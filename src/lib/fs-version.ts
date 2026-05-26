import { promises as fs } from "node:fs";
import path from "node:path";

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
