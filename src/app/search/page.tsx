"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";

type SearchResults = {
  memories: Array<{ id: string; path: string; line?: number; preview: string; score: number }>;
  files: Array<{ id: string; path: string; lineNumber: number; preview: string }>;
  conversations: Array<{ id: string; key: string; label: string; model: string; updatedAt: number; status: string }>;
  tasks: Array<{ id: string; name: string; description: string; schedule: string; enabled: boolean }>;
};

const emptyResults: SearchResults = { memories: [], files: [], conversations: [], tasks: [] };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    if (!debouncedQuery) {
      return () => {
        mounted = false;
      };
    }

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to search");
        const data = (await response.json()) as SearchResults;
        if (mounted) setResults(data);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [debouncedQuery]);

  const visibleResults = debouncedQuery ? results : emptyResults;

  const sections = useMemo(
    () => [
      { title: "Memories", items: visibleResults.memories, render: (item: SearchResults["memories"][number]) => <><p className="text-sm font-medium text-white">{highlight(item.path, debouncedQuery)}</p><p className="mt-1 text-xs text-white/55">Line {item.line || "—"}</p><p className="mt-2 text-sm text-white/70">{highlight(item.preview, debouncedQuery)}</p></> },
      { title: "Files", items: visibleResults.files, render: (item: SearchResults["files"][number]) => <><p className="text-sm font-medium text-white">{highlight(item.path, debouncedQuery)}</p><p className="mt-1 text-xs text-white/55">Line {item.lineNumber}</p><p className="mt-2 text-sm text-white/70">{highlight(item.preview, debouncedQuery)}</p></> },
      { title: "Conversations", items: visibleResults.conversations, render: (item: SearchResults["conversations"][number]) => <><p className="text-sm font-medium text-white">{highlight(item.label, debouncedQuery)}</p><p className="mt-1 text-xs text-white/55">{item.model} · {item.status}</p><p className="mt-2 text-sm text-white/70">Updated {new Date(item.updatedAt).toLocaleString()}</p></> },
      { title: "Tasks", items: visibleResults.tasks, render: (item: SearchResults["tasks"][number]) => <><p className="text-sm font-medium text-white">{highlight(item.name, debouncedQuery)}</p><p className="mt-1 text-xs text-white/55">{item.schedule} · {item.enabled ? "enabled" : "disabled"}</p><p className="mt-2 text-sm text-white/70">{highlight(item.description, debouncedQuery)}</p></> },
    ],
    [debouncedQuery, visibleResults]
  );

  return (
    <PageShell>
      <section className="animate-fade-in rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Global search</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">Search everywhere</h2>
        <div className="mt-5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search memories, files, sessions, and tasks..."
            className="w-full rounded-2xl border border-[#2A2A3E] bg-[#0E1020] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#60A5FA]"
          />
        </div>

        {loading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {sections.map((section) => (
              <div key={section.title} className="rounded-2xl border border-[#2A2A3E] bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                  <span className="text-xs text-white/45">{section.items.length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {section.items.length ? section.items.map((item: { id: string }) => (
                    <div key={item.id} className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
                      <div className="min-w-0 break-words">
                        {section.render(item as never)}
                      </div>
                    </div>
                  )) : <p className="text-sm text-white/45">{debouncedQuery ? "No results here yet." : "Start typing to search."}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="rounded bg-[#60A5FA]/30 px-1 text-white">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}
