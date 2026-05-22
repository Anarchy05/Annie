import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLiveWorkItems,
  buildQuickActionPlans,
  buildRecommendationSpotlight,
  buildRecentWorkItems,
  deriveFeedStatus,
  emptyControlCenter,
} from "../src/lib/feed-view-model.ts";

test("deriveFeedStatus keeps stale snapshots visible when refreshes fail", () => {
  const now = Date.UTC(2026, 4, 17, 0, 50, 0);
  const status = deriveFeedStatus({
    lastLoadedAt: now - 5 * 60_000,
    hasAutomationSnapshot: true,
    error: "Control center data is unavailable right now.",
    automationError: "Automation watch is unavailable right now.",
    now,
  });

  assert.equal(status.showBlockingControlCenterError, false);
  assert.equal(status.blockingAutomationError, null);
  assert.equal(status.staleSignals.length, 2);
  assert.match(status.staleSignals[0] || "", /showing the last good snapshot from 5 min ago/i);
  assert.match(status.staleSignals[1] || "", /last good health read visible/i);
});

test("deriveFeedStatus blocks empty first loads when no snapshot exists yet", () => {
  const status = deriveFeedStatus({
    lastLoadedAt: null,
    hasAutomationSnapshot: false,
    error: "Control center data is unavailable right now.",
    automationError: "Automation watch is unavailable right now.",
  });

  assert.equal(status.showBlockingControlCenterError, true);
  assert.equal(status.blockingControlCenterError, "Control center data is unavailable right now.");
  assert.equal(status.blockingAutomationError, "Automation watch is unavailable right now.");
  assert.deepEqual(status.staleSignals, []);
});

test("buildLiveWorkItems and buildRecentWorkItems split active work by status", () => {
  const controlCenter = {
    ...emptyControlCenter,
    activeWork: [
      { id: "1", title: "Running task", detail: "", status: "running", updatedAt: 1, source: "task" as const },
      { id: "2", title: "Active session", detail: "", status: "active", updatedAt: 2, source: "session" as const },
      { id: "3", title: "Recent cron", detail: "", status: "completed", updatedAt: 3, source: "cron" as const },
    ],
  };

  assert.deepEqual(buildLiveWorkItems(controlCenter).map((item) => item.id), ["1", "2"]);
  assert.deepEqual(buildRecentWorkItems(controlCenter).map((item) => item.id), ["3"]);
});

test("buildQuickActionPlans prioritizes recovery signals before normal navigation", () => {
  const controlCenter = {
    ...emptyControlCenter,
    priorities: [{ id: "p1", group: "P0", text: "Top priority" }],
    agenda: [{ id: "job-1", title: "Weekly pass", detail: "Refactor time", timestamp: Date.UTC(2026, 4, 17, 1, 20, 0) }],
    projects: [{ id: "proj-1", name: "Mission Control", status: "active" as const, progress: 80, summary: "Close out polish", nextStep: "Ship the weekly pass", updatedAt: 1 }],
    taskTracker: {
      ...emptyControlCenter.taskTracker,
      summary: { ...emptyControlCenter.taskTracker.summary, attention: 2 },
    },
  };

  const actions = buildQuickActionPlans({
    controlCenter,
    automationWatch: { generatedAt: 1, headline: "Watch", note: "", summary: { failing: 1, warning: 0, upcoming: 1 }, items: [] },
    error: "Control center data is unavailable right now.",
    automationError: "Automation watch is unavailable right now.",
    liveWork: [],
    now: Date.UTC(2026, 4, 17, 0, 50, 0),
  });

  assert.deepEqual(actions.map((action) => action.id), [
    "refresh-control-center",
    "automation-refresh",
    "top-priority",
    "project-pulse",
  ]);
});

test("buildRecommendationSpotlight picks the strongest next move for the operator", () => {
  const controlCenter = {
    ...emptyControlCenter,
    taskTracker: {
      ...emptyControlCenter.taskTracker,
      note: "A cron job needs a decision.",
      summary: { ...emptyControlCenter.taskTracker.summary, attention: 1 },
    },
    recommendation: {
      headline: "Best next move: inspect the runway.",
      note: "A cron job needs a decision.",
    },
  };

  const spotlight = buildRecommendationSpotlight({
    controlCenter,
    automationWatch: null,
    error: null,
    automationError: null,
    liveWork: [],
  });

  assert.equal(spotlight.id, "task-attention");
  assert.equal(spotlight.kind, "link");
  assert.equal(spotlight.href, "#task-runway");
  assert.match(spotlight.cta, /task runway/i);
});

test("buildQuickActionPlans falls back to live work, schedule, and backlog guidance when healthy", () => {
  const controlCenter = {
    ...emptyControlCenter,
    priorities: [],
    agenda: [{ id: "job-1", title: "Nightly pass", detail: "Healthcheck", timestamp: Date.UTC(2026, 4, 17, 1, 5, 0) }],
    projects: [],
  };

  const actions = buildQuickActionPlans({
    controlCenter,
    automationWatch: { generatedAt: 1, headline: "Watch", note: "", summary: { failing: 0, warning: 0, upcoming: 1 }, items: [] },
    error: null,
    automationError: null,
    liveWork: [{ id: "live-1", title: "Customer follow-up", detail: "", status: "running", updatedAt: 1, source: "task" }],
    now: Date.UTC(2026, 4, 17, 0, 50, 0),
  });

  assert.deepEqual(actions.map((action) => action.id), ["live-thread", "next-beat", "set-direction", "ask-annie"]);
  assert.match(actions[1]?.detail || "", /in 15 min/i);
});
