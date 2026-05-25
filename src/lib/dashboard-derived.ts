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
  status: "ok" | "empty" | "degraded";
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
    staggerMs?: number;
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
  createdAt?: number;
  startedAt?: number;
  endedAt?: number;
  lastEventAt?: number;
  summary?: string;
  title?: string;
  label?: string;
  task?: string;
  terminalSummary?: string;
  ownerKey?: string;
  childSessionKey?: string;
  requesterSessionKey?: string;
};

export type TasksListResponse = {
  count: number;
  tasks: TaskEntry[];
};

export type TaskTrackerItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  statusTone: "running" | "queued" | "attention" | "done" | "other";
  updatedAt: number;
  repeatCount?: number;
};

export type TaskTrackerTriage = {
  tone: "danger" | "warning" | "info";
  title: string;
  note: string;
};

export type TaskTrackerData = {
  headline: string;
  note: string;
  triage?: TaskTrackerTriage;
  summary: {
    running: number;
    queued: number;
    attention: number;
    staleAttention: number;
    completed: number;
  };
  items: TaskTrackerItem[];
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

export type AutomationWatchTriage = {
  tone: "danger" | "warning" | "info";
  title: string;
  note: string;
};

export type AutomationWatchData = {
  generatedAt: number;
  headline: string;
  note: string;
  triage?: AutomationWatchTriage;
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
  taskTracker: TaskTrackerData;
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

function getTaskTimestamp(task: TaskEntry) {
  return task.updatedAtMs || task.startedAtMs || task.createdAtMs || 0;
}

function compactText(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function humanizeSessionKey(key?: string) {
  if (!key) return "session";
  if (key.includes(":cron:")) return "automation heartbeat";
  if (key.includes(":subagent:")) return "sub-agent session";
  if (key.includes(":whatsapp:")) return "WhatsApp session";
  if (key.includes(":web:")) return "web chat";
  if (key.includes(":direct:")) return "direct session";
  return compactText(key, 80);
}

function cleanTaskText(value?: string, fallback = "Task") {
  if (!value) return fallback;
  const firstLine = value.split("\n").find((line) => line.trim())?.trim() || fallback;
  if (firstLine.startsWith("[Subagent Context]") || value.includes("You are running as a subagent")) {
    return "Sub-agent handoff";
  }
  if (firstLine.startsWith("agent:") || firstLine.startsWith("system:")) {
    return humanizeSessionKey(firstLine);
  }
  return compactText(firstLine, 120);
}

function cleanTaskDetail(value?: string, fallback = "OpenClaw task") {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("agent:") || trimmed.startsWith("system:")) {
    return `via ${humanizeSessionKey(trimmed)}`;
  }
  return compactText(trimmed, 180);
}

function getTaskTitle(task: TaskEntry) {
  return cleanTaskText(task.title || task.label || task.task || task.runtime || task.taskId, "Task");
}

function getTaskDetail(task: TaskEntry) {
  return cleanTaskDetail(task.summary || task.terminalSummary || task.childSessionKey || task.sessionKey || task.ownerKey, "OpenClaw task");
}

function getSessionTitle(session: Session) {
  if (session.key.includes(":cron:")) return "Automation heartbeat";
  if (session.key.includes(":subagent:")) return "Sub-agent session";
  if (session.key.includes(":whatsapp:")) return "WhatsApp session";
  if (session.key.includes(":web:")) return "Web chat";
  if ((session.kind || "").toLowerCase() === "direct") return "Direct session";
  return cleanTaskText(session.key, "Session");
}

function getSessionDetail(session: Session) {
  const parts = [session.model || "unknown"];
  if (session.key.includes(":cron:")) {
    parts.push("automation");
  } else if (session.key.includes(":subagent:")) {
    parts.push("sub-agent");
  } else if (session.key.includes(":whatsapp:")) {
    parts.push("WhatsApp");
  } else if (session.key.includes(":web:")) {
    parts.push("web");
  } else {
    parts.push(session.kind || "session");
  }
  return parts.join(" · ");
}

function getTaskStatusTone(status?: string): TaskTrackerItem["statusTone"] {
  const normalized = (status || "").toLowerCase();
  if (["running", "active", "in_progress"].includes(normalized)) return "running";
  if (["queued", "pending"].includes(normalized)) return "queued";
  if (["failed", "error", "timeout", "timed_out", "canceled", "cancelled"].includes(normalized)) return "attention";
  if (["succeeded", "success", "completed", "done"].includes(normalized)) return "done";
  return "other";
}

function classifyTaskFailure(task: TaskEntry) {
  const detail = [task.summary, task.terminalSummary].filter(Boolean).join(" ").toLowerCase();

  if (detail.includes("couldn't generate a response")) return "agent-response" as const;
  if (detail.includes("model did not produce a response") || detail.includes("idle timeout")) return "model-timeout" as const;
  if (detail.includes("timed out while waiting for the cli")) return "cli-timeout" as const;
  return "other" as const;
}

function buildTaskTriage(attention: TaskEntry[], now = Date.now()): TaskTrackerTriage | undefined {
  if (!attention.length) return undefined;

  const counts = attention.reduce(
    (summary, task) => {
      summary[classifyTaskFailure(task)] += 1;
      return summary;
    },
    { "agent-response": 0, "model-timeout": 0, "cli-timeout": 0, other: 0 }
  );

  const operationalCount = counts["agent-response"] + counts["model-timeout"] + counts["cli-timeout"];
  const majorityOperational = operationalCount >= Math.max(2, Math.ceil(attention.length / 2));
  const newestAttention = [...attention].sort((a, b) => getTaskTimestamp(b) - getTaskTimestamp(a))[0];

  if (majorityOperational) {
    const reasons = [
      counts["agent-response"] ? `${counts["agent-response"]} agent response hiccup${counts["agent-response"] === 1 ? "" : "s"}` : null,
      counts["model-timeout"] ? `${counts["model-timeout"]} model timeout${counts["model-timeout"] === 1 ? "" : "s"}` : null,
      counts["cli-timeout"] ? `${counts["cli-timeout"]} CLI timeout${counts["cli-timeout"] === 1 ? "" : "s"}` : null,
    ].filter(Boolean) as string[];

    return {
      tone: counts["agent-response"] > 0 ? "warning" : "info",
      title:
        operationalCount === attention.length
          ? "Recent task failures look operational, not product-specific."
          : "Most of the hot task failures look operational first.",
      note: `${reasons.join(" · ")}. ${counts["agent-response"] > 0 ? "Verify any tool side effects before retrying those tasks." : "Retry the freshest task after the underlying runtime settles."}`,
    };
  }

  const freshestTitle = newestAttention ? getTaskTitle(newestAttention) : "the freshest failed task";
  const ageMinutes = newestAttention ? Math.max(Math.round((now - getTaskTimestamp(newestAttention)) / 60_000), 0) : 0;

  return {
    tone: "danger",
    title: "A real task decision still looks hottest.",
    note: `Start with ${freshestTitle}${newestAttention ? `${ageMinutes <= 1 ? " from just now" : ` from ${ageMinutes} min ago`}` : ""} before older failure noise piles up.`,
  };
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
        title: getTaskTitle(task),
        detail: getTaskDetail(task),
        status: normalizeTaskStatus(task.status),
        updatedAt: getTaskTimestamp(task),
        source: "task" as const,
      })),
    ...sessions
      .filter((session) => (session.ageMs || Number.POSITIVE_INFINITY) < 30 * 60_000)
      .slice(0, 6)
      .map((session) => ({
        id: `session-${session.key}`,
        title: getSessionTitle(session),
        detail: getSessionDetail(session),
        status: (session.ageMs || 0) < 120_000 ? "running" : "recent",
        updatedAt: session.updatedAt || 0,
        source: session.key.includes(":cron:") ? ("cron" as const) : ("session" as const),
      })),
  ]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);
}

