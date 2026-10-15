import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { getPage } from '../browser.js';
import { getWardrobe } from '../wardrobe/db.js';
import { budgetBasket, generateGaps, impulseGuard, shoppingOrder } from '../wardrobe/logic.js';
import { getReviewInsights } from '../reviewinsights.js';
import { scrapeProductDetail } from '../trendyol/scrape.js';
import { openProduct } from '../trendyol/actions.js';
import { profileNote } from '../wardrobe/profile.js';
import { errorResult, jsonResult, parsePrice, productKey } from '../util.js';

const ROLE = ['ust', 'alt', 'tekParca', 'katman', 'dis', 'ayakkabi', 'aksesuar'] as const;

export function registerShoppingTools(server: McpServer): void {
  server.registerTool(
    'budget_basket',
    {
      title: 'Budget basket',
      description:
        'Sum a basket (given directly or from product URLs), show category shares and whether it stays within the budget.',
      inputSchema: z.object({
        lines: z.array(z.object({ ad: z.string(), fiyat: z.union([z.number(), z.string()]).optional(), kategori: z.string().optional(), rol: z.enum(ROLE).optional(), url: z.string().optional() })).optional(),
        urls: z.array(z.string()).optional().describe('Product URLs to price automatically.'),
        budget: z.number().optional(),
      }),
    },
    async ({ lines, urls, budget }) => {
      try {
        const collected: Array<{ ad: string; kategori?: string; rol?: (typeof ROLE)[number]; fiyat: number; url?: string }> = [];
        for (const line of lines ?? []) {
          const value = typeof line.fiyat === 'string' ? parsePrice(line.fiyat) : line.fiyat;
          collected.push({ ad: line.ad, kategori: line.kategori, rol: line.rol, fiyat: value ?? 0, url: line.url });
        }
        if (urls?.length) {
          const page = await getPage();
          for (const url of urls) {
            await openProduct(page, { url });
            const detail = await page.evaluate(scrapeProductDetail);
            const value = parsePrice(detail.price ?? undefined) ?? 0;
            collected.push({ ad: detail.title ?? url, fiyat: value, url: detail.url });
          }
        }
        const profile = await getWardrobe().getProfile();
        const result = budgetBasket(collected, budget ?? profile.butce);

        const insights = await getReviewInsights().list();
        const map = new Map(insights.map((i) => [productKey(i.url), i]));
        const warnings: Array<{ ad: string; reason: string }> = [];
        for (const line of collected) {
          if (!line.url) continue;
          const insight = map.get(productKey(line.url));
          if (!insight) continue;
          if (insight.qualityScore < 50) warnings.push({ ad: line.ad, reason: `Yorum kalitesi düşük (${insight.qualityScore}).` });
          if (/dar/i.test(insight.sizing.verdict ?? '')) warnings.push({ ad: line.ad, reason: `Kalıp: ${insight.sizing.verdict}` });
        }

        return jsonResult({ ...result, lines: collected, warnings, ...profileNote(profile) });
      } catch (error) {
        return errorResult(`budget_basket başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'shopping_order',
    {
      title: 'Plan the shopping order',
      description: 'Order the gap list by priority and stock urgency (put soon-to-sell-out pieces first).',
      inputSchema: z.object({
        urgent_roles: z.array(z.enum(ROLE)).optional().describe('Roles that are urgent (e.g. low stock / season start).'),
      }),
    },
    async ({ urgent_roles }) => {
      const store = getWardrobe();
      const [items, profile] = await Promise.all([store.listItems(), store.getProfile()]);
      const gaps = generateGaps(profile, items);
      const ordered = shoppingOrder(gaps, (urgent_roles ?? []) as never);
      return jsonResult({ order: ordered.map((g, index) => ({ sira: index + 1, ...g })) });
    },
  );

  server.registerTool(
    'impulse_guard',
    {
      title: 'Impulse guard',
      description:
        'Before adding a product to the cart: check whether it is on the gap list, whether a similar piece already exists, and whether it stays within budget.',
      inputSchema: z.object({
        candidate: z.object({
          rol: z.enum(ROLE),
          renk: z.string(),
          fiyat: z.number().optional(),
          url: z.string().optional().describe('Ürün URL\'si; kayıtlı yorum analizi varsa uyarıya eklenir.'),
        }),
        basket_total: z.number().optional(),
      }),
    },
    async ({ candidate, basket_total }) => {
      const store = getWardrobe();
      const [items, profile] = await Promise.all([store.listItems(), store.getProfile()]);
      const gaps = generateGaps(profile, items);
      const result = impulseGuard(candidate, { items, gaps, profile, basketTotal: basket_total });
      let { verdict } = result;
      const reasons = [...result.reasons];
      if (candidate.url) {
        const insight = await getReviewInsights().get(candidate.url);
        if (insight) {
          reasons.push(`Kayıtlı yorum analizi: ${insight.sizing.verdict ?? 'beden bilgisi yok'} (kalite ${insight.qualityScore}).`);
          if (/dar/i.test(insight.sizing.verdict ?? '') && verdict === 'al') verdict = 'bekle';
          if (insight.qualityScore < 40 && verdict === 'al') verdict = 'bekle';
        }
      }
      return jsonResult({ verdict, reasons, candidate, ...profileNote(profile) });
    },
  );
}
