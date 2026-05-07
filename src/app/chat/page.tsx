"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { PageShell } from "@/components/page-shell";
import { splitMarkdownBlocks, tokenizeInline } from "@/lib/chat-markdown";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
};

type PendingAttachment = {
  id: string;
  file: File;
  preview?: string;
};

type ChatArchive = {
  id: string;
  label: string;
  archivedAt: number;
  messageCount: number;
  preview: string;
};

type DownloadableFile = {
  path: string;
  label: string;
};

const suggestedPrompts = [
  "What matters most today?",
  "What are you busy with right now?",
  "Show me the next jobs coming up.",
  "Help me fix something step by step.",
];

const MAX_ATTACHMENTS = 6;

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [archives, setArchives] = useState<ChatArchive[]>([]);
  const [activeArchiveId, setActiveArchiveId] = useState<string | null>(null);
  const [sendingStartedAt, setSendingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const archiveId = new URLSearchParams(window.location.search).get("archive");
        const params = archiveId ? `?archive=${encodeURIComponent(archiveId)}` : "";
        const response = await fetch(`/api/chat${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load chat");
        const data = (await response.json()) as {
          messages: ChatMessage[];
          archives?: ChatArchive[];
          activeArchiveId?: string | null;
        };
        if (mounted) {
          setMessages(data.messages);
          setArchives(data.archives || []);
          setActiveArchiveId(data.activeArchiveId || null);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!sendingStartedAt) return;

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sendingStartedAt) / 1000));
    }, 250);

    return () => window.clearInterval(interval);
  }, [sendingStartedAt]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  }, [input]);

  const viewingArchive = Boolean(activeArchiveId);
  const canSend = !viewingArchive && (input.trim().length > 0 || attachments.length > 0);

  const transcriptMarkdown = useMemo(
    () => messages.map((message) => `## ${message.role === "user" ? "You" : "Annie"}\n\n${message.text}`).join("\n\n"),
    [messages]
  );

  async function appendFiles(files: File[]) {
    if (!files.length || viewingArchive) return;
    const next = await createPendingAttachments(files.slice(0, MAX_ATTACHMENTS));
    setAttachments((current) => mergePendingAttachments(current, next));
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function streamAssistantMessages(nextMessages: ChatMessage[]) {
    const lastAssistantIndex = [...nextMessages].reverse().findIndex((entry) => entry.role === "assistant");
    if (lastAssistantIndex === -1) {
      setMessages(nextMessages);
      return;
    }

    const assistantIndex = nextMessages.length - 1 - lastAssistantIndex;
    const assistantMessage = nextMessages[assistantIndex];
    const prefix = nextMessages.slice(0, assistantIndex);
    const suffix = nextMessages.slice(assistantIndex + 1);

    setMessages([...prefix, { ...assistantMessage, text: "" }, ...suffix]);

    let index = 0;
    await new Promise<void>((resolve) => {
      const interval = window.setInterval(() => {
        index = Math.min(index + 12, assistantMessage.text.length);
        setMessages([...prefix, { ...assistantMessage, text: assistantMessage.text.slice(0, index) }, ...suffix]);
        if (index >= assistantMessage.text.length) {
          window.clearInterval(interval);
          resolve();
        }
      }, 14);
    });
  }

  async function loadConversation(archiveId?: string | null) {
    const params = archiveId ? `?archive=${encodeURIComponent(archiveId)}` : "";
    const response = await fetch(`/api/chat${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load chat");
    const data = (await response.json()) as {
      messages: ChatMessage[];
      archives?: ChatArchive[];
      activeArchiveId?: string | null;
    };
    setMessages(data.messages);
    setArchives(data.archives || []);
    setActiveArchiveId(data.activeArchiveId || null);
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = "/chat";
    if (archiveId) nextUrl.searchParams.set("archive", archiveId);
    else nextUrl.searchParams.delete("archive");
    window.history.replaceState(null, "", nextUrl.toString());
    setError(null);
  }

  async function handleSend() {
    const message = input.trim();
    if ((!message && !attachments.length) || sending || viewingArchive) return;

    const queuedAttachments = attachments;
    const optimisticText = [message, ...queuedAttachments.map((attachment) => `[attachment] ${attachment.file.name}`)]
      .filter(Boolean)
      .join("\n");

    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      text: optimisticText,
      timestamp: Date.now(),
    };

    const formData = new FormData();
    formData.set("message", message);
    queuedAttachments.forEach((attachment) => formData.append("files", attachment.file));

    setMessages((current) => [...current, optimistic]);
    setInput("");
    setAttachments([]);
    setSending(true);
    setSendingStartedAt(Date.now());
    setElapsedSeconds(0);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        error?: string;
        messages?: ChatMessage[];
        archives?: ChatArchive[];
        activeArchiveId?: string | null;
      };
      if (!response.ok) throw new Error(data.error || "Failed to send message");
      setArchives(data.archives || archives);
      setActiveArchiveId(data.activeArchiveId || null);
      await streamAssistantMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setMessages((current) => current.filter((entry) => entry.id !== optimistic.id));
      setInput(message);
      setAttachments(queuedAttachments);
    } finally {
      setSending(false);
      setSendingStartedAt(null);
      setElapsedSeconds(0);
    }
  }

  async function handleClearChat() {
    if (sending) return;
    const confirmed = window.confirm("Clear this Annie web chat? I’ll archive the old transcript first.");
    if (!confirmed) return;

    try {
      const response = await fetch("/api/chat", { method: "DELETE" });
      const data = (await response.json()) as { error?: string; messages?: ChatMessage[] };
      if (!response.ok) throw new Error(data.error || "Failed to clear chat");
      setMessages([]);
      setActiveArchiveId(null);
      setError(null);
      await loadConversation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleCopyTranscript() {
    await navigator.clipboard.writeText(transcriptMarkdown || "No chat yet.");
    setCopyState("transcript");
    window.setTimeout(() => setCopyState(null), 1200);
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    await appendFiles(Array.from(fileList));
  }

  async function handleDroppedFiles(fileList: FileList | null) {
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    if (!fileList?.length) return;
    await appendFiles(Array.from(fileList));
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false);
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  return (
    <PageShell>
      <section className="grid gap-4 xl:grid-cols-[0.6fr_1.4fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Chat</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Talk to Annie</h2>
            <p className="mt-3 text-sm text-white/70">Quick prompts, file uploads, downloadable outputs, and now a real archive browser for older Annie conversations.</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="rounded-full border border-[#2A2A3E] bg-black/20 px-3 py-2 text-left text-sm text-white/75 hover:border-[#60A5FA]/50 hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(event) => {
                event.preventDefault();
                void handleDroppedFiles(event.dataTransfer.files);
              }}
              className={`mt-5 rounded-3xl border border-dashed px-4 py-4 transition ${
                isDraggingFiles
                  ? "border-[#60A5FA]/70 bg-[#60A5FA]/12"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Drop files anywhere in this chat</p>
                  <p className="mt-1 text-sm text-white/55">Annie can inspect screenshots, text files, logs, and small code snippets. Up to {MAX_ATTACHMENTS} files per send.</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={viewingArchive}
                  className="rounded-full border border-[#34D399]/30 bg-[#34D399]/10 px-3 py-2 text-sm text-[#6EE7B7] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Attach files
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => void handleCopyTranscript()}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70 hover:text-white"
              >
                {copyState === "transcript" ? "Copied" : "Copy chat"}
              </button>
              <button
                onClick={() => void loadConversation(null)}
                className="rounded-full border border-[#60A5FA]/30 bg-[#60A5FA]/10 px-3 py-2 text-sm text-[#BFDBFE] hover:brightness-110"
              >
                Live chat
              </button>
              <button
                onClick={() => void handleClearChat()}
                disabled={viewingArchive}
                className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear chat
              </button>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => void handleFilesSelected(event.target.files)} />
          </div>

          <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">Archive</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Recent conversations</h3>
              </div>
              <span className="text-xs text-white/40">{archives.length} saved</span>
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => void loadConversation(null)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  !viewingArchive
                    ? "border-[#34D399]/25 bg-[#34D399]/10"
                    : "border-white/8 bg-[#0E1020] hover:border-white/15"
                }`}
              >
                <p className="text-sm font-medium text-white">Current live chat</p>
                <p className="mt-1 text-sm text-white/55">Jump back into the active Annie thread.</p>
              </button>

              {archives.length ? (
                archives.map((archive) => (
                  <button
                    key={archive.id}
                    onClick={() => void loadConversation(archive.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      activeArchiveId === archive.id
                        ? "border-[#60A5FA]/30 bg-[#60A5FA]/10"
                        : "border-white/8 bg-[#0E1020] hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{archive.label}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-white/55">{archive.preview}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/55">
                        {archive.messageCount} msgs
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[#0E1020] p-4 text-sm text-white/45">
                  No archived chats yet. When you clear a thread, Annie will save it here.
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={(event) => {
            event.preventDefault();
            void handleDroppedFiles(event.dataTransfer.files);
          }}
          className={`relative flex min-h-[75vh] flex-col overflow-hidden rounded-3xl border bg-[#1A1A2E]/80 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition ${
            isDraggingFiles ? "border-[#60A5FA]/70" : "border-[#2A2A3E]"
          }`}
        >
          {isDraggingFiles ? (
            <div className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center rounded-[1.5rem] border border-dashed border-[#60A5FA]/60 bg-[#0E1020]/88 text-center">
              <div className="max-w-sm px-6">
                <p className="text-lg font-semibold text-white">Drop files to hand them to Annie</p>
                <p className="mt-2 text-sm text-white/65">She&apos;ll pull in image context, text excerpts, and file names right into the next reply.</p>
              </div>
            </div>
          ) : null}

          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {viewingArchive ? (
              <div className="rounded-2xl border border-[#60A5FA]/25 bg-[#60A5FA]/10 p-4 text-sm text-[#DBEAFE]">
                You&apos;re browsing an archived Annie conversation. Return to <button onClick={() => void loadConversation(null)} className="underline decoration-[#93C5FD]/50 underline-offset-2 hover:text-white">live chat</button> to keep talking.
              </div>
            ) : null}
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
              ))
            ) : messages.length ? (
              messages.map((message) => <ChatBubble key={message.id} message={message} />)
            ) : (
              <div className="rounded-2xl border border-white/8 bg-black/20 p-5 text-sm text-white/55">No chat history yet.</div>
            )}
            {sending && (
              <div className="max-w-[92%] rounded-3xl border border-white/8 bg-black/20 p-4 text-sm text-white/60">
                Annie is thinking… <span className="text-white/35">{elapsedSeconds}s</span>
              </div>
            )}
          </div>

          <div className="border-t border-white/8 bg-black/20 p-4">
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-3">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0E1020] p-3 text-xs text-white/70">
                    {attachment.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={attachment.preview} alt={attachment.file.name} className="mb-2 h-20 w-20 rounded-xl object-cover" />
                    ) : null}
                    <p className="max-w-40 break-all font-medium text-white">{attachment.file.name}</p>
                    <p className="mt-1 text-white/45">{formatFileSize(attachment.file.size)}</p>
                    <button
                      onClick={() => setAttachments((current) => current.filter((entry) => entry.id !== attachment.id))}
                      className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] text-white/70 opacity-0 transition group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error && <p className="mb-3 rounded-2xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</p>}
            <div className="flex flex-col gap-3">
              <div className={`rounded-[1.35rem] border p-1 transition ${isDraggingFiles ? "border-[#60A5FA]/70 bg-[#60A5FA]/8" : "border-transparent"}`}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={viewingArchive}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={viewingArchive ? "Return to live chat to send a new message..." : "Ask Annie anything..."}
                  className="max-h-60 min-h-[92px] w-full resize-none rounded-2xl border border-[#2A2A3E] bg-[#0E1020] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#60A5FA] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-white/40">
                  {viewingArchive ? "Archive mode is read-only · switch back to live chat to send" : "Enter to send · Shift+Enter for newline · Drag files in to attach"}
                </p>
                <button
                  onClick={() => void handleSend()}
                  disabled={sending || !canSend}
                  className="rounded-2xl bg-[#60A5FA] px-5 py-3 text-sm font-medium text-[#0A0A0F] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

async function createPendingAttachments(files: File[]) {
  const next: PendingAttachment[] = [];

  for (const file of files) {
    const id = `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${Math.random()}`;
    let preview: string | undefined;
    if (file.type.startsWith("image/")) {
      preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(file);
      });
    }
    next.push({ id, file, preview });
  }

  return next;
}

function mergePendingAttachments(current: PendingAttachment[], next: PendingAttachment[]) {
  const merged = [...current];
  const seen = new Set(current.map((attachment) => attachmentSignature(attachment.file)));

  for (const attachment of next) {
    const signature = attachmentSignature(attachment.file);
    if (seen.has(signature)) continue;
    merged.push(attachment);
    seen.add(signature);
    if (merged.length >= MAX_ATTACHMENTS) break;
  }

  return merged;
}

function attachmentSignature(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const text = stripMediaLines(message.text);
  const downloadableFiles = extractDownloadableFiles(message.text);

  return (
    <article
      className={`max-w-[92%] rounded-3xl border p-4 ${
        message.role === "user" ? "ml-auto border-[#60A5FA]/30 bg-[#60A5FA]/10" : "border-white/8 bg-black/20"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">{message.role === "user" ? "You" : "Annie"}</p>
        <p className="text-xs text-white/35">{new Date(message.timestamp).toLocaleString()}</p>
      </div>
      <div className="mt-3">
        <RichText text={text} />
      </div>
      {downloadableFiles.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {downloadableFiles.map((file) => (
            <a
              key={file.path}
              href={`/api/files?path=${encodeURIComponent(file.path)}`}
              className="rounded-full border border-[#34D399]/30 bg-[#34D399]/10 px-3 py-1.5 text-xs text-[#6EE7B7] hover:brightness-110"
              download
              target="_blank"
              rel="noreferrer"
            >
              Download {file.label}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function RichText({ text }: { text: string }) {
  const blocks = splitMarkdownBlocks(text);
  return (
    <div className="space-y-4 text-sm leading-6 text-white/90">
      {blocks.map((block, index) => {
        if (block.kind === "code") {
          return <CodeBlock key={`${block.kind}-${index}`} language={block.language} code={block.content} />;
        }

        if (block.kind === "heading") {
          const sizes = {
            1: "text-xl",
            2: "text-lg",
            3: "text-base",
          } as const;
          return <h3 key={`${block.kind}-${index}`} className={`font-semibold text-white ${sizes[block.level]}`}>{renderInline(block.text)}</h3>;
        }

        if (block.kind === "list") {
          return (
            <ul key={`${block.kind}-${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.kind === "blockquote") {
          return (
            <blockquote key={`${block.kind}-${index}`} className="rounded-r-2xl rounded-l-md border-l-4 border-[#60A5FA]/50 bg-[#60A5FA]/10 px-4 py-3 text-white/80">
              <p className="whitespace-pre-wrap break-words">{renderInline(block.text)}</p>
            </blockquote>
          );
        }

        if (block.kind === "table") {
          return (
            <div key={`${block.kind}-${index}`} className="overflow-x-auto rounded-2xl border border-white/8 bg-[#0E1020]">
              <table className="min-w-full text-left text-sm text-white/80">
                <thead className="bg-white/5 text-white">
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th key={headerIndex} className="px-3 py-2 font-medium">{renderInline(header)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-white/8 align-top">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2">{renderInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return <p key={`${block.kind}-${index}`} className="whitespace-pre-wrap break-words">{renderInline(block.text)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string) {
  return tokenizeInline(text).map((token, index) => {
    if (token.type === "code") {
      return (
        <code key={index} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.95em] text-[#C4B5FD]">
          {token.text}
        </code>
      );
    }

    if (token.type === "link") {
      return (
        <a
          key={index}
          href={token.href}
          target="_blank"
          rel="noreferrer"
          className="text-[#93C5FD] underline decoration-[#60A5FA]/40 underline-offset-2 hover:text-white"
        >
          {token.text}
        </a>
      );
    }

    return <span key={index}>{token.text}</span>;
  });
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0E1020]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2 text-xs text-white/55">
        <span>{language || "code"}</span>
        <button onClick={() => void handleCopy()} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/75 hover:text-white">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs text-white/85"><code>{code}</code></pre>
    </div>
  );
}

function extractDownloadableFiles(text: string): DownloadableFile[] {
  const results = new Map<string, DownloadableFile>();
  const mediaMatches = text.match(/^MEDIA:(.+)$/gm) || [];

  for (const match of mediaMatches) {
    const mediaPath = match.replace(/^MEDIA:/, "").trim();
    if (!mediaPath.startsWith("/")) continue;
    results.set(mediaPath, { path: mediaPath, label: fileNameFromPath(mediaPath) });
  }

  const absolutePathRegex = /(?:^|[\s(\[])(\/root\/(?:\.openclaw\/workspace|projects)\/[^\s)\]]+|\/tmp\/annies-mission-control-uploads\/[^\s)\]]+)/g;
  let pathMatch: RegExpExecArray | null;
  while ((pathMatch = absolutePathRegex.exec(text)) !== null) {
    const filePath = pathMatch[1];
    results.set(filePath, { path: filePath, label: fileNameFromPath(filePath) });
  }

  return [...results.values()];
}

function stripMediaLines(text: string) {
  return text.replace(/^MEDIA:.+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

function fileNameFromPath(filePath: string) {
  const parts = filePath.split("/").filter(Boolean);
  return parts.at(-1) || filePath;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
