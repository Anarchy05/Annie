"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/page-shell";

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

const suggestedPrompts = [
  "Summarize what Annie is currently busy with.",
  "Review this dashboard and suggest three killer upgrades.",
  "Help me plan today around my active sessions and cron jobs.",
  "Debug a problem step by step with me.",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sendingStartedAt, setSendingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copyState, setCopyState] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch("/api/chat", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load chat");
        const data = (await response.json()) as { messages: ChatMessage[] };
        if (mounted) {
          setMessages(data.messages);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
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

  const canSend = input.trim().length > 0 || attachments.length > 0;

  const transcriptMarkdown = useMemo(
    () => messages.map((message) => `## ${message.role === "user" ? "You" : "Annie"}\n\n${message.text}`).join("\n\n"),
    [messages]
  );

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

  async function handleSend() {
    const message = input.trim();
    if ((!message && !attachments.length) || sending) return;

    const optimisticText = [
      message,
      ...attachments.map((attachment) => `[attachment] ${attachment.file.name}`),
    ]
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
    attachments.forEach((attachment) => formData.append("files", attachment.file));

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
      const data = (await response.json()) as { error?: string; messages?: ChatMessage[] };
      if (!response.ok) throw new Error(data.error || "Failed to send message");
      await streamAssistantMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setMessages((current) => current.filter((entry) => entry.id !== optimistic.id));
      setInput(message);
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
      setError(null);
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
    const next: PendingAttachment[] = [];

    for (const file of Array.from(fileList).slice(0, 6)) {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
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

    setAttachments((current) => [...current, ...next].slice(0, 6));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <PageShell>
      <section className="animate-fade-in grid gap-4 xl:grid-cols-[0.88fr_1.32fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Direct line</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Chat with Annie</h2>
            <p className="mt-4 text-sm leading-6 text-white/70">
              This is your dashboard-native Annie chat — polished, persistent, and ready for real work.
            </p>
            <div className="mt-6 space-y-3 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-white/70">
              <p className="font-medium text-white">Now with:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>markdown-style rendering</li>
                <li>copyable code blocks</li>
                <li>file uploads and image context</li>
                <li>separate persistent web chat memory</li>
              </ul>
            </div>
          </div>

          <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Quick prompts</p>
              <button
                onClick={() => void handleCopyTranscript()}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70 hover:text-white"
              >
                {copyState === "transcript" ? "Copied" : "Copy transcript"}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
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
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-[#34D399]/30 bg-[#34D399]/10 px-3 py-2 text-sm text-[#6EE7B7] hover:brightness-110"
              >
                Attach files
              </button>
              <button
                onClick={() => void handleClearChat()}
                className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100 hover:brightness-110"
              >
                Clear chat
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void handleFilesSelected(event.target.files)}
            />
          </div>
        </div>

        <div className="flex min-h-[75vh] flex-col overflow-hidden rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
              ))
            ) : messages.length ? (
              messages.map((message) => <ChatBubble key={message.id} message={message} />)
            ) : (
              <div className="rounded-2xl border border-white/8 bg-black/20 p-5 text-sm text-white/55">
                No chat history yet. Say something dangerous, clever, or useful 😏
              </div>
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
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ask Annie anything..."
                className="max-h-60 min-h-[92px] w-full resize-none rounded-2xl border border-[#2A2A3E] bg-[#0E1020] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-[#60A5FA]"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-white/40">Enter to send · Shift+Enter for newline · up to 6 attachments</p>
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

function ChatBubble({ message }: { message: ChatMessage }) {
  return (
    <article
      className={`max-w-[92%] rounded-3xl border p-4 ${
        message.role === "user"
          ? "ml-auto border-[#60A5FA]/30 bg-[#60A5FA]/10"
          : "border-white/8 bg-black/20"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">
          {message.role === "user" ? "You" : "Annie"}
        </p>
        <p className="text-xs text-white/35">{new Date(message.timestamp).toLocaleString()}</p>
      </div>
      <div className="mt-3">
        <RichText text={message.text} />
      </div>
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

        return (
          <div key={`${block.kind}-${index}`} className="space-y-3">
            {block.content.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
              <TextParagraph key={paragraphIndex} text={paragraph} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TextParagraph({ text }: { text: string }) {
  const lines = text.split("\n");
  const isList = lines.every((line) => /^\s*([-*]|\d+\.)\s+/.test(line));

  if (isList) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((line, index) => (
          <li key={index}>{renderInline(line.replace(/^\s*([-*]|\d+\.)\s+/, ""))}</li>
        ))}
      </ul>
    );
  }

  const heading = text.match(/^(#{1,3})\s+(.+)/);
  if (heading) {
    const sizes = {
      1: "text-xl",
      2: "text-lg",
      3: "text-base",
    } as const;
    return <h3 className={`font-semibold text-white ${sizes[heading[1].length as 1 | 2 | 3]}`}>{renderInline(heading[2])}</h3>;
  }

  return <p className="whitespace-pre-wrap break-words">{renderInline(text)}</p>;
}

function renderInline(text: string) {
  const segments = text.split(/(`[^`]+`)/g);
  return segments.map((segment, index) => {
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.95em] text-[#C4B5FD]">
          {segment.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{segment}</span>;
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

function splitMarkdownBlocks(text: string): Array<{ kind: "text" | "code"; content: string; language?: string }> {
  const blocks: Array<{ kind: "text" | "code"; content: string; language?: string }> = [];
  const regex = /```([\w-]+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim();
    if (before) blocks.push({ kind: "text", content: before });
    blocks.push({ kind: "code", language: match[1], content: match[2].trimEnd() });
    lastIndex = regex.lastIndex;
  }

  const tail = text.slice(lastIndex).trim();
  if (tail) blocks.push({ kind: "text", content: tail });
  return blocks.length ? blocks : [{ kind: "text", content: text }];
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
