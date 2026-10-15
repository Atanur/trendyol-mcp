import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { productKey } from './util.js';
const FILE = () => path.join(config.dataDir, 'review-insights.json');
async function load() {
    try {
        return JSON.parse(await readFile(FILE(), 'utf8'));
    }
    catch {
        return [];
    }
}
async function persist(entries) {
    await mkdir(config.dataDir, { recursive: true });
    const file = FILE();
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(entries, null, 2), 'utf8');
    await rename(tmp, file);
}
class ReviewInsightStore {
    async save(insight) {
        const entries = await load();
        const key = productKey(insight.url);
        const index = entries.findIndex((e) => productKey(e.url) === key);
        if (index >= 0)
            entries[index] = insight;
        else
            entries.push(insight);
        await persist(entries);
        return insight;
    }
    async get(url) {
        const key = productKey(url);
        return (await load()).find((e) => productKey(e.url) === key);
    }
    async list() {
        return load();
    }
    async remove(url) {
        const key = productKey(url);
        const entries = await load();
        const next = entries.filter((e) => productKey(e.url) !== key);
        const removed = next.length < entries.length;
        if (removed)
            await persist(next);
        return removed;
    }
}
let instance;
export function getReviewInsights() {
    instance ??= new ReviewInsightStore();
    return instance;
}
//# sourceMappingURL=reviewinsights.js.map