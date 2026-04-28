"use client";

import { useEffect, useMemo, useState } from "react";

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "blue" | "green" | "purple" | "yellow" }) {
  const toneClass = {
    default: "border-white/10 bg-white/5 text-white/75",
    blue: "border-[#60A5FA]/30 bg-[#60A5FA]/10 text-[#93C5FD]",
    green: "border-[#34D399]/30 bg-[#34D399]/10 text-[#6EE7B7]",
    purple: "border-[#A78BFA]/30 bg-[#A78BFA]/10 text-[#C4B5FD]",
    yellow: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
  }[tone];

  return <span className={`rounded-full border px-3 py-1 text-xs ${toneClass}`}>{children}</span>;
}

type BannerData = {
  agentName: string;
  version: string;
  latestVersion: string;
  upToDate: boolean;
  stats: {
    model: string;
    contextUsage: string;
    activeSessions: number;
    runtimeMode: string;
    scheduledJobs: number;
  };
  quickInfo: {
    humanName: string;
    githubUsername: string;
    workspacePath: string;
    secretsManager: string;
  };
  resources: string[];
  capabilities: string[];
  subAgents: Array<{
    key: string;
    label: string;
    model: string;
    tokens: number;
    status: string;
    updatedAt: number;
    taskDescription: string;
  }>;
  resourceSnapshot: {
    timestamp: number;
    memoryCurrentBytes: number;
    memoryLimitBytes: number;
    cpuUsageUsec: number;
    cpuLimitCores: number;
    pidsCurrent: number;
    pidsLimit: number;
    diskUsedBytes: number;
    diskTotalBytes: number;
  };
};

type ResourcePoint = {
  timestamp: number;
  memoryPercent: number;
  cpuPercent: number;
};

function formatRelative(updatedAt: number) {
  const diffMinutes = Math.floor((Date.now() - updatedAt) / 60_000);
  if (diffMinutes <= 0) return "just now";
  if (diffMinutes === 1) return "1 min ago";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const hours = Math.floor(diffMinutes / 60);
  return `${hours}h ago`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) {
    return <div className="h-16 rounded-2xl border border-white/8 bg-black/20" />;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full overflow-hidden rounded-2xl border border-white/8 bg-black/20 p-1">
      <polyline fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}

