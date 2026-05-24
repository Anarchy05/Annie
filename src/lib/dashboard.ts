import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  buildActiveWork,
  buildAgenda,
  buildAttentionItems,
  buildAutomationWatchDataModel,
  buildFocusSummary,
  buildRecommendation,
  buildTaskTracker,
  parsePriorityItems,
  type ControlCenterData,
  type SourceHealth,
  type TasksListResponse,
  type TimelineItem,
  type PriorityItem,
  type ProjectPulseItem,
} from "@/lib/dashboard-derived";
import {
  buildCronJobsPayload,
  buildCronRunsPayload,
  buildDegradedCronState,
  buildOkCronState,
  deriveNextRunAtMs,
  type CronStateMeta,
} from "@/lib/cron-state";
import { invokeOpenClaw } from "@/lib/openclaw";
import { normalizeCronJobs, normalizeCronRunEntry, normalizeSessionsIndex, parseJsonLines } from "@/lib/openclaw-state";
import { listProjects } from "@/lib/projects";
import { classifyRouteSpeed, getRouteDiagnostics } from "@/lib/route-diagnostics";
import { runtimeCache } from "@/lib/runtime-cache";

const execFileAsync = promisify(execFile);
const OPENCLAW_STATE_DIR = "/root/.openclaw";
const OPENCLAW_AGENT_DIR = path.join(OPENCLAW_STATE_DIR, "agents", "main", "sessions");
const OPENCLAW_SESSIONS_INDEX = path.join(OPENCLAW_AGENT_DIR, "sessions.json");
const OPENCLAW_CRON_JOBS_FILE = path.join(OPENCLAW_STATE_DIR, "cron", "jobs.json");
const OPENCLAW_CRON_RUNS_DIR = path.join(OPENCLAW_STATE_DIR, "cron", "runs");
const OPENCLAW_TASKS_DIR = path.join(OPENCLAW_STATE_DIR, "tasks");
const OPENCLAW_TASKS_DB = path.join(OPENCLAW_TASKS_DIR, "runs.sqlite");
const OPENCLAW_TASKS_DB_WAL = path.join(OPENCLAW_TASKS_DIR, "runs.sqlite-wal");
const OPENCLAW_TASKS_DB_SHM = path.join(OPENCLAW_TASKS_DIR, "runs.sqlite-shm");
const TODO_FILE = "/root/projects/mission-control/TODO.md";
const PROJECTS_FILE = "/root/projects/mission-control/state/projects.json";

type MessagePart = {
  type: "text" | "toolCall" | "thinking" | string;
  text?: string;
  name?: string;
  arguments?: unknown;
  thinking?: string;
};

type SessionMessage = {
  role: string;
  content?: MessagePart[];
  toolName?: string;
  timestamp?: number;
};

type CronListResponse = {
  jobs: Array<{
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
  }>;
  total?: number;
  meta: CronStateMeta;
};

type CronRunsResponse = {
  entries: Array<{
    startedAtMs?: number;
    finishedAtMs?: number;
    status?: string;
    summary?: string;
    error?: string;
    skippedReason?: string;
  }>;
  meta: CronStateMeta;
};

type MemorySearchHit = {
  path: string;
  score?: number;
  preview?: string;
  snippet?: string;
  lines?: { from: number; to: number };
  startLine?: number;
};

type MemorySearchResponse = {
  hits?: MemorySearchHit[];
  results?: MemorySearchHit[];
};

export { compactNumber, formatTimestamp, normalizeRunStatus } from "@/lib/dashboard-derived";

