import test from "node:test";
import assert from "node:assert/strict";

import { buildPreviewFallbackMessage, getParentPath } from "../src/lib/files-client.ts";

test("getParentPath returns the containing directory for nested files", () => {
  assert.equal(getParentPath("/root/projects/mission-control/README.md"), "/root/projects/mission-control");
});

test("getParentPath trims trailing slashes without climbing past root", () => {
  assert.equal(getParentPath("/root/projects/mission-control/src/"), "/root/projects/mission-control");
  assert.equal(getParentPath("/"), "/");
});

test("buildPreviewFallbackMessage keeps the failure actionable", () => {
  assert.equal(
    buildPreviewFallbackMessage(
      "/root/projects/mission-control/src/app/favicon.ico",
      "This file type is not previewable in Mission Control yet"
    ),
    "Couldn’t preview favicon.ico. This file type is not previewable in Mission Control yet You can still browse the parent folder or download the file directly."
  );
});
