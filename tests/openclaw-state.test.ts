import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCronJobs, normalizeCronRunEntry, normalizeSessionsIndex, parseJsonLines } from "../src/lib/openclaw-state.ts";

test("normalizeSessionsIndex keeps valid sessions while flagging malformed entries", () => {
  const now = Date.UTC(2026, 4, 24, 1, 0, 0);
  const result = normalizeSessionsIndex(
    {
      "agent:main:direct:good": {
        sessionId: "session-1",
        updatedAt: now - 60_000,
        model: "gpt-5.4",
      },
      "agent:main:direct:missing-id": {
        updatedAt: now,
      },
      "agent:main:direct:not-an-object": "oops",
    },
    now
  );

  assert.equal(result.sessions.length, 1);
  assert.equal(result.invalidCount, 2);
  assert.equal(result.sessions[0]?.sessionId, "session-1");
  assert.equal(result.sessions[0]?.ageMs, 60_000);
});

test("normalizeCronJobs keeps valid jobs and drops malformed ones", () => {
  const result = normalizeCronJobs({
    jobs: [
      {
        id: "weekly-refactor",
        name: "Weekly refactor",
        enabled: true,
        schedule: { kind: "cron", expr: "0 0 * * 0", tz: "UTC" },
      },
      {
        name: "Missing id",
      },
      "bad-row",
    ],
  });

  assert.equal(result.jobs.length, 1);
  assert.equal(result.invalidCount, 2);
  assert.equal(result.jobs[0]?.id, "weekly-refactor");
  assert.equal(result.jobs[0]?.schedule?.expr, "0 0 * * 0");
});

test("parseJsonLines skips malformed rows without losing good cron runs", () => {
  const result = parseJsonLines(
    [
      JSON.stringify({ status: "ok", summary: "done" }),
      "not json at all",
      JSON.stringify({ status: "failed", error: "boom" }),
    ].join("\n"),
    normalizeCronRunEntry
  );

  assert.equal(result.items.length, 2);
  assert.equal(result.invalidCount, 1);
  assert.equal(result.items[0]?.status, "ok");
  assert.equal(result.items[1]?.error, "boom");
});

test("normalizeCronRunEntry rejects non-object values", () => {
  assert.equal(normalizeCronRunEntry("bad-row"), null);
  assert.deepEqual(normalizeCronRunEntry({ status: "ok", summary: "done" }), {
    startedAtMs: undefined,
    finishedAtMs: undefined,
    status: "ok",
    summary: "done",
    error: undefined,
    skippedReason: undefined,
  });
});