async function runOpenClawJson<T>(args: string[], timeout = 15_000): Promise<T> {
  const { stdout } = await execFileAsync("openclaw", [...args, "--json"], {
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout) as T;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function getFileVersion(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    return `${Math.floor(stats.mtimeMs)}:${stats.size}`;
  } catch {
    return "missing";
  }
}

async function runOpenClawText(args: string[], timeout = 15_000) {
  const { stdout } = await execFileAsync("openclaw", args, {
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

function combineVersionParts(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => String(part ?? "missing")).join("|");
}

async function getTaskStateVersion() {
  const [dbVersion, walVersion, shmVersion] = await Promise.all([
    getFileVersion(OPENCLAW_TASKS_DB),
    getFileVersion(OPENCLAW_TASKS_DB_WAL),
    getFileVersion(OPENCLAW_TASKS_DB_SHM),
  ]);

  return combineVersionParts([dbVersion, walVersion, shmVersion]);
}

async function getCronRunsAggregateVersion() {
  try {
    const entries = await fs.readdir(OPENCLAW_CRON_RUNS_DIR, { withFileTypes: true });
    const fileVersions = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => `${entry.name}:${await getFileVersion(path.join(OPENCLAW_CRON_RUNS_DIR, entry.name))}`)
    );

    fileVersions.sort();
    return combineVersionParts(fileVersions);
  } catch {
    return "missing";
  }
}

export async function getSessions() {
  const version = await getFileVersion(OPENCLAW_SESSIONS_INDEX);
  return runtimeCache.withCache("sessions", 5_000, async () => {
    try {
      const index = await readJsonFile<unknown>(OPENCLAW_SESSIONS_INDEX);
      const { sessions, invalidCount } = normalizeSessionsIndex(index, Date.now());

      sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      return {
        count: sessions.length,
        sessions,
        source: {
          key: "sessions",
          label: "Sessions",
          status: invalidCount > 0 ? "degraded" : sessions.length ? "ok" : "empty",
          detail: invalidCount > 0
            ? `Loaded ${sessions.length} recent session${sessions.length === 1 ? "" : "s"} but skipped ${invalidCount} malformed entr${invalidCount === 1 ? "y" : "ies"}`
            : sessions.length
              ? `${sessions.length} recent session${sessions.length === 1 ? "" : "s"} indexed`
              : "No recent sessions are indexed yet",
        } satisfies SourceHealth,
      };
    } catch (error) {
      return {
        count: 0,
        sessions: [],
        source: {
          key: "sessions",
          label: "Sessions",
          status: "degraded",
          detail: error instanceof Error ? error.message : "Session index unavailable right now",
        } satisfies SourceHealth,
      };
    }
  }, version);
}

async function readSessionTranscript(sessionId: string) {
  const transcriptPath = path.join(OPENCLAW_AGENT_DIR, `${sessionId}.jsonl`);
  try {
    const raw = await fs.readFile(transcriptPath, "utf8");
    return parseJsonLines<Record<string, unknown>>(raw, (value) =>
      typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
    ).items;
  } catch {
    return [] as Record<string, unknown>[];
  }
}

export async function getSessionHistory(sessionKey: string, limit = 20) {
  const sessions = await getSessions();
  const session = sessions.sessions.find((entry) => entry.key === sessionKey);
  if (!session) {
    return { sessionKey, messages: [] };
  }

  const rows = await readSessionTranscript(session.sessionId);
  const messages: SessionMessage[] = rows
    .filter((row) => row.type === "message")
    .map((row) => {
      const timestampValue = typeof row.timestamp === "string" ? Date.parse(row.timestamp) : undefined;
      const message = row.message as { role?: string; content?: MessagePart[]; toolName?: string; timestamp?: number };
      return {
        role: message.role || "assistant",
        content: Array.isArray(message.content) ? message.content : [],
        toolName: message.toolName,
        timestamp: message.timestamp ?? timestampValue,
      };
    });

  return {
    sessionKey,
    messages: messages.slice(-limit),
  };
}

function extractBody(part: MessagePart, fallbackRole: string) {
  if (part.type === "toolCall") {
    return JSON.stringify(part.arguments ?? {}, null, 2);
  }

  if (part.type === "thinking") {
    return "";
  }

  return part.text ?? fallbackRole;
}

export async function buildFeedTimeline() {
  const version = await getFileVersion(OPENCLAW_SESSIONS_INDEX);
  return runtimeCache.withCache("feed", 5_000, async () => {
    const sessions = await getSessions();
    const recentSessions = sessions.sessions.slice(0, 4);
    const histories = await Promise.all(
      recentSessions.map(async (session) => ({
        session,
        history: await getSessionHistory(session.key, 12),
      }))
    );

    const items: TimelineItem[] = [];

    for (const { session, history } of histories) {
      for (const [messageIndex, message] of history.messages.entries()) {
        const parts = message.content ?? [];

        if (message.role === "toolResult") {
          const text = parts.map((part) => part.text ?? "").join("\n").trim();
          items.push({
            id: `${session.key}-${messageIndex}-tool-result`,
            sessionKey: session.key,
            sessionLabel: session.key,
            role: "tool",
            title: message.toolName || "Tool result",
            body: text || "No text returned",
            timestamp: message.timestamp ?? session.updatedAt ?? Date.now(),
          });
          continue;
        }

        for (const [partIndex, part] of parts.entries()) {
          if (part.type === "thinking") continue;

          const role: TimelineItem["role"] =
            part.type === "toolCall" ? "tool" : message.role === "user" ? "user" : "assistant";

          const title =
            part.type === "toolCall"
              ? part.name || "Tool call"
              : message.role === "user"
                ? "User message"
                : "Assistant message";

          const body = extractBody(part, message.role).trim();
          if (!body) continue;

          items.push({
            id: `${session.key}-${messageIndex}-${partIndex}`,
            sessionKey: session.key,
            sessionLabel: session.key,
            role,
            title,
            body,
            timestamp: message.timestamp ?? session.updatedAt ?? Date.now(),
          });
        }
      }
    }

    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 60);
  }, version);
}

