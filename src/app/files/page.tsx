"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";

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

type FileBrowserResponse = {
  currentPath: string;
  parentPath: string | null;
  roots: RootEntry[];
  items: FileBrowserEntry[];
  requestedPath?: string | null;
  pathFallbackApplied?: boolean;
  pathFallbackReason?: "outside-root" | "missing" | "file";
};

export default function FilesPage() {
  const [data, setData] = useState<FileBrowserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedPath = params.get("path") || "";
      void loadPath(requestedPath);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function loadPath(nextPath: string) {
    setLoading(true);
    try {
      const query = nextPath ? `?mode=list&path=${encodeURIComponent(nextPath)}` : "?mode=list";
      const response = await fetch(`/api/files${query}`, { cache: "no-store" });
      const payload = (await response.json()) as FileBrowserResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to load files");
      setData(payload);
      setCurrentPath(payload.currentPath);
      window.history.replaceState(null, "", `/files?path=${encodeURIComponent(payload.currentPath)}`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <section className="space-y-5">
        <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Files</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Drive and file browser</h2>
          <p className="mt-2 text-sm text-white/65">Browse folders, download files, and see when each file was last updated.</p>
        </div>

        <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          <div className="flex flex-wrap items-center gap-2">
            {data?.roots.map((root) => (
              <button
                key={root.path}
                onClick={() => void loadPath(root.path)}
                className={`rounded-full border px-3 py-1.5 text-xs ${currentPath === root.path ? "border-[#60A5FA] bg-[#60A5FA]/15 text-[#93C5FD]" : "border-white/10 bg-black/20 text-white/70"}`}
              >
                {root.name}
              </button>
            ))}
            <button onClick={() => void loadPath(currentPath)} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70">
              Refresh
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/50">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Current: {currentPath || "Loading…"}</span>
            {data?.parentPath ? (
              <button onClick={() => void loadPath(data.parentPath || currentPath)} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-white/70">
                Up one level
              </button>
            ) : null}
          </div>

          {data?.pathFallbackApplied && data.requestedPath ? (
            <div className="mt-4 rounded-2xl border border-[#60A5FA]/25 bg-[#60A5FA]/10 p-3 text-sm text-[#BFDBFE]">
              {describePathFallback(data.pathFallbackReason)}
            </div>
          ) : null}

          {error ? <div className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100">{error}</div> : null}

          {loading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />)}
            </div>
          ) : !data ? (
            <div className="mt-4 rounded-3xl border border-white/8 bg-[#0E1020] px-4 py-6 text-sm text-white/45">No file roots are available yet.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-3xl border border-white/8 bg-[#0E1020]">
              <div className="hidden grid-cols-[1.4fr_0.7fr_0.9fr_1fr] gap-3 border-b border-white/8 px-4 py-3 text-xs uppercase tracking-[0.16em] text-white/35 md:grid">
                <span>Name</span>
                <span>Type</span>
                <span>Size</span>
                <span>Last updated</span>
              </div>
              <div className="divide-y divide-white/6">
                {data.items.length ? (
                  data.items.map((item) => (
                    <div key={item.path} className="grid gap-2 px-4 py-3 text-sm text-white/80 md:grid-cols-[1.4fr_0.7fr_0.9fr_1fr] md:gap-3">
                      <div className="min-w-0">
                        {item.kind === "directory" ? (
                          <button onClick={() => void loadPath(item.path)} className="truncate text-left text-white hover:text-[#93C5FD]">
                            📁 {item.name}
                          </button>
                        ) : (
                          <a href={`/api/files?path=${encodeURIComponent(item.path)}`} download className="truncate text-white hover:text-[#93C5FD]" target="_blank" rel="noreferrer">
                            📄 {item.name}
                          </a>
                        )}
                        <p className="mt-1 truncate text-xs text-white/35">{item.path}</p>
                      </div>
                      <Detail label="Type" value={item.kind} />
                      <Detail label="Size" value={item.kind === "directory" ? "—" : formatFileSize(item.sizeBytes)} />
                      <Detail label="Last updated" value={formatDate(item.updatedAt)} />
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-white/45">This folder is empty.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 md:hidden">{label}</p>
      <p className="text-white/55">{value}</p>
    </div>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(timestamp: number) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString();
}

function describePathFallback(reason?: FileBrowserResponse["pathFallbackReason"]) {
  if (reason === "file") {
    return "That link pointed at a file, so Mission Control opened the file’s parent folder instead.";
  }
  if (reason === "outside-root") {
    return "That path sits outside Mission Control’s allowed file roots, so it was redirected to the nearest safe workspace.";
  }
  return "The requested path wasn’t available, so Mission Control opened the nearest safe folder instead.";
}
