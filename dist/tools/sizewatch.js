import * as z from 'zod/v4';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getPage } from '../browser.js';
import { config } from '../config.js';
import { scrapeProductDetail } from '../trendyol/scrape.js';
import { openProduct } from '../trendyol/actions.js';
import { errorResult, jsonResult, shortId } from '../util.js';
const FILE = () => path.join(config.dataDir, 'size-watch.json');
async function load() {
    try {
        return JSON.parse(await readFile(FILE(), 'utf8'));
    }
    catch {
        return [];
    }
}
async function save(entries) {
    await mkdir(config.dataDir, { recursive: true });
    const file = FILE();
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(entries, null, 2), 'utf8');
    await rename(tmp, file);
}
function findAvailability(sizes, size) {
    if (!sizes)
        return undefined;
    const target = size.trim().toLocaleLowerCase('tr-TR');
    const hit = sizes.find((s) => s.label.trim().toLocaleLowerCase('tr-TR') === target);
    if (hit)
        return hit.available;
    const partial = sizes.find((s) => s.label.toLocaleLowerCase('tr-TR').includes(target));
    return partial?.available;
}
export function registerSizeWatchTools(server) {
    server.registerTool('trendyol_watch_size_add', {
        title: 'Watch a size for stock',
        description: 'Watch a specific size of a product. Later checks report when the size comes back in stock or goes out of stock.',
        inputSchema: z.object({
            url: z.string().optional(),
            ref: z.string().optional(),
            size: z.string().describe('Size label to watch, e.g. "M" or "42".'),
            label: z.string().optional(),
        }),
    }, async ({ url, ref, size, label }) => {
        try {
            const page = await getPage();
            await openProduct(page, { ref, url });
            const detail = await page.evaluate(scrapeProductDetail);
            const available = findAvailability(detail.sizes, size);
            const entries = await load();
            const existing = entries.find((e) => e.url === detail.url && e.size.toLocaleLowerCase('tr-TR') === size.toLocaleLowerCase('tr-TR'));
            if (existing) {
                existing.lastAvailable = available;
                existing.lastCheckedAt = Date.now();
                await save(entries);
                return jsonResult({ entry: existing, available, note: 'mevcut kayıt güncellendi' });
            }
            const entry = {
                id: shortId('sz_'),
                url: detail.url,
                size,
                label: label ?? detail.title,
                title: detail.title,
                lastAvailable: available,
                addedAt: Date.now(),
                lastCheckedAt: Date.now(),
                history: available !== undefined ? [{ at: Date.now(), available }] : [],
            };
            entries.push(entry);
            await save(entries);
            return jsonResult({ entry, available, sizeExists: available !== undefined });
        }
        catch (error) {
            return errorResult(`watch_size_add başarısız: ${error.message}`);
        }
    });
    server.registerTool('trendyol_size_stock_check', {
        title: 'Check watched sizes',
        description: 'Re-read watched sizes and report stock changes (in stock / out of stock).',
        inputSchema: z.object({
            id: z.string().optional().describe('Check a single size watch; omit for all.'),
            max: z.number().int().min(1).max(30).optional(),
        }),
    }, async ({ id, max }) => {
        try {
            const entries = await load();
            const targets = id ? entries.filter((e) => e.id === id) : entries;
            const page = await getPage();
            const results = [];
            for (const entry of targets.slice(0, max ?? 15)) {
                try {
                    await openProduct(page, { url: entry.url });
                    const detail = await page.evaluate(scrapeProductDetail);
                    const available = findAvailability(detail.sizes, entry.size);
                    const previous = entry.lastAvailable;
                    if (available !== undefined && available !== previous) {
                        entry.history.push({ at: Date.now(), available });
                    }
                    entry.lastAvailable = available;
                    entry.lastCheckedAt = Date.now();
                    let alert = 'değişmedi';
                    if (available === true && previous === false)
                        alert = 'STOĞA GİRDİ';
                    else if (available === false && previous === true)
                        alert = 'TÜKENDİ';
                    else if (available === undefined)
                        alert = 'beden bulunamadı';
                    results.push({ id: entry.id, label: entry.label, size: entry.size, available, previous, alert, url: entry.url });
                }
                catch (error) {
                    results.push({ id: entry.id, url: entry.url, error: error.message });
                }
            }
            await save(entries);
            return jsonResult({ checked: results.length, results });
        }
        catch (error) {
            return errorResult(`size_stock_check başarısız: ${error.message}`);
        }
    });
    server.registerTool('trendyol_size_watch_list', {
        title: 'List size watches',
        description: 'List watched product sizes with their last known availability.',
        inputSchema: z.object({}),
    }, async () => {
        const entries = await load();
        return jsonResult({
            count: entries.length,
            items: entries.map((e) => ({
                id: e.id,
                label: e.label ?? e.title,
                size: e.size,
                lastAvailable: e.lastAvailable,
                lastCheckedAt: e.lastCheckedAt ? new Date(e.lastCheckedAt).toISOString() : undefined,
                url: e.url,
            })),
        });
    });
}
//# sourceMappingURL=sizewatch.js.map