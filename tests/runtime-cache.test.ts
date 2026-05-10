import test from "node:test";
import assert from "node:assert/strict";

import { createRuntimeCache } from "../src/lib/runtime-cache.ts";

test("runtime cache reuses hot values until the ttl expires", async () => {
  let now = 1_000;
  const cache = createRuntimeCache(() => now);
  let calls = 0;

  const first = await cache.withCache("status", 500, async () => {
    calls += 1;
    return { value: calls };
  });
  const second = await cache.withCache("status", 500, async () => {
    calls += 1;
    return { value: calls };
  });

  now += 501;

  const third = await cache.withCache("status", 500, async () => {
    calls += 1;
    return { value: calls };
  });

  assert.deepEqual(first, { value: 1 });
  assert.strictEqual(second, first);
  assert.deepEqual(third, { value: 2 });
  assert.equal(calls, 2);
});

test("runtime cache deduplicates concurrent reads for the same key", async () => {
  const cache = createRuntimeCache();
  let calls = 0;

  const factory = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { value: calls };
  };

  const [first, second, third] = await Promise.all([
    cache.withCache("sessions", 500, factory),
    cache.withCache("sessions", 500, factory),
    cache.withCache("sessions", 500, factory),
  ]);

  assert.equal(calls, 1);
  assert.strictEqual(first, second);
  assert.strictEqual(second, third);
});

test("runtime cache does not poison future reads after a failed factory", async () => {
  const cache = createRuntimeCache();
  let calls = 0;

  await assert.rejects(
    cache.withCache("projects", 500, async () => {
      calls += 1;
      throw new Error("boom");
    }),
    /boom/
  );

  const recovered = await cache.withCache("projects", 500, async () => {
    calls += 1;
    return "ok";
  });

  assert.equal(calls, 2);
  assert.equal(recovered, "ok");
});
