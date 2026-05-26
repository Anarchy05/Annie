"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { PageShell } from "@/components/page-shell";
import { StatePanel } from "@/components/state-panels";

type SearchResults = {
  memories: Array<{ id: string; path: string; line?: number; preview: string; score: number }>;
  files: Array<{ id: string; path: string; lineNumber: number; preview: string }>;
  conversations: Array<{ id: string; key: string; sessionId: string; label: string; model: string; updatedAt: number; status: string }>;
  tasks: Array<{ id: string; name: string; description: string; schedule: string; enabled: boolean }>;
};

const emptyResults: SearchResults = { memories: [], files: [], conversations: [], tasks: [] };
const RECENT_SEARCHES_KEY = "annie-mission-control-recent-searches";
const MAX_RECENT_SEARCHES = 6;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latestRequestId = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const targetTag = target instanceof HTMLElement ? target.tagName : "";
      const isTypingField =
        target instanceof HTMLElement &&
        (targetTag === "INPUT" || targetTag === "TEXTAREA" || target.isContentEditable);

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingField) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }

      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!debouncedQuery) {
      latestRequestId.current += 1;
      return () => {
        cancelled = true;
      };
    }

    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Search is unavailable right now.");
        const data = (await response.json()) as SearchResults;
        if (!cancelled && requestId === latestRequestId.current) {
          setResults(data);
          setError(null);
          rememberSearch(debouncedQuery, setRecentSearches);
        }
      } catch (err) {
        if (!cancelled && requestId === latestRequestId.current) {
          setResults(emptyResults);
          setError(err instanceof Error ? err.message : "Search is unavailable right now.");
        }
      } finally {
        if (!cancelled && requestId === latestRequestId.current) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
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
            <div className="mt-3 flex flex-wrap gap-2">
              <ResultLink href={`/files?path=${encodeURIComponent(item.path)}&view=1${item.line ? `&line=${item.line}` : ""}`}>Open preview</ResultLink>
              <ResultLink href={`/files?path=${encodeURIComponent(item.path)}`}>Browse location</ResultLink>
            </div>
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
            <div className="mt-3 flex flex-wrap gap-2">
              <ResultLink href={`/files?path=${encodeURIComponent(item.path)}&view=1&line=${item.lineNumber}`}>Open preview</ResultLink>
              <ResultLink href={`/api/files?path=${encodeURIComponent(item.path)}`}>Download</ResultLink>
            </div>
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
            <div className="mt-3 flex flex-wrap gap-2">
              <ResultLink href={`/chat?session=${encodeURIComponent(item.sessionId)}&label=${encodeURIComponent(item.label)}`}>Open transcript</ResultLink>
            </div>
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
            <div className="mt-3 flex flex-wrap gap-2">
              <ResultLink href="/calendar">Open schedule</ResultLink>
            </div>
          </>
        ),
      },
    ],
    [debouncedQuery, results]
  );

  const totalResults = sections.reduce((sum, section) => sum + section.items.length, 0);
  const topResultSection = sections.find((section) => section.items.length > 0);

  return (
    <PageShell>
      <section className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Search</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">Find anything fast</h2>
        <div className="mt-5">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (!nextQuery.trim()) {
                setError(null);
                setLoading(false);
              }
            }}
            placeholder="Search memories, files, sessions, and tasks..."
            className="w-full rounded-2xl border border-[#2A2A3E] bg-[#0E1020] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#60A5FA]"
          />
          <div className="mt-3 flex flex-col gap-3 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
            <p>Annie can search memories, repo files, session labels, and automation notes from one box.</p>
            <p className="text-xs uppercase tracking-[0.18em] text-white/35">Press / to focus · Esc to step back</p>
          </div>
        </div>

        {recentSearches.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {recentSearches.map((recent) => (
              <button
                key={recent}
                type="button"
                onClick={() => setQuery(recent)}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/20 hover:text-white"
              >
                {recent}
              </button>
            ))}
          </div>
        ) : null}

        {debouncedQuery && !error && !loading ? (
          <div className="mt-5 rounded-2xl border border-[#2A2A3E] bg-black/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">Search read</p>
                <p className="mt-1 text-sm text-white/80">
                  {totalResults ? (
                    <>
                      Annie found <span className="font-medium text-white">{totalResults}</span> match{totalResults === 1 ? "" : "es"}
                      {topResultSection ? `, led by ${topResultSection.title.toLowerCase()}.` : "."}
                    </>
                  ) : (
                    <>Annie didn&apos;t find a clean match yet.</>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {sections.map((section) => (
                  <span key={section.title} className="rounded-full border border-white/10 bg-[#0E1020] px-3 py-1.5 text-white/65">
                    {section.title} · {section.items.length}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

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
              detail={recentSearches.length ? "Pick a recent search or type a keyword to scan memories, repo files, sessions, and cron jobs from one place." : "Search across memories, repo files, sessions, and cron jobs from one place."}
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

function ResultLink({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("/api/");

  if (external) {
    return (
      <a
        href={href}
        className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70 hover:text-white"
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70 hover:text-white">
      {children}
    </Link>
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

function readRecentSearches() {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function rememberSearch(query: string, setRecentSearches: Dispatch<SetStateAction<string[]>>) {
  setRecentSearches((current) => {
    const next = [query, ...current.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);

    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // Ignore localStorage write issues.
    }

    return next;
  });
}
