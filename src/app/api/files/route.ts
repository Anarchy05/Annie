import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ROOTS = [
  "/root/.openclaw/workspace",
  "/root/projects",
  "/tmp/annies-mission-control-uploads",
  "/mnt/gdrive",
] as const;

const CONTENT_TYPES: Record<string, string> = {
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".zip": "application/zip",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".tsx": "text/plain; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
};

type RootEntry = {
  name: string;
  path: string;
};

type FileBrowserEntry = {
  name: string;
  path: string;
  kind: "file" | "directory";
  sizeBytes: number;
  updatedAt: number;
  extension: string;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getAvailableRoots(): Promise<RootEntry[]> {
  const roots = await Promise.all(
    ALLOWED_ROOTS.map(async (root): Promise<RootEntry | null> =>
      (await pathExists(root)) ? { name: path.basename(root) || root, path: root } : null
    )
  );

  return roots.filter((root): root is RootEntry => root !== null);
}

function resolveSafePath(rawPath: string, allowedRoots: RootEntry[]) {
  const resolved = path.resolve(rawPath);
  const allowed = allowedRoots.some((root) => resolved === root.path || resolved.startsWith(`${root.path}/`));
  if (!allowed) {
    throw new HttpError(403, "Path is outside allowed roots");
  }
  return resolved;
}

async function listDirectory(dirPath: string) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const enriched = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(entryPath);
      return {
        name: entry.name,
        path: entryPath,
        kind: entry.isDirectory() ? "directory" : "file",
        sizeBytes: entry.isDirectory() ? 0 : stats.size,
        updatedAt: stats.mtimeMs,
        extension: entry.isDirectory() ? "" : path.extname(entry.name).toLowerCase(),
      } satisfies FileBrowserEntry;
    })
  );

  return enriched.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function GET(request: NextRequest) {
  try {
    const rawPath = request.nextUrl.searchParams.get("path");
    const mode = request.nextUrl.searchParams.get("mode") || "download";
    const roots = await getAvailableRoots();

    if (!roots.length) {
      throw new HttpError(503, "No allowed file roots are available right now");
    }

    if (mode === "list") {
      const requestedPath = rawPath || roots[0].path;
      const resolvedPath = resolveSafePath(requestedPath, roots);
      const exists = await pathExists(resolvedPath);
      const listPath = exists ? resolvedPath : roots[0].path;
      const stats = await fs.stat(listPath);

      if (!stats.isDirectory()) {
        throw new HttpError(400, "Not a directory");
      }

      const items = await listDirectory(listPath);
      const parentPath = roots.some((root) => root.path === listPath) ? null : path.dirname(listPath);

      return NextResponse.json(
        {
          currentPath: listPath,
          parentPath,
          roots,
          items,
          requestedPath: rawPath || null,
          pathFallbackApplied: listPath !== resolvedPath,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!rawPath) {
      throw new HttpError(400, "path is required");
    }

    const resolvedPath = resolveSafePath(rawPath, roots);
    const stats = await fs.stat(resolvedPath).catch(() => null);
    if (!stats) {
      throw new HttpError(404, "File not found");
    }
    if (!stats.isFile()) {
      throw new HttpError(400, "Not a file");
    }

    const buffer = await fs.readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase();
    const filename = path.basename(resolvedPath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status }
    );
  }
}
