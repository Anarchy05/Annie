"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { StatePanel } from "@/components/state-panels";
import type { CronStateMeta } from "@/lib/cron-state";

type CronJob = {
  id: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  schedule?: {
    kind?: string;
    expr?: string;
    tz?: string;
    everyMs?: number;
    at?: string;
    anchorMs?: number;
  };
  state?: {
    nextRunAtMs?: number;
  };
};

type RunEntry = {
  startedAtMs?: number;
  status?: string;
  summary?: string;
  error?: string;
  skippedReason?: string;
};

const defaultJobsMeta: CronStateMeta = {
  status: "ok",
  source: "local",
  detail: "Loading cron schedule…",
};

const defaultRunsMeta: CronStateMeta = {
  status: "ok",
  source: "local",
  detail: "Loading run history…",
};

export default function CalendarPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [jobsMeta, setJobsMeta] = useState<CronStateMeta>(defaultJobsMeta);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, RunEntry[]>>({});
  const [runMeta, setRunMeta] = useState<Record<string, CronStateMeta>>({});
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);

    try {
      const response = await fetch("/api/cron/jobs", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load cron jobs");
      const data = (await response.json()) as { jobs: CronJob[]; meta?: CronStateMeta };
      setJobs(data.jobs);
      setJobsMeta(data.meta || defaultJobsMeta);
      setError(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Cron schedule is unavailable right now.";
      setJobs([]);
      setJobsMeta({
        status: "degraded",
        source: "fallback",
        detail,
      });
      setError(detail);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const upcomingJobs = useMemo(
    () => [...jobs].filter((job) => job.enabled !== false).sort((a, b) => (a.state?.nextRunAtMs || Number.MAX_SAFE_INTEGER) - (b.state?.nextRunAtMs || Number.MAX_SAFE_INTEGER)),
    [jobs]
  );

  const laterJobs = useMemo(
    () => [...jobs].filter((job) => job.enabled === false || !job.state?.nextRunAtMs),
    [jobs]
  );

  const handleToggleJob = async (jobId: string) => {
    setExpandedJobId((current) => (current === jobId ? null : jobId));
    if (runs[jobId] || loadingRunId === jobId) return;

    setLoadingRunId(jobId);
    try {
      const response = await fetch(`/api/cron/runs?jobId=${encodeURIComponent(jobId)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Run history is unavailable right now.");
      const data = (await response.json()) as { entries: RunEntry[]; meta?: CronStateMeta };
      setRuns((current) => ({ ...current, [jobId]: data.entries }));
      setRunMeta((current) => ({ ...current, [jobId]: data.meta || defaultRunsMeta }));
    } catch (err) {
      setRuns((current) => ({ ...current, [jobId]: [] }));
      setRunMeta((current) => ({
        ...current,
        [jobId]: {
          status: "degraded",
          source: "fallback",
          detail: err instanceof Error ? err.message : "Run history is unavailable right now.",
        },
      }));
    } finally {
      setLoadingRunId((current) => (current === jobId ? null : current));
    }
  };

  return (
    <PageShell>
      <section className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Schedule</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">Upcoming jobs</h2>
        <p className="mt-2 text-sm text-white/65">A cleaner list of what Annie is scheduled to do next.</p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-white/45">
            Source {jobsMeta.source} · {jobsMeta.status === "degraded" ? "degraded" : "ready"}
          </div>
          <button
            onClick={() => void load("refresh")}
            className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white/80 hover:text-white"
          >
            {refreshing ? "Refreshing…" : "Refresh schedule"}
          </button>
        </div>

        {jobsMeta.status === "degraded" ? (
          <div className="mt-4">
            <StatePanel title="Cron state is partially unavailable" detail={jobsMeta.detail} tone="warning" />
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-40 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
            ))}
          </div>
        ) : error && jobsMeta.status !== "degraded" ? (
          <div className="mt-6">
            <StatePanel
              title="Cron schedule is unavailable"
              detail={error}
              tone="danger"
              action={(
                <button
                  onClick={() => void load("refresh")}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white/80 hover:text-white"
                >
                  Refresh calendar
                </button>
              )}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ListPanel title="Next to run" subtitle={`${upcomingJobs.length} scheduled`}>
              {upcomingJobs.length ? upcomingJobs.slice(0, 12).map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  expanded={expandedJobId === job.id}
                  runs={runs[job.id] || []}
                  runsMeta={runMeta[job.id]}
                  loadingRuns={loadingRunId === job.id}
                  onToggle={handleToggleJob}
                />
              )) : <Empty text={jobsMeta.status === "degraded" ? "Upcoming jobs could not be confirmed while cron state is degraded." : "No upcoming jobs found. Annie has a clear runway right now."} />}
            </ListPanel>

            <ListPanel title="Disabled or unscheduled" subtitle={`${laterJobs.length} hidden from the main queue`}>
              {laterJobs.length ? laterJobs.slice(0, 12).map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  expanded={expandedJobId === job.id}
                  runs={runs[job.id] || []}
                  runsMeta={runMeta[job.id]}
                  loadingRuns={loadingRunId === job.id}
                  onToggle={handleToggleJob}
                />
              )) : <Empty text={jobsMeta.status === "degraded" ? "Disabled or unscheduled jobs could not be confirmed while cron state is degraded." : "Everything already has a next run. Nothing is parked off to the side."} />}
            </ListPanel>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function ListPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#2A2A3E] bg-black/20 p-4">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs text-white/45">{subtitle}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function JobCard({
  job,
  expanded,
  runs,
  runsMeta,
  loadingRuns,
  onToggle,
}: {
  job: CronJob;
  expanded: boolean;
  runs: RunEntry[];
  runsMeta?: CronStateMeta;
  loadingRuns: boolean;
  onToggle: (jobId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
      <button className="w-full text-left" onClick={() => void onToggle(job.id)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{job.name || "Untitled job"}</p>
            <p className="mt-1 text-xs text-white/50">{job.description || formatSchedule(job)}</p>
            {job.state?.nextRunAtMs ? <p className="mt-2 text-sm text-white/75">Next run {new Date(job.state.nextRunAtMs).toLocaleString()}</p> : null}
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${job.enabled === false ? "border-white/10 bg-white/5 text-white/55" : "border-[#34D399]/30 bg-[#34D399]/10 text-[#6EE7B7]"}`}>
            {job.enabled === false ? "off" : "on"}
          </span>
        </div>
      </button>

      {expanded ? (
        <div className="mt-3 border-t border-white/8 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-white/35">Recent runs</p>
            {runsMeta ? <p className="text-[11px] text-white/35">{runsMeta.source} · {runsMeta.status === "degraded" ? "degraded" : "ready"}</p> : null}
          </div>
          <div className="mt-2 space-y-2">
            {loadingRuns ? (
              <p className="text-xs text-white/45">Loading recent run history…</p>
            ) : runsMeta?.status === "degraded" ? (
              <StatePanel title="Run history is partially unavailable" detail={runsMeta.detail} tone="warning" />
            ) : runs.length ? runs.slice(0, 5).map((run, index) => (
              <div key={index} className="rounded-xl border border-white/8 bg-black/20 p-2 text-xs text-white/70">
                <p className="font-medium text-white">{run.status || "unknown"}</p>
                <p>{run.summary || run.error || run.skippedReason || "No summary"}</p>
                {run.startedAtMs ? <p className="mt-1 text-white/40">{new Date(run.startedAtMs).toLocaleString()}</p> : null}
              </div>
            )) : (
              <p className="text-xs text-white/45">{runsMeta?.detail || "No runs recorded yet."}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-white/10 bg-[#0E1020] p-4 text-sm text-white/45">{text}</p>;
}

function formatSchedule(job: CronJob) {
  const schedule = job.schedule;
  if (!schedule) return "No schedule details";
  if (schedule.kind === "cron") return `${schedule.expr || "cron"}${schedule.tz ? ` · ${schedule.tz}` : ""}`;
  if (schedule.kind === "at") return schedule.at || "One-time job";
  if (schedule.kind === "every") return schedule.everyMs ? `Every ${Math.round(schedule.everyMs / 60000)} min` : "Repeating job";
  return schedule.kind || "Schedule set";
}
