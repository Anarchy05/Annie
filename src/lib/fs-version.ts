import { promises as fs } from "node:fs";
import path from "node:path";

type TreeVersionCacheEntry = {
  expiresAt: number;
  value: string;
};

type CachedTreeVersionReader = {
  get(rootPath: string, options?: TreeVersionOptions, ttlMs?: number): Promise<string>;
  clear(): void;
};

export async function getFileVersion(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    return `${Math.floor(stats.mtimeMs)}:${stats.size}`;
  } catch {
    return "missing";
  }
}

export function combineVersionParts(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => String(part ?? "missing")).join("|");
}

type TreeVersionOptions = {
  ignoreDirs?: Iterable<string>;
};

function buildTreeVersionCacheKey(rootPath: string, options: TreeVersionOptions = {}) {
  const ignored = Array.from(options.ignoreDirs ?? []).sort();
  return `${rootPath}\u0000${ignored.join("|")}`;
}

export function createCachedTreeVersionReader(nowProvider: () => number = () => Date.now()): CachedTreeVersionReader {
  const values = new Map<string, TreeVersionCacheEntry>();
  const inFlight = new Map<string, Promise<string>>();

  return {
    async get(rootPath: string, options: TreeVersionOptions = {}, ttlMs = 15_000) {
      const key = buildTreeVersionCacheKey(rootPath, options);
      const cached = values.get(key);
      const now = nowProvider();
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }

      const pending = inFlight.get(key);
      if (pending) {
        return pending;
      }

      const next = getTreeVersion(rootPath, options)
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
    clear() {
      values.clear();
      inFlight.clear();
    },
  };
}

export const cachedTreeVersionReader = createCachedTreeVersionReader();

export async function getCachedTreeVersion(rootPath: string, options: TreeVersionOptions = {}, ttlMs = 15_000) {
  return cachedTreeVersionReader.get(rootPath, options, ttlMs);
}

export async function getTreeVersion(rootPath: string, options: TreeVersionOptions = {}) {
  const ignored = new Set(options.ignoreDirs ?? []);
  const pending = [rootPath];
  let newest: { mtimeMs: number; size: number; relativePath: string } | null = null;
  let fileCount = 0;

  try {
    while (pending.length) {
      const currentPath = pending.pop();
      if (!currentPath) continue;

      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          if (!ignored.has(entry.name)) {
            pending.push(entryPath);
          }
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const stats = await fs.stat(entryPath);
        fileCount += 1;
        const relativePath = path.relative(rootPath, entryPath) || entry.name;

        if (
          !newest ||
          stats.mtimeMs > newest.mtimeMs ||
          (stats.mtimeMs === newest.mtimeMs && relativePath > newest.relativePath)
        ) {
          newest = {
            mtimeMs: stats.mtimeMs,
            size: stats.size,
            relativePath,
          };
        }
      }
    }
  } catch {
    return "missing";
  }

  if (!newest) {
    return `empty:${rootPath}`;
  }

  return `${Math.floor(newest.mtimeMs)}:${newest.size}:${fileCount}:${newest.relativePath}`;
}