export function AgentBanner() {
  const [collapsed, setCollapsed] = useState(false);
  const [data, setData] = useState<BannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [history, setHistory] = useState<ResourcePoint[]>([]);

  useEffect(() => {
    let mounted = true;
    let previousCpuUsage = 0;
    let previousTimestamp = 0;

    const load = async () => {
      try {
        const response = await fetch("/api/banner", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load banner");
        const payload = (await response.json()) as BannerData;
        if (!mounted) return;

        const memoryPercent = clampPercent(
          (payload.resourceSnapshot.memoryCurrentBytes / Math.max(payload.resourceSnapshot.memoryLimitBytes, 1)) * 100
        );

        let cpuPercent = 0;
        if (previousTimestamp && payload.resourceSnapshot.timestamp > previousTimestamp) {
          const deltaUsage = payload.resourceSnapshot.cpuUsageUsec - previousCpuUsage;
          const deltaTimeUsec = (payload.resourceSnapshot.timestamp - previousTimestamp) * 1000;
          cpuPercent = clampPercent(
            (deltaUsage / Math.max(deltaTimeUsec * Math.max(payload.resourceSnapshot.cpuLimitCores, 0.1), 1)) * 100
          );
        }

        previousCpuUsage = payload.resourceSnapshot.cpuUsageUsec;
        previousTimestamp = payload.resourceSnapshot.timestamp;
        setHistory((current) => [...current.slice(-17), { timestamp: payload.resourceSnapshot.timestamp, memoryPercent, cpuPercent }]);
        setData(payload);
        setError(null);
        setCurrentTime(Date.now());
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, 10_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const resourceSummary = useMemo(() => {
    if (!data) return null;
    const { resourceSnapshot } = data;
    const memoryPercent = clampPercent((resourceSnapshot.memoryCurrentBytes / Math.max(resourceSnapshot.memoryLimitBytes, 1)) * 100);
    const diskPercent = clampPercent((resourceSnapshot.diskUsedBytes / Math.max(resourceSnapshot.diskTotalBytes, 1)) * 100);
    const pidsPercent = resourceSnapshot.pidsLimit > 0
      ? clampPercent((resourceSnapshot.pidsCurrent / resourceSnapshot.pidsLimit) * 100)
      : 0;

    return { memoryPercent, diskPercent, pidsPercent };
  }, [data]);

  return (
    <section className="animate-fade-in border-b border-[#2A2A3E] bg-[radial-gradient(circle_at_top,#1D2340,transparent_42%),#0A0A0F]">
      <button
        className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 text-left sm:px-6 lg:px-8"
        onClick={() => setCollapsed((value) => !value)}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Annie core</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Annie&apos;s Mission Control</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/65">
          <span>{collapsed ? "Expand" : "Collapse"}</span>
          <span className="text-lg">{collapsed ? "▾" : "▴"}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-6 sm:px-6 lg:px-8">
          {loading && !data ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/70 skeleton" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : data && resourceSummary ? (
            <>
              <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
                <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="break-words text-xl font-semibold text-white">{data.agentName}</h2>
                    <Badge tone="blue">v{data.version}</Badge>
                    <Badge tone={data.upToDate ? "green" : "yellow"}>
                      {data.upToDate ? `Up to date · latest ${data.latestVersion}` : `Update available · ${data.latestVersion}`}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <Stat label="Model" value={data.stats.model} color="blue" />
                    <Stat label="Context" value={data.stats.contextUsage} color="purple" />
                    <Stat label="Sessions" value={String(data.stats.activeSessions)} color="green" />
                    <Stat label="Runtime" value={data.stats.runtimeMode} color="yellow" />
                    <Stat label="Cron jobs" value={String(data.stats.scheduledJobs)} color="default" />
                  </div>
                </div>

                <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5">
                  <p className="text-sm font-medium text-white">Quick info</p>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <InfoRow label="Human" value={data.quickInfo.humanName} />
                    <InfoRow label="GitHub" value={data.quickInfo.githubUsername} />
                    <InfoRow label="Workspace" value={data.quickInfo.workspacePath} />
                    <InfoRow label="Secrets" value={data.quickInfo.secretsManager} />
                  </dl>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1.4fr]">
                <Panel title="Connected resources">
                  <div className="flex flex-wrap gap-2">
                    {data.resources.length ? data.resources.map((resource) => <Badge key={resource}>{resource}</Badge>) : <EmptyState text="No detected server-side keys yet." />}
                  </div>
                </Panel>

                <Panel title="Capabilities">
                  <div className="flex flex-wrap gap-2">
                    {data.capabilities.map((capability) => (
                      <Badge key={capability} tone="purple">{capability}</Badge>
                    ))}
                  </div>
                </Panel>

                <Panel title="Sub-agents">
                  <div className="grid gap-3">
                    {data.subAgents.length ? data.subAgents.map((agent) => {
                      const fresh = currentTime - agent.updatedAt < 120_000;
                      return (
                        <div key={agent.key} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-all text-sm font-medium text-white">{agent.label}</p>
                              <p className="break-all text-xs text-white/45">{agent.model} · {agent.tokens.toLocaleString()} tokens</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-2 text-xs text-white/55">
                              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${fresh ? "bg-[#34D399] animate-pulse" : "bg-white/25"}`} />
                              {agent.status}
                            </div>
                          </div>
                          <p className="mt-2 break-words text-sm text-white/65">{agent.taskDescription}</p>
                          <p className="mt-2 text-xs text-white/40">Updated {formatRelative(agent.updatedAt)}</p>
                        </div>
                      );
                    }) : <EmptyState text="No active sub-agents or cron sessions found." />}
                  </div>
                </Panel>
              </div>

              <Panel title="LXC resource usage">
                <div className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
                  <div className="grid gap-3">
                    <MetricCard
                      label="Memory"
                      value={`${formatBytes(data.resourceSnapshot.memoryCurrentBytes)} / ${formatBytes(data.resourceSnapshot.memoryLimitBytes)}`}
                      percent={resourceSummary.memoryPercent}
                      accent="bg-[#A78BFA]"
                    />
                    <Sparkline values={history.map((point) => point.memoryPercent)} color="#A78BFA" />
                  </div>
                  <div className="grid gap-3">
                    <MetricCard
                      label="CPU"
                      value={`${(history.at(-1)?.cpuPercent || 0).toFixed(1)}% of ${data.resourceSnapshot.cpuLimitCores.toFixed(1)} cores`}
                      percent={history.at(-1)?.cpuPercent || 0}
                      accent="bg-[#60A5FA]"
                    />
                    <Sparkline values={history.map((point) => point.cpuPercent)} color="#60A5FA" />
                  </div>
                  <div className="grid gap-3">
                    <MetricCard
                      label="Disk"
                      value={`${formatBytes(data.resourceSnapshot.diskUsedBytes)} / ${formatBytes(data.resourceSnapshot.diskTotalBytes)}`}
                      percent={resourceSummary.diskPercent}
                      accent="bg-[#34D399]"
                    />
                    <MetricCard
                      label="PIDs"
                      value={data.resourceSnapshot.pidsLimit > 0 ? `${data.resourceSnapshot.pidsCurrent} / ${data.resourceSnapshot.pidsLimit}` : `${data.resourceSnapshot.pidsCurrent}`}
                      percent={resourceSummary.pidsPercent}
                      accent="bg-yellow-400"
                    />
                  </div>
                </div>
              </Panel>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5">
      <p className="text-sm font-medium text-white">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, color = "default" }: { label: string; value: string; color?: "default" | "blue" | "green" | "purple" | "yellow" }) {
  const textColor = {
    default: "text-white",
    blue: "text-[#93C5FD]",
    green: "text-[#6EE7B7]",
    purple: "text-[#C4B5FD]",
    yellow: "text-yellow-200",
  }[color];

  return (
    <div className="min-w-0 rounded-2xl border border-white/8 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className={`mt-2 break-words text-sm font-medium ${textColor}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
      <dt className="shrink-0 text-white/45">{label}</dt>
      <dd className="min-w-0 break-all text-right text-white/80">{value}</dd>
    </div>
  );
}

function MetricCard({ label, value, percent, accent }: { label: string; value: string; percent: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p>
        <p className="text-xs text-white/45">{clampPercent(percent).toFixed(1)}%</p>
      </div>
      <p className="mt-2 break-words text-sm font-medium text-white/90">{value}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${clampPercent(percent)}%` }} />
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-white/45">{text}</p>;
}
