import { promises as fs } from "node:fs";
import path from "node:path";

export const CHAT_SESSION_ID = "annies-mission-control-chat";
export const SESSION_DIR = "/root/.openclaw/agents/main/sessions";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
};

export type ChatHistoryResult = {
  exists: boolean;
  messages: ChatMessage[];
};

export async function readChatHistoryFromFile(filePath: string): Promise<ChatHistoryResult> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const rows = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    const messages: ChatMessage[] = [];

    for (const row of rows) {
      if (row.type !== "message") continue;
      const message = row.message as { role?: string; content?: Array<{ type?: string; text?: string }> };
      if (message.role !== "user" && message.role !== "assistant") continue;

      const text = (message.content || [])
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text?.trim() || "")
        .join("\n\n")
        .trim();

      if (!text) continue;

      const timestamp = typeof row.timestamp === "string" ? Date.parse(row.timestamp) : Date.now();
      messages.push({
        id: String(row.id || `${message.role}-${timestamp}`),
        role: message.role,
        text,
        timestamp,
      });
    }

    return {
      exists: true,
      messages: messages.slice(-80),
    };
  } catch {
    return {
      exists: false,
      messages: [],
    };
  }
}

export async function readArchiveById(id: string) {
  if (!/^\d+$/.test(id)) {
    return {
      exists: false,
      messages: [],
    } satisfies ChatHistoryResult;
  }
  const archivePath = path.join(SESSION_DIR, `${CHAT_SESSION_ID}.${id}.bak.jsonl`);
  return readChatHistoryFromFile(archivePath);
}

export async function readSessionById(id: string) {
  const sessionId = id.trim();
  if (!sessionId || /[\\/]/.test(sessionId)) {
    return {
      exists: false,
      messages: [],
    } satisfies ChatHistoryResult;
  }

  const sessionPath = path.join(SESSION_DIR, `${sessionId}.jsonl`);
  return readChatHistoryFromFile(sessionPath);
}
