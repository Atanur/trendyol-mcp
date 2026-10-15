import * as z from 'zod/v4';
import { getPage } from '../browser.js';
import { settle } from '../dom.js';
import { CATEGORY_ROLE_HINTS } from '../wardrobe/logic.js';
import { getStore } from '../store.js';
import { getReviewInsights } from '../reviewinsights.js';
import { analyzeAuthenticity } from '../trendyol/authenticity.js';
import { analyzeLens } from '../trendyol/lens.js';
import { scrapeProductDetail, scrapeProducts, scrapeReviews } from '../trendyol/scrape.js';
import { openProduct, performSearch } from '../trendyol/actions.js';
import { errorResult, jsonResult, parsePrice } from '../util.js';
async function openReviews(page) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.55 }));
    await settle(page, 800);
    for (const label of ['Tüm Yorumları Gör', 'Tüm değerlendirmeleri gör', 'Tümünü Gör']) {
        const button = page.getByText(label, { exact: false }).first();
        if (await button.isVisible().catch(() => false)) {
            await button.click().catch(() => undefined);
            await settle(page, 1200);
            return;
        }
    }
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await settle(page, 900);
}
export function registerEvaluateTool(server) {
    server.registerTool('trendyol_evaluate_product', {
        title: 'Evaluate a product (all-in-one)',
        description: 'Given a product URL, gather everything needed for a verdict in one call: detail, reviews (sizing/complaints + AI summary + fake-review signals), seller risk, price/discount (incl. son 10 günün en düşüğü) and similar alternatives for comparison. Returns structured data + verdict hints; the model makes the final judgement.',
        inputSchema: z.object({
            url: z.string(),
            similar_limit: z.number().int().min(0).max(10).optional().describe('How many similar alternatives to include (default 4).'),
            review_limit: z.number().int().min(5).max(80).optional().describe('Reviews to analyze (default 30).'),
        }),
    }, async ({ url, similar_limit, review_limit }) => {
        try {
            const page = await getPage();
            await openProduct(page, { url });
            const detail = await page.evaluate(scrapeProductDetail);
            // Reviews + authenticity
            await openReviews(page);
            for (let i = 0; i < 3; i += 1) {
                await page.mouse.wheel(0, 1400);
                await settle(page, 500);
            }
            const reviewSummary = await page.evaluate(scrapeReviews, review_limit ?? 30);
            const lens = analyzeLens(reviewSummary.reviews);
            const authenticity = analyzeAuthenticity(reviewSummary.reviews);
            // Seller risk
            const flags = [];
            if (detail.sellerRating !== undefined && detail.sellerRating < 4)
                flags.push('Satıcı puanı düşük.');
            if (!detail.returnInfo)
                flags.push('İade bilgisi yok.');
            const freeCargo = (detail.cargo ?? []).some((c) => /bedava|ücretsiz/i.test(c));
            if (!freeCargo)
                flags.push('Ücretsiz kargo görünmüyor.');
            let risk = 0;
            if (detail.sellerRating !== undefined && detail.sellerRating < 4)
                risk += 30;
            if (!detail.returnInfo)
                risk += 20;
            if (!freeCargo)
                risk += 15;
            if (lens.qualityScore < 50)
                risk += 25;
            if (authenticity.authenticityScore < 60)
                risk += 20;
            // Discount
            const current = parsePrice(detail.price ?? undefined);
            const listPrice = parsePrice(detail.originalPrice ?? undefined);
            const watch = await getStore().get(detail.url);
            const history = (watch?.history ?? []).map((h) => h.price);
            // Similar alternatives
            const term = CATEGORY_ROLE_HINTS.flatMap((h) => h.terms).find((t) => (detail.title ?? '').toLocaleLowerCase('tr-TR').includes(t.toLocaleLowerCase('tr-TR')));
            const gender = /kadın|kadin/.test((detail.title ?? '').toLowerCase()) ? 'kadın' : 'erkek';
            const query = `${detail.brand ?? ''} ${term ?? ''} ${gender}`.replace(/\s+/g, ' ').trim();
            let similar = [];
            if ((similar_limit ?? 4) > 0 && query) {
                await performSearch(page, query);
                const products = await page.evaluate(scrapeProducts, (similar_limit ?? 4) * 3);
                const insightStore = getReviewInsights();
                similar = products
                    .filter((p) => p.url !== detail.url)
                    .slice(0, similar_limit ?? 4)
                    .map((p) => {
                    const value = parsePrice(p.price);
                    return {
                        title: p.title,
                        price: p.price,
                        priceDelta: value !== undefined && current !== undefined ? value - current : undefined,
                        rating: p.rating,
                        url: p.url,
                    };
                });
                void insightStore;
            }
            return jsonResult({
                product: {
                    title: detail.title,
                    brand: detail.brand,
                    price: detail.price,
                    originalPrice: detail.originalPrice,
                    lowestPrice10d: detail.lowestPrice10d,
                    lowestPrice10dLabel: detail.lowestPrice10dLabel,
                    rating: detail.rating,
                    reviews: detail.reviews,
                    fit: detail.fit,
                    fabric: detail.fabric,
                    fabricType: detail.fabricType,
                    color: detail.color,
                    sizes: detail.sizes,
                    seller: detail.seller,
                    sellerRating: detail.sellerRating,
                    returnInfo: detail.returnInfo,
                    cargo: detail.cargo,
                    url: detail.url,
                },
                reviews: {
                    averageRating: reviewSummary.averageRating,
                    totalCount: reviewSummary.totalCount,
                    aiSummary: reviewSummary.aiSummary,
                    sizing: lens.sizing,
                    complaints: lens.complaints,
                    qualityScore: lens.qualityScore,
                    authenticity,
                    samples: reviewSummary.reviews.slice(0, 6),
                },
                seller: { freeCargo, flags, riskScore: Math.min(100, risk), riskLevel: risk >= 50 ? 'yüksek' : risk >= 25 ? 'orta' : 'düşük' },
                price: {
                    current,
                    listPrice,
                    discountPct: current && listPrice ? Math.round((1 - current / listPrice) * 100) : undefined,
                    recordedPoints: history.length,
                    min: history.length ? Math.min(...history) : undefined,
                    max: history.length ? Math.max(...history) : undefined,
                },
                similar,
                verdictHints: [
                    'Yorum sahtelik sinyalleri: authenticity.fakeRatio ve flagged incele; yüksekse puanı şüpheyle karşıla.',
                    'Kalıp: lens.sizing.verdict (dar/bol/tam) → beden önerisi.',
                    'Kumaş/mevsim: fabric/fabricType ile isteğe uygunluğu doğrula.',
                    'Fiyat: discountPct + lowestPrice10d ile "gerçek indirim mi" kontrol et.',
                    'Benzer ürünlerle fiyat/kalite kıyası yap (similar).',
                ],
            });
        }
        catch (error) {
            return errorResult(`evaluate_product başarısız: ${error.message}`);
        }
    });
}
//# sourceMappingURL=evaluate.js.map