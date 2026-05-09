"use client";

import { useEffect, useMemo, useState } from "react";

type BannerData = {
  version: string;
  latestVersion: string;
  upToDate: boolean;
  stats: {
    model: string;
    activeSessions: number;
    scheduledJobs: number;
  };
  diagnostics?: {
    summary: string;
    routes: Array<{
      key: string;
      label: string;
      lastDurationMs: number;
      avgDurationMs: number;
      tone: "warming" | "swift" | "steady" | "watch";
    }>;
  };
};

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75">
      <span className="text-white/40">{label}</span> <span className="text-white">{value}</span>
    </div>
  );
}

export function AgentBanner() {
  const [data, setData] = useState<BannerData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch("/api/banner", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load");
        const payload = (await response.json()) as BannerData;
        if (!mounted) return;
        setData(payload);
        setError(false);
      } catch {
        if (mounted) setError(true);
      }
    };

    void load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const versionLabel = useMemo(() => {
    if (!data) return "Loading";
    return data.upToDate ? `v${data.version}` : `v${data.version} · update ${data.latestVersion}`;
  }, [data]);

  const speedValue = useMemo(() => {
    if (!data?.diagnostics) return "warming up";
    const routes = data.diagnostics.routes.slice(0, 2);
    if (!routes.length) return data.diagnostics.summary;
    return `${data.diagnostics.summary} · ${routes.map((route) => `${route.label.toLowerCase()} ${route.lastDurationMs}ms`).join(" · ")}`;
  }, [data]);

  return (
    <section className="border-b border-white/8 bg-[#111520]">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <Chip label="Status" value={error ? "degraded" : "ready"} />
        <Chip label="Version" value={versionLabel} />
        <Chip label="Speed" value={speedValue} />
        <Chip label="Model" value={data?.stats.model || "Loading"} />
        <Chip label="Sessions" value={String(data?.stats.activeSessions ?? "—")} />
        <Chip label="Jobs" value={String(data?.stats.scheduledJobs ?? "—")} />
      </div>
    </section>
  );
}
