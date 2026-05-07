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

test("files view mode returns a text preview for previewable files", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/files?mode=view&path=/root/projects/mission-control/README.md")
  );
  const payload = (await response.json()) as {
    path: string;
    parentPath: string;
    name: string;
    content: string;
    lineCount: number;
    truncated: boolean;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.path, "/root/projects/mission-control/README.md");
  assert.equal(payload.parentPath, "/root/projects/mission-control");
  assert.equal(payload.name, "README.md");
  assert.match(payload.content, /Mission Control/i);
  assert.ok(payload.lineCount > 0);
  assert.equal(typeof payload.truncated, "boolean");
});

test("files view mode rejects non-previewable binary files", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/files?mode=view&path=/root/projects/mission-control/src/app/favicon.ico")
  );
  const payload = (await response.json()) as { error?: string };

  assert.equal(response.status, 415);
  assert.match(payload.error || "", /not previewable/i);
});
