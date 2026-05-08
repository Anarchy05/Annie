export type CronStateMeta = {
  status: "ok" | "degraded";
  source: "local" | "cli" | "fallback";
  detail: string;
};

type CronSchedule = {
  kind?: string;
  expr?: string;
  tz?: string;
  everyMs?: number;
  at?: string;
  anchorMs?: number;
  staggerMs?: number;
};

function parseCronField(field: string, min: number, max: number) {
  if (field === "*") {
    return (value: number) => value >= min && value <= max;
  }

  const stepMatch = field.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = Number(stepMatch[1]);
    if (!Number.isFinite(step) || step <= 0) return null;
    return (value: number) => value >= min && value <= max && (value - min) % step === 0;
  }

  const exact = Number(field);
  if (!Number.isInteger(exact) || exact < min || exact > max) {
    return null;
  }

  return (value: number) => value === exact;
}

export function deriveNextRunAtMs(schedule?: CronSchedule, now = Date.now()) {
  if (!schedule?.kind) return undefined;

  if (schedule.kind === "every") {
    const interval = schedule.everyMs;
    if (!interval || interval <= 0) return undefined;

    const anchor = typeof schedule.anchorMs === "number" ? schedule.anchorMs : now;
    if (anchor > now) return anchor;

    const elapsed = now - anchor;
    return anchor + (Math.floor(elapsed / interval) + 1) * interval;
  }

  if (schedule.kind === "at") {
    const timestamp = schedule.at ? Date.parse(schedule.at) : Number.NaN;
    return Number.isFinite(timestamp) && timestamp >= now ? timestamp : undefined;
  }

  if (schedule.kind !== "cron" || !schedule.expr) return undefined;
  if (schedule.tz && schedule.tz !== "UTC") return undefined;

  const parts = schedule.expr.trim().split(/\s+/);
  if (parts.length !== 5) return undefined;

  const [minuteField, hourField, dayField, monthField, weekdayField] = parts;
  const minuteMatches = parseCronField(minuteField, 0, 59);
  const hourMatches = parseCronField(hourField, 0, 23);
  const dayMatches = parseCronField(dayField, 1, 31);
  const monthMatches = parseCronField(monthField, 1, 12);
  const weekdayMatches = parseCronField(weekdayField, 0, 6);

  if (!minuteMatches || !hourMatches || !dayMatches || !monthMatches || !weekdayMatches) {
    return undefined;
  }

  const start = Math.floor(now / 60_000) * 60_000 + 60_000;
  const maxChecks = 366 * 24 * 60;

  for (let minuteOffset = 0; minuteOffset < maxChecks; minuteOffset += 1) {
    const candidate = start + minuteOffset * 60_000;
    const date = new Date(candidate);
    const weekday = date.getUTCDay();

    if (
      minuteMatches(date.getUTCMinutes()) &&
      hourMatches(date.getUTCHours()) &&
      dayMatches(date.getUTCDate()) &&
      monthMatches(date.getUTCMonth() + 1) &&
      weekdayMatches(weekday)
    ) {
      return candidate + (schedule.staggerMs || 0);
    }
  }

  return undefined;
}

export function buildOkCronState(source: CronStateMeta["source"], detail: string): CronStateMeta {
  return {
    status: "ok",
    source,
    detail,
  };
}

export function buildDegradedCronState(detail: string): CronStateMeta {
  return {
    status: "degraded",
    source: "fallback",
    detail,
  };
}

export function buildCronJobsPayload<T>(jobs: T[], meta: CronStateMeta) {
  return {
    jobs,
    total: jobs.length,
    meta,
  };
}

export function buildCronRunsPayload<T>(entries: T[], meta: CronStateMeta) {
  return {
    entries,
    meta,
  };
}
