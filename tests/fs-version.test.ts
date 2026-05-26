import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import { getFileVersion, getTreeVersion } from "../src/lib/fs-version.ts";

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
