import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFallbackAutomationWatchData,
  buildFallbackBannerData,
  buildFallbackControlCenterData,
  buildFallbackFeedData,
} from "../src/lib/dashboard-fallbacks.ts";

test("control-center fallback keeps every dashboard panel renderable", () => {
  const payload = buildFallbackControlCenterData("Control center is degraded");

  assert.ok(Array.isArray(payload.priorities));
  assert.ok(Array.isArray(payload.activeWork));
  assert.ok(Array.isArray(payload.taskTracker.items));
  assert.ok(Array.isArray(payload.agenda));
  assert.ok(Array.isArray(payload.meta.sources));
  assert.equal(payload.alerts[0]?.detail, "Control center is degraded");
});

test("automation-watch fallback keeps automation cards renderable", () => {
  const payload = buildFallbackAutomationWatchData("Automation history is degraded");

  assert.equal(typeof payload.headline, "string");
  assert.equal(typeof payload.summary.failing, "number");
  assert.equal(typeof payload.summary.warning, "number");
  assert.equal(typeof payload.summary.upcoming, "number");
  assert.ok(Array.isArray(payload.items));
  assert.equal(payload.note, "Automation history is degraded");
});

test("banner fallback keeps the top status banner renderable", () => {
  const payload = buildFallbackBannerData("Banner is degraded");

  assert.equal(typeof payload.version, "string");
  assert.equal(typeof payload.latestVersion, "string");
  assert.equal(typeof payload.upToDate, "boolean");
  assert.equal(typeof payload.stats.model, "string");
  assert.equal(typeof payload.stats.activeSessions, "number");
  assert.equal(typeof payload.stats.scheduledJobs, "number");
  assert.equal(payload.diagnostics.summary, "warming up");
  assert.ok(Array.isArray(payload.diagnostics.routes));
  assert.equal(payload.rawStatus, "Banner is degraded");
});

test("feed fallback always returns an items array", () => {
  const payload = buildFallbackFeedData();

  assert.ok(Array.isArray(payload.items));
  assert.equal(payload.items.length, 0);
});
