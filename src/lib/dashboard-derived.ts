export type Session = {
  key: string;
  updatedAt?: number;
  ageMs?: number;
  sessionId: string;
  totalTokens?: number | null;
  contextTokens?: number;
  model?: string;
  agentId?: string;
  kind?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  inputTokens?: number;
  outputTokens?: number;
};

export type SessionsListResponse = {
  count: number;
  sessions: Session[];
};

export type SourceHealth = {
  key: "todo" | "tasks" | "sessions" | "cron";
  label: string;
  status: "ok" | "degraded";
  detail: string;
};

export type AttentionItem = {
  id: string;
  tone: "warning" | "focus" | "info";
  title: string;
  detail: string;
};

export type CronJob = {
  id: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  createdAtMs?: number;
  updatedAtMs?: number;
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
    text?: string;
    message?: string;
  };
  state?: {
    nextRunAtMs?: number;
  };
  sessionKey?: string;
  sessionTarget?: string;
  wakeMode?: string;
};

export type TaskEntry = {
  taskId?: string;
  runId?: string;
  runtime?: string;
  status?: string;
  sessionKey?: string;
  createdAtMs?: number;
  startedAtMs?: number;
  updatedAtMs?: number;
  summary?: string;
  title?: string;
};

export type TasksListResponse = {
  count: number;
  tasks: TaskEntry[];
};

export type ResourceSnapshot = {
  timestamp: number;
  memoryCurrentBytes: number;
  memoryLimitBytes: number;
  cpuUsageUsec: number;
  cpuLimitCores: number;
  pidsCurrent: number;
  pidsLimit: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
};

export type PriorityItem = {
  id: string;
  group: string;
  text: string;
};

export type ActiveWorkItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  updatedAt: number;
  source: "task" | "session" | "cron";
};

export type AgendaItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: number;
};

export type AutomationWatchItem = {
  id: string;
  title: string;
  detail: string;
  nextRunAt?: number;
  lastRunAt?: number;
  lastRunStatus: string;
  lastRunSummary: string;
  status: "healthy" | "warning" | "failing" | "idle";
};

export type AutomationWatchData = {
  generatedAt: number;
  headline: string;
  note: string;
  summary: {
    failing: number;
    warning: number;
    upcoming: number;
  };
  items: AutomationWatchItem[];
};

export type ProjectPulseItem = {
  id: string;
  name: string;
  status: "planned" | "active" | "blocked" | "done";
  progress: number;
  summary: string;
  nextStep?: string;
  updatedAt: number;
  pinned?: boolean;
};

export type ControlCenterData = {
  priorities: PriorityItem[];
  activeWork: ActiveWorkItem[];
  agenda: AgendaItem[];
  projects: ProjectPulseItem[];
  alerts: AttentionItem[];
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
    sources: SourceHealth[];
  };
};

export type TimelineItem = {
  id: string;
  sessionKey: string;
  sessionLabel: string;
  role: "tool" | "assistant" | "user";
  title: string;
  body: string;
  timestamp: number;
};

export type CronRunEntry = {
  startedAtMs?: number;
  finishedAtMs?: number;
  status?: string;
  summary?: string;
  error?: string;
  skippedReason?: string;
};

export function formatTimestamp(value?: number) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function compactNumber(value?: number | null) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export function normalizeRunStatus(status?: string) {
  const normalized = (status || "unknown").toLowerCase();
  if (["ok", "success", "completed", "done"].includes(normalized)) return "healthy" as const;
  if (["failed", "error", "timeout", "timed_out"].includes(normalized)) return "failing" as const;
  if (["skipped", "cancelled", "canceled", "partial"].includes(normalized)) return "warning" as const;
  return "idle" as const;
}

export function normalizeTaskStatus(status?: string) {
  if (!status) return "unknown";
  return status.replace(/[_-]+/g, " ");
}

export function parsePriorityItems(raw: string) {
  const lines = raw.split("\n");
  const items: PriorityItem[] = [];
  let inCurrentPriorities = false;
  let currentGroup = "Current Priorities";

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,3})\s+(.*)$/);
    if (headingMatch) {
      const heading = headingMatch[2].trim();
      if (headingMatch[1] === "##") {
        inCurrentPriorities = heading === "Current Priorities";
        currentGroup = heading;
      } else if (inCurrentPriorities && headingMatch[1] === "###") {
        currentGroup = heading;
      }
      continue;
    }

    if (!inCurrentPriorities) continue;
    const todoMatch = line.match(/^- \[ \] (.+)$/);
    if (!todoMatch) continue;

    items.push({
      id: `${currentGroup}-${items.length}`,
      group: currentGroup,
      text: todoMatch[1].trim(),
    });
  }

  return items;
}

