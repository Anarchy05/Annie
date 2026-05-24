import test from "node:test";
import assert from "node:assert/strict";

import {
  buildActiveWork,
  buildAgenda,
  buildAttentionItems,
  buildAutomationWatchDataModel,
  buildRecommendation,
  buildTaskTracker,
  parsePriorityItems,
} from "../src/lib/dashboard-derived.ts";
import { splitMarkdownBlocks, tokenizeInline } from "../src/lib/chat-markdown.ts";

test("parsePriorityItems only returns unchecked items inside Current Priorities", () => {
  const items = parsePriorityItems(`# TODO\n\n## Current Priorities\n\n### P0 - Direction\n- [ ] Define the next 3 highest-value features\n- [x] Already done\n\n### P1 - Later\n- [ ] Add diagnostics\n\n## Done\n- [ ] Ignore this section\n`);

  assert.deepEqual(
    items.map((item) => ({ group: item.group, text: item.text })),
    [
      { group: "P0 - Direction", text: "Define the next 3 highest-value features" },
      { group: "P1 - Later", text: "Add diagnostics" },
    ]
  );
});

test("buildActiveWork prioritizes live tasks and recent sessions", () => {
  const activeWork = buildActiveWork(
    [
      {
        taskId: "task-1",
        status: "in_progress",
        label: "Refactor dashboard",
        terminalSummary: "Extract pure helpers",
        updatedAtMs: 200,
      },
      {
        taskId: "task-2",
        status: "done",
        title: "Should not show",
        updatedAtMs: 300,
      },
    ],
    [
      {
        key: "agent:main:cron:abc123",
        sessionId: "session-1",
        model: "gpt-5.4",
        kind: "direct",
        updatedAt: 150,
        ageMs: 60_000,
      },
      {
        key: "old-session",
        sessionId: "session-2",
        updatedAt: 100,
        ageMs: 31 * 60_000,
      },
    ]
  );

  assert.equal(activeWork.length, 2);
  assert.equal(activeWork[0]?.source, "task");
  assert.equal(activeWork[0]?.title, "Refactor dashboard");
  assert.equal(activeWork[0]?.detail, "Extract pure helpers");
  assert.equal(activeWork[0]?.status, "in progress");
  assert.equal(activeWork[1]?.source, "cron");
  assert.equal(activeWork[1]?.title, "Automation heartbeat");
  assert.equal(activeWork[1]?.detail, "gpt-5.4 · automation");
  assert.equal(activeWork[1]?.status, "running");
});

test("buildTaskTracker summarizes live task flow while tucking older failures into history", () => {
  const now = Date.UTC(2026, 4, 14, 0, 0, 0);
  const tracker = buildTaskTracker(
    [
      {
        taskId: "live-1",
        label: "Mission Control daily improvement",
        status: "running",
        updatedAtMs: now,
      },
      {
        taskId: "queued-1",
        task: "Repo cleanup",
        status: "queued",
        updatedAtMs: now - 5 * 60_000,
      },
      {
        taskId: "failed-1",
        title: "[Subagent Context] You are running as a subagent",
        status: "error",
        childSessionKey: "agent:main:subagent:abc123",
        terminalSummary: "Timed out while waiting for the CLI.\nRetry later.",
        updatedAtMs: now - 10 * 60_000,
      },
      {
        taskId: "failed-old-1",
        label: "Old failure",
        status: "failed",
        terminalSummary: "Happened days ago",
        updatedAtMs: now - 3 * 24 * 60 * 60_000,
      },
      {
        taskId: "done-1",
        label: "Healthcheck",
        status: "succeeded",
        updatedAtMs: now - 30 * 60_000,
      },
      {
        taskId: "done-old-1",
        label: "Old completion",
        status: "done",
        updatedAtMs: now - 2 * 24 * 60 * 60_000,
      },
    ],
    now
  );

  assert.equal(tracker.summary.running, 1);
  assert.equal(tracker.summary.queued, 1);
  assert.equal(tracker.summary.attention, 1);
  assert.equal(tracker.summary.staleAttention, 1);
  assert.equal(tracker.summary.completed, 1);
  assert.match(tracker.headline, /live task/i);
  assert.equal(tracker.items[0]?.title, "Mission Control daily improvement");
  assert.equal(tracker.items[1]?.title, "Sub-agent handoff");
  assert.equal(tracker.items[1]?.detail, "Timed out while waiting for the CLI. Retry later.");
  assert.equal(tracker.items[1]?.repeatCount, 1);
  assert.equal(tracker.triage?.tone, "danger");
  assert.match(tracker.triage?.note || "", /sub-agent handoff/i);
  assert.ok(!tracker.items.some((item) => item.title === "Old failure"));
  assert.ok(!tracker.items.some((item) => item.title === "Old completion"));
});

