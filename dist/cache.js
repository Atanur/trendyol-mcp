import { config } from './config.js';
const store = new Map();
export function cacheGet(key) {
    const hit = store.get(key);
    if (!hit)
        return undefined;
    if (hit.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
    }
    return hit.value;
}
export function cacheSet(key, value, ttlMs = config.cacheTtlMs) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
export async function cacheWrap(key, producer, ttlMs = config.cacheTtlMs) {
    const hit = cacheGet(key);
    if (hit !== undefined)
        return hit;
    const value = await producer();
    cacheSet(key, value, ttlMs);
    return value;
}
export function cacheClear(prefix) {
    if (!prefix) {
        const size = store.size;
        store.clear();
        return size;
    }
    let removed = 0;
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
            store.delete(key);
            removed += 1;
        }
    }
    return removed;
}
export function cacheStats() {
    return { size: store.size, keys: [...store.keys()] };
}
//# sourceMappingURL=cache.js.map