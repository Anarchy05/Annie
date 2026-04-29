"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type ControlCenterData = {
  priorities: Array<{ id: string; group: string; text: string }>;
  activeWork: Array<{
    id: string;
    title: string;
    detail: string;
    status: string;
    updatedAt: number;
    source: "task" | "session" | "cron";
  }>;
  agenda: Array<{ id: string; title: string; detail: string; timestamp: number }>;
  summary: {
    openPriorities: number;
    activeNow: number;
    upcomingJobs: number;
  };
  focus: {
    headline: string;
    note: string;
  };
  meta: {
    generatedAt: number;
    sources: Array<{
      key: "todo" | "tasks" | "sessions" | "cron";
      label: string;
      status: "ok" | "degraded";
      detail: string;
    }>;
  };
};

const filters = ["all", "tool", "assistant", "user"] as const;
const emptyControlCenter: ControlCenterData = {
  priorities: [],
  activeWork: [],
  agenda: [],
  summary: { openPriorities: 0, activeNow: 0, upcomingJobs: 0 },
  focus: {
    headline: "Mission Control is waking up.",
    note: "Waiting for local state to load.",
  },
  meta: {
    generatedAt: 0,
    sources: [],
  },
};

export default function FeedPage() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [controlCenter, setControlCenter] = useState<ControlCenterData>(emptyControlCenter);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [controlCenterLoading, setControlCenterLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [controlCenterError, setControlCenterError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);

    const [feedResult, controlCenterResult] = await Promise.allSettled([
      fetch("/api/feed", { cache: "no-store" }),
      fetch("/api/control-center", { cache: "no-store" }),
    ]);

    let loadedAny = false;

    if (feedResult.status === "fulfilled") {
      if (feedResult.value.ok) {
        const feedData = (await feedResult.value.json()) as { items: TimelineItem[] };
        setItems(feedData.items);
        setFeedError(null);
        loadedAny = true;
      } else {
        setFeedError("Live session feed is unavailable right now.");
      }
    } else {
      setFeedError("Live session feed is unavailable right now.");
    }

    if (controlCenterResult.status === "fulfilled") {
      if (controlCenterResult.value.ok) {
        const controlCenterData = (await controlCenterResult.value.json()) as ControlCenterData;
        setControlCenter(controlCenterData);
        setControlCenterError(null);
        loadedAny = true;
      } else {
        setControlCenterError("Control center data is unavailable right now.");
      }
    } else {
      setControlCenterError("Control center data is unavailable right now.");
    }

    if (loadedAny) setLastLoadedAt(Date.now());
    setControlCenterLoading(false);
    setFeedLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load("refresh"), 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [load]);

  const filteredItems = useMemo(
    () => items.filter((item) => filter === "all" || item.role === filter),
    [filter, items]
  );

  return (
    <PageShell>
      <div className="space-y-6">
        <section className="animate-fade-in rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Phase 1 control center</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">What matters now</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/65">
                A tighter operator view for priorities, Annie&apos;s current work, and the next scheduled beats.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryCard label="Open priorities" value={controlCenter.summary.openPriorities} accent="text-[#93C5FD]" />
                <SummaryCard label="Busy now" value={controlCenter.summary.activeNow} accent="text-[#6EE7B7]" />
                <SummaryCard label="Up next" value={controlCenter.summary.upcomingJobs} accent="text-[#C4B5FD]" />
              </div>
              <div className="flex items-center gap-3 text-xs text-white/45">
                <span>{lastLoadedAt ? `Refreshed ${formatRelative(lastLoadedAt)}` : "Loading live state..."}</span>
                <button
                  onClick={() => void load("refresh")}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-white/70 hover:text-white"
                >
                  {refreshing ? "Refreshing…" : "Refresh now"}
                </button>
              </div>
            </div>
          </div>

          {!controlCenterLoading && !controlCenterError && (
            <div className="mt-6 rounded-3xl border border-[#2A2A3E] bg-[linear-gradient(135deg,rgba(96,165,250,0.14),rgba(167,139,250,0.14))] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Annie&apos;s read on the room</p>
                  <p className="mt-2 text-lg font-semibold text-white">{controlCenter.focus.headline}</p>
                  <p className="mt-1 text-sm text-white/70">{controlCenter.focus.note}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {controlCenter.meta.sources.map((source) => (
                    <div
                      key={source.key}
                      className={`rounded-2xl border px-3 py-2 text-left ${source.status === "ok" ? "border-[#34D399]/30 bg-[#34D399]/10 text-[#CFFCEB]" : "border-yellow-400/30 bg-yellow-400/10 text-yellow-100"}`}
                      title={source.detail}
                    >
                      <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">{source.label}</p>
                      <p className="mt-1 text-xs">{source.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {controlCenterLoading ? (
            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-64 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {controlCenterError && (
                <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                  {controlCenterError}
                </div>
              )}
              <div className="grid gap-4 xl:grid-cols-3">
                <ControlPanel title="Active priorities" subtitle="Pulled from TODO.md">
                  <div className="space-y-3">
                    {controlCenter.priorities.length ? controlCenter.priorities.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{item.group}</p>
                        <p className="mt-2 text-sm text-white/85">{item.text}</p>
                      </div>
                    )) : <EmptyPanel text="No open priorities found in TODO.md." />}
                  </div>
                </ControlPanel>

                <ControlPanel title="What Annie is busy with now" subtitle="Recent sessions, cron work, and active tasks">
                  <div className="space-y-3">
                    {controlCenter.activeWork.length ? controlCenter.activeWork.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-all text-sm font-medium text-white">{item.title}</p>
                            <p className="mt-1 break-words text-xs text-white/55">{item.detail}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] capitalize ${statusTone(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-white/40">
                          <span className="capitalize">{item.source}</span>
                          <span>{formatRelative(item.updatedAt)}</span>
                        </div>
                      </div>
                    )) : <EmptyPanel text="No active or recent work surfaced right now." />}
                  </div>
                </ControlPanel>

                <ControlPanel title="Agenda" subtitle="Next scheduled jobs">
                  <div className="space-y-3">
                    {controlCenter.agenda.length ? controlCenter.agenda.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-white/55">{new Date(item.timestamp).toLocaleString()}</p>
                        <p className="mt-2 break-words text-sm text-white/75">{item.detail}</p>
                      </div>
                    )) : <EmptyPanel text="No upcoming jobs with next-run timestamps found." />}
                  </div>
                </ControlPanel>
              </div>
            </div>
          )}
        </section>

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

          {feedLoading ? (
            <div className="mt-6 grid gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-28 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {feedError && (
                <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                  {feedError}
                </div>
              )}
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
              {!feedError && !filteredItems.length && <p className="text-sm text-white/45">No matching activity yet.</p>}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function ControlPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#2A2A3E] bg-black/20 p-4">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs text-white/45">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-white/10 bg-[#0E1020] p-4 text-sm text-white/45">{text}</p>;
}

function formatRelative(timestamp: number) {
  if (!timestamp) return "Unknown";
  const diffMinutes = Math.max(Math.floor((Date.now() - timestamp) / 60_000), 0);
  if (diffMinutes <= 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (["running", "active", "in progress"].includes(normalized)) {
    return "border-[#34D399]/30 bg-[#34D399]/10 text-[#6EE7B7]";
  }
  if (["queued", "pending", "recent"].includes(normalized)) {
    return "border-[#60A5FA]/30 bg-[#60A5FA]/10 text-[#93C5FD]";
  }
  return "border-white/10 bg-white/5 text-white/70";
}

const dotClass = {
  tool: "bg-[#60A5FA] shadow-[0_0_20px_rgba(96,165,250,0.75)]",
  user: "bg-[#34D399] shadow-[0_0_20px_rgba(52,211,153,0.75)]",
  assistant: "bg-[#A78BFA] shadow-[0_0_20px_rgba(167,139,250,0.75)]",
};
