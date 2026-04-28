"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";

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
  payload?: {
    kind?: string;
    message?: string;
    text?: string;
  };
  state?: {
    nextRunAtMs?: number;
  };
};

type RunEntry = {
  startedAtMs?: number;
  finishedAtMs?: number;
  status?: string;
  summary?: string;
  error?: string;
  skippedReason?: string;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, RunEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/cron/jobs", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load cron jobs");
        const data = (await response.json()) as { jobs: CronJob[] };
        setJobs(data.jobs);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  const jobsByDay = useMemo(() => {
    return weekDays.map((day) => ({
      day,
      jobs: jobs.filter((job) => isJobScheduledForDay(job, day)),
    }));
  }, [jobs, weekDays]);

  const handleToggleJob = async (jobId: string) => {
    setExpandedJobId((current) => (current === jobId ? null : jobId));
    if (runs[jobId]) return;

    const response = await fetch(`/api/cron/runs?jobId=${encodeURIComponent(jobId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { entries: RunEntry[] };
    setRuns((current) => ({ ...current, [jobId]: data.entries }));
  };

  return (
    <PageShell>
      <section className="animate-fade-in rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Schedules</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Cron calendar</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-full border border-[#2A2A3E] bg-black/20 px-4 py-2 text-sm text-white/70 hover:text-white" onClick={() => setWeekOffset((value) => value - 1)}>Prev</button>
            <button className="rounded-full border border-[#2A2A3E] bg-black/20 px-4 py-2 text-sm text-white/70 hover:text-white" onClick={() => setWeekOffset(0)}>Today</button>
            <button className="rounded-full border border-[#2A2A3E] bg-black/20 px-4 py-2 text-sm text-white/70 hover:text-white" onClick={() => setWeekOffset((value) => value + 1)}>Next</button>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-7">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-48 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-7">
            {jobsByDay.map(({ day, jobs: dayJobs }) => {
              const today = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={`rounded-2xl border p-3 ${today ? "border-[#60A5FA] bg-[#60A5FA]/10" : "border-[#2A2A3E] bg-black/20"}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/40">{weekdayLabels[day.getDay()]}</p>
                      <p className="text-lg font-semibold text-white">{day.getDate()}</p>
                    </div>
                    {today && <span className="rounded-full bg-[#60A5FA] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0A0A0F]">Today</span>}
                  </div>

                  <div className="space-y-3">
                    {dayJobs.length ? dayJobs.map((job) => (
                      <div key={job.id} className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
                        <button className="w-full text-left" onClick={() => handleToggleJob(job.id)}>
                          <p className="text-sm font-medium text-white">{job.name || "Untitled job"}</p>
                          <p className="mt-1 text-xs text-white/45">{job.schedule?.expr || job.schedule?.kind || "manual"} {job.schedule?.tz ? `· ${job.schedule.tz}` : ""}</p>
                          {job.description && <p className="mt-2 line-clamp-2 text-xs text-white/60">{job.description}</p>}
                        </button>
                        {expandedJobId === job.id && (
                          <div className="mt-3 border-t border-white/8 pt-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-white/35">Run history</p>
                            <div className="mt-2 space-y-2">
                              {(runs[job.id] || []).length ? (runs[job.id] || []).map((run, index) => (
                                <div key={index} className="rounded-xl border border-white/8 bg-black/20 p-2 text-xs text-white/70">
                                  <p className="font-medium text-white">{run.status || "unknown"}</p>
                                  <p>{run.summary || run.error || run.skippedReason || "No summary"}</p>
                                  {run.startedAtMs && <p className="mt-1 text-white/40">{new Date(run.startedAtMs).toLocaleString()}</p>}
                                </div>
                              )) : <p className="text-xs text-white/45">No runs recorded yet.</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    )) : <p className="text-sm text-white/40">No matching jobs</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function getWeekDays(weekOffset: number) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() + weekOffset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isJobScheduledForDay(job: CronJob, day: Date) {
  const schedule = job.schedule;
  if (!schedule) return false;

  if (schedule.kind === "cron" && schedule.expr) {
    const parts = schedule.expr.trim().split(/\s+/);
    if (parts.length < 5) return false;
    const [, , dayOfMonth, month, dayOfWeek] = parts;
    return [
      matchesCronPart(dayOfMonth, day.getDate(), 1, 31),
      matchesCronPart(month, day.getMonth() + 1, 1, 12),
      matchesCronPart(dayOfWeek, day.getDay(), 0, 6),
    ].every(Boolean);
  }

  if (schedule.kind === "at" && schedule.at) {
    return isSameDay(new Date(schedule.at), day);
  }

  if (schedule.kind === "every" && schedule.everyMs && schedule.anchorMs) {
    const diff = day.getTime() - schedule.anchorMs;
    if (diff < 0) return false;
    return diff % schedule.everyMs < 86_400_000;
  }

  return false;
}

function matchesCronPart(part: string, value: number, min: number, max: number) {
  if (part === "*") return true;

  return part.split(",").some((token) => {
    if (token.includes("/")) {
      const [base, stepRaw] = token.split("/");
      const step = Number(stepRaw);
      const range = base === "*" ? `${min}-${max}` : base;
      const [start, end] = range.split("-").map(Number);
      if (Number.isNaN(step) || Number.isNaN(start) || Number.isNaN(end)) return false;
      return value >= start && value <= end && (value - start) % step === 0;
    }

    if (token.includes("-")) {
      const [start, end] = token.split("-").map(Number);
      return value >= start && value <= end;
    }

    return Number(token) === value;
  });
}
