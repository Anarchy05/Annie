import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createCachedTreeVersionReader, getFileVersion, getTreeVersion } from "../src/lib/fs-version.ts";

test("getFileVersion returns missing for absent files", async () => {
  const missing = await getFileVersion(path.join(os.tmpdir(), `annie-missing-${Date.now()}`));
  assert.equal(missing, "missing");
});

test("getTreeVersion ignores configured directories and changes when tracked files update", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "annie-fs-version-"));

  try {
    await fs.writeFile(path.join(root, "keep.txt"), "alpha\n", "utf8");
    await fs.mkdir(path.join(root, ".next"));
    await fs.writeFile(path.join(root, ".next", "ignore.txt"), "build-one\n", "utf8");

    const beforeIgnoredChange = await getTreeVersion(root, { ignoreDirs: [".next"] });

    await new Promise((resolve) => setTimeout(resolve, 15));
    await fs.writeFile(path.join(root, ".next", "ignore.txt"), "build-two\n", "utf8");

    const afterIgnoredChange = await getTreeVersion(root, { ignoreDirs: [".next"] });
    assert.equal(afterIgnoredChange, beforeIgnoredChange);

    await new Promise((resolve) => setTimeout(resolve, 15));
    await fs.writeFile(path.join(root, "keep.txt"), "beta\n", "utf8");

    const afterTrackedChange = await getTreeVersion(root, { ignoreDirs: [".next"] });
    assert.notEqual(afterTrackedChange, beforeIgnoredChange);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("createCachedTreeVersionReader reuses a recent tree scan until its TTL expires", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "annie-tree-version-"));
  let now = 1_000;

  try {
    const filePath = path.join(root, "notes.txt");
    await fs.writeFile(filePath, "hello\n", "utf8");

    const reader = createCachedTreeVersionReader(() => now);
    const first = await reader.get(root, {}, 5_000);

    const nextMtime = new Date(Date.now() + 60_000);
    await fs.writeFile(filePath, "hello again\n", "utf8");
    await fs.utimes(filePath, nextMtime, nextMtime);

    const cached = await reader.get(root, {}, 5_000);
    assert.equal(cached, first);

    now += 5_001;
    const refreshed = await reader.get(root, {}, 5_000);
    assert.notEqual(refreshed, first);
    assert.equal(refreshed, await getTreeVersion(root));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