test("buildTaskTracker spots operational failure clusters and tells Annie how to react", () => {
  const now = Date.UTC(2026, 4, 24, 0, 0, 0);
  const tracker = buildTaskTracker(
    [
      {
        taskId: "failed-1",
        label: "Mission Control daily improvement",
        status: "failed",
        terminalSummary: "⚠️ Agent couldn't generate a response. Note: some tool actions may have already been executed — please verify before retrying.",
        updatedAtMs: now - 5 * 60_000,
      },
      {
        taskId: "failed-2",
        label: "Repo nightly pass",
        status: "failed",
        terminalSummary: "The model did not produce a response before the model idle timeout.",
        updatedAtMs: now - 10 * 60_000,
      },
      {
        taskId: "failed-3",
        label: "Branch cleanup",
        status: "error",
        terminalSummary: "⚠️ Agent couldn't generate a response. Note: some tool actions may have already been executed — please verify before retrying.",
        updatedAtMs: now - 15 * 60_000,
      },
    ],
    now
  );

  assert.equal(tracker.summary.attention, 3);
  assert.equal(tracker.triage?.tone, "warning");
  assert.match(tracker.triage?.title || "", /operational/i);
  assert.match(tracker.triage?.note || "", /agent response hiccups/i);
  assert.match(tracker.triage?.note || "", /verify any tool side effects/i);
});

test("buildTaskTracker groups repeated recent failures and completions without hiding the real counts", () => {
  const now = Date.UTC(2026, 4, 20, 0, 0, 0);
  const tracker = buildTaskTracker(
    [
      {
        taskId: "failed-1",
        label: "BoldIOT hourly site improvements",
        status: "failed",
        terminalSummary: "Agent couldn't generate a response.",
        updatedAtMs: now - 5 * 60_000,
      },
      {
        taskId: "failed-2",
        label: "BoldIOT hourly site improvements",
        status: "error",
        terminalSummary: "Agent couldn't generate a response.",
        updatedAtMs: now - 15 * 60_000,
      },
      {
        taskId: "failed-3",
        label: "BoldIOT hourly site improvements",
        status: "failed",
        terminalSummary: "Agent couldn't generate a response.",
        updatedAtMs: now - 25 * 60_000,
      },
      {
        taskId: "done-1",
        label: "Healthcheck",
        status: "done",
        updatedAtMs: now - 30 * 60_000,
      },
      {
        taskId: "done-2",
        label: "Healthcheck",
        status: "success",
        updatedAtMs: now - 40 * 60_000,
      },
    ],
    now
  );

  assert.equal(tracker.summary.attention, 3);
  assert.equal(tracker.summary.completed, 2);
  assert.match(tracker.note, /2 similar recent failures/i);
  assert.equal(tracker.items[0]?.title, "BoldIOT hourly site improvements");
  assert.equal(tracker.items[0]?.repeatCount, 3);
  assert.match(tracker.items[0]?.detail || "", /2 similar recent failures/i);
  assert.equal(tracker.items[1]?.title, "Healthcheck");
  assert.equal(tracker.items[1]?.repeatCount, 2);
  assert.match(tracker.items[1]?.detail || "", /1 similar recent completions/i);
  assert.equal(tracker.items.length, 2);
});

test("buildAgenda sorts enabled jobs by next run time", () => {
  const now = 1_000;
  const agenda = buildAgenda([
    { id: "later", enabled: true, name: "Later", state: { nextRunAtMs: now + 200 } },
    { id: "disabled", enabled: false, name: "Disabled", state: { nextRunAtMs: now + 50 } },
    { id: "first", enabled: true, name: "First", state: { nextRunAtMs: now + 100 } },
  ]);

  assert.deepEqual(agenda.map((item) => item.id), ["first", "later"]);
});