export async function getCronJobs() {
  const version = await getFileVersion(OPENCLAW_CRON_JOBS_FILE);
  return runtimeCache.withCache("cron-jobs", 10_000, async () => {
    try {
      const data = await readJsonFile<unknown>(OPENCLAW_CRON_JOBS_FILE);
      const { jobs: rawJobs, invalidCount } = normalizeCronJobs(data);
      const jobs = rawJobs.map((job) => {
        if (typeof job.state?.nextRunAtMs === "number") return job;
        const nextRunAtMs = deriveNextRunAtMs(job.schedule);
        return nextRunAtMs ? { ...job, state: { ...job.state, nextRunAtMs } } : job;
      });
      const derivedCount = jobs.filter((job) => typeof job.state?.nextRunAtMs === "number").length - rawJobs.filter((job) => typeof job.state?.nextRunAtMs === "number").length;

      const detailParts = [
        !jobs.length
          ? "No cron jobs are scheduled right now."
          : derivedCount > 0
            ? `Loaded local cron job state and derived ${derivedCount} upcoming run${derivedCount === 1 ? "" : "s"} from schedule metadata.`
            : "Loaded local cron job state.",
        invalidCount > 0 ? `Skipped ${invalidCount} malformed cron entr${invalidCount === 1 ? "y" : "ies"}.` : null,
      ].filter(Boolean);

      return buildCronJobsPayload(
        jobs,
        invalidCount > 0
          ? { status: "degraded", source: "local", detail: detailParts.join(" ") }
          : buildOkCronState("local", detailParts.join(" "))
      ) satisfies CronListResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cron job state is unavailable right now.";
      return buildCronJobsPayload([], buildDegradedCronState(message)) satisfies CronListResponse;
    }
  }, version);
}

function buildCronRunMeta(source: "local" | "cli", entryCount: number, invalidCount = 0): CronStateMeta {
  const detailParts = [
    entryCount ? `Loaded recent runs from ${source === "local" ? "local cron history" : "the OpenClaw CLI"}.` : "No runs have been recorded for this job yet.",
    invalidCount > 0 ? `Skipped ${invalidCount} malformed run entr${invalidCount === 1 ? "y" : "ies"}.` : null,
  ].filter(Boolean);

  return invalidCount > 0
    ? { status: "degraded", source, detail: detailParts.join(" ") }
    : buildOkCronState(source, detailParts.join(" "));
}

