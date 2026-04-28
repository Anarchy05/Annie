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
};

const filters = ["all", "tool", "assistant", "user"] as const;
const emptyControlCenter: ControlCenterData = {
  priorities: [],
  activeWork: [],
  agenda: [],
  summary: { openPriorities: 0, activeNow: 0, upcomingJobs: 0 },
};

export default function FeedPage() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [controlCenter, setControlCenter] = useState<ControlCenterData>(emptyControlCenter);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [feedResponse, controlCenterResponse] = await Promise.all([
          fetch("/api/feed", { cache: "no-store" }),
          fetch("/api/control-center", { cache: "no-store" }),
        ]);
        if (!feedResponse.ok) throw new Error("Failed to load feed");
        if (!controlCenterResponse.ok) throw new Error("Failed to load control center");

        const feedData = (await feedResponse.json()) as { items: TimelineItem[] };
        const controlCenterData = (await controlCenterResponse.json()) as ControlCenterData;

        if (mounted) {
          setItems(feedData.items);
          setControlCenter(controlCenterData);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 30_000);
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard label="Open priorities" value={controlCenter.summary.openPriorities} accent="text-[#93C5FD]" />
              <SummaryCard label="Busy now" value={controlCenter.summary.activeNow} accent="text-[#6EE7B7]" />
              <SummaryCard label="Up next" value={controlCenter.summary.upcomingJobs} accent="text-[#C4B5FD]" />
            </div>
          </div>

          {loading ? (
            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-64 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
              ))}
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>
          ) : (
            <div className="mt-6 grid gap-4 xl:grid-cols-3">
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
