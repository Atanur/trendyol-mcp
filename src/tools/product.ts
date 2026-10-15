import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { getPage } from '../browser.js';
import { settle } from '../dom.js';
import { scrapeProductDetail, scrapeReviews } from '../trendyol/scrape.js';
import { analyzeLens } from '../trendyol/lens.js';
import { analyzeAuthenticity } from '../trendyol/authenticity.js';
import { getReviewInsights, type ReviewInsight } from '../reviewinsights.js';
import { openProduct } from '../trendyol/actions.js';
import { errorResult, jsonResult } from '../util.js';

async function openReviewsSection(page: import('playwright').Page): Promise<void> {
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.6 }));
  await settle(page, 700);
  for (const label of ['Tüm Yorumları Gör', 'Tüm değerlendirmeleri gör', 'Tümünü Gör', 'Değerlendirmeleri Gör']) {
    const button = await page.getByText(label, { exact: false }).first().isVisible().catch(() => false);
    if (button) {
      await page.getByText(label, { exact: false }).first().click().catch(() => undefined);
      await settle(page, 1200);
      return;
    }
  }
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
  await settle(page, 900);
}

export function registerProductTools(server: McpServer): void {
  server.registerTool(
    'trendyol_product_detail',
    {
      title: 'Read product detail',
      description:
        'Open a product (by snapshot ref or URL) and return normalized details: title, price, brand, rating, seller (+rating), size/color variants with availability, images, attributes and cargo info.',
      inputSchema: z.object({
        ref: z.string().optional(),
        url: z.string().optional(),
        screenshot: z.boolean().optional(),
      }),
    },
    async ({ ref, url, screenshot }) => {
      try {
        const page = await getPage();
        await openProduct(page, { ref, url });
        const detail = await page.evaluate(scrapeProductDetail);
        const result = jsonResult({ detail });
        if (screenshot) {
          const buffer = await page.screenshot({ type: 'jpeg', quality: 50 });
          result.content.push({ type: 'image', data: buffer.toString('base64'), mimeType: 'image/jpeg' });
        }
        return result;
      } catch (error) {
        return errorResult(`product_detail başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_product_reviews',
    {
      title: 'Read product reviews',
      description:
        'Open a product, expand its reviews and return review texts plus aggregate stats (average, distribution, recurring keywords) to summarize pros/cons and sizing feedback.',
      inputSchema: z.object({
        ref: z.string().optional(),
        url: z.string().optional(),
        limit: z.number().int().min(1).max(80).optional().describe('Max reviews to return (default 20).'),
        scroll_rounds: z.number().int().min(0).max(10).optional().describe('Scroll cycles while loading reviews (default 3).'),
      }),
    },
    async ({ ref, url, limit, scroll_rounds }) => {
      try {
        const page = await getPage();
        await openProduct(page, { ref, url });
        await openReviewsSection(page);
        const rounds = scroll_rounds ?? 3;
        for (let i = 0; i < rounds; i += 1) {
          await page.mouse.wheel(0, 1400);
          await settle(page, 600);
        }
        const summary = await page.evaluate(scrapeReviews, limit ?? 20);
        return jsonResult({ summary });
      } catch (error) {
        return errorResult(`product_reviews başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_analyze_reviews',
    {
      title: 'Analyze review complaints',
      description:
        'Open a product, expand its reviews and quantify feedback: sizing bias (dar/bol/tam), quality complaints (ince kumaş, dikiş, koku, çekme, sentetik...), a quality score and Trendyol\'s own AI summary.',
      inputSchema: z.object({
        ref: z.string().optional(),
        url: z.string().optional(),
        limit: z.number().int().min(5).max(120).optional().describe('Reviews to analyze (default 40).'),
        scroll_rounds: z.number().int().min(0).max(12).optional().describe('Scroll cycles while loading reviews (default 4).'),
        save: z.boolean().optional().describe('Persist the analysis to the local review-insights store (default true).'),
      }),
    },
    async ({ ref, url, limit, scroll_rounds, save }) => {
      try {
        const page = await getPage();
        await openProduct(page, { ref, url });
        await openReviewsSection(page);
        const rounds = scroll_rounds ?? 4;
        for (let i = 0; i < rounds; i += 1) {
          await page.mouse.wheel(0, 1400);
          await settle(page, 600);
        }
        const summary = await page.evaluate(scrapeReviews, limit ?? 40);
        const lens = analyzeLens(summary.reviews);
        const authenticity = analyzeAuthenticity(summary.reviews);
        const detail = await page.evaluate(scrapeProductDetail);

        const insight: ReviewInsight = {
          url: summary.url,
          title: detail.title,
          brand: detail.brand,
          savedAt: new Date().toISOString(),
          averageRating: summary.averageRating,
          totalCount: summary.totalCount,
          qualityScore: lens.qualityScore,
          sizing: lens.sizing,
          complaints: lens.complaints,
          aiSummary: summary.aiSummary,
          keywords: summary.keywords,
          authenticity,
        };
        const persisted = save ?? true;
        if (persisted) await getReviewInsights().save(insight);
        return jsonResult({ ...insight, saved: persisted });
      } catch (error) {
        return errorResult(`analyze_reviews başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_review_insights',
    {
      title: 'Saved review insights',
      description:
        'Read the locally saved review analyses (sizing bias, complaints, quality score, AI summary) for one product or all.',
      inputSchema: z.object({
        action: z.enum(['list', 'get', 'remove']),
        url: z.string().optional(),
      }),
    },
    async ({ action, url }) => {
      const store = getReviewInsights();
      if (action === 'list') {
        const entries = await store.list();
        return jsonResult({
          count: entries.length,
          items: entries.map((e) => ({
            url: e.url,
            title: e.title,
            brand: e.brand,
            savedAt: e.savedAt,
            averageRating: e.averageRating,
            qualityScore: e.qualityScore,
            sizing: e.sizing.verdict,
            topComplaint: e.complaints[0]?.label,
          })),
        });
      }
      if (!url) return errorResult(`${action} için url gerekli.`);
      if (action === 'remove') return jsonResult({ removed: await store.remove(url) });
      const insight = await store.get(url);
      return insight ? jsonResult({ insight }) : errorResult('Bu ürün için kayıtlı analiz yok.');
    },
  );

  server.registerTool(
    'trendyol_seller_check',
    {
      title: 'Check the seller',
      description: 'Open a product and report the seller name/rating, cargo and return policy with risk flags (low seller rating, missing return info, paid shipping).',
      inputSchema: z.object({
        ref: z.string().optional(),
        url: z.string().optional(),
      }),
    },
    async ({ ref, url }) => {
      try {
        const page = await getPage();
        await openProduct(page, { ref, url });
        const detail = await page.evaluate(scrapeProductDetail);
        const flags: string[] = [];
        if (detail.sellerRating !== undefined && detail.sellerRating < 4) flags.push('Satıcı puanı düşük (<4).');
        if (!detail.returnInfo) flags.push('İade bilgisi bulunamadı.');
        const freeCargo = (detail.cargo ?? []).some((c) => /bedava|ücretsiz/i.test(c));
        if (!freeCargo) flags.push('Ücretsiz kargo görünmüyor.');

        const insight = await getReviewInsights().get(detail.url);
        const reviewQuality = insight?.qualityScore;
        let risk = 0;
        if (detail.sellerRating !== undefined && detail.sellerRating < 4) risk += 30;
        if (!detail.returnInfo) risk += 20;
        if (!freeCargo) risk += 15;
        if (reviewQuality !== undefined && reviewQuality < 50) risk += 25;
        if (detail.rating !== undefined && detail.rating < 3.5) risk += 10;
        risk = Math.min(100, risk);
        const riskLevel = risk >= 50 ? 'yüksek' : risk >= 25 ? 'orta' : 'düşük';

        return jsonResult({
          url: detail.url,
          seller: detail.seller,
          sellerRating: detail.sellerRating,
          freeCargo,
          cargo: detail.cargo,
          returnInfo: detail.returnInfo,
          productRating: detail.rating,
          reviews: detail.reviews,
          reviewQuality,
          riskScore: risk,
          riskLevel,
          price: detail.price,
          flags,
        });
      } catch (error) {
        return errorResult(`seller_check başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_compare_products',
    {
      title: 'Compare several products',
      description: 'Open a list of product URLs one by one and return their normalized details side by side (for picking the best seller/price).',
      inputSchema: z.object({
        urls: z.array(z.string()).min(2).max(8),
      }),
    },
    async ({ urls }) => {
      try {
        const page = await getPage();
        const store = getReviewInsights();
        const items: unknown[] = [];
        for (const url of urls) {
          await openProduct(page, { url });
          const detail = await page.evaluate(scrapeProductDetail);
          const insight = await store.get(detail.url);
          items.push({ ...detail, reviewInsight: insight ?? null });
        }
        return jsonResult({ count: items.length, items });
      } catch (error) {
        return errorResult(`compare_products başarısız: ${(error as Error).message}`);
      }
    },
  );
}