export async function getCronRuns(jobId: string) {
  const runsFile = path.join(OPENCLAW_CRON_RUNS_DIR, `${jobId}.jsonl`);
  const version = await getFileVersion(runsFile);

  return runtimeCache.withCache(`cron-runs:${jobId}`, 5_000, async () => {
    try {
      const text = await fs.readFile(runsFile, "utf8");
      const { items, invalidCount } = parseJsonLines(text, normalizeCronRunEntry);
      const entries = items.slice(-20);

      return buildCronRunsPayload(entries, buildCronRunMeta("local", entries.length, invalidCount)) satisfies CronRunsResponse;
    } catch {
      try {
        const text = await runOpenClawText(["cron", "runs", "--id", jobId, "--limit", "20", "--timeout", "10000"], 15_000);
        try {
          const parsed = JSON.parse(text) as Partial<CronRunsResponse> | CronRunsResponse["entries"];
          if (Array.isArray(parsed)) {
            const entries = parsed.map((entry) => normalizeCronRunEntry(entry)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
            return buildCronRunsPayload(entries, buildCronRunMeta("cli", entries.length, parsed.length - entries.length)) satisfies CronRunsResponse;
          }
          if (Array.isArray(parsed.entries)) {
            const entries = parsed.entries.map((entry) => normalizeCronRunEntry(entry)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
            return buildCronRunsPayload(entries, buildCronRunMeta("cli", entries.length, parsed.entries.length - entries.length)) satisfies CronRunsResponse;
          }
        } catch {
          // Fall through to line-based parsing for older/plain-text output.
        }

        const { items, invalidCount } = parseJsonLines(text, normalizeCronRunEntry);
        return buildCronRunsPayload(items, buildCronRunMeta("cli", items.length, invalidCount)) satisfies CronRunsResponse;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Run history is unavailable right now.";
        return buildCronRunsPayload([], buildDegradedCronState(message)) satisfies CronRunsResponse;
      }
    }
  }, version);
}

async function getTasks() {
  const version = await getTaskStateVersion();
  return runtimeCache.withCache("tasks", 10_000, async () => {
    try {
      const response = await runOpenClawJson<TasksListResponse & {
        tasks?: Array<TasksListResponse["tasks"][number] & {
          createdAt?: number;
          startedAt?: number;
          endedAt?: number;
          lastEventAt?: number;
          label?: string;
          task?: string;
          terminalSummary?: string;
          ownerKey?: string;
          childSessionKey?: string;
          requesterSessionKey?: string;
        }>;
      }>(["tasks", "list"], 10_000);

      const tasks = (response.tasks || []).map((task) => ({
        ...task,
        sessionKey: task.sessionKey || task.childSessionKey || task.requesterSessionKey,
        createdAtMs: task.createdAtMs || task.createdAt,
        startedAtMs: task.startedAtMs || task.startedAt,
        updatedAtMs: task.updatedAtMs || task.lastEventAt || task.endedAt || task.startedAt || task.createdAt,
        title: task.title || task.label || task.task,
        summary: task.summary || task.terminalSummary || task.childSessionKey || task.ownerKey,
      }));

      return {
        count: typeof response.count === "number" ? response.count : tasks.length,
        tasks,
        source: {
          key: "tasks",
          label: "Tasks",
          status: tasks.length ? "ok" : "empty",
          detail: tasks.length ? `${tasks.length} OpenClaw task${tasks.length === 1 ? "" : "s"} visible` : "No live OpenClaw tasks right now",
        } satisfies SourceHealth,
      };
    } catch (error) {
      return {
        count: 0,
        tasks: [],
        source: {
          key: "tasks",
          label: "Tasks",
          status: "degraded",
          detail: error instanceof Error ? error.message : "Task runway unavailable right now",
        } satisfies SourceHealth,
      };
    }
  }, version);
}

async function getPriorityItems() {
  const version = await getFileVersion(TODO_FILE);
  return runtimeCache.withCache("todo-priorities", 15_000, async () => {
    try {
      const raw = await fs.readFile(TODO_FILE, "utf8");
      const items = parsePriorityItems(raw);
      return {
        items,
        source: {
          key: "todo",
          label: "Backlog",
          status: items.length ? "ok" : "empty",
          detail: items.length ? `${items.length} open priorit${items.length === 1 ? "y" : "ies"} parsed` : "Backlog looks clear right now",
        } satisfies SourceHealth,
      };
    } catch (error) {
      return {
        items: [] as PriorityItem[],
        source: {
          key: "todo",
          label: "Backlog",
          status: "degraded",
          detail: error instanceof Error ? error.message : "TODO priorities unavailable right now",
        } satisfies SourceHealth,
      };
    }
  }, version);
}

async function getProjectPulse() {
  const version = await getFileVersion(PROJECTS_FILE);
  return runtimeCache.withCache("project-pulse", 15_000, async () => {
    try {
      const projects = await listProjects();
      return projects
        .filter((project) => project.pinned || project.status === "active" || project.status === "blocked")
        .sort((a, b) => {
          if (Boolean(b.pinned) !== Boolean(a.pinned)) return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
          if (a.status !== b.status) {
            const order = { blocked: 0, active: 1, planned: 2, done: 3 } as const;
            return order[a.status] - order[b.status];
          }
          return b.updatedAt - a.updatedAt;
        })
        .slice(0, 4)
        .map((project) => ({
          id: project.id,
          name: project.name,
          status: project.status,
          progress: project.progress,
          summary: project.summary,
          nextStep: project.nextStep,
          updatedAt: project.updatedAt,
          pinned: project.pinned,
        }));
    } catch {
      return [] as ProjectPulseItem[];
    }
  }, version);
}

export {
  buildFallbackAutomationWatchData,
  buildFallbackBannerData,
  buildFallbackControlCenterData,
  buildFallbackFeedData,
} from "@/lib/dashboard-fallbacks";

export async function getControlCenterData() {
  const version = combineVersionParts(
    await Promise.all([
      getFileVersion(TODO_FILE),
      getTaskStateVersion(),
      getFileVersion(OPENCLAW_SESSIONS_INDEX),
      getFileVersion(OPENCLAW_CRON_JOBS_FILE),
      getFileVersion(PROJECTS_FILE),
    ])
  );

  return runtimeCache.withCache("control-center", 10_000, async () => {
    const [priorityState, tasks, sessions, jobs, projects] = await Promise.all([
      getPriorityItems(),
      getTasks(),
      getSessions(),
      getCronJobs(),
      getProjectPulse(),
    ]);

    const priorities = priorityState.items;
    const activeWork = buildActiveWork(tasks.tasks, sessions.sessions);
    const taskTracker = buildTaskTracker(tasks.tasks);
    const agenda = buildAgenda(jobs.jobs);

    const sources: SourceHealth[] = [
      priorityState.source,
      tasks.source.status === "empty" && activeWork.some((item) => item.source === "task")
        ? {
            ...tasks.source,
            status: "ok",
            detail: `${activeWork.filter((item) => item.source === "task").length} active task signal${activeWork.filter((item) => item.source === "task").length === 1 ? "" : "s"} surfaced from recent work`,
          }
        : tasks.source,
      sessions.source,
      jobs.meta.status === "degraded"
        ? {
            key: "cron",
            label: "Cron",
            status: "degraded",
            detail: jobs.meta.detail,
          }
        : jobs.jobs.length
          ? {
              key: "cron",
              label: "Cron",
              status: "ok",
              detail: `${jobs.jobs.length} scheduled job${jobs.jobs.length === 1 ? "" : "s"} loaded`,
            }
          : {
              key: "cron",
              label: "Cron",
              status: "empty",
              detail: "No cron jobs are scheduled right now",
            },
    ];

    return {
      priorities: priorities.slice(0, 8),
      activeWork,
      taskTracker,
      agenda,
      projects,
      alerts: buildAttentionItems(projects, priorities, activeWork, agenda, sources),
      summary: {
        openPriorities: priorities.length,
        activeNow: activeWork.length,
        upcomingJobs: agenda.length,
      },
      focus: buildFocusSummary(priorities, activeWork, agenda),
      recommendation: buildRecommendation(projects, priorities, agenda),
      meta: {
        generatedAt: Date.now(),
        sources,
      },
    } satisfies ControlCenterData;
  }, version);
}

export async function getAutomationWatchData() {
  const version = combineVersionParts(await Promise.all([getFileVersion(OPENCLAW_CRON_JOBS_FILE), getCronRunsAggregateVersion()]));

  return runtimeCache.withCache("automation-watch", 20_000, async () => {
    const jobs = await getCronJobs();
    const enabledJobs = jobs.jobs
      .filter((job) => job.enabled !== false)
      .sort((a, b) => (a.state?.nextRunAtMs || Number.MAX_SAFE_INTEGER) - (b.state?.nextRunAtMs || Number.MAX_SAFE_INTEGER))
      .slice(0, 6);

    const runsByJob = await Promise.all(
      enabledJobs.map(async (job) => ({
        job,
        runs: await getCronRuns(job.id),
      }))
    );

    return buildAutomationWatchDataModel(runsByJob);
  }, version);
}

async function getStatusText() {
  return runtimeCache.withCache("status-text", 60_000, async () => {
    try {
      const version = await runOpenClawText(["--version"], 5_000);
      return `OpenClaw ${version.replace(/^OpenClaw\s+/i, "")}`;
    } catch {
      return "OpenClaw status unavailable";
    }
  });
}

async function getLatestOpenClawVersion() {
  return runtimeCache.withCache("openclaw-latest-version", 30 * 60_000, async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2_000);
      const npmResponse = await fetch("https://registry.npmjs.org/openclaw/latest", {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!npmResponse.ok) return "unknown";
      const npmData = (await npmResponse.json()) as { version?: string };
      return npmData.version || "unknown";
    } catch {
      return "unknown";
    }
  });
}

