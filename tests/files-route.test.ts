import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";

import { GET } from "../src/app/api/files/route.ts";

test("files list view falls back to the nearest safe directory when given a file path", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/files?mode=list&path=/root/projects/mission-control/README.md")
  );
  const payload = (await response.json()) as {
    currentPath: string;
    requestedPath: string | null;
    pathFallbackApplied?: boolean;
    pathFallbackReason?: string;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.currentPath, "/root/projects/mission-control");
  assert.equal(payload.requestedPath, "/root/projects/mission-control/README.md");
  assert.equal(payload.pathFallbackApplied, true);
  assert.equal(payload.pathFallbackReason, "file");
});

test("files list view falls back to the nearest existing directory when a nested path is missing", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/files?mode=list&path=/root/projects/mission-control/src/not-real/deeper")
  );
  const payload = (await response.json()) as {
    currentPath: string;
    pathFallbackApplied?: boolean;
    pathFallbackReason?: string;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.currentPath, "/root/projects/mission-control/src");
  assert.equal(payload.pathFallbackApplied, true);
  assert.equal(payload.pathFallbackReason, "missing");
});

test("files list view redirects outside-root requests back to the first safe root", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/files?mode=list&path=/etc")
  );
  const payload = (await response.json()) as {
    currentPath: string;
    pathFallbackApplied?: boolean;
    pathFallbackReason?: string;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.currentPath, "/root/.openclaw/workspace");
  assert.equal(payload.pathFallbackApplied, true);
  assert.equal(payload.pathFallbackReason, "outside-root");
});
