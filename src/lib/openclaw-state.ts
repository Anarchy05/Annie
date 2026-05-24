import type { CronJob, CronRunEntry, Session } from "@/lib/dashboard-derived";

type JsonLineParseResult<T> = {
  items: T[];
  invalidCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function parseJsonLines<T>(raw: string, mapValue: (value: unknown) => T | null): JsonLineParseResult<T> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<JsonLineParseResult<T>>(
      (result, line) => {
        try {
          const value = JSON.parse(line) as unknown;
          const mapped = mapValue(value);
          if (mapped !== null) {
            result.items.push(mapped);
          } else {
            result.invalidCount += 1;
          }
        } catch {
          result.invalidCount += 1;
        }

        return result;
      },
      { items: [], invalidCount: 0 }
    );
}

export function normalizeSessionsIndex(index: unknown, now = Date.now()) {
  if (!isRecord(index)) {
    return { sessions: [] as Session[], invalidCount: 1 };
  }

  const sessions = Object.entries(index).reduce<Session[]>((items, [key, value]) => {
    if (!isRecord(value)) return items;

    const sessionId = asString(value.sessionId);
    if (!sessionId) return items;

    const updatedAt = asNumber(value.updatedAt) ?? 0;
    items.push({
      key,
      sessionId,
      updatedAt,
      ageMs: asNumber(value.ageMs) ?? (updatedAt ? now - updatedAt : 0),
      totalTokens: typeof value.totalTokens === "number" ? value.totalTokens : null,
      contextTokens: asNumber(value.contextTokens) ?? 272000,
      model: asString(value.model) ?? "gpt-5.4",
      agentId: asString(value.agentId) ?? "main",
      kind: asString(value.chatType) ?? asString(value.kind) ?? "direct",
      systemSent: Boolean(value.systemSent),
      abortedLastRun: Boolean(value.abortedLastRun),
      inputTokens: asNumber(value.inputTokens),
      outputTokens: asNumber(value.outputTokens),
    });
    return items;
  }, []);

  return {
    sessions,
    invalidCount: Math.max(Object.keys(index).length - sessions.length, 0),
  };
}

export function normalizeCronJobs(value: unknown): { jobs: CronJob[]; invalidCount: number } {
  const rawJobs = isRecord(value) && Array.isArray(value.jobs) ? value.jobs : [];
  const jobs = rawJobs.reduce<CronJob[]>((items, rawJob) => {
    if (!isRecord(rawJob)) return items;
    const id = asString(rawJob.id);
    if (!id) return items;

    const schedule = isRecord(rawJob.schedule)
      ? {
          kind: asString(rawJob.schedule.kind),
          expr: asString(rawJob.schedule.expr),
          tz: asString(rawJob.schedule.tz),
          everyMs: asNumber(rawJob.schedule.everyMs),
          at: asString(rawJob.schedule.at),
          anchorMs: asNumber(rawJob.schedule.anchorMs),
          staggerMs: asNumber(rawJob.schedule.staggerMs),
        }
      : undefined;

    const payload = isRecord(rawJob.payload)
      ? {
          kind: asString(rawJob.payload.kind),
          text: asString(rawJob.payload.text),
          message: asString(rawJob.payload.message),
        }
      : undefined;

    const state = isRecord(rawJob.state)
      ? {
          nextRunAtMs: asNumber(rawJob.state.nextRunAtMs),
        }
      : undefined;

    items.push({
      id,
      name: asString(rawJob.name),
      description: asString(rawJob.description),
      enabled: typeof rawJob.enabled === "boolean" ? rawJob.enabled : undefined,
      createdAtMs: asNumber(rawJob.createdAtMs),
      updatedAtMs: asNumber(rawJob.updatedAtMs),
      schedule,
      payload,
      state,
      sessionKey: asString(rawJob.sessionKey),
      sessionTarget: asString(rawJob.sessionTarget),
      wakeMode: asString(rawJob.wakeMode),
    });
    return items;
  }, []);

  return {
    jobs,
    invalidCount: Math.max(rawJobs.length - jobs.length, 0),
  };
}

export function normalizeCronRunEntry(value: unknown): CronRunEntry | null {
  if (!isRecord(value)) return null;

  return {
    startedAtMs: asNumber(value.startedAtMs),
    finishedAtMs: asNumber(value.finishedAtMs),
    status: asString(value.status),
    summary: asString(value.summary),
    error: asString(value.error),
    skippedReason: asString(value.skippedReason),
  };
}
