import type { ControlCenterData, TimelineItem } from "./dashboard-derived";

export function buildFallbackControlCenterData(message = "Mission Control is waiting for local OpenClaw state to load.") {
  const generatedAt = Date.now();

  return {
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
    alerts: [
      {
        id: "control-center-degraded",
        tone: "info",
        title: "Mission Control is in degraded mode",
        detail: message,
      },
    ],
    summary: { openPriorities: 0, activeNow: 0, upcomingJobs: 0 },
    focus: {
      headline: "Mission Control is waking up.",
      note: message,
    },
    recommendation: {
      headline: "Annie is getting oriented.",
      note: "Once local state is available again, the dashboard will fill itself back in.",
    },
    meta: {
      generatedAt,
      sources: [
        { key: "todo", label: "Backlog", status: "degraded", detail: "TODO priorities unavailable right now" },
        { key: "tasks", label: "Tasks", status: "degraded", detail: "Task runway unavailable right now" },
        { key: "sessions", label: "Sessions", status: "degraded", detail: "Session index unavailable right now" },
        { key: "cron", label: "Cron", status: "degraded", detail: "Cron state unavailable right now" },
      ],
    },
  } satisfies ControlCenterData;
}

export function buildFallbackAutomationWatchData(message = "Automation history is unavailable right now.") {
  return {
    generatedAt: Date.now(),
    headline: "Automation watch is in a quiet degraded mode",
    note: message,
    summary: {
      failing: 0,
      warning: 0,
      upcoming: 0,
    },
    items: [],
  };
}

export function buildFallbackBannerData(message = "Mission Control banner data is unavailable right now.") {
  return {
    agentName: "Annie's Mission Control",
    version: "unknown",
    latestVersion: "unknown",
    upToDate: true,
    stats: {
      model: "unknown",
      contextUsage: "Unavailable",
      activeSessions: 0,
      runtimeMode: "OpenClaw",
      scheduledJobs: 0,
    },
    quickInfo: {
      humanName: process.env.HUMAN_NAME || "Vorster",
      githubUsername: process.env.GITHUB_USERNAME || "Not set",
      workspacePath: process.env.WORKSPACE_PATH || "/root/.openclaw/workspace",
      secretsManager: process.env.SECRETS_MANAGER || ".env.local",
    },
    resources: [],
    capabilities: [],
    subAgents: [],
    resourceSnapshot: {
      timestamp: Date.now(),
      memoryCurrentBytes: 0,
      memoryLimitBytes: 0,
      cpuUsageUsec: 0,
      cpuLimitCores: 0,
      pidsCurrent: 0,
      pidsLimit: 0,
      diskUsedBytes: 0,
      diskTotalBytes: 0,
    },
    diagnostics: {
      summary: "warming up",
      routes: [],
    },
    rawStatus: message,
  };
}

export function buildFallbackFeedData() {
  return {
    items: [] as TimelineItem[],
  };
}
