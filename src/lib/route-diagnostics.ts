export type RouteOutcome = "ok" | "degraded" | "error";

export type RouteSample = {
  route: string;
  label: string;
  durationMs: number;
  outcome: RouteOutcome;
  recordedAt: number;
};

export type RouteDiagnostic = {
  route: string;
  label: string;
  samples: number;
  lastDurationMs: number;
  avgDurationMs: number;
  p95DurationMs: number;
  maxDurationMs: number;
  lastOutcome: RouteOutcome;
  lastRecordedAt: number;
};

const MAX_SAMPLES_PER_ROUTE = 30;

const routeLabels: Record<string, string> = {
  banner: "Banner",
  "control-center": "Control Center",
  feed: "Feed",
  "automation-watch": "Automation",
  search: "Search",
  health: "Health",
  projects: "Projects",
};

const routeSamples = new Map<string, RouteSample[]>();

export function getRouteLabel(route: string) {
  return routeLabels[route] || route;
}

export function recordRouteSample(route: string, durationMs: number, outcome: RouteOutcome) {
  const sample: RouteSample = {
    route,
    label: getRouteLabel(route),
    durationMs: Math.max(Math.round(durationMs), 0),
    outcome,
    recordedAt: Date.now(),
  };

  const existing = routeSamples.get(route) || [];
  const next = [...existing, sample].slice(-MAX_SAMPLES_PER_ROUTE);
  routeSamples.set(route, next);
}

export function summarizeRouteSamples(samples: RouteSample[]): Omit<RouteDiagnostic, "route" | "label"> {
  if (!samples.length) {
    return {
      samples: 0,
      lastDurationMs: 0,
      avgDurationMs: 0,
      p95DurationMs: 0,
      maxDurationMs: 0,
      lastOutcome: "ok",
      lastRecordedAt: 0,
    };
  }

  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  const total = durations.reduce((sum, value) => sum + value, 0);
  const p95Index = Math.min(Math.ceil(durations.length * 0.95) - 1, durations.length - 1);
  const last = samples[samples.length - 1]!;

  return {
    samples: samples.length,
    lastDurationMs: last.durationMs,
    avgDurationMs: Math.round(total / durations.length),
    p95DurationMs: durations[p95Index] || 0,
    maxDurationMs: durations[durations.length - 1] || 0,
    lastOutcome: last.outcome,
    lastRecordedAt: last.recordedAt,
  };
}

export function getRouteDiagnostics() {
  return {
    generatedAt: Date.now(),
    routes: Array.from(routeSamples.entries())
      .map(([route, samples]) => ({
        route,
        label: getRouteLabel(route),
        ...summarizeRouteSamples(samples),
      }))
      .sort((a, b) => b.lastRecordedAt - a.lastRecordedAt),
  } satisfies { generatedAt: number; routes: RouteDiagnostic[] };
}

export function classifyRouteSpeed(durationMs?: number) {
  if (!durationMs) return "warming" as const;
  if (durationMs <= 120) return "swift" as const;
  if (durationMs <= 400) return "steady" as const;
  return "watch" as const;
}
