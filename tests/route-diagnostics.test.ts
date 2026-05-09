import test from "node:test";
import assert from "node:assert/strict";

import { classifyRouteSpeed, summarizeRouteSamples, type RouteSample } from "../src/lib/route-diagnostics.ts";

test("summarizeRouteSamples calculates last, average, and p95 timings", () => {
  const samples: RouteSample[] = [
    { route: "search", label: "Search", durationMs: 40, outcome: "ok", recordedAt: 1 },
    { route: "search", label: "Search", durationMs: 120, outcome: "ok", recordedAt: 2 },
    { route: "search", label: "Search", durationMs: 300, outcome: "error", recordedAt: 3 },
  ];

  const summary = summarizeRouteSamples(samples);

  assert.equal(summary.samples, 3);
  assert.equal(summary.lastDurationMs, 300);
  assert.equal(summary.avgDurationMs, 153);
  assert.equal(summary.p95DurationMs, 300);
  assert.equal(summary.maxDurationMs, 300);
  assert.equal(summary.lastOutcome, "error");
  assert.equal(summary.lastRecordedAt, 3);
});

test("classifyRouteSpeed keeps route timing language simple", () => {
  assert.equal(classifyRouteSpeed(), "warming");
  assert.equal(classifyRouteSpeed(85), "swift");
  assert.equal(classifyRouteSpeed(240), "steady");
  assert.equal(classifyRouteSpeed(900), "watch");
});
