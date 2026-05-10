type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

export type RuntimeCacheStore = {
  withCache<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T>;
  clear(key?: string): void;
  size(): number;
};

export function createRuntimeCache(nowProvider: () => number = () => Date.now()): RuntimeCacheStore {
  const values = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<unknown>>();

  return {
    async withCache<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
      const now = nowProvider();
      const cached = values.get(key);
      if (cached && cached.expiresAt > now) {
        return cached.value as T;
      }

      const pending = inFlight.get(key);
      if (pending) {
        return pending as Promise<T>;
      }

      const next = factory()
        .then((value) => {
          values.set(key, {
            value,
            expiresAt: nowProvider() + Math.max(ttlMs, 0),
          });
          inFlight.delete(key);
          return value;
        })
        .catch((error) => {
          inFlight.delete(key);
          throw error;
        });

      inFlight.set(key, next);
      return next;
    },
    clear(key?: string) {
      if (key) {
        values.delete(key);
        inFlight.delete(key);
        return;
      }

      values.clear();
      inFlight.clear();
    },
    size() {
      return values.size;
    },
  };
}

export const runtimeCache = createRuntimeCache();
