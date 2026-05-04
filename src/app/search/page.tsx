"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { StatePanel } from "@/components/state-panels";

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
  const [error, setError] = useState<string | null>(null);

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
        if (!response.ok) throw new Error("Search is unavailable right now.");
        const data = (await response.json()) as SearchResults;
        if (mounted) {
          setResults(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setResults(emptyResults);
          setError(err instanceof Error ? err.message : "Search is unavailable right now.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [debouncedQuery]);

  const sections = useMemo(
    () => [
      {
        title: "Memories",
        items: results.memories,
        render: (item: SearchResults["memories"][number]) => (
          <>
            <p className="text-sm font-medium text-white">{highlight(item.path, debouncedQuery)}</p>
            <p className="mt-1 text-xs text-white/50">Line {item.line || "—"}</p>
            <p className="mt-2 text-sm text-white/70">{highlight(item.preview, debouncedQuery)}</p>
          </>
        ),
      },
      {
        title: "Files",
        items: results.files,
        render: (item: SearchResults["files"][number]) => (
          <>
            <p className="text-sm font-medium text-white">{highlight(item.path, debouncedQuery)}</p>
            <p className="mt-1 text-xs text-white/50">Line {item.lineNumber}</p>
            <p className="mt-2 text-sm text-white/70">{highlight(item.preview, debouncedQuery)}</p>
          </>
        ),
      },
      {
        title: "Conversations",
        items: results.conversations,
        render: (item: SearchResults["conversations"][number]) => (
          <>
            <p className="text-sm font-medium text-white">{highlight(item.label, debouncedQuery)}</p>
            <p className="mt-1 text-xs text-white/50">{item.model} · {item.status}</p>
            <p className="mt-2 text-sm text-white/70">Updated {new Date(item.updatedAt).toLocaleString()}</p>
          </>
        ),
      },
      {
        title: "Tasks",
        items: results.tasks,
        render: (item: SearchResults["tasks"][number]) => (
          <>
            <p className="text-sm font-medium text-white">{highlight(item.name, debouncedQuery)}</p>
            <p className="mt-1 text-xs text-white/50">{item.schedule} · {item.enabled ? "enabled" : "disabled"}</p>
            <p className="mt-2 text-sm text-white/70">{highlight(item.description, debouncedQuery)}</p>
          </>
        ),
      },
    ],
    [debouncedQuery, results]
  );

  const totalResults = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <PageShell>
      <section className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Search</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">Find anything fast</h2>
        <div className="mt-5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search memories, files, sessions, and tasks..."
            className="w-full rounded-2xl border border-[#2A2A3E] bg-[#0E1020] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#60A5FA]"
          />
        </div>

        {error ? (
          <div className="mt-6">
            <StatePanel
              title="Search is temporarily unavailable"
              detail={error}
              tone="warning"
              action={(
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white/80 hover:text-white"
                >
                  Try again
                </button>
              )}
            />
          </div>
        ) : loading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
            ))}
          </div>
        ) : !debouncedQuery ? (
          <div className="mt-6">
            <StatePanel
              title="Start with a keyword"
              detail="Search across memories, repo files, sessions, and cron jobs from one place."
            />
          </div>
        ) : !totalResults ? (
          <div className="mt-6">
            <StatePanel
              title="No matches yet"
              detail={`Nothing matched “${debouncedQuery}”. Try a broader word, a file name, or part of a session label.`}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {sections.map((section) => (
              <div key={section.title} className="rounded-2xl border border-[#2A2A3E] bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{section.title}</h3>
                  <span className="text-xs text-white/45">{section.items.length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {section.items.length ? section.items.slice(0, 8).map((item: { id: string }) => (
                    <div key={item.id} className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
                      <div className="min-w-0 break-words">{section.render(item as never)}</div>
                    </div>
                  )) : <p className="text-sm text-white/45">No results in this section.</p>}
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
