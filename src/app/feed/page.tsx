"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";

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
  taskTracker: {
    headline: string;
    note: string;
    summary: {
      running: number;
      queued: number;
      attention: number;
      completed: number;
    };
    items: Array<{
      id: string;
      title: string;
      detail: string;
      status: string;
      statusTone: "running" | "queued" | "attention" | "done" | "other";
      updatedAt: number;
    }>;
  };
  agenda: Array<{ id: string; title: string; detail: string; timestamp: number }>;
  projects: Array<{
    id: string;
    name: string;
    status: "planned" | "active" | "blocked" | "done";
    progress: number;
    summary: string;
    nextStep?: string;
    updatedAt: number;
    pinned?: boolean;
  }>;
  alerts: Array<{
    id: string;
    tone: "warning" | "focus" | "info";
    title: string;
    detail: string;
  }>;
  summary: {
    openPriorities: number;
    activeNow: number;
    upcomingJobs: number;
  };
  focus: {
    headline: string;
    note: string;
  };
  recommendation: {
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

type AutomationWatchData = {
  generatedAt: number;
  headline: string;
  note: string;
  summary: {
    failing: number;
    warning: number;
    upcoming: number;
  };
  items: Array<{
    id: string;
    title: string;
    detail: string;
    nextRunAt?: number;
    lastRunAt?: number;
    lastRunStatus: string;
    lastRunSummary: string;
    status: "healthy" | "warning" | "failing" | "idle";
  }>;
};

const emptyControlCenter: ControlCenterData = {
  priorities: [],
  activeWork: [],
  taskTracker: {
    headline: "Annie is checking the task runway.",
    note: "Live task details will appear after local state loads.",
    summary: { running: 0, queued: 0, attention: 0, completed: 0 },
    items: [],
  },
  agenda: [],
  projects: [],
  alerts: [],
  summary: { openPriorities: 0, activeNow: 0, upcomingJobs: 0 },
  focus: {
    headline: "Mission Control is waking up.",
    note: "Waiting for local state to load.",
  },
  recommendation: {
    headline: "Annie is getting oriented.",
    note: "Project guidance will appear after local state loads.",
  },
  meta: {
    generatedAt: 0,
    sources: [],
  },
};

export default function FeedPage() {
  const [controlCenter, setControlCenter] = useState<ControlCenterData>(emptyControlCenter);
  const [automationWatch, setAutomationWatch] = useState<AutomationWatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const liveWork = useMemo(
    () =>
      controlCenter.activeWork.filter((item) => {
        const status = item.status.toLowerCase();
        return ["running", "active", "in progress"].includes(status);
      }),
    [controlCenter.activeWork]
  );
  const recentWork = useMemo(
    () =>
      controlCenter.activeWork.filter((item) => {
        const status = item.status.toLowerCase();
        return !["running", "active", "in progress"].includes(status);
      }),
    [controlCenter.activeWork]
  );

  const loadAutomationWatch = useCallback(async () => {
    try {
      const response = await fetch("/api/automation-watch", { cache: "no-store" });
      if (!response.ok) throw new Error("Automation watch is unavailable right now.");
      const data = (await response.json()) as AutomationWatchData;
      setAutomationWatch(data);
      setAutomationError(null);
    } catch (err) {
      setAutomationError(err instanceof Error ? err.message : "Automation watch is unavailable right now.");
    }
  }, []);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);

    try {
      const response = await fetch("/api/control-center", { cache: "no-store" });
      if (!response.ok) throw new Error("Control center data is unavailable right now.");
      const data = (await response.json()) as ControlCenterData;
      setControlCenter(data);
      setError(null);
      setLastLoadedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Control center data is unavailable right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    void loadAutomationWatch();
  }, [loadAutomationWatch]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void load("refresh");
      }
    }, 30_000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void load("refresh");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [load]);

  return (
    <PageShell>
      <div className="space-y-5">
        <section className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Overview</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">What matters now</h2>
              <p className="mt-2 text-sm text-white/65">A simpler view of priorities, current work, and what&apos;s next.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/45">
              <span>{lastLoadedAt ? `Updated ${formatRelative(lastLoadedAt)}` : "Loading..."}</span>
              <button
                onClick={() => void load("refresh")}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-white/70 hover:text-white"
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Priorities" value={controlCenter.summary.openPriorities} />
            <SummaryCard label="Active now" value={controlCenter.summary.activeNow} />
            <SummaryCard label="Up next" value={controlCenter.summary.upcomingJobs} />
          </div>

          {controlCenter.meta.sources.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {controlCenter.meta.sources.map((source) => (
                <SourceBadge key={source.key} label={source.label} status={source.status} detail={source.detail} />
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">{error}</div>
          ) : (
            <>
              <div className="mt-5 rounded-3xl border border-[#2A2A3E] bg-[linear-gradient(135deg,rgba(96,165,250,0.14),rgba(167,139,250,0.14))] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Focus</p>
                <p className="mt-2 text-lg font-semibold text-white">{controlCenter.focus.headline}</p>
                <p className="mt-1 text-sm text-white/70">{controlCenter.focus.note}</p>
              </div>

              {controlCenter.alerts.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {controlCenter.alerts.map((alert) => (
                    <AttentionCard key={alert.id} alert={alert} />
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <BriefCard
                  label="Top priority"
                  title={controlCenter.priorities[0]?.text || "Backlog is clear"}
                  detail={controlCenter.priorities[0]?.group || "Nothing urgent is surfacing."}
                />
                <BriefCard
                  label="Live now"
                  title={liveWork[0]?.title || "No hot thread running"}
                  detail={
                    liveWork[0]
                      ? `${liveWork[0].source} · ${liveWork[0].status}`
                      : controlCenter.activeWork[0]
                        ? `Latest signal: ${controlCenter.activeWork[0].title}`
                        : "Annie is calm and ready for the next push."
                  }
                />
                <BriefCard
                  label="Next beat"
                  title={controlCenter.agenda[0]?.title || "No scheduled beat queued"}
                  detail={
                    controlCenter.agenda[0]
                      ? `${formatRelativeFuture(controlCenter.agenda[0].timestamp)} · ${controlCenter.agenda[0].detail}`
                      : "Nothing time-based is pressing right now."
                  }
                />
              </div>
            </>
          )}
        </section>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-44 rounded-3xl border border-[#2A2A3E] bg-black/20 skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Top priorities">
              {controlCenter.priorities.length ? (
                <div className="space-y-3">
                  {controlCenter.priorities.slice(0, 6).map((item) => (
                    <ItemCard key={item.id} eyebrow={item.group} title={item.text} />
                  ))}
                </div>
              ) : (
                <EmptyPanel text="No open priorities found." />
              )}
            </Panel>

            <Panel
              title="Current work"
              headerRight={
                controlCenter.activeWork.length ? (
                  <span className="text-xs text-white/40">{liveWork.length} live · {recentWork.length} recent</span>
                ) : undefined
              }
            >
              {controlCenter.activeWork.length ? (
                <div className="space-y-4">
                  {liveWork.length ? (
                    <div>
                      <SectionLabel label="Live now" />
                      <div className="mt-2 space-y-3">
                        {liveWork.slice(0, 4).map((item) => (
                          <ItemCard
                            key={item.id}
                            eyebrow={`${item.source} · ${formatRelative(item.updatedAt)}`}
                            title={item.title}
                            detail={item.detail}
                            status={item.status}
                            highlight
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyPanel text="No thread is actively running right this second." />
                  )}

                  {recentWork.length ? (
                    <div>
                      <SectionLabel label="Recent signals" />
                      <div className="mt-2 space-y-3">
                        {recentWork.slice(0, 3).map((item) => (
                          <ItemCard
                            key={item.id}
                            eyebrow={`${item.source} · ${formatRelative(item.updatedAt)}`}
                            title={item.title}
                            detail={item.detail}
                            status={item.status}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyPanel text="Nothing active right now." />
              )}
            </Panel>

            <Panel
              title="Task runway"
              headerRight={
                <span className="text-xs text-white/40">
                  {controlCenter.taskTracker.summary.running} live · {controlCenter.taskTracker.summary.queued} queued · {controlCenter.taskTracker.summary.attention} attention
                </span>
              }
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#60A5FA]/20 bg-[linear-gradient(135deg,rgba(96,165,250,0.12),rgba(167,139,250,0.12))] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Annie&apos;s task read</p>
                  <p className="mt-2 text-base font-semibold text-white">{controlCenter.taskTracker.headline}</p>
                  <p className="mt-1 text-sm text-white/70">{controlCenter.taskTracker.note}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryMiniCard label="Running" value={controlCenter.taskTracker.summary.running} tone="running" />
                  <SummaryMiniCard label="Queued" value={controlCenter.taskTracker.summary.queued} tone="queued" />
                  <SummaryMiniCard label="Attention" value={controlCenter.taskTracker.summary.attention} tone="attention" />
                  <SummaryMiniCard label="Done" value={controlCenter.taskTracker.summary.completed} tone="done" />
                </div>

                <div>
                  <SectionLabel label="Recent task flow" />
                  <div className="mt-2 space-y-3">
                    {controlCenter.taskTracker.items.length ? (
                      controlCenter.taskTracker.items.map((item) => (
                        <ItemCard
                          key={item.id}
                          eyebrow={item.updatedAt ? `Updated ${formatRelative(item.updatedAt)}` : "Task state"}
                          title={item.title}
                          detail={item.detail}
                          status={item.status}
                          highlight={item.statusTone === "running" || item.statusTone === "attention"}
                        />
                      ))
                    ) : (
                      <EmptyPanel text="No live task queue is surfacing yet." />
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              title="Automation watch"
              headerRight={
                automationWatch ? (
                  <span className="text-xs text-white/40">
                    {automationWatch.summary.failing} failing · {automationWatch.summary.warning} warning
                  </span>
                ) : undefined
              }
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#60A5FA]/20 bg-[linear-gradient(135deg,rgba(96,165,250,0.12),rgba(167,139,250,0.12))] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Annie&apos;s automation read</p>
                  <p className="mt-2 text-base font-semibold text-white">{automationWatch?.headline || "Reading the automation runway…"}</p>
                  <p className="mt-1 text-sm text-white/70">{automationWatch?.note || "Loading recent run health without slowing down the main dashboard."}</p>
                </div>

                <div>
                  <SectionLabel label="Next up" />
                  <div className="mt-2 space-y-3">
                    {controlCenter.agenda.length ? (
                      controlCenter.agenda.slice(0, 3).map((item) => (
                        <ItemCard
                          key={item.id}
                          eyebrow={new Date(item.timestamp).toLocaleString()}
                          title={item.title}
                          detail={item.detail}
                        />
                      ))
                    ) : (
                      <EmptyPanel text="No upcoming scheduled jobs." />
                    )}
                  </div>
                </div>

                <div>
                  <SectionLabel label="Recent run health" />
                  <div className="mt-2 space-y-3">
                    {automationError ? (
                      <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100">{automationError}</div>
                    ) : automationWatch ? (
                      automationWatch.items.length ? (
                        automationWatch.items.map((item) => (
                          <ItemCard
                            key={item.id}
                            eyebrow={item.lastRunAt ? `Last run ${formatRelative(item.lastRunAt)}` : "No recent run logged"}
                            title={item.title}
                            detail={`${item.lastRunStatus} · ${item.lastRunSummary}`}
                            status={item.status}
                            highlight={item.status === "failing" || item.status === "warning"}
                          />
                        ))
                      ) : (
                        <EmptyPanel text="No automation health signals are available yet." />
                      )
                    ) : (
                      <div className="space-y-3">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <div key={index} className="h-20 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Project pulse">
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#60A5FA]/20 bg-[linear-gradient(135deg,rgba(96,165,250,0.12),rgba(167,139,250,0.12))] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Annie&apos;s next move</p>
                  <p className="mt-2 text-base font-semibold text-white">{controlCenter.recommendation.headline}</p>
                  <p className="mt-1 text-sm text-white/70">{controlCenter.recommendation.note}</p>
                </div>

                {controlCenter.projects.length ? (
                  controlCenter.projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))
                ) : (
                  <EmptyPanel text="No tracked projects are surfacing yet." />
                )}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function SummaryMiniCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "running" | "queued" | "attention" | "done";
}) {
  const toneClass =
    tone === "running"
      ? "border-[#34D399]/25 bg-[#34D399]/10 text-[#CFFCE9]"
      : tone === "queued"
        ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-100"
        : tone === "attention"
          ? "border-red-400/30 bg-red-400/10 text-red-100"
          : "border-[#60A5FA]/25 bg-[#60A5FA]/10 text-[#BFDBFE]";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] opacity-80">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Panel({
  title,
  headerRight,
  children,
}: {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {headerRight}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BriefCard({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-sm text-white/55">{detail}</p>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{label}</p>;
}

function ItemCard({
  eyebrow,
  title,
  detail,
  status,
  highlight,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  status?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${highlight ? "border-[#34D399]/20 bg-[linear-gradient(135deg,rgba(52,211,153,0.08),rgba(96,165,250,0.08))]" : "border-white/8 bg-[#0E1020]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{eyebrow}</p>
          <p className="mt-2 text-sm font-medium text-white">{title}</p>
          {detail ? <p className="mt-1 text-sm text-white/60">{detail}</p> : null}
        </div>
        {status ? <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] capitalize ${statusTone(status)}`}>{status}</span> : null}
      </div>
    </div>
  );
}

function SourceBadge({ label, status, detail }: { label: string; status: "ok" | "degraded"; detail: string }) {
  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs ${status === "ok" ? "border-[#34D399]/25 bg-[#34D399]/10 text-[#CFFCE9]" : "border-yellow-400/30 bg-yellow-400/10 text-yellow-100"}`}>
      <span className="font-medium text-white">{label}</span>
      <span className="ml-2 opacity-80">{detail}</span>
    </div>
  );
}

function AttentionCard({ alert }: { alert: ControlCenterData["alerts"][number] }) {
  return (
    <div className={`rounded-2xl border p-3 ${attentionTone(alert.tone)}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Needs attention</p>
      <p className="mt-2 text-sm font-medium text-white">{alert.title}</p>
      <p className="mt-1 text-sm text-white/70">{alert.detail}</p>
    </div>
  );
}

function ProjectCard({
  project,
}: {
  project: ControlCenterData["projects"][number];
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white">{project.name}</p>
            {project.pinned ? <span className="rounded-full border border-[#60A5FA]/30 bg-[#60A5FA]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#93C5FD]">Pinned</span> : null}
          </div>
          <p className="mt-1 text-sm text-white/60">{project.nextStep || project.summary}</p>
          <p className="mt-2 text-xs text-white/35">Updated {formatRelative(project.updatedAt)}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] capitalize ${projectStatusTone(project.status)}`}>{project.status}</span>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/35">
          <span>Progress</span>
          <span>{project.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-[#60A5FA]" style={{ width: `${project.progress}%` }} />
        </div>
      </div>
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

function formatRelativeFuture(timestamp: number) {
  if (!timestamp) return "Unknown";
  const diffMinutes = Math.round((timestamp - Date.now()) / 60_000);
  if (diffMinutes <= 1) return "due now";
  if (diffMinutes < 60) return `in ${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (["running", "active", "in progress", "healthy", "success", "completed"].includes(normalized)) {
    return "border-[#34D399]/30 bg-[#34D399]/10 text-[#6EE7B7]";
  }
  if (["queued", "pending", "recent", "warning", "skipped"].includes(normalized)) {
    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  }
  if (["failing", "failed", "error", "timeout"].includes(normalized)) {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }
  if (["idle"].includes(normalized)) {
    return "border-[#60A5FA]/30 bg-[#60A5FA]/10 text-[#93C5FD]";
  }
  return "border-white/10 bg-white/5 text-white/70";
}

function projectStatusTone(status: ControlCenterData["projects"][number]["status"]) {
  if (status === "blocked") return "border-red-400/30 bg-red-400/10 text-red-200";
  if (status === "active") return "border-[#34D399]/30 bg-[#34D399]/10 text-[#6EE7B7]";
  if (status === "planned") return "border-[#60A5FA]/30 bg-[#60A5FA]/10 text-[#93C5FD]";
  return "border-white/10 bg-white/5 text-white/70";
}

function attentionTone(tone: ControlCenterData["alerts"][number]["tone"]) {
  if (tone === "warning") return "border-yellow-400/30 bg-yellow-400/10";
  if (tone === "focus") return "border-[#60A5FA]/25 bg-[#60A5FA]/10";
  return "border-white/10 bg-black/20";
}
