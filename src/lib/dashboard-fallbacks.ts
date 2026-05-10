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
    version: "unknown",
    latestVersion: "unknown",
    upToDate: true,
    stats: {
      model: "unknown",
      activeSessions: 0,
      scheduledJobs: 0,
    },
    diagnostics: {
      summary: "warming up",
      routes: [],
    },
    note: message,
  };
}

export function buildFallbackFeedData() {
  return {
    items: [] as TimelineItem[],
  };
}
