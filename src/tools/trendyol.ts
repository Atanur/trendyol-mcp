import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { getPage } from '../browser.js';
import { config } from '../config.js';
import { buildSnapshot, formatSnapshot } from '../snapshot.js';
import { dismissConsent, settle } from '../dom.js';
import { scrapeFilterGroups, scrapeProducts, scrapeProductDetail } from '../trendyol/scrape.js';
import { CATEGORY_ROLE_HINTS } from '../wardrobe/logic.js';
import { getReviewInsights } from '../reviewinsights.js';
import { parsePrice, productKey } from '../util.js';
import {
  applyFilters,
  applyPriceRange,
  applySort,
  collectPages,
  loadMore,
  openCategory,
  openProduct,
  performSearch,
  prepareFilters,
  resolveCategory,
} from '../trendyol/actions.js';
import { errorResult, jsonResult, textResult } from '../util.js';
import { createProgress } from '../progress.js';
import { annotatePersonalSafe } from './personal.js';

const SORT_KEYS = [
  'best_sellers',
  'most_reviewed',
  'highest_rating',
  'price_asc',
  'price_desc',
  'newest',
  'relevance',
] as const;

export function registerTrendyolTools(server: McpServer): void {
  server.registerTool(
    'trendyol_home',
    {
      title: 'Open Trendyol home',
      description: 'Open https://www.trendyol.com in the visible browser and return a snapshot of the page.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const page = await getPage();
        await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });
        await settle(page);
        await dismissConsent(page);
        const items = await buildSnapshot(page);
        return textResult(formatSnapshot(items, { url: page.url(), title: await page.title() }));
      } catch (error) {
        return errorResult(`trendyol_home başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_get_filter_options',
    {
      title: 'Read left-panel filter options',
      description:
        'Open a category (default men clothing), expand the left filter groups (category, brand, gender, size, color, price, ...) and return every available option. Use the labels with trendyol_search_products (filters) or with browser_click.',
      inputSchema: z.object({
        category_url: z.string().optional().describe('Defaults to men clothing category.'),
        gender: z.string().optional().describe('"Erkek" or "Kadın" — selects the matching category when category_url is omitted.'),
        expand: z.boolean().optional().describe('Expand collapsed groups + "Daha fazla" first (default true).'),
      }),
    },
    async ({ category_url, gender, expand }) => {
      try {
        const page = await getPage();
        await openCategory(page, await resolveCategory(page, { category_url, gender }));
        const expansion = (expand ?? true) ? await prepareFilters(page) : { expandedGroups: 0, expandedMore: 0 };
        const groups = await page.evaluate(scrapeFilterGroups);
        const quickFilters = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.quick-filter')).map((el) =>
            (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
          ),
        );
        return jsonResult({ url: page.url(), expansion, quickFilters, groups });
      } catch (error) {
        return errorResult(`get_filter_options başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_search_products',
    {
      title: 'Search products by UI (filters + sort + pages)',
      description:
        'Drive the real UI: open the category (and/or type in the search box), click gender/brand/category/size/color filters, apply a price range, apply a sort (best sellers / most reviewed / ...), walk through N result pages, then scrape the products. Everything happens in the visible browser so the user can watch.',
      inputSchema: z.object({
        query: z.string().optional().describe('Optional search text typed into the search box.'),
        category_url: z.string().optional().describe('Defaults to men clothing category.'),
        filters: z.array(z.string()).optional().describe('Left-panel option labels to click (multiple values allowed, e.g. several brands/sizes/colors).'),
        gender: z.string().optional().describe('Gender filter label, e.g. "Erkek" or "Kadın".'),
        price_min: z.number().optional().describe('Minimum price in TRY (left "Fiyat" filter).'),
        price_max: z.number().optional().describe('Maximum price in TRY.'),
        sort: z
          .enum(SORT_KEYS)
          .optional()
          .describe('best_sellers, most_reviewed, highest_rating, price_asc, price_desc, newest, relevance.'),
        quick_filters: z
          .array(z.string())
          .optional()
          .describe('Quick filter chips above the grid, e.g. "Yüksek Puanlı Ürünler", "Flaş Ürünler", "Kargo Bedava".'),
        expand_filters: z.boolean().optional().describe('Reveal hidden filter options first (default true).'),
        pages: z.number().int().min(1).max(20).optional().describe('How many result pages to walk (default 1).'),
        limit: z.number().int().min(1).max(200).optional().describe('Max products to return (default 24).'),
        open_first: z.boolean().optional().describe('Open the first product after scraping.'),
        scroll_rounds: z.number().int().min(0).max(6).optional().describe('Extra lazy-load scrolls per page (default 1).'),
        with_insights: z.boolean().optional().describe('Attach saved review insights (sizing/quality) to each product when available.'),
        kisisel: z
          .boolean()
          .optional()
          .describe('Sonuçları kullanıcının profiline göre işaretle (varsayılan true): her ürüne kisisel = {skor, karar uygun/dikkat/eleme, uyarilar, bedenOnerisi} eklenir. Sıralama değişmez.'),
        rol: z.enum(['ust', 'alt', 'tekParca', 'katman', 'dis', 'ayakkabi', 'aksesuar']).optional().describe('Beden önerisi için aranan parçanın rolü.'),
      }),
    },
    async ({
      query,
      category_url,
      filters,
      gender,
      price_min,
      price_max,
      sort,
      quick_filters,
      expand_filters,
      pages,
      limit,
      open_first,
      scroll_rounds,
      with_insights,
      kisisel,
      rol,
    }, ctx) => {
      const step = createProgress(ctx, 3);
      try {
        await step('Trendyol açılıyor');
        const page = await getPage();
        const categoryUrl = await resolveCategory(page, { category_url, gender });
        await openCategory(page, categoryUrl);

        const steps: Record<string, unknown> = {};
        await step(query ? `"${query}" aranıyor, filtreler uygulanıyor` : 'Filtreler uygulanıyor');
        if (query) steps.searched = await performSearch(page, query);

        const labels = [...(filters ?? [])];
        if (gender && category_url) labels.push(gender);
        if (labels.length > 0) {
          if (expand_filters ?? true) steps.expansion = await prepareFilters(page);
          steps.filters = await applyFilters(page, labels);
        }

        if (price_min !== undefined || price_max !== undefined) {
          steps.priceRange = {
            applied: await applyPriceRange(page, price_min, price_max),
            min: price_min,
            max: price_max,
          };
        }

        if (quick_filters && quick_filters.length > 0) {
          steps.quickFilters = [];
          for (const chip of quick_filters) {
            const ok = await selectQuickFilter(page, chip);
            (steps.quickFilters as unknown[]).push({ chip, clicked: ok });
          }
        }

        if (sort) steps.sortApplied = await applySort(page, sort);

        await step('Ürünler okunuyor');
        const products = await collectProducts(page, {
          pages: pages ?? 1,
          limit: limit ?? 24,
          scrollRounds: scroll_rounds ?? 1,
        });
        const enriched = with_insights ? await annotateInsights(products) : products;
        const personal = kisisel === false ? undefined : await annotatePersonalSafe(enriched, { gender, rol, butceMax: price_max });
        const results = personal?.ok ? personal.products : enriched;
        const personalSummary = !personal ? {} : personal.ok ? { kisiselOzet: personal.summary } : { kisiselHata: personal.hata };

        if (open_first && results[0]) {
          await openProduct(page, { url: results[0].url });
          const { scrapeProductDetail } = await import('../trendyol/scrape.js');
          const detail = await page.evaluate(scrapeProductDetail);
          return jsonResult({ url: page.url(), steps, count: results.length, products: results, opened: detail, ...personalSummary });
        }

        return jsonResult({ url: page.url(), steps, count: results.length, products: results, ...personalSummary });
      } catch (error) {
        return errorResult(`search_products başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_get_products',
    {
      title: 'Scrape products on the current listing',
      description: 'Extract product cards from the current listing/search page. Optionally apply a sort and walk pages.',
      inputSchema: z.object({
        sort: z.enum(SORT_KEYS).optional(),
        pages: z.number().int().min(1).max(20).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        with_insights: z.boolean().optional().describe('Attach saved review insights to each product when available.'),
      }),
    },
    async ({ sort, pages, limit, with_insights }) => {
      try {
        const page = await getPage();
        let sortApplied: boolean | undefined;
        if (sort) sortApplied = await applySort(page, sort);
        const products = await collectProducts(page, { pages: pages ?? 1, limit: limit ?? 24, scrollRounds: 1 });
        const results = with_insights ? await annotateInsights(products) : products;
        return jsonResult({ url: page.url(), sortApplied, count: results.length, products: results });
      } catch (error) {
        return errorResult(`get_products başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_open_product',
    {
      title: 'Open a product and read its details',
      description: 'Click a product (by snapshot ref or URL) and return its title, price, brand, rating, seller, variants and attributes.',
      inputSchema: z.object({
        ref: z.string().optional().describe('Product ref from a snapshot.'),
        url: z.string().optional().describe('Product URL to open instead.'),
      }),
    },
    async ({ ref, url }) => {
      try {
        const page = await getPage();
        await openProduct(page, { ref, url });
        const { scrapeProductDetail } = await import('../trendyol/scrape.js');
        const detail = await page.evaluate(scrapeProductDetail);
        return jsonResult({ detail });
      } catch (error) {
        return errorResult(`open_product başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_find_similar',
    {
      title: 'Find similar alternatives',
      description:
        'From a product, search the same brand + garment type and return similar alternatives, optionally cheaper ones, ranked by rating and price.',
      inputSchema: z.object({
        url: z.string().optional(),
        ref: z.string().optional(),
        cheaper_only: z.boolean().optional().describe('Only return cheaper alternatives.'),
        limit: z.number().int().min(1).max(40).optional(),
      }),
    },
    async ({ url, ref, cheaper_only, limit }) => {
      try {
        const page = await getPage();
        await openProduct(page, { ref, url });
        const detail = await page.evaluate(scrapeProductDetail);
        const currentPrice = parsePrice(detail.price ?? undefined);
        const title = (detail.title ?? '').toLocaleLowerCase('tr-TR');
        const terms = CATEGORY_ROLE_HINTS.flatMap((h) => h.terms);
        const term = terms.find((t) => title.includes(t.toLocaleLowerCase('tr-TR'))) ?? '';
        const gender = /kadın|kadin/.test(title) ? 'kadın' : /erkek/.test(title) ? 'erkek' : '';
        const query = `${detail.brand ?? ''} ${term} ${gender}`.replace(/\s+/g, ' ').trim() || (detail.title ?? '').split(' ').slice(0, 3).join(' ');

        await performSearch(page, query);
        const products = await page.evaluate(scrapeProducts, (limit ?? 12) * 2);
        let alternatives = products.filter((p) => p.url !== detail.url);
        if (cheaper_only && currentPrice !== undefined) {
          alternatives = alternatives.filter((p) => {
            const value = parsePrice(p.price);
            return value !== undefined && value < currentPrice;
          });
        }
        const ranked = alternatives
          .map((p) => {
            const value = parsePrice(p.price);
            return { ...p, priceDelta: value !== undefined && currentPrice !== undefined ? value - currentPrice : undefined };
          })
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (parsePrice(a.price) ?? Infinity) - (parsePrice(b.price) ?? Infinity))
          .slice(0, limit ?? 12);

        const insightStore = getReviewInsights();
        const withInsights = await Promise.all(
          ranked.map(async (p) => {
            const insight = await insightStore.get(p.url);
            return insight
              ? { ...p, reviewInsight: { sizing: insight.sizing.verdict, qualityScore: insight.qualityScore } }
              : p;
          }),
        );

        return jsonResult({
          base: { title: detail.title, brand: detail.brand, price: detail.price, fabric: detail.fabric, fit: detail.fit },
          query,
          count: withInsights.length,
          alternatives: withInsights,
        });
      } catch (error) {
        return errorResult(`find_similar başarısız: ${(error as Error).message}`);
      }
    },
  );
}

async function annotateInsights<T extends { url: string }>(products: T[]): Promise<Array<T & { reviewInsight?: unknown }>> {
  const entries = await getReviewInsights().list();
  const map = new Map(entries.map((e) => [productKey(e.url), e]));
  return products.map((product) => {
    const insight = map.get(productKey(product.url));
    return insight
      ? { ...product, reviewInsight: { sizing: insight.sizing.verdict, qualityScore: insight.qualityScore } }
      : product;
  });
}

async function selectQuickFilter(page: import('playwright').Page, chip: string): Promise<boolean> {  const scoped = page.locator('.quick-filter', { hasText: chip });
  const target = (await scoped.count()) > 0 ? scoped.first() : null;
  if (target) {
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    await target.click().catch(() => undefined);
    await settle(page, 800);
    return true;
  }
  const { clickByText } = await import('../dom.js');
  return clickByText(page, chip, { exact: false });
}

async function collectProducts(
  page: import('playwright').Page,
  options: { pages: number; limit: number; scrollRounds: number },
): Promise<ReturnType<typeof scrapeProducts>> {
  await loadMore(page, options.scrollRounds);
  const collected: ReturnType<typeof scrapeProducts> = [];
  const seen = new Set<string>();

  for (let pageIndex = 0; pageIndex < options.pages; pageIndex += 1) {
    const batch = await page.evaluate(scrapeProducts, options.limit);
    for (const product of batch) {
      if (seen.has(product.url)) continue;
      seen.add(product.url);
      collected.push(product);
      if (collected.length >= options.limit) return collected;
    }
    if (pageIndex < options.pages - 1) {
      const used = await collectPages(page, 2);
      if (used < 2) break;
      await loadMore(page, options.scrollRounds);
    }
  }
  return collected;
}
