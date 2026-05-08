import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCronJobsPayload,
  buildCronRunsPayload,
  buildDegradedCronState,
  buildOkCronState,
  deriveNextRunAtMs,
} from "../src/lib/cron-state.ts";

test("cron jobs payload keeps the calendar page renderable in degraded mode", () => {
  const payload = buildCronJobsPayload([], buildDegradedCronState("Cron job state is unavailable right now."));

  assert.ok(Array.isArray(payload.jobs));
  assert.equal(payload.total, 0);
  assert.equal(payload.meta.status, "degraded");
  assert.equal(payload.meta.source, "fallback");
  assert.match(payload.meta.detail, /unavailable/i);
});

test("cron runs payload keeps job history renderable when no runs exist yet", () => {
  const payload = buildCronRunsPayload([], buildOkCronState("local", "No runs have been recorded for this job yet."));

  assert.ok(Array.isArray(payload.entries));
  assert.equal(payload.entries.length, 0);
  assert.equal(payload.meta.status, "ok");
  assert.equal(payload.meta.source, "local");
  assert.match(payload.meta.detail, /no runs/i);
});

test("deriveNextRunAtMs handles repeating schedules from anchor time", () => {
  const now = Date.UTC(2026, 4, 8, 0, 10, 0);
  const nextRun = deriveNextRunAtMs({ kind: "every", everyMs: 10 * 60_000, anchorMs: Date.UTC(2026, 4, 8, 0, 0, 0) }, now);

  assert.equal(nextRun, Date.UTC(2026, 4, 8, 0, 20, 0));
});

test("deriveNextRunAtMs handles simple utc cron expressions and stagger", () => {
  const now = Date.UTC(2026, 4, 8, 0, 10, 0);
  const nextDaily = deriveNextRunAtMs({ kind: "cron", expr: "30 6 * * *", tz: "UTC" }, now);
  const nextStepped = deriveNextRunAtMs({ kind: "cron", expr: "0 */4 * * *", tz: "UTC", staggerMs: 45 * 60_000 }, now);
  const nextWeekly = deriveNextRunAtMs({ kind: "cron", expr: "15 1 * * 0", tz: "UTC" }, now);

  assert.equal(nextDaily, Date.UTC(2026, 4, 8, 6, 30, 0));
  assert.equal(nextStepped, Date.UTC(2026, 4, 8, 4, 45, 0));
  assert.equal(nextWeekly, Date.UTC(2026, 4, 10, 1, 15, 0));
});