export async function getBannerData() {
  const [statusText, sessions, jobs, latestVersion] = await Promise.all([
    getStatusText(),
    getSessions(),
    getCronJobs(),
    getLatestOpenClawVersion(),
  ]);

  const versionMatch = statusText.match(/OpenClaw\s+([^\s]+)/i);
  const modelMatch = statusText.match(/Model:\s+([^·\n]+)/i);
  const upToDate = latestVersion !== "unknown" && latestVersion === (versionMatch?.[1] || "");

  const diagnosticsByRoute = new Map(getRouteDiagnostics().routes.map((route) => [route.route, route]));
  const speedRoutes = ["control-center", "automation-watch", "search"]
    .map((route) => diagnosticsByRoute.get(route))
    .filter((route): route is NonNullable<typeof route> => Boolean(route))
    .map((route) => ({
      key: route.route,
      label: route.label,
      lastDurationMs: route.lastDurationMs,
      avgDurationMs: route.avgDurationMs,
      tone: classifyRouteSpeed(route.lastDurationMs),
    }));
  const slowestSpeedRoute = [...speedRoutes].sort((a, b) => b.lastDurationMs - a.lastDurationMs)[0];

  return {
    version: versionMatch?.[1] || "unknown",
    latestVersion,
    upToDate,
    stats: {
      model: modelMatch?.[1]?.trim() || sessions.sessions[0]?.model || "unknown",
      activeSessions: sessions.count,
      scheduledJobs: jobs.jobs.length,
    },
    diagnostics: {
      summary: !speedRoutes.length
        ? "warming up"
        : slowestSpeedRoute?.tone === "watch"
          ? `watching ${slowestSpeedRoute.label.toLowerCase()}`
          : slowestSpeedRoute?.tone === "steady"
            ? "steady"
            : "swift",
      routes: speedRoutes,
    },
  };
}