export function buildTaskTracker(tasks: TaskEntry[], now = Date.now()): TaskTrackerData {
  const RECENT_ATTENTION_WINDOW_MS = 36 * 60 * 60_000;
  const RECENT_COMPLETION_WINDOW_MS = 24 * 60 * 60_000;

  const running = tasks.filter((task) => getTaskStatusTone(task.status) === "running");
  const queued = tasks.filter((task) => getTaskStatusTone(task.status) === "queued");
  const allAttention = tasks.filter((task) => getTaskStatusTone(task.status) === "attention");
  const attention = allAttention.filter((task) => {
    const timestamp = getTaskTimestamp(task);
    return !timestamp || now - timestamp <= RECENT_ATTENTION_WINDOW_MS;
  });
  const staleAttention = Math.max(allAttention.length - attention.length, 0);
  const completed = tasks.filter((task) => {
    if (getTaskStatusTone(task.status) !== "done") return false;
    const timestamp = getTaskTimestamp(task);
    return !timestamp || now - timestamp <= RECENT_COMPLETION_WINDOW_MS;
  });

  const itemCandidates = [...running, ...attention, ...queued, ...completed].sort((a, b) => {
    const priority = { running: 0, attention: 1, queued: 2, done: 3, other: 4 } as const;
    const delta = priority[getTaskStatusTone(a.status)] - priority[getTaskStatusTone(b.status)];
    if (delta !== 0) return delta;
    return getTaskTimestamp(b) - getTaskTimestamp(a);
  });

  const groupedItems: TaskTrackerItem[] = [];

  for (const task of itemCandidates) {
    const title = getTaskTitle(task);
    const detail = getTaskDetail(task);
    const statusTone = getTaskStatusTone(task.status);
    const repeatable = statusTone === "attention" || statusTone === "done";

    if (repeatable) {
      const existing = groupedItems.find((item) => item.statusTone === statusTone && item.title === title && item.detail === detail);
      if (existing) {
        existing.repeatCount = (existing.repeatCount || 1) + 1;
        existing.updatedAt = Math.max(existing.updatedAt, getTaskTimestamp(task));
        continue;
      }
    }

    groupedItems.push({
      id: `task-tracker-${task.taskId || task.runId || task.sessionKey || title}`,
      title,
      detail,
      status: normalizeTaskStatus(task.status),
      statusTone,
      updatedAt: getTaskTimestamp(task),
      repeatCount: 1,
    });
  }

  const items = groupedItems.slice(0, 6).map((item) => {
    if ((item.repeatCount || 1) <= 1) return item;
    const extraCount = (item.repeatCount || 1) - 1;
    const suffix = item.statusTone === "done" ? "similar recent completions" : "similar recent failures";
    return {
      ...item,
      detail: `${item.detail} · ${extraCount} ${suffix}`,
    };
  });

  const topAttention = items.find((item) => item.statusTone === "attention");
  const topCompletion = items.find((item) => item.statusTone === "done");

  const headline = running.length
    ? `Annie has ${running.length} live task${running.length === 1 ? "" : "s"} in motion.`
    : attention.length
      ? `${attention.length} recent task${attention.length === 1 ? " needs" : "s need"} a closer look.`
      : queued.length
        ? `${queued.length} queued task${queued.length === 1 ? " is" : "s are"} lined up next.`
        : staleAttention
          ? "The live task runway is calm, with older failures tucked into history."
          : "Task traffic is calm right now.";

  const note = running[0]
    ? getTaskTitle(running[0])
    : topAttention
      ? topAttention.detail
      : queued[0]
        ? getTaskTitle(queued[0])
        : staleAttention
          ? `${staleAttention} older failed task signal${staleAttention === 1 ? " is" : "s are"} still on record, but Annie is keeping the live attention count focused on fresher work.`
          : topCompletion
            ? `Latest completion: ${topCompletion.title}${(topCompletion.repeatCount || 1) > 1 ? ` · ${topCompletion.repeatCount} similar recent wins` : ""}`
            : "OpenClaw is not surfacing a live task queue at the moment.";

  return {
    headline,
    note,
    triage: buildTaskTriage(attention, now),
    summary: {
      running: running.length,
      queued: queued.length,
      attention: attention.length,
      staleAttention,
      completed: completed.length,
    },
    items,
  };
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

function classifyAutomationFailure(run?: CronRunEntry) {
  const detail = [run?.summary, run?.error, run?.skippedReason].filter(Boolean).join(" ").toLowerCase();

  if (detail.includes("couldn't generate a response")) return "agent-response" as const;
  if (detail.includes("model did not produce a response") || detail.includes("idle timeout")) return "model-timeout" as const;
  if (detail.includes("timed out while waiting for the cli")) return "cli-timeout" as const;
  if (detail.includes("skipped")) return "skipped" as const;
  return "other" as const;
}

function buildAutomationWatchTriage(
  items: AutomationWatchItem[],
  latestRuns: Array<{ item: AutomationWatchItem; latestRun?: CronRunEntry }>,
  now = Date.now()
): AutomationWatchTriage | undefined {
  const failingItems = latestRuns.filter(({ item }) => item.status === "failing");
  const warningItems = latestRuns.filter(({ item }) => item.status === "warning");

  if (failingItems.length) {
    const counts = failingItems.reduce(
      (summary, { latestRun }) => {
        summary[classifyAutomationFailure(latestRun)] += 1;
        return summary;
      },
      { "agent-response": 0, "model-timeout": 0, "cli-timeout": 0, skipped: 0, other: 0 }
    );

    const operationalCount = counts["agent-response"] + counts["model-timeout"] + counts["cli-timeout"];
    const majorityOperational = operationalCount >= Math.max(2, Math.ceil(failingItems.length / 2));

    if (majorityOperational) {
      const reasons = [
        counts["agent-response"] ? `${counts["agent-response"]} agent response hiccup${counts["agent-response"] === 1 ? "" : "s"}` : null,
        counts["model-timeout"] ? `${counts["model-timeout"]} model timeout${counts["model-timeout"] === 1 ? "" : "s"}` : null,
        counts["cli-timeout"] ? `${counts["cli-timeout"]} CLI timeout${counts["cli-timeout"] === 1 ? "" : "s"}` : null,
      ].filter(Boolean) as string[];

      return {
        tone: counts["agent-response"] > 0 ? "warning" : "info",
        title:
          operationalCount === failingItems.length
            ? "Recent automation failures look operational first."
            : "Most failing automations look runtime-related first.",
        note: `${reasons.join(" · ")}. ${counts["agent-response"] > 0 ? "Verify any tool side effects before retrying those jobs." : "Retry the freshest job after the runtime settles."}`,
      };
    }

    const freshest = [...failingItems].sort(
      (a, b) => (b.item.lastRunAt || 0) - (a.item.lastRunAt || 0)
    )[0]?.item;
    const ageMinutes = freshest?.lastRunAt ? Math.max(Math.round((now - freshest.lastRunAt) / 60_000), 0) : 0;

    return {
      tone: "danger",
      title: "A real automation failure still looks hottest.",
      note: `Start with ${freshest?.title || "the freshest failing job"}${freshest?.lastRunAt ? `${ageMinutes <= 1 ? " from just now" : ` from ${ageMinutes} min ago`}` : ""} before the next beat lands.`,
    };
  }

  if (warningItems.length) {
    const overdueItems = warningItems.filter(({ item }) => typeof item.nextRunAt === "number" && item.nextRunAt < now - 15 * 60_000);
    const freshestWarning = [...warningItems].sort(
      (a, b) => (a.item.nextRunAt || Number.MAX_SAFE_INTEGER) - (b.item.nextRunAt || Number.MAX_SAFE_INTEGER)
    )[0]?.item;

    return {
      tone: overdueItems.length ? "warning" : "info",
      title: overdueItems.length ? "A couple automation beats look late, not broken." : "Automation has a soft edge worth a quick look.",
      note: overdueItems.length
        ? `${overdueItems.length} scheduled beat${overdueItems.length === 1 ? " is" : "s are"} overdue. Check ${freshestWarning?.title || "the earliest warning job"} before the queue drifts further.`
        : `${freshestWarning?.title || "One automation"} deserves a quick glance, but nothing looks hard-failed right now.`,
    };
  }

  return undefined;
}

export function buildAutomationWatchDataModel(
  jobsWithRuns: Array<{ job: CronJob; runs: { entries: CronRunEntry[] } }>,
  now = Date.now()
): AutomationWatchData {
  const latestRuns = jobsWithRuns.map(({ job, runs }) => {
    const latestRun = [...runs.entries].sort(
      (a, b) => (b.startedAtMs || b.finishedAtMs || 0) - (a.startedAtMs || a.finishedAtMs || 0)
    )[0];
    const nextRunAt = job.state?.nextRunAtMs;
    const baseStatus = normalizeRunStatus(latestRun?.status);
    const overdue = typeof nextRunAt === "number" && nextRunAt < now - 15 * 60_000;
    const status = overdue && baseStatus !== "failing" ? "warning" : baseStatus;

    return {
      latestRun,
      item: {
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
      },
    };
  });

  const items = latestRuns.map(({ item }) => item);
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
    triage: buildAutomationWatchTriage(items, latestRuns, now),
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
