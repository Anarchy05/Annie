import "server-only";

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { invokeOpenClaw } from "@/lib/openclaw";

const execFileAsync = promisify(execFile);
const OPENCLAW_STATE_DIR = "/root/.openclaw";
const OPENCLAW_AGENT_DIR = path.join(OPENCLAW_STATE_DIR, "agents", "main", "sessions");
const OPENCLAW_SESSIONS_INDEX = path.join(OPENCLAW_AGENT_DIR, "sessions.json");
const OPENCLAW_CRON_JOBS_FILE = path.join(OPENCLAW_STATE_DIR, "cron", "jobs.json");
const TODO_FILE = "/root/projects/mission-control/TODO.md";
const DEFAULT_CONTEXT_TOKENS = 272000;

const cache = new Map<string, { expiresAt: number; value: unknown }>();

async function withCache<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  const value = await factory();
  cache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

type Session = {
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

type SessionsListResponse = {
  count: number;
  sessions: Session[];
};

type SourceHealth = {
  key: "todo" | "tasks" | "sessions" | "cron";
  label: string;
  status: "ok" | "degraded";
  detail: string;
};

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

type CronJob = {
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

type CronListResponse = {
  jobs: CronJob[];
  total?: number;
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

type TaskEntry = {
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

type TasksListResponse = {
  count: number;
  tasks: TaskEntry[];
};

type ResourceSnapshot = {
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

export type ControlCenterData = {
  priorities: PriorityItem[];
  activeWork: ActiveWorkItem[];
  agenda: AgendaItem[];
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

async function runOpenClawText(args: string[], timeout = 15_000) {
  const { stdout } = await execFileAsync("openclaw", args, {
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

export async function getSessions() {
  return withCache("sessions", 5_000, async () => {
    try {
      const index = await readJsonFile<Record<string, Record<string, unknown>>>(OPENCLAW_SESSIONS_INDEX);
      const sessions = Object.entries(index).map(([key, value]) => ({
        key,
        sessionId: String(value.sessionId || ""),
        updatedAt: Number(value.updatedAt || 0),
        ageMs: Number(value.ageMs || (value.updatedAt ? Date.now() - Number(value.updatedAt) : 0)),
        totalTokens: typeof value.totalTokens === "number" ? value.totalTokens : null,
        contextTokens: typeof value.contextTokens === "number" ? value.contextTokens : DEFAULT_CONTEXT_TOKENS,
        model: typeof value.model === "string" ? value.model : "gpt-5.4",
        agentId: typeof value.agentId === "string" ? value.agentId : "main",
        kind: typeof value.chatType === "string" ? value.chatType : typeof value.kind === "string" ? value.kind : "direct",
        systemSent: Boolean(value.systemSent),
        abortedLastRun: Boolean(value.abortedLastRun),
        inputTokens: typeof value.inputTokens === "number" ? value.inputTokens : undefined,
        outputTokens: typeof value.outputTokens === "number" ? value.outputTokens : undefined,
      })) satisfies Session[];

      sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      return {
        count: sessions.length,
        sessions,
      } satisfies SessionsListResponse;
    } catch {
      return {
        count: 0,
        sessions: [],
      } satisfies SessionsListResponse;
    }
  });
}

async function readSessionTranscript(sessionId: string) {
  const transcriptPath = path.join(OPENCLAW_AGENT_DIR, `${sessionId}.jsonl`);
  try {
    const raw = await fs.readFile(transcriptPath, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
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
  return withCache("feed", 5_000, async () => {
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
  });
}

export async function getCronJobs() {
  return withCache("cron-jobs", 10_000, async () => {
    try {
      const data = await readJsonFile<{ version?: number; jobs?: CronJob[] }>(OPENCLAW_CRON_JOBS_FILE);
      return { jobs: data.jobs || [], total: data.jobs?.length || 0 } satisfies CronListResponse;
    } catch {
      return { jobs: [] } satisfies CronListResponse;
    }
  });
}

export async function getCronRuns(jobId: string) {
  try {
    const text = await runOpenClawText(["cron", "runs", "--id", jobId, "--limit", "20", "--timeout", "10000"], 15_000);
    const entries = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as CronRunsResponse["entries"][number];
        } catch {
          return { summary: line };
        }
      });
    return { entries };
  } catch {
    return { entries: [] } satisfies CronRunsResponse;
  }
}

async function getTasks() {
  return withCache("tasks", 10_000, async () => {
    try {
      return await runOpenClawJson<TasksListResponse>(["tasks", "list"], 10_000);
    } catch {
      return { count: 0, tasks: [] } satisfies TasksListResponse;
    }
  });
}

async function getPriorityItems() {
  return withCache("todo-priorities", 15_000, async () => {
    try {
      const raw = await fs.readFile(TODO_FILE, "utf8");
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
    } catch {
      return [] as PriorityItem[];
    }
  });
}

function normalizeTaskStatus(status?: string) {
  if (!status) return "unknown";
  return status.replace(/[_-]+/g, " ");
}

function buildFocusSummary(priorities: PriorityItem[], activeWork: ActiveWorkItem[], agenda: AgendaItem[]) {
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

export async function getControlCenterData() {
  return withCache("control-center", 10_000, async () => {
    const [priorities, tasks, sessions, jobs] = await Promise.all([
      getPriorityItems(),
      getTasks(),
      getSessions(),
      getCronJobs(),
    ]);

    const activeTaskStatuses = new Set(["queued", "pending", "running", "active", "in_progress"]);
    const activeWork: ActiveWorkItem[] = [
      ...tasks.tasks
        .filter((task) => activeTaskStatuses.has((task.status || "").toLowerCase()))
        .map((task) => ({
          id: `task-${task.taskId || task.runId || task.sessionKey || Math.random()}`,
          title: task.title || task.runtime || task.taskId || "Task",
          detail: task.summary || task.sessionKey || "OpenClaw task",
          status: normalizeTaskStatus(task.status),
          updatedAt: task.updatedAtMs || task.startedAtMs || task.createdAtMs || 0,
          source: "task" as const,
        })),
      ...sessions.sessions
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

    const agenda = jobs.jobs
      .filter((job) => job.enabled !== false && typeof job.state?.nextRunAtMs === "number")
      .sort((a, b) => (a.state?.nextRunAtMs || 0) - (b.state?.nextRunAtMs || 0))
      .slice(0, 6)
      .map((job) => ({
        id: job.id,
        title: job.name || "Untitled job",
        detail: job.description || job.payload?.message || job.payload?.text || job.schedule?.expr || job.schedule?.kind || "Scheduled job",
        timestamp: job.state?.nextRunAtMs || 0,
      }));

    const sources: SourceHealth[] = [
      {
        key: "todo",
        label: "Backlog",
        status: priorities.length ? "ok" : "degraded",
        detail: priorities.length ? `${priorities.length} open priorities parsed` : "No TODO priorities found",
      },
      {
        key: "tasks",
        label: "Tasks",
        status: tasks.count || activeWork.some((item) => item.source === "task") ? "ok" : "degraded",
        detail: tasks.count ? `${tasks.count} OpenClaw tasks visible` : "No task entries returned",
      },
      {
        key: "sessions",
        label: "Sessions",
        status: sessions.count ? "ok" : "degraded",
        detail: sessions.count ? `${sessions.count} recent sessions indexed` : "Session index unavailable or empty",
      },
      {
        key: "cron",
        label: "Cron",
        status: jobs.jobs.length ? "ok" : "degraded",
        detail: jobs.jobs.length ? `${jobs.jobs.length} scheduled jobs loaded` : "No cron jobs found",
      },
    ];

    return {
      priorities: priorities.slice(0, 8),
      activeWork,
      agenda,
      summary: {
        openPriorities: priorities.length,
        activeNow: activeWork.length,
        upcomingJobs: agenda.length,
      },
      focus: buildFocusSummary(priorities, activeWork, agenda),
      meta: {
        generatedAt: Date.now(),
        sources,
      },
    } satisfies ControlCenterData;
  });
}

async function getStatusText() {
  return withCache("status-text", 60_000, async () => {
    try {
      const version = await runOpenClawText(["--version"], 5_000);
      return `OpenClaw ${version.replace(/^OpenClaw\s+/i, "")}`;
    } catch {
      return "OpenClaw status unavailable";
    }
  });
}

async function readCgroupNumber(filePath: string) {
  try {
    const raw = (await fs.readFile(filePath, "utf8")).trim();
    if (!raw || raw === "max") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function getResourceSnapshot(): Promise<ResourceSnapshot> {
  const [memoryCurrent, memoryLimitRaw, pidsCurrent, pidsLimitRaw, cpuStatRaw, cpuMaxRaw, statFs] = await Promise.all([
    readCgroupNumber("/sys/fs/cgroup/memory.current"),
    readCgroupNumber("/sys/fs/cgroup/memory.max"),
    readCgroupNumber("/sys/fs/cgroup/pids.current"),
    readCgroupNumber("/sys/fs/cgroup/pids.max"),
    fs.readFile("/sys/fs/cgroup/cpu.stat", "utf8").catch(() => ""),
    fs.readFile("/sys/fs/cgroup/cpu.max", "utf8").catch(() => "max 100000"),
    fs.statfs("/"),
  ]);

  const totalMem = os.totalmem();
  const cpuLine = cpuStatRaw
    .split("\n")
    .find((line) => line.startsWith("usage_usec "));
  const cpuUsageUsec = cpuLine ? Number(cpuLine.split(/\s+/)[1]) || 0 : 0;

  const [quotaRaw, periodRaw] = cpuMaxRaw.trim().split(/\s+/);
  const cpuLimitCores = quotaRaw && quotaRaw !== "max" && periodRaw
    ? Math.max(Number(quotaRaw) / Number(periodRaw), 0.1)
    : os.cpus().length;

  const blockSize = Number(statFs.bsize || 1);
  const diskTotalBytes = Number(statFs.blocks) * blockSize;
  const diskFreeBytes = Number(statFs.bavail ?? statFs.bfree ?? 0) * blockSize;
  const diskUsedBytes = Math.max(diskTotalBytes - diskFreeBytes, 0);

  return {
    timestamp: Date.now(),
    memoryCurrentBytes: memoryCurrent ?? 0,
    memoryLimitBytes: memoryLimitRaw ?? totalMem,
    cpuUsageUsec,
    cpuLimitCores,
    pidsCurrent: pidsCurrent ?? 0,
    pidsLimit: pidsLimitRaw ?? 0,
    diskUsedBytes,
    diskTotalBytes,
  };
}

export async function getBannerData() {
  const [statusText, sessions, jobs, tasks, resourceSnapshot] = await Promise.all([
    getStatusText(),
    getSessions(),
    getCronJobs(),
    getTasks(),
    getResourceSnapshot(),
  ]);

  const versionMatch = statusText.match(/OpenClaw\s+([^\s]+)/i);
  const modelMatch = statusText.match(/Model:\s+([^·\n]+)/i);
  const contextMatch = statusText.match(/Context:\s+([^·\n]+)/i);
  const runtimeMatch = statusText.match(/Runtime:\s+([^·\n]+)/i);

  let latestVersion = "unknown";
  let upToDate = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    const npmResponse = await fetch("https://registry.npmjs.org/openclaw/latest", {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (npmResponse.ok) {
      const npmData = (await npmResponse.json()) as { version?: string };
      latestVersion = npmData.version || latestVersion;
      upToDate = latestVersion === (versionMatch?.[1] || "");
    }
  } catch {
    // best effort only
  }

  const resources = [
    ["OpenAI", !!process.env.OPENAI_API_KEY],
    ["Anthropic", !!process.env.ANTHROPIC_API_KEY],
    ["Google", !!process.env.GOOGLE_API_KEY],
    ["OpenRouter", !!process.env.OPENROUTER_API_KEY],
    ["GitHub", !!process.env.GITHUB_TOKEN],
    ["Gateway", !!process.env.GATEWAY_TOKEN],
  ]
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);

  const capabilities = [
    "Web Browse",
    "Shell Exec",
    "File System",
    "Cron Jobs",
    "Session Control",
    "Memory",
    "Image Analysis",
    "Image Generation",
  ];

  const subAgents = [
    ...sessions.sessions
      .filter((session) => session.key.includes(":subagent:") || session.key.includes(":cron:"))
      .map((session) => ({
        key: session.key,
        label: session.key,
        model: session.model || "unknown",
        tokens: session.totalTokens || 0,
        status: session.ageMs && session.ageMs < 120_000 ? "running" : "idle",
        updatedAt: session.updatedAt || 0,
        taskDescription: session.key,
      })),
    ...tasks.tasks.map((task) => ({
      key: task.sessionKey || task.runId || task.taskId || "task",
      label: task.title || task.runtime || task.taskId || "Task",
      model: task.runtime || "task",
      tokens: 0,
      status: task.status || "unknown",
      updatedAt: task.updatedAtMs || task.startedAtMs || task.createdAtMs || 0,
      taskDescription: task.summary || task.sessionKey || task.taskId || "",
    })),
  ];

  return {
    agentName: "Annie's Mission Control",
    version: versionMatch?.[1] || "unknown",
    latestVersion,
    upToDate,
    stats: {
      model: modelMatch?.[1]?.trim() || sessions.sessions[0]?.model || "unknown",
      contextUsage: contextMatch?.[1]?.trim() || `${sessions.sessions[0]?.contextTokens || 0} ctx`,
      activeSessions: sessions.count,
      runtimeMode: runtimeMatch?.[1]?.trim() || "OpenClaw",
      scheduledJobs: jobs.jobs.length,
    },
    quickInfo: {
      humanName: process.env.HUMAN_NAME || "Vorster",
      githubUsername: process.env.GITHUB_USERNAME || "Not set",
      workspacePath: process.env.WORKSPACE_PATH || "/root/.openclaw/workspace",
      secretsManager: process.env.SECRETS_MANAGER || ".env.local",
    },
    resources,
    capabilities,
    subAgents,
    resourceSnapshot,
    rawStatus: statusText,
  };
}

export async function buildSearchResults(query: string) {
  if (!query.trim()) {
    return {
      memories: [],
      files: [],
      conversations: [],
      tasks: [],
    };
  }

  const [memoryResults, sessions, cronResults, grepText] = await Promise.all([
    invokeOpenClaw<MemorySearchResponse>("memory_search", {
      query,
      maxResults: 8,
    }).catch(() => ({ hits: [], results: [] } satisfies MemorySearchResponse)),
    getSessions(),
    getCronJobs(),
    execFileAsync(
      "bash",
      [
        "-lc",
        `rg -n --hidden --glob '!node_modules' --glob '!.git' ${JSON.stringify(query)} /root/.openclaw/workspace /root/projects/mission-control | head -40`,
      ],
      { timeout: 10_000, maxBuffer: 5 * 1024 * 1024 }
    )
      .then(({ stdout }) => stdout.trim())
      .catch(() => ""),
  ]);

  const cronMatches = cronResults.jobs.filter((job) => {
    const haystack = [job.name, job.description, job.payload?.message, job.payload?.text]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
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
      .filter((session) => session.key.toLowerCase().includes(query.toLowerCase()))
      .map((session) => ({
        id: session.key,
        key: session.key,
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
}
