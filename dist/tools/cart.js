import * as z from 'zod/v4';
import { getPage } from '../browser.js';
import { config } from '../config.js';
import { clickByText, dismissConsent, firstVisible, settle } from '../dom.js';
import { openProduct } from '../trendyol/actions.js';
import { errorResult, jsonResult } from '../util.js';
async function cartCount(page) {
    const badge = await firstVisible(page.locator('[class*="basket" i] [class*="count" i], [class*="cart" i] [class*="count" i], [data-testid*="basket" i]'));
    if (!badge)
        return undefined;
    const text = (await badge.textContent().catch(() => '')) ?? '';
    const match = text.match(/(\d{1,3})/);
    return match ? Number.parseInt(match[1], 10) : undefined;
}
async function selectSize(page, size) {
    const scopes = [
        page.locator('[class*="size" i], [class*="variant" i], [class*="option" i]', { hasText: size }),
    ];
    for (const scope of scopes) {
        const elements = scope.locator('button, a, div, span, li');
        const count = await elements.count().catch(() => 0);
        for (let i = 0; i < count; i += 1) {
            const el = elements.nth(i);
            const text = ((await el.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
            if (text !== size)
                continue;
            if (!(await el.isVisible().catch(() => false)))
                continue;
            await el.scrollIntoViewIfNeeded().catch(() => undefined);
            await el.click().catch(() => undefined);
            await settle(page, 600);
            return true;
        }
    }
    return clickByText(page, size, { exact: true });
}
export function registerCartTools(server) {
    server.registerTool('trendyol_add_to_cart', {
        title: 'Add a product to the cart',
        description: 'Open a product (ref or URL), optionally pick a size, click "Sepete Ekle" and report whether the cart count changed. This only adds to the cart — it never checks out.',
        inputSchema: z.object({
            ref: z.string().optional(),
            url: z.string().optional(),
            size: z.string().optional().describe('Variant label to pick before adding, e.g. "M" or "42".'),
            confirm: z.boolean().optional().describe('Must be true to actually click add (safety).'),
        }),
    }, async ({ ref, url, size, confirm }) => {
        if (!config.enableCart)
            return errorResult('Sepet işlemleri kapalı (TRENDYOL_ENABLE_CART=false).');
        if (!confirm)
            return errorResult('Onay gerekli: confirm=true gönder.');
        try {
            const page = await getPage();
            const before = await cartCount(page);
            await openProduct(page, { ref, url });
            if (size)
                await selectSize(page, size);
            const added = await clickByText(page, 'Sepete Ekle', { exact: false });
            await settle(page, 1200);
            const after = await cartCount(page);
            const toast = await firstVisible(page.getByText(/sepete eklendi/i));
            return jsonResult({ opened: page.url(), sizeSelected: size ?? null, added, cartBefore: before, cartAfter: after, toast: toast ? await toast.textContent() : null });
        }
        catch (error) {
            return errorResult(`add_to_cart başarısız: ${error.message}`);
        }
    });
    server.registerTool('trendyol_cart_summary', {
        title: 'Read the cart summary',
        description: 'Open the cart (/sepetim), list the items with price/quantity and return the totals (subtotal, discounts, shipping, grand total) so you can show the "sepette indirim" real price.',
        inputSchema: z.object({}),
    }, async () => {
        try {
            const page = await getPage();
            await page.goto(`${config.baseUrl}/sepetim`, { waitUntil: 'domcontentloaded' });
            await settle(page, 1500);
            await dismissConsent(page);
            const data = await page.evaluate(() => {
                const norm = (value) => value.replace(/\s+/g, ' ').trim();
                const PRICE = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:TL|₺)/;
                const lines = [];
                document.querySelectorAll('a[href*="-p-"]').forEach((anchor) => {
                    const link = anchor;
                    const card = anchor.closest('[class*="cart" i], [class*="item" i], li, tr') ?? anchor;
                    const text = norm((card.textContent ?? ''));
                    const title = norm(link.textContent ?? '') || text.slice(0, 80);
                    if (!title)
                        return;
                    const price = text.match(PRICE)?.[0];
                    const qty = text.match(/(?:adet|Adet)\D{0,4}(\d{1,3})/)?.[1];
                    lines.push({ title: title.slice(0, 120), price, quantity: qty, url: link.href });
                });
                const summaryText = norm(document.body.innerText ?? '');
                const totalMatch = summaryText.match(/(?:Genel Toplam|Toplam)[^0-9]{0,20}((?:\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:TL|₺))/i);
                const savingsMatch = summaryText.match(/(?:Kazanc|İndirim|İndirimler)[^0-9]{0,20}((?:\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:TL|₺))/i);
                return { items: lines, total: totalMatch?.[1], savings: savingsMatch?.[1] };
            });
            return jsonResult({ ...data, cartCount: await cartCount(page) });
        }
        catch (error) {
            return errorResult(`cart_summary başarısız: ${error.message}`);
        }
    });
    server.registerTool('trendyol_favorites', {
        title: 'Manage favorites',
        description: 'Add a product to favorites (from ref/URL) or list your favorites page.',
        inputSchema: z.object({
            action: z.enum(['add', 'list']),
            ref: z.string().optional(),
            url: z.string().optional(),
        }),
    }, async ({ action, ref, url }) => {
        try {
            const page = await getPage();
            if (action === 'add') {
                await openProduct(page, { ref, url });
                const ok = await clickByText(page, 'Favorilere Ekle', { exact: false }) ||
                    (await clickByText(page, 'Favorilerime Ekle', { exact: false }));
                await settle(page, 800);
                return jsonResult({ added: ok, url: page.url() });
            }
            await page.goto(`${config.baseUrl}/hesabim/favoriler`, { waitUntil: 'domcontentloaded' });
            await settle(page, 1500);
            const items = await page.evaluate(() => {
                const out = [];
                document.querySelectorAll('a[href*="-p-"]').forEach((anchor) => {
                    const link = anchor;
                    const title = (link.getAttribute('title') ?? link.textContent ?? '').replace(/\s+/g, ' ').trim();
                    if (title)
                        out.push({ title: title.slice(0, 120), url: link.href });
                });
                return out;
            });
            return jsonResult({ url: page.url(), count: items.length, items });
        }
        catch (error) {
            return errorResult(`favorites başarısız: ${error.message}`);
        }
    });
}
//# sourceMappingURL=cart.js.map