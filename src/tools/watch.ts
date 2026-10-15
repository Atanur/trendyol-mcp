import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { getPage } from '../browser.js';
import { settle } from '../dom.js';
import { getStore } from '../store.js';
import { scrapeProductDetail } from '../trendyol/scrape.js';
import { openProduct } from '../trendyol/actions.js';
import { errorResult, jsonResult, parsePrice } from '../util.js';

function summarizeHistory(history: Array<{ at: number; price: number }>) {
  if (history.length === 0) return { points: 0 };
  const prices = history.map((h) => h.price);
  return {
    points: history.length,
    first: prices[0],
    last: prices[prices.length - 1],
    min: Math.min(...prices),
    max: Math.max(...prices),
    since: new Date(history[0]!.at).toISOString(),
  };
}

export function registerWatchTools(server: McpServer): void {
  server.registerTool(
    'trendyol_watch_add',
    {
      title: 'Watch a product price',
      description:
        'Add a product (URL or snapshot ref) to the price watchlist. Scrapes its current price as the baseline and stores it locally (SQLite/JSON) so you can detect drops later.',
      inputSchema: z.object({
        url: z.string().optional(),
        ref: z.string().optional(),
        label: z.string().optional().describe('Human label for the watch, e.g. "lacivert blazer".'),
        target_price: z.number().optional().describe('Alert when price drops to/below this value (TRY).'),
      }),
    },
    async ({ url, ref, label, target_price }) => {
      try {
        const page = await getPage();
        await openProduct(page, { ref, url });
        const detail = await page.evaluate(scrapeProductDetail);
        const price = parsePrice(detail.price ?? undefined);
        const entry = await getStore().add({
          url: detail.url,
          label,
          title: detail.title,
          brand: detail.brand,
          image: detail.images?.[0],
          targetPrice: target_price,
          lastPrice: price,
        });
        return jsonResult({ entry, price });
      } catch (error) {
        return errorResult(`watch_add başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_watch_list',
    {
      title: 'List watched products',
      description: 'Return the local watchlist with baseline/last/target prices and price-history summary.',
      inputSchema: z.object({}),
    },
    async () => {
      const entries = await getStore().list();
      return jsonResult({
        count: entries.length,
        items: entries.map((entry) => ({
          id: entry.id,
          label: entry.label ?? entry.title,
          url: entry.url,
          brand: entry.brand,
          targetPrice: entry.targetPrice,
          baselinePrice: entry.baselinePrice,
          lastPrice: entry.lastPrice,
          lastCheckedAt: entry.lastCheckedAt ? new Date(entry.lastCheckedAt).toISOString() : undefined,
          history: summarizeHistory(entry.history),
        })),
      });
    },
  );

  server.registerTool(
    'trendyol_watch_remove',
    {
      title: 'Remove a watched product',
      description: 'Remove a watch by id or URL.',
      inputSchema: z.object({ id_or_url: z.string() }),
    },
    async ({ id_or_url }) => {
      const removed = await getStore().remove(id_or_url);
      return jsonResult({ removed });
    },
  );

  server.registerTool(
    'trendyol_fake_discount_check',
    {
      title: 'Detect a fake discount',
      description:
        'Compare the current price with the struck-through list price and the locally recorded price history to flag "raise then discount" games or inflated discounts.',
      inputSchema: z.object({
        url: z.string().optional(),
        ref: z.string().optional(),
        add_to_watch: z.boolean().optional().describe('Auto-add the product to the watchlist if not present (default true).'),
      }),
    },
    async ({ url, ref, add_to_watch }) => {
      try {
        const page = await getPage();
        await openProduct(page, { ref, url });
        const detail = await page.evaluate(scrapeProductDetail);
        const current = parsePrice(detail.price ?? undefined);
        const listPrice = parsePrice(detail.originalPrice ?? undefined);
        const store = getStore();
        let watch = await store.get(detail.url);
        const flags: Array<{ code: string; message: string }> = [];

        if (!watch && (add_to_watch ?? true)) {
          watch = await store.add({
            url: detail.url,
            title: detail.title,
            brand: detail.brand,
            image: detail.images?.[0],
            lastPrice: current,
          });
        } else if (watch && current !== undefined) {
          const record = await store.recordPrice(watch.id, current);
          watch = record?.entry ?? watch;
        }

        const history = (watch?.history ?? []).map((h) => h.price);
        const points = history.length;
        const min = history.length ? Math.min(...history) : undefined;
        const max = history.length ? Math.max(...history) : undefined;

        if (listPrice && current) {
          const pct = (1 - current / listPrice) * 100;
          if (pct < 10) flags.push({ code: 'ABARTILI_INDIRIM', message: `Üstü çizili fiyata göre sadece %${pct.toFixed(0)} indirim.` });
          else flags.push({ code: 'INDIRIM', message: `Üstü çizili fiyata göre %${pct.toFixed(0)} indirim.` });
        }
        if (max !== undefined && current !== undefined && max > current * 1.15) {
          flags.push({ code: 'ZAM_SONRA_INDIRIM', message: 'Geçmişte daha yüksek fiyat görüldü; indirim şişirilmiş olabilir.' });
        }
        if (min !== undefined && current !== undefined && current <= min * 1.001) {
          flags.push({ code: 'EN_DUSUK', message: 'Şu an kaydedilen en düşük fiyat.' });
        }
        if (points < 3) {
          flags.push({ code: 'YETERSIZ_GECMIS', message: 'Yeterli fiyat geçmişi yok; izlemeye devam et.' });
        }

        const suspicious = flags.some((f) => ['ZAM_SONRA_INDIRIM', 'ABARTILI_INDIRIM'].includes(f.code));
        return jsonResult({ url: detail.url, current, listPrice, min, max, points, suspicious, flags });
      } catch (error) {
        return errorResult(`fake_discount_check başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_watch_check',
    {
      title: 'Check watched prices',
      description:
        'Re-visit watched products, record their current price into history and report drops vs the previous/baseline price and whether the target was reached.',
      inputSchema: z.object({
        id_or_url: z.string().optional().describe('Check a single watch; omit to check all.'),
        all: z.boolean().optional().describe('Explicitly check every watch (default true when id_or_url is omitted).'),
        max: z.number().int().min(1).max(30).optional().describe('Max watches to check in one run (default 15).'),
      }),
    },
    async ({ id_or_url, max }) => {
      try {
        const store = getStore();
        const targets = id_or_url
          ? [await store.get(id_or_url)].filter((x): x is NonNullable<typeof x> => Boolean(x))
          : await store.list();
        const page = await getPage();
        const results: unknown[] = [];
        for (const watch of targets.slice(0, max ?? 15)) {
          try {
            await openProduct(page, { url: watch.url });
            const detail = await page.evaluate(scrapeProductDetail);
            const price = parsePrice(detail.price ?? undefined);
            if (price === undefined) {
              results.push({ id: watch.id, label: watch.label ?? watch.title, error: 'fiyat okunamadı', url: watch.url });
              continue;
            }
            const record = await store.recordPrice(watch.id, price);
            results.push({
              id: watch.id,
              label: record?.entry.label ?? record?.entry.title,
              price,
              previous: record?.previous,
              drop: record?.drop,
              dropPct: record?.dropPct ? Number(record.dropPct.toFixed(1)) : undefined,
              target: record?.entry.targetPrice,
              reachedTarget: record?.reachedTarget,
              alert: record?.reachedTarget ? 'HEDEFE ULAŞTI' : (record?.drop ?? 0) > 0 ? 'FİYAT DÜŞTÜ' : 'değişmedi',
            });
          } catch (error) {
            results.push({ id: watch.id, url: watch.url, error: (error as Error).message });
          }
          await settle(page, 400);
        }
        return jsonResult({ checked: results.length, results });
      } catch (error) {
        return errorResult(`watch_check başarısız: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'trendyol_price_trend',
    {
      title: 'Price trend from history',
      description:
        'Compute min/median/max and the trend (rising/falling/stable) from the locally recorded price history of watched products — use it to judge whether a discount is real.',
      inputSchema: z.object({ id_or_url: z.string().optional() }),
    },
    async ({ id_or_url }) => {
      const store = getStore();
      const entries = id_or_url
        ? [await store.get(id_or_url)].filter((x): x is NonNullable<typeof x> => Boolean(x))
        : await store.list();
      const rows = entries.map((entry) => {
        const prices = entry.history.map((h) => h.price);
        if (prices.length === 0) {
          return { id: entry.id, label: entry.label ?? entry.title, points: 0, note: 'fiyat geçmişi yok; watch_check ile birkaç kez kontrol et.' };
        }
        const sorted = [...prices].sort((a, b) => a - b);
        const first = prices[0]!;
        const last = prices[prices.length - 1]!;
        const min = sorted[0]!;
        const max = sorted[sorted.length - 1]!;
        const median = sorted[Math.floor(sorted.length / 2)]!;
        const changePct = first ? ((last - first) / first) * 100 : 0;
        const trend = changePct > 2 ? 'yükseliyor' : changePct < -2 ? 'düşüyor' : 'stabil';
        return {
          id: entry.id,
          label: entry.label ?? entry.title,
          points: prices.length,
          first,
          last,
          min,
          median,
          max,
          changePct: Number(changePct.toFixed(1)),
          trend,
          currentVsMinPct: min ? Number((((last - min) / min) * 100).toFixed(1)) : undefined,
          target: entry.targetPrice,
        };
      });
      return jsonResult({ count: rows.length, rows });
    },
  );
}
