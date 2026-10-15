import * as z from 'zod/v4';
import { getPage } from '../browser.js';
import { getWardrobe } from '../wardrobe/db.js';
import { openProduct } from '../trendyol/actions.js';
import { settle } from '../dom.js';
import { errorResult, jsonResult } from '../util.js';
export function registerOpsTools(server) {
    server.registerTool('coupon_tracker', {
        title: 'Collect coupons/campaigns',
        description: 'Scan the current page (or open the cart/product) for coupons, campaign and discount texts and list them.',
        inputSchema: z.object({
            source: z.enum(['cart', 'current', 'product']).optional().describe('Where to scan (default: current page).'),
            url: z.string().optional(),
        }),
    }, async ({ source, url }) => {
        try {
            const page = await getPage();
            if (source === 'cart') {
                await page.goto('https://www.trendyol.com/sepetim', { waitUntil: 'domcontentloaded' });
                await settle(page, 1500);
            }
            else if (source === 'product' || url) {
                await openProduct(page, { url });
            }
            const found = await page.evaluate(() => {
                const seen = new Set();
                const out = [];
                const nodes = document.querySelectorAll('[class*="coupon" i], [class*="kupon" i], [class*="campaign" i], [class*="promotion" i], [class*="discount" i], [class*="indirim" i]');
                nodes.forEach((el) => {
                    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
                    if (!text || text.length > 90 || seen.has(text))
                        return;
                    const code = text.match(/\b([A-Z0-9]{5,12})\b/)?.[1];
                    seen.add(text);
                    out.push({ ad: text, kod: code, kaynak: (typeof el.className === 'string' ? el.className : '').slice(0, 30) });
                });
                return out.slice(0, 25);
            });
            const store = getWardrobe();
            for (const coupon of found)
                await store.addCoupon({ ad: coupon.ad, kod: coupon.kod, kaynak: coupon.kaynak });
            return jsonResult({ url: page.url(), count: found.length, coupons: found });
        }
        catch (error) {
            return errorResult(`coupon_tracker başarısız: ${error.message}`);
        }
    });
    server.registerTool('return_tracker', {
        title: 'Track returns',
        description: 'List purchases with their return window and mark items as returned.',
        inputSchema: z.object({
            action: z.enum(['list', 'mark']).optional().describe('Default: list.'),
            id: z.string().optional(),
            returned: z.boolean().optional(),
        }),
    }, async ({ action, id, returned }) => {
        const store = getWardrobe();
        if (action === 'mark') {
            if (!id)
                return errorResult('mark için id gerekli.');
            const purchase = await store.markReturn(id, returned ?? true);
            return purchase ? jsonResult({ purchase }) : errorResult(`purchase bulunamadı: ${id}`);
        }
        const purchases = await store.listPurchases();
        const today = Date.now();
        const rows = purchases.map((p) => {
            const deadline = new Date(p.iadeSonTarih).getTime();
            const daysLeft = Math.ceil((deadline - today) / 86_400_000);
            return {
                id: p.id,
                ad: p.ad,
                fiyat: p.fiyat,
                alimTarihi: p.alimTarihi,
                iadeSonTarih: p.iadeSonTarih,
                daysLeft,
                iadeEdildi: p.iadeEdildi ?? false,
                status: p.iadeEdildi ? 'iade edildi' : daysLeft < 0 ? 'süre doldu' : daysLeft <= 3 ? 'son günler' : 'aktif',
            };
        });
        return jsonResult({ count: rows.length, rows });
    });
    server.registerTool('review_photo_summary', {
        title: 'Extract review photos',
        description: 'Collect the customer photos from a product\'s reviews (URLs + count). Visual color/fit analysis needs a vision model — use `screenshot` + reviews as input for that.',
        inputSchema: z.object({
            url: z.string().optional(),
            ref: z.string().optional(),
            limit: z.number().int().min(1).max(60).optional(),
        }),
    }, async ({ url, ref, limit }) => {
        try {
            const page = await getPage();
            await openProduct(page, { ref, url });
            await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.6 }));
            await settle(page, 1000);
            for (let i = 0; i < 3; i += 1) {
                await page.mouse.wheel(0, 1400);
                await settle(page, 500);
            }
            const photos = await page.evaluate((max) => {
                const out = [];
                document.querySelectorAll('.review-review img, [class*="review" i] img, [class*="comment" i] img').forEach((img) => {
                    const src = img.getAttribute('src') ?? img.getAttribute('data-src') ?? '';
                    if (src && !out.includes(src) && (src.includes('cdn') || src.includes('trendyol')))
                        out.push(src);
                });
                return out.slice(0, max);
            }, limit ?? 20);
            return jsonResult({ count: photos.length, photos });
        }
        catch (error) {
            return errorResult(`review_photo_summary başarısız: ${error.message}`);
        }
    });
}
//# sourceMappingURL=ops.js.map