export async function buildSearchResults(query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      memories: [],
      files: [],
      conversations: [],
      tasks: [],
    };
  }

  const version = [
    await getFileVersion(OPENCLAW_SESSIONS_INDEX),
    await getFileVersion(OPENCLAW_CRON_JOBS_FILE),
  ].join("|");

  return runtimeCache.withCache(`search:${normalizedQuery.toLowerCase()}`, 3_000, async () => {
    const [memoryResults, sessions, cronResults, grepText] = await Promise.all([
      invokeOpenClaw<MemorySearchResponse>(
        "memory_search",
        {
          query: normalizedQuery,
          maxResults: 8,
        },
        { timeoutMs: 1_200 }
      ).catch(() => ({ hits: [], results: [] } satisfies MemorySearchResponse)),
      getSessions(),
      getCronJobs(),
      execFileAsync(
        "bash",
        [
          "-lc",
          `grep -RIn --exclude-dir=node_modules --exclude-dir=.git ${JSON.stringify(normalizedQuery)} /root/.openclaw/workspace /root/projects/mission-control 2>/dev/null | head -40`,
        ],
        { timeout: 10_000, maxBuffer: 5 * 1024 * 1024 }
      )
        .then(({ stdout }) => stdout.trim())
        .catch(() => ""),
    ]);

    const queryLower = normalizedQuery.toLowerCase();
    const cronMatches = cronResults.jobs.filter((job) => {
      const haystack = [job.name, job.description, job.payload?.message, job.payload?.text]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(queryLower);
    });

    const files = grepText
      ? grepText.split("\n").slice(0, 40).map((line, index) => {
          const [filePath, lineNumber, ...rest] = line.split(":");
          return {
            id: `file-${index}`,
            path: filePath,
            lineNumber: Number(lineNumber),
            preview: rest.join(":").trim(),
          };
        }).filter((entry) => entry.path && Number.isFinite(entry.lineNumber))
      : [];

    return {
      memories: (memoryResults.hits || memoryResults.results || []).map((hit, index) => ({
        id: `memory-${index}`,
        path: hit.path,
        line: hit.lines?.from || hit.startLine,
        preview: hit.preview || hit.snippet || "",
        score: hit.score || 0,
      })),
      files,
      conversations: sessions.sessions
        .filter((session) => session.key.toLowerCase().includes(queryLower))
        .map((session) => ({
          id: session.key,
          key: session.key,
          sessionId: session.sessionId,
          label: session.key,
          model: session.model || "unknown",
          updatedAt: session.updatedAt || 0,
          status: session.ageMs && session.ageMs < 120_000 ? "active" : "idle",
        })),
      tasks: cronMatches.map((job) => ({
        id: job.id,
        name: job.name || "Untitled job",
        description: job.description || job.payload?.message || job.payload?.text || "",
        schedule: job.schedule?.expr || job.schedule?.kind || "manual",
        enabled: !!job.enabled,
      })),
    };
  }, version);
}
