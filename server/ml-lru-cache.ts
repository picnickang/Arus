/**
 * Minimal LRU cache for ML model objects.
 *
 * Recreated 2026-04 after a refactor left `model-loader.ts` importing
 * `../ml-lru-cache.js` from a file that no longer existed, breaking the
 * background job startup. Only `.get`/`.set` are used by callers; the
 * Map-reinsertion trick gives standard LRU recency semantics without
 * pulling in another dependency.
 */

export interface ModelCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  size(): number;
  clear(): void;
}

export function createModelCache<V = unknown>(maxEntries: number): ModelCache<V> {
  if (!Number.isFinite(maxEntries) || maxEntries < 1) {
    throw new Error(`createModelCache: maxEntries must be >= 1, got ${maxEntries}`);
  }

  const store = new Map<string, V>();

  return {
    get(key) {
      if (!store.has(key)) return undefined;
      const value = store.get(key) as V;
      store.delete(key);
      store.set(key, value);
      return value;
    },
    set(key, value) {
      if (store.has(key)) {
        store.delete(key);
      } else if (store.size >= maxEntries) {
        const oldestKey = store.keys().next().value;
        if (oldestKey !== undefined) store.delete(oldestKey);
      }
      store.set(key, value);
    },
    size() {
      return store.size;
    },
    clear() {
      store.clear();
    },
  };
}
