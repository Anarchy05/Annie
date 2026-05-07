import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

import { invokeOpenClaw } from "@/lib/openclaw";

const execFileAsync = promisify(execFile);
const CHAT_SESSION_ID = "annies-mission-control-chat";
const SESSION_DIR = "/root/.openclaw/agents/main/sessions";
const SESSION_FILE = path.join(SESSION_DIR, `${CHAT_SESSION_ID}.jsonl`);
const UPLOAD_DIR = "/tmp/annies-mission-control-uploads";
const TEXT_FILE_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".yml",
  ".yaml",
  ".toml",
  ".sh",
  ".log",
  ".csv",
  ".html",
  ".css",
  ".sql",
  ".xml",
]);

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
};

type UploadedAttachment = {
  name: string;
  type: string;
  size: number;
  note: string;
};

type ChatArchive = {
  id: string;
  label: string;
  archivedAt: number;
  messageCount: number;
  preview: string;
};

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function readChatHistoryFromFile(filePath: string): Promise<ChatMessage[]> {
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

    return messages.slice(-80);
  } catch {
    return [];
  }
}

async function readChatHistory() {
  return readChatHistoryFromFile(SESSION_FILE);
}

function archiveIdFromFileName(fileName: string) {
  const match = fileName.match(/\.(\d+)\.bak\.jsonl$/);
  return match?.[1] || null;
}

async function listChatArchives(): Promise<ChatArchive[]> {
  try {
    const entries = await fs.readdir(SESSION_DIR, { withFileTypes: true });
    const archiveFiles = entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(`${CHAT_SESSION_ID}.`) && entry.name.endsWith(".bak.jsonl"))
      .map((entry) => entry.name);

    const archives = await Promise.all(
      archiveFiles.map(async (fileName) => {
        const id = archiveIdFromFileName(fileName);
        if (!id) return null;

        const messages = await readChatHistoryFromFile(path.join(SESSION_DIR, fileName));
        const archivedAt = Number(id);
        const previewSource = messages.find((message) => message.role === "user") || messages[0];

        return {
          id,
          label: Number.isFinite(archivedAt) ? new Date(archivedAt).toLocaleString() : fileName,
          archivedAt: Number.isFinite(archivedAt) ? archivedAt : 0,
          messageCount: messages.length,
          preview: previewSource?.text.replace(/\s+/g, " ").trim().slice(0, 140) || "Archived Annie conversation",
        } satisfies ChatArchive;
      })
    );

    return archives
      .filter((archive): archive is ChatArchive => Boolean(archive))
      .sort((a, b) => b.archivedAt - a.archivedAt)
      .slice(0, 12);
  } catch {
    return [];
  }
}

async function readArchiveById(id: string) {
  if (!/^\d+$/.test(id)) return [];
  const archivePath = path.join(SESSION_DIR, `${CHAT_SESSION_ID}.${id}.bak.jsonl`);
  return readChatHistoryFromFile(archivePath);
}

async function summarizeImage(imagePath: string, name: string) {
  try {
    const result = await invokeOpenClaw<string>("image", {
      image: imagePath,
      prompt: "Describe this uploaded image for Annie's dashboard chat context. Focus on visible text, UI, diagrams, errors, charts, and the key thing the user likely wants Annie to notice.",
    });

    return `Image: ${name}\n${String(result).trim()}`;
  } catch {
    return `Image: ${name} (uploaded, but automatic vision summary was unavailable)`;
  }
}

async function processAttachments(files: File[]) {
  await ensureUploadDir();

  const notes: string[] = [];
  const attachments: UploadedAttachment[] = [];

  for (const file of files.slice(0, 6)) {
    const name = file.name || "attachment";
    const type = file.type || "application/octet-stream";
    const size = file.size || 0;
    const extension = path.extname(name).toLowerCase();

    if (type.startsWith("image/")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(UPLOAD_DIR, `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
      await fs.writeFile(filePath, buffer);
      const note = await summarizeImage(filePath, name);
      notes.push(note);
      attachments.push({ name, type, size, note });
      continue;
    }

    if (type.startsWith("text/") || TEXT_FILE_EXTENSIONS.has(extension)) {
      const text = (await file.text()).trim();
      const excerpt = text.length > 12_000 ? `${text.slice(0, 12_000)}\n\n[truncated]` : text;
      const note = `File: ${name}\n\n${excerpt}`;
      notes.push(note);
      attachments.push({ name, type, size, note: `Attached text file · ${name}` });
      continue;
    }

    const note = `Attachment: ${name} (${type || "unknown type"}, ${size} bytes)`;
    notes.push(note);
    attachments.push({ name, type, size, note });
  }

  return { notes, attachments };
}

function buildPrompt(message: string, attachmentNotes: string[]) {
  if (!attachmentNotes.length) return message;

  return [
    message || "Please analyze the attached context.",
    "",
    "Attached context:",
    ...attachmentNotes.flatMap((note, index) => [`--- Attachment ${index + 1} ---`, note]),
  ].join("\n");
}

async function archiveChatHistory() {
  try {
    await fs.access(SESSION_FILE);
  } catch {
    return;
  }

  const archivePath = SESSION_FILE.replace(/\.jsonl$/, `.${Date.now()}.bak.jsonl`);
  await fs.rename(SESSION_FILE, archivePath);
}

export async function GET(request: NextRequest) {
  const archiveId = request.nextUrl.searchParams.get("archive")?.trim() || null;
  const [messages, archives] = await Promise.all([
    archiveId ? readArchiveById(archiveId) : readChatHistory(),
    listChatArchives(),
  ]);

  return NextResponse.json(
    {
      messages,
      archives,
      activeArchiveId: archiveId,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE() {
  try {
    await archiveChatHistory();
    return NextResponse.json({ ok: true, messages: [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let message = "";
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      message = String(formData.get("message") || "").trim();
      files = formData
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    } else {
      const body = (await request.json()) as { message?: string };
      message = body.message?.trim() || "";
    }

    if (!message && !files.length) {
      return NextResponse.json({ error: "Message or attachment is required" }, { status: 400 });
    }

    const { notes, attachments } = await processAttachments(files);
    const prompt = buildPrompt(message, notes);

    const { stdout } = await execFileAsync(
      "openclaw",
      [
        "agent",
        "--agent",
        "main",
        "--session-id",
        CHAT_SESSION_ID,
        "--message",
        prompt,
        "--json",
      ],
      {
        timeout: 180_000,
        maxBuffer: 12 * 1024 * 1024,
      }
    );

    const result = JSON.parse(stdout) as {
      result?: { payloads?: Array<{ text?: string | null }> };
    };

    const reply = result.result?.payloads?.map((payload) => payload.text || "").join("\n\n").trim() || "No reply returned.";
    const messages = await readChatHistory();

    return NextResponse.json({ reply, messages, attachments }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