export function buildActiveWork(tasks: TaskEntry[], sessions: Session[]) {
  const activeTaskStatuses = new Set(["queued", "pending", "running", "active", "in_progress"]);

  return [
    ...tasks
      .filter((task) => activeTaskStatuses.has((task.status || "").toLowerCase()))
      .map((task) => ({
        id: `task-${task.taskId || task.runId || task.sessionKey || "task"}`,
        title: task.title || task.runtime || task.taskId || "Task",
        detail: task.summary || task.sessionKey || "OpenClaw task",
        status: normalizeTaskStatus(task.status),
        updatedAt: task.updatedAtMs || task.startedAtMs || task.createdAtMs || 0,
        source: "task" as const,
      })),
    ...sessions
      .filter((session) => (session.ageMs || Number.POSITIVE_INFINITY) < 30 * 60_000)
      .slice(0, 6)
      .map((session) => ({
        id: `session-${session.key}`,
        title: session.key,
        detail: `${session.model || "unknown"} · ${session.kind || "session"}`,
        status: (session.ageMs || 0) < 120_000 ? "running" : "recent",
        updatedAt: session.updatedAt || 0,
        source: session.key.includes(":cron:") ? ("cron" as const) : ("session" as const),
      })),
  ]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);
}

export function buildAgenda(jobs: CronJob[]) {
  return jobs
    .filter((job) => job.enabled !== false && typeof job.state?.nextRunAtMs === "number")
    .sort((a, b) => (a.state?.nextRunAtMs || 0) - (b.state?.nextRunAtMs || 0))
    .slice(0, 6)
    .map((job) => ({
      id: job.id,
      title: job.name || "Untitled job",
      detail:
        job.description ||
        job.payload?.message ||
        job.payload?.text ||
        job.schedule?.expr ||
        job.schedule?.kind ||
        "Scheduled job",
      timestamp: job.state?.nextRunAtMs || 0,
    }));
}

export function buildFocusSummary(priorities: PriorityItem[], activeWork: ActiveWorkItem[], agenda: AgendaItem[]) {
  const runningWork = activeWork.filter((item) => item.status.toLowerCase() === "running");
  const nextJob = agenda[0];

  if (runningWork.length) {
    return {
      headline: `Annie is actively moving ${runningWork.length} thread${runningWork.length === 1 ? "" : "s"}.`,
      note: runningWork[0]?.title || "Live work is underway right now.",
    };
  }

  if (priorities.length && activeWork.length) {
    return {
      headline: `There are ${priorities.length} open priorities and ${activeWork.length} recent work signal${activeWork.length === 1 ? "" : "s"}.`,
      note: `Best next glance: ${priorities[0]?.text || "Review the top backlog item."}`,
    };
  }

  if (nextJob) {
    return {
      headline: "The board is calm, but the next automation beat is queued.",
      note: `${nextJob.title} at ${formatTimestamp(nextJob.timestamp)}`,
    };
  }

  return {
    headline: "Mission Control is quiet right now.",
    note: "No active work or upcoming jobs surfaced from local state.",
  };
}

export function buildRecommendation(projects: ProjectPulseItem[], priorities: PriorityItem[], agenda: AgendaItem[]) {
  const blockedProject = projects.find((project) => project.status === "blocked");
  if (blockedProject) {
    return {
      headline: `Annie would unblock ${blockedProject.name} first.`,
      note: blockedProject.nextStep || blockedProject.summary,
    };
  }

  const activeProject = projects.find((project) => project.status === "active");
  if (activeProject) {
    return {
      headline: `Best next move: push ${activeProject.name}.`,
      note: activeProject.nextStep || activeProject.summary,
    };
  }

  if (priorities.length) {
    return {
      headline: "Best next move: trim the top backlog item.",
      note: priorities[0]?.text || "Review the current backlog.",
    };
  }

  if (agenda.length) {
    return {
      headline: "The board is clear for the next automation beat.",
      note: `${agenda[0]?.title || "Next job"} at ${formatTimestamp(agenda[0]?.timestamp)}`,
    };
  }

  return {
    headline: "Annie is ready for the next instruction.",
    note: "No project or scheduling pressure is surfacing right now.",
  };
}

