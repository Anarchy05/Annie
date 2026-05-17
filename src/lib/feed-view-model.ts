export type ControlCenterData = {
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
      staleAttention: number;
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

export type AutomationWatchData = {
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

export type QuickActionPlan = {
  id: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  tone: "info" | "success" | "warning" | "danger";
  kind: "link" | "button";
};

export const emptyControlCenter: ControlCenterData = {
  priorities: [],
  activeWork: [],
  taskTracker: {
    headline: "Annie is checking the task runway.",
    note: "Live task details will appear after local state loads.",
    summary: { running: 0, queued: 0, attention: 0, staleAttention: 0, completed: 0 },
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

export function buildLiveWorkItems(controlCenter: ControlCenterData) {
  return controlCenter.activeWork.filter((item) => {
    const status = item.status.toLowerCase();
    return ["running", "active", "in progress"].includes(status);
  });
}

export function buildRecentWorkItems(controlCenter: ControlCenterData) {
  return controlCenter.activeWork.filter((item) => {
    const status = item.status.toLowerCase();
    return !["running", "active", "in progress"].includes(status);
  });
}

export function buildSourcesMap(controlCenter: ControlCenterData) {
  return new Map(controlCenter.meta.sources.map((source) => [source.key, source] as const));
}

export function deriveFeedStatus(args: {
  lastLoadedAt: number | null;
  hasAutomationSnapshot: boolean;
  error: string | null;
  automationError: string | null;
  now?: number;
}) {
  const hasControlCenterSnapshot = args.lastLoadedAt !== null;
  const showBlockingControlCenterError = Boolean(args.error && !hasControlCenterSnapshot);
  const blockingControlCenterError = showBlockingControlCenterError ? args.error || "Control center data is unavailable right now." : null;
  const blockingAutomationError = args.automationError && !args.hasAutomationSnapshot ? args.automationError : null;
  const staleSignals = [
    args.error && hasControlCenterSnapshot
      ? `Control center refresh failed${args.lastLoadedAt ? `; showing the last good snapshot from ${formatRelative(args.lastLoadedAt, args.now)}` : "."}`
      : null,
    args.automationError && args.hasAutomationSnapshot
      ? "Automation watch refresh failed; Annie is keeping the last good health read visible."
      : null,
  ].filter(Boolean) as string[];

  return {
    hasControlCenterSnapshot,
    showBlockingControlCenterError,
    blockingControlCenterError,
    blockingAutomationError,
    staleSignals,
  };
}

export function buildQuickActionPlans(args: {
  controlCenter: ControlCenterData;
  automationWatch: AutomationWatchData | null;
  error: string | null;
  automationError: string | null;
  liveWork: ControlCenterData["activeWork"];
  now?: number;
}) {
  const { controlCenter, automationWatch, error, automationError, liveWork } = args;
  const actions: QuickActionPlan[] = [];

  if (error) {
    actions.push({
      id: "refresh-control-center",
      label: "Wake the dashboard",
      title: "Refresh Annie's read",
      detail: "Mission Control hit a rough patch. Give it another pass.",
      href: "#overview",
      tone: "warning",
      kind: "button",
    });
  } else if (controlCenter.taskTracker.summary.attention > 0) {
    actions.push({
      id: "task-attention",
      label: "Needs attention",
      title: `${controlCenter.taskTracker.summary.attention} task${controlCenter.taskTracker.summary.attention === 1 ? "" : "s"} need a decision`,
      detail: "Jump to the task runway before stale work piles up.",
      href: "#task-runway",
      tone: "danger",
      kind: "link",
    });
  } else if (liveWork.length > 0) {
    actions.push({
      id: "live-thread",
      label: "Live now",
      title: liveWork[0]?.title || "A live thread is moving",
      detail: "Open chat or scan the current work panel to steer Annie.",
      href: "/chat",
      tone: "success",
      kind: "link",
    });
  }

  if (automationError) {
    actions.push({
      id: "automation-refresh",
      label: "Automation watch",
      title: "Refresh recent run health",
      detail: "Automation signals went fuzzy. Reload the watch panel.",
      href: "#automation-watch",
      tone: "warning",
      kind: "button",
    });
  } else if ((automationWatch?.summary.failing || 0) > 0) {
    actions.push({
      id: "automation-failing",
      label: "Automation watch",
      title: `${automationWatch?.summary.failing || 0} job${automationWatch?.summary.failing === 1 ? "" : "s"} are failing`,
      detail: "Check the latest cron health before the next beat lands.",
      href: "#automation-watch",
      tone: "danger",
      kind: "link",
    });
  } else if (controlCenter.agenda[0]) {
    actions.push({
      id: "next-beat",
      label: "Next beat",
      title: controlCenter.agenda[0].title,
      detail: `${formatRelativeFuture(controlCenter.agenda[0].timestamp, args.now)} · ${controlCenter.agenda[0].detail}`,
      href: "/calendar",
      tone: "info",
      kind: "link",
    });
  }

  if (controlCenter.priorities[0]) {
    actions.push({
      id: "top-priority",
      label: "Top priority",
      title: controlCenter.priorities[0].text,
      detail: `From ${controlCenter.priorities[0].group}. Keep Annie pointed here.`,
      href: "#top-priorities",
      tone: "info",
      kind: "link",
    });
  } else {
    actions.push({
      id: "set-direction",
      label: "Set direction",
      title: "Backlog is quiet",
      detail: "Open projects and give Annie the next valuable target.",
      href: "/projects",
      tone: "success",
      kind: "link",
    });
  }

  if (controlCenter.projects[0]) {
    actions.push({
      id: "project-pulse",
      label: "Project pulse",
      title: controlCenter.projects[0].name,
      detail: controlCenter.projects[0].nextStep || controlCenter.projects[0].summary,
      href: "#project-pulse",
      tone: "info",
      kind: "link",
    });
  }

  actions.push({
    id: "ask-annie",
    label: "Annie help",
    title: "Ask Annie for a steer",
    detail: "Open chat for a plain-English rundown or next-step help.",
    href: "/chat",
    tone: "success",
    kind: "link",
  });

  return actions.slice(0, 4);
}

export function formatRelative(timestamp: number, now = Date.now()) {
  if (!timestamp) return "Unknown";
  const diffMinutes = Math.max(Math.floor((now - timestamp) / 60_000), 0);
  if (diffMinutes <= 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatRelativeFuture(timestamp: number, now = Date.now()) {
  if (!timestamp) return "Unknown";
  const diffMinutes = Math.round((timestamp - now) / 60_000);
  if (diffMinutes <= 1) return "due now";
  if (diffMinutes < 60) return `in ${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}
