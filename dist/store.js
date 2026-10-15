import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { shortId } from './util.js';
const FILE = () => path.join(config.dataDir, 'watchlist.json');
async function jsonBackend() {
    const file = FILE();
    return {
        kind: 'json',
        async load() {
            try {
                const raw = await readFile(file, 'utf8');
                return JSON.parse(raw);
            }
            catch {
                return [];
            }
        },
        async save(entries) {
            await mkdir(path.dirname(file), { recursive: true });
            const tmp = `${file}.${process.pid}.tmp`;
            await writeFile(tmp, JSON.stringify(entries, null, 2), 'utf8');
            await rename(tmp, file);
        },
    };
}
async function sqliteBackend() {
    try {
        const sqlite = (await import('node:sqlite'));
        await mkdir(config.dataDir, { recursive: true });
        const db = new sqlite.DatabaseSync(path.join(config.dataDir, 'trendyol-mcp.db'));
        db.exec(`
      CREATE TABLE IF NOT EXISTS watches (
        id TEXT PRIMARY KEY, url TEXT, label TEXT, title TEXT, brand TEXT, image TEXT,
        currency TEXT, targetPrice REAL, baselinePrice REAL, lastPrice REAL,
        addedAt INTEGER, lastCheckedAt INTEGER
      );
      CREATE TABLE IF NOT EXISTS history (
        watchId TEXT, at INTEGER, price REAL
      );
      CREATE INDEX IF NOT EXISTS idx_history_watch ON history(watchId, at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_watches_url ON watches(url);
    `);
        const selectWatches = db.prepare('SELECT * FROM watches ORDER BY addedAt DESC');
        const selectHistory = db.prepare('SELECT at, price FROM history WHERE watchId = ? ORDER BY at ASC');
        const insertWatch = db.prepare(`INSERT INTO watches (id, url, label, title, brand, image, currency, targetPrice, baselinePrice, lastPrice, addedAt, lastCheckedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         label=excluded.label, title=excluded.title, brand=excluded.brand, image=excluded.image,
         currency=excluded.currency, targetPrice=excluded.targetPrice,
         baselinePrice=excluded.baselinePrice, lastPrice=excluded.lastPrice, lastCheckedAt=excluded.lastCheckedAt`);
        const deleteWatch = db.prepare('DELETE FROM watches WHERE id = ? OR url = ?');
        const deleteHistory = db.prepare('DELETE FROM history WHERE watchId = ?');
        const insertHistory = db.prepare('INSERT INTO history (watchId, at, price) VALUES (?, ?, ?)');
        return {
            kind: 'sqlite',
            async load() {
                const rows = selectWatches.all();
                return rows.map((row) => ({
                    id: String(row.id),
                    url: String(row.url),
                    label: row.label ?? undefined,
                    title: row.title ?? undefined,
                    brand: row.brand ?? undefined,
                    image: row.image ?? undefined,
                    currency: row.currency ?? 'TL',
                    targetPrice: row.targetPrice ?? undefined,
                    baselinePrice: row.baselinePrice ?? undefined,
                    lastPrice: row.lastPrice ?? undefined,
                    addedAt: Number(row.addedAt),
                    lastCheckedAt: row.lastCheckedAt ?? undefined,
                    history: selectHistory.all(String(row.id)).map((h) => ({
                        at: Number(h.at),
                        price: Number(h.price),
                    })),
                }));
            },
            async save(entries) {
                for (const entry of entries) {
                    insertWatch.run(entry.id, entry.url, entry.label ?? null, entry.title ?? null, entry.brand ?? null, entry.image ?? null, entry.currency, entry.targetPrice ?? null, entry.baselinePrice ?? null, entry.lastPrice ?? null, entry.addedAt, entry.lastCheckedAt ?? null);
                    deleteHistory.run(entry.id);
                    for (const point of entry.history)
                        insertHistory.run(entry.id, point.at, point.price);
                }
                // Remove watches that are no longer in the in-memory set.
                const ids = new Set(entries.map((e) => e.id));
                const existing = db.prepare('SELECT id FROM watches').all();
                for (const row of existing)
                    if (!ids.has(row.id))
                        deleteWatch.run(row.id, '');
            },
        };
    }
    catch {
        return null;
    }
}
class WatchStore {
    backend = null;
    entries = [];
    loaded = false;
    async init() {
        if (this.loaded)
            return;
        this.backend = (await sqliteBackend()) ?? (await jsonBackend());
        this.entries = await this.backend.load();
        this.loaded = true;
    }
    async persist() {
        if (this.backend)
            await this.backend.save(this.entries);
    }
    async list() {
        await this.init();
        return this.entries;
    }
    async get(idOrUrl) {
        await this.init();
        return this.entries.find((e) => e.id === idOrUrl || e.url === idOrUrl);
    }
    async add(input) {
        await this.init();
        const existing = this.entries.find((e) => e.url === input.url);
        if (existing) {
            Object.assign(existing, {
                label: input.label ?? existing.label,
                title: input.title ?? existing.title,
                brand: input.brand ?? existing.brand,
                image: input.image ?? existing.image,
                targetPrice: input.targetPrice ?? existing.targetPrice,
                lastPrice: input.lastPrice ?? existing.lastPrice,
            });
            await this.persist();
            return existing;
        }
        const entry = {
            id: shortId('w_'),
            url: input.url,
            label: input.label,
            title: input.title,
            brand: input.brand,
            image: input.image,
            currency: input.currency ?? 'TL',
            targetPrice: input.targetPrice,
            baselinePrice: input.baselinePrice ?? input.lastPrice,
            lastPrice: input.lastPrice,
            addedAt: Date.now(),
            history: input.lastPrice ? [{ at: Date.now(), price: input.lastPrice }] : [],
        };
        this.entries.unshift(entry);
        await this.persist();
        return entry;
    }
    async remove(idOrUrl) {
        await this.init();
        const before = this.entries.length;
        this.entries = this.entries.filter((e) => e.id !== idOrUrl && e.url !== idOrUrl);
        const removed = this.entries.length < before;
        if (removed)
            await this.persist();
        return removed;
    }
    async setTarget(idOrUrl, targetPrice) {
        await this.init();
        const entry = this.entries.find((e) => e.id === idOrUrl || e.url === idOrUrl);
        if (!entry)
            return undefined;
        entry.targetPrice = targetPrice;
        await this.persist();
        return entry;
    }
    async recordPrice(idOrUrl, price) {
        await this.init();
        const entry = this.entries.find((e) => e.id === idOrUrl || e.url === idOrUrl);
        if (!entry)
            return undefined;
        const previous = entry.lastPrice;
        entry.lastPrice = price;
        entry.lastCheckedAt = Date.now();
        if (entry.baselinePrice === undefined)
            entry.baselinePrice = price;
        const lastPoint = entry.history[entry.history.length - 1];
        if (!lastPoint || lastPoint.price !== price)
            entry.history.push({ at: Date.now(), price });
        await this.persist();
        const reference = previous ?? entry.baselinePrice;
        const drop = reference !== undefined ? reference - price : undefined;
        return {
            entry,
            previous,
            drop,
            dropPct: reference ? (drop / reference) * 100 : undefined,
            reachedTarget: entry.targetPrice !== undefined && price <= entry.targetPrice,
        };
    }
}
let instance;
export function getStore() {
    instance ??= new WatchStore();
    return instance;
}
//# sourceMappingURL=store.js.map