export function buildAttentionItems(
  projects: ProjectPulseItem[],
  priorities: PriorityItem[],
  activeWork: ActiveWorkItem[],
  agenda: AgendaItem[],
  sources: SourceHealth[],
  now = Date.now()
) {
  const items: AttentionItem[] = [];
  const blockedProject = projects.find((project) => project.status === "blocked");
  const degradedSources = sources.filter((source) => source.status === "degraded");
  const nextJob = agenda[0];
  const nextJobDistance = nextJob ? nextJob.timestamp - now : Number.POSITIVE_INFINITY;

  if (blockedProject) {
    items.push({
      id: `blocked-${blockedProject.id}`,
      tone: "warning",
      title: `${blockedProject.name} is blocked`,
      detail: blockedProject.nextStep || blockedProject.summary,
    });
  }

  if (degradedSources.length) {
    items.push({
      id: "degraded-sources",
      tone: "warning",
      title: `Annie is missing ${degradedSources.length} signal${degradedSources.length === 1 ? "" : "s"}`,
      detail: degradedSources.map((source) => `${source.label}: ${source.detail}`).join(" · "),
    });
  }

  if (priorities.length && !activeWork.length) {
    items.push({
      id: "no-active-work",
      tone: "focus",
      title: "Open priorities are waiting for a push",
      detail: priorities[0]?.text || "Review the top priority and start the next thread.",
    });
  }

  if (Number.isFinite(nextJobDistance) && nextJobDistance > 0 && nextJobDistance <= 60 * 60_000) {
    items.push({
      id: `next-job-${nextJob.id}`,
      tone: "info",
      title: `${nextJob.title} is coming up soon`,
      detail: `${formatTimestamp(nextJob.timestamp)} · ${nextJob.detail}`,
    });
  }

  if (!items.length) {
    items.push({
      id: "board-calm",
      tone: "info",
      title: "Everything looks steady",
      detail: "No immediate blockers or missing signals are surfacing right now.",
    });
  }

  return items.slice(0, 4);
}

export function buildAutomationWatchDataModel(
  jobsWithRuns: Array<{ job: CronJob; runs: { entries: CronRunEntry[] } }>,
  now = Date.now()
): AutomationWatchData {
  const items: AutomationWatchItem[] = jobsWithRuns.map(({ job, runs }) => {
    const latestRun = [...runs.entries].sort(
      (a, b) => (b.startedAtMs || b.finishedAtMs || 0) - (a.startedAtMs || a.finishedAtMs || 0)
    )[0];
    const nextRunAt = job.state?.nextRunAtMs;
    const baseStatus = normalizeRunStatus(latestRun?.status);
    const overdue = typeof nextRunAt === "number" && nextRunAt < now - 15 * 60_000;
    const status = overdue && baseStatus !== "failing" ? "warning" : baseStatus;

    return {
      id: job.id,
      title: job.name || "Untitled job",
      detail:
        job.description ||
        job.payload?.message ||
        job.payload?.text ||
        job.schedule?.expr ||
        job.schedule?.kind ||
        "Scheduled job",
      nextRunAt,
      lastRunAt: latestRun?.startedAtMs || latestRun?.finishedAtMs,
      lastRunStatus: latestRun?.status || "No runs yet",
      lastRunSummary:
        latestRun?.summary ||
        latestRun?.error ||
        latestRun?.skippedReason ||
        (latestRun ? "No summary recorded" : "Annie hasn't logged a recent run yet."),
      status,
    };
  });

  const failing = items.filter((item) => item.status === "failing").length;
  const warning = items.filter((item) => item.status === "warning").length;
  const upcoming = items.filter(
    (item) => typeof item.nextRunAt === "number" && item.nextRunAt > now && item.nextRunAt - now <= 6 * 60 * 60_000
  ).length;

  const headline = failing
    ? `${failing} automation${failing === 1 ? " needs" : "s need"} Annie's attention`
    : warning
      ? "Automation runway has a couple soft edges"
      : upcoming
        ? "Automation runway looks steady"
        : "Automation is calm right now";

  const note = failing
    ? "The most recent failing runs are surfaced first so Annie can recover the queue quickly."
    : warning
      ? "Nothing appears broken, but a skipped or overdue beat is worth a closer look."
      : upcoming
        ? "Recent runs look healthy and the next scheduled beats are queued up cleanly."
        : "No urgent automations are surfacing; Annie has room for deliberate work.";

  return {
    generatedAt: now,
    headline,
    note,
    summary: { failing, warning, upcoming },
    items: items
      .sort((a, b) => {
        const priority = { failing: 0, warning: 1, healthy: 2, idle: 3 } as const;
        const statusDelta = priority[a.status] - priority[b.status];
        if (statusDelta !== 0) return statusDelta;
        return (a.nextRunAt || Number.MAX_SAFE_INTEGER) - (b.nextRunAt || Number.MAX_SAFE_INTEGER);
      })
      .slice(0, 5),
  };
}
