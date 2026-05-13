import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readSessionById, SESSION_DIR } from "../src/lib/chat-transcripts.ts";

async function withSessionTranscript(sessionId: string, rows: Array<Record<string, unknown>>, run: () => Promise<void>) {
  const sessionPath = path.join(SESSION_DIR, `${sessionId}.jsonl`);
  await fs.mkdir(SESSION_DIR, { recursive: true });
  await fs.writeFile(sessionPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

  try {
    await run();
  } finally {
    await fs.rm(sessionPath, { force: true });
  }
}

test("chat transcript helper can open a read-only session transcript by session id", async () => {
  const sessionId = `mission-control-chat-test-${Date.now()}`;

  await withSessionTranscript(
    sessionId,
    [
      {
        id: "user-1",
        type: "message",
        timestamp: "2026-05-13T00:00:00.000Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "hello Annie" }],
        },
      },
      {
        id: "assistant-1",
        type: "message",
        timestamp: "2026-05-13T00:00:01.000Z",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hi there" }],
        },
      },
    ],
    async () => {
      const payload = await readSessionById(sessionId);

      assert.equal(payload.exists, true);
      assert.deepEqual(
        payload.messages.map((message) => ({ role: message.role, text: message.text })),
        [
          { role: "user", text: "hello Annie" },
          { role: "assistant", text: "Hi there" },
        ]
      );
    }
  );
});

test("chat transcript helper marks missing read-only session transcripts clearly", async () => {
  const payload = await readSessionById("missing-session-for-test");

  assert.equal(payload.exists, false);
  assert.deepEqual(payload.messages, []);
});
