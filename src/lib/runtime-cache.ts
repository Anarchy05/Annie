type CacheEntry = {
  expiresAt: number;
  value: unknown;
  version?: string | number | null;
};

export type RuntimeCacheStore = {
  withCache<T>(key: string, ttlMs: number, factory: () => Promise<T>, version?: string | number | null): Promise<T>;
  clear(key?: string): void;
  size(): number;
};

function buildInFlightKey(key: string, version?: string | number | null) {
  return `${key}\u0000${String(version ?? "")}`;
}

export function createRuntimeCache(nowProvider: () => number = () => Date.now()): RuntimeCacheStore {
  const values = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<unknown>>();

  return {
    async withCache<T>(key: string, ttlMs: number, factory: () => Promise<T>, version?: string | number | null): Promise<T> {
      const now = nowProvider();
      const cached = values.get(key);
      if (cached && cached.expiresAt > now && cached.version === version) {
        return cached.value as T;
      }

      const inFlightKey = buildInFlightKey(key, version);
      const pending = inFlight.get(inFlightKey);
      if (pending) {
        return pending as Promise<T>;
      }

      const next = factory()
        .then((value) => {
          values.set(key, {
            value,
            expiresAt: nowProvider() + Math.max(ttlMs, 0),
            version,
          });
          inFlight.delete(inFlightKey);
          return value;
        })
        .catch((error) => {
          inFlight.delete(inFlightKey);
          throw error;
        });

      inFlight.set(inFlightKey, next);
      return next;
    },
    clear(key?: string) {
      if (key) {
        values.delete(key);
        const prefix = `${key}\u0000`;
        for (const pendingKey of inFlight.keys()) {
          if (pendingKey.startsWith(prefix)) {
            inFlight.delete(pendingKey);
          }
        }
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