test("buildAttentionItems surfaces blocked work, degraded sources, and upcoming jobs", () => {
  const now = Date.UTC(2026, 4, 3, 0, 0, 0);
  const items = buildAttentionItems(
    [
      {
        id: "project-1",
        name: "Mission Control",
        status: "blocked",
        progress: 55,
        summary: "Needs direction",
        nextStep: "Decide the task model",
        updatedAt: now,
      },
    ],
    [{ id: "p0", group: "P0", text: "Top priority" }],
    [],
    [{ id: "job-1", title: "Weekly pass", detail: "Refactor time", timestamp: now + 30 * 60_000 }],
    [{ key: "tasks", label: "Tasks", status: "degraded", detail: "No tasks returned" }],
    now
  );

  assert.equal(items[0]?.id, "blocked-project-1");
  assert.equal(items[1]?.id, "degraded-sources");
  assert.equal(items[2]?.id, "no-active-work");
  assert.equal(items[3]?.id, "next-job-job-1");
});

test("buildAttentionItems does not treat quiet sources as degraded", () => {
  const now = Date.UTC(2026, 4, 3, 0, 0, 0);
  const items = buildAttentionItems(
    [],
    [{ id: "p0", group: "P0", text: "Top priority" }],
    [],
    [],
    [{ key: "tasks", label: "Tasks", status: "empty", detail: "No live OpenClaw tasks right now" }],
    now
  );

  assert.ok(!items.some((item) => item.id === "degraded-sources"));
  assert.equal(items[0]?.id, "no-active-work");
});

test("buildRecommendation prefers blocked projects, then active projects, then priorities", () => {
  const blocked = buildRecommendation(
    [{ id: "a", name: "A", status: "blocked", progress: 10, summary: "s", nextStep: "n", updatedAt: 1 }],
    [{ id: "p", group: "P0", text: "Priority" }],
    []
  );
  assert.match(blocked.headline, /unblock A/i);

  const active = buildRecommendation(
    [{ id: "b", name: "B", status: "active", progress: 50, summary: "summary", updatedAt: 1 }],
    [{ id: "p", group: "P0", text: "Priority" }],
    []
  );
  assert.match(active.headline, /push B/i);

  const priorityOnly = buildRecommendation([], [{ id: "p", group: "P0", text: "Priority" }], []);
  assert.equal(priorityOnly.note, "Priority");
});

test("buildAutomationWatchDataModel marks overdue healthy jobs as warnings and sorts failures first", () => {
  const now = Date.UTC(2026, 4, 3, 0, 0, 0);
  const data = buildAutomationWatchDataModel(
    [
      {
        job: {
          id: "healthy-overdue",
          name: "Healthy but overdue",
          state: { nextRunAtMs: now - 20 * 60_000 },
        },
        runs: {
          entries: [{ status: "completed", startedAtMs: now - 40 * 60_000, summary: "ok" }],
        },
      },
      {
        job: {
          id: "failing",
          name: "Failing",
          state: { nextRunAtMs: now + 20 * 60_000 },
        },
        runs: {
          entries: [{ status: "failed", startedAtMs: now - 10 * 60_000, error: "boom" }],
        },
      },
    ],
    now
  );

  assert.equal(data.summary.failing, 1);
  assert.equal(data.summary.warning, 1);
  assert.equal(data.items[0]?.id, "failing");
  assert.equal(data.items[1]?.status, "warning");
});

test("splitMarkdownBlocks recognizes headings, blockquotes, tables, and fenced code", () => {
  const blocks = splitMarkdownBlocks([
    "# Heading",
    "",
    "> Helpful quote",
    "",
    "| Name | Link |",
    "| --- | --- |",
    "| Docs | https://example.com |",
    "",
    "```ts",
    "const answer = 42;",
    "```",
  ].join("\n"));

  assert.deepEqual(
    blocks.map((block) => block.kind),
    ["heading", "blockquote", "table", "code"]
  );

  assert.equal(blocks[0]?.kind, "heading");
  assert.equal(blocks[1]?.kind, "blockquote");
  assert.equal(blocks[2]?.kind, "table");
  assert.equal(blocks[3]?.kind, "code");
});

test("tokenizeInline recognizes inline code, markdown links, and bare urls", () => {
  const tokens = tokenizeInline("Use `npm test`, read [docs](https://example.com/docs), or open https://example.com/run.");

  assert.deepEqual(tokens, [
    { type: "text", text: "Use " },
    { type: "code", text: "npm test" },
    { type: "text", text: ", read " },
    { type: "link", text: "docs", href: "https://example.com/docs" },
    { type: "text", text: ", or open " },
    { type: "link", text: "https://example.com/run", href: "https://example.com/run" },
    { type: "text", text: "." },
  ]);
});
