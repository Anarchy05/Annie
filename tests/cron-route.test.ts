import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCronJobsPayload,
  buildCronRunsPayload,
  buildDegradedCronState,
  buildOkCronState,
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
