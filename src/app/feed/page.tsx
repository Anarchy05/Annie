"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";

type TimelineItem = {
  id: string;
  sessionKey: string;
  sessionLabel: string;
  role: "tool" | "assistant" | "user";
  title: string;
  body: string;
  timestamp: number;
};

const filters = ["all", "tool", "assistant", "user"] as const;

export default function FeedPage() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch("/api/feed", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load feed");
        const data = (await response.json()) as { items: TimelineItem[] };
        if (mounted) {
          setItems(data.items);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const filteredItems = useMemo(
    () => items.filter((item) => filter === "all" || item.role === filter),
    [filter, items]
  );

  return (
    <PageShell>
      <section className="animate-fade-in rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Live activity</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Session feed</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-full border px-4 py-2 text-sm ${
                  filter === value
                    ? "border-[#60A5FA] bg-[#60A5FA] text-[#0A0A0F]"
                    : "border-[#2A2A3E] bg-black/20 text-white/65 hover:border-white/20 hover:text-white"
                }`}
              >
                {value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1) + (value === "tool" ? "s" : "")}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-6 grid gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredItems.map((item) => (
              <article key={item.id} className="min-w-0 rounded-2xl border border-[#2A2A3E] bg-black/20 p-4">
                <div className="flex items-start gap-4">
                  <span className={`mt-1 inline-flex h-3 w-3 shrink-0 rounded-full ${dotClass[item.role]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="break-words text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-1 break-all text-xs text-white/45">{item.sessionLabel}</p>
                      </div>
                      <p className="text-xs text-white/45">{new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-white/8 bg-[#0E1020] p-3 font-mono text-xs text-white/75">{item.body}</pre>
                  </div>
                </div>
              </article>
            ))}
            {!filteredItems.length && <p className="text-sm text-white/45">No matching activity yet.</p>}
          </div>
        )}
      </section>
    </PageShell>
  );
}

const dotClass = {
  tool: "bg-[#60A5FA] shadow-[0_0_20px_rgba(96,165,250,0.75)]",
  user: "bg-[#34D399] shadow-[0_0_20px_rgba(52,211,153,0.75)]",
  assistant: "bg-[#A78BFA] shadow-[0_0_20px_rgba(167,139,250,0.75)]",
};
