export type CronStateMeta = {
  status: "ok" | "degraded";
  source: "local" | "cli" | "fallback";
  detail: string;
};

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
