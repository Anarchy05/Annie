"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AttentionCard,
  BriefCard,
  EmptyPanel,
  ItemCard,
  Panel,
  ProjectCard,
  type QuickAction,
  QuickActionCard,
  SectionLabel,
  SourceBadge,
  SummaryCard,
  SummaryMiniCard,
} from "@/components/feed-cards";
import { PageShell } from "@/components/page-shell";
import { StatePanel } from "@/components/state-panels";
import {
  buildLiveWorkItems,
  buildQuickActionPlans,
  buildRecentWorkItems,
  buildSourcesMap,
  deriveFeedStatus,
  emptyControlCenter,
  formatRelative,
  formatRelativeFuture,
  type AutomationWatchData,
  type ControlCenterData,
} from "@/lib/feed-view-model";

export default function FeedPage() {
  const [controlCenter, setControlCenter] = useState<ControlCenterData>(emptyControlCenter);
  const [automationWatch, setAutomationWatch] = useState<AutomationWatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const liveWork = useMemo(() => buildLiveWorkItems(controlCenter), [controlCenter]);
  const recentWork = useMemo(() => buildRecentWorkItems(controlCenter), [controlCenter]);
  const sourcesByKey = useMemo(() => buildSourcesMap(controlCenter), [controlCenter]);
  const feedStatus = useMemo(
    () => deriveFeedStatus({ lastLoadedAt, hasAutomationSnapshot: automationWatch !== null, error, automationError }),
    [automationError, automationWatch, error, lastLoadedAt]
  );

  const loadAutomationWatch = useCallback(async () => {
    try {
      const response = await fetch("/api/automation-watch", { cache: "no-store" });
      if (!response.ok) throw new Error("Automation watch is unavailable right now.");
      const data = (await response.json()) as AutomationWatchData;
      setAutomationWatch(data);
      setAutomationError(null);
    } catch (err) {
      setAutomationError(err instanceof Error ? err.message : "Automation watch is unavailable right now.");
    }
  }, []);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") setRefreshing(true);

      const controlCenterPromise = fetch("/api/control-center", { cache: "no-store" });
      const automationPromise = loadAutomationWatch();

      try {
        const response = await controlCenterPromise;
        if (!response.ok) throw new Error("Control center data is unavailable right now.");
        const data = (await response.json()) as ControlCenterData;
        setControlCenter(data);
        setError(null);
        setLastLoadedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Control center data is unavailable right now.");
      } finally {
        await automationPromise;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadAutomationWatch]
  );

  const quickActions = useMemo<QuickAction[]>(() => {
    const handlers: Partial<Record<string, () => void>> = {
      "refresh-control-center": () => void load("refresh"),
      "automation-refresh": () => void loadAutomationWatch(),
    };

    return buildQuickActionPlans({
      controlCenter,
      automationWatch,
      error,
      automationError,
      liveWork,
    }).map((action) => ({
      ...action,
      onSelect: handlers[action.id],
    }));
  }, [automationError, automationWatch, controlCenter, error, liveWork, load, loadAutomationWatch]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void load("refresh");
      }
    }, 30_000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void load("refresh");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [load]);

  return (
    <PageShell>
      <div className="space-y-5">
        <section className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Overview</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">What matters now</h2>
              <p className="mt-2 text-sm text-white/65">A simpler view of priorities, current work, and what&apos;s next.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/45">
              <span>{lastLoadedAt ? `Updated ${formatRelative(lastLoadedAt)}` : "Loading..."}</span>
              <button
                onClick={() => void load("refresh")}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-white/70 hover:text-white"
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          <div id="overview" className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Priorities" value={loading ? "…" : feedStatus.showBlockingControlCenterError ? "—" : controlCenter.summary.openPriorities} />
            <SummaryCard label="Active now" value={loading ? "…" : feedStatus.showBlockingControlCenterError ? "—" : controlCenter.summary.activeNow} />
            <SummaryCard label="Up next" value={loading ? "…" : feedStatus.showBlockingControlCenterError ? "—" : controlCenter.summary.upcomingJobs} />
          </div>

          <div className="mt-4">
            <SectionLabel label="Annie's quick actions" />
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => (
                <QuickActionCard key={action.id} action={action} />
              ))}
            </div>
          </div>

          {controlCenter.meta.sources.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {controlCenter.meta.sources.map((source) => (
                <SourceBadge key={source.key} label={source.label} status={source.status} detail={source.detail} />
              ))}
            </div>
          ) : null}

          {feedStatus.showBlockingControlCenterError ? (
            <div className="mt-5 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">{error}</div>
          ) : (
            <>
              {feedStatus.staleSignals.length ? (
                <div className="mt-5 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                  <p className="font-medium text-white">Annie is holding a steady snapshot.</p>
                  <ul className="mt-2 space-y-1 text-yellow-50/90">
                    {feedStatus.staleSignals.map((signal) => (
                      <li key={signal}>• {signal}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5 rounded-3xl border border-[#2A2A3E] bg-[linear-gradient(135deg,rgba(96,165,250,0.14),rgba(167,139,250,0.14))] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Focus</p>
                <p className="mt-2 text-lg font-semibold text-white">{controlCenter.focus.headline}</p>
                <p className="mt-1 text-sm text-white/70">{controlCenter.focus.note}</p>
              </div>

              {controlCenter.alerts.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {controlCenter.alerts.map((alert) => (
                    <AttentionCard key={alert.id} alert={alert} />
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <BriefCard
                  label="Top priority"
                  title={controlCenter.priorities[0]?.text || "Backlog is clear"}
                  detail={controlCenter.priorities[0]?.group || "Nothing urgent is surfacing."}
                />
                <BriefCard
                  label="Live now"
                  title={liveWork[0]?.title || "No hot thread running"}
                  detail={
                    liveWork[0]
                      ? `${liveWork[0].source} · ${liveWork[0].status}`
                      : controlCenter.activeWork[0]
                        ? `Latest signal: ${controlCenter.activeWork[0].title}`
                        : "Annie is calm and ready for the next push."
                  }
                />
                <BriefCard
                  label="Next beat"
                  title={controlCenter.agenda[0]?.title || "No scheduled beat queued"}
                  detail={
                    controlCenter.agenda[0]
                      ? `${formatRelativeFuture(controlCenter.agenda[0].timestamp)} · ${controlCenter.agenda[0].detail}`
                      : "Nothing time-based is pressing right now."
                  }
                />
              </div>
            </>
          )}
        </section>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-44 rounded-3xl border border-[#2A2A3E] bg-black/20 skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel id="top-priorities" title="Top priorities">
              {feedStatus.showBlockingControlCenterError ? (
                <StatePanel
                  title="Priority read is unavailable"
                  detail={feedStatus.blockingControlCenterError || "Control center data is unavailable right now."}
                  tone="warning"
                  action={
                    <RefreshButton onClick={() => void load("refresh")}>Refresh priorities</RefreshButton>
                  }
                />
              ) : controlCenter.priorities.length ? (
                <div className="space-y-3">
                  {controlCenter.priorities.slice(0, 6).map((item) => (
                    <ItemCard key={item.id} eyebrow={item.group} title={item.text} />
                  ))}
                </div>
              ) : sourcesByKey.get("todo")?.status === "degraded" ? (
                <StatePanel
                  title="Priority backlog is partially unavailable"
                  detail={sourcesByKey.get("todo")?.detail || "Mission Control couldn't confirm the current backlog from TODO.md."}
                  tone="warning"
                />
              ) : (
                <EmptyPanel text="No open priorities found." />
              )}
            </Panel>

            <Panel
              id="current-work"
              title="Current work"
              headerRight={controlCenter.activeWork.length ? <span className="text-xs text-white/40">{liveWork.length} live · {recentWork.length} recent</span> : undefined}
            >
              {feedStatus.showBlockingControlCenterError ? (
                <StatePanel
                  title="Live work is unavailable"
                  detail={feedStatus.blockingControlCenterError || "Control center data is unavailable right now."}
                  tone="warning"
                  action={<RefreshButton onClick={() => void load("refresh")}>Refresh live work</RefreshButton>}
                />
              ) : controlCenter.activeWork.length ? (
                <div className="space-y-4">
                  {liveWork.length ? (
                    <div>
                      <SectionLabel label="Live now" />
                      <div className="mt-2 space-y-3">
                        {liveWork.slice(0, 4).map((item) => (
                          <ItemCard
                            key={item.id}
                            eyebrow={`${item.source} · ${formatRelative(item.updatedAt)}`}
                            title={item.title}
                            detail={item.detail}
                            status={item.status}
                            highlight
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyPanel text="No thread is actively running right this second." />
                  )}

                  {recentWork.length ? (
                    <div>
                      <SectionLabel label="Recent signals" />
                      <div className="mt-2 space-y-3">
                        {recentWork.slice(0, 3).map((item) => (
                          <ItemCard
                            key={item.id}
                            eyebrow={`${item.source} · ${formatRelative(item.updatedAt)}`}
                            title={item.title}
                            detail={item.detail}
                            status={item.status}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : sourcesByKey.get("tasks")?.status === "degraded" || sourcesByKey.get("sessions")?.status === "degraded" ? (
                <StatePanel
                  title="Live work is partially unavailable"
                  detail={
                    [sourcesByKey.get("tasks")?.detail, sourcesByKey.get("sessions")?.detail].filter(Boolean).join(" · ") ||
                    "Mission Control couldn't fully confirm Annie's current work."
                  }
                  tone="warning"
                />
              ) : (
                <EmptyPanel text="Nothing active right now." />
              )}
            </Panel>

            <Panel
              id="task-runway"
              title="Task runway"
              headerRight={
                feedStatus.showBlockingControlCenterError ? undefined : (
                  <span className="text-xs text-white/40">
                    {controlCenter.taskTracker.summary.running} live · {controlCenter.taskTracker.summary.queued} queued · {controlCenter.taskTracker.summary.attention} attention
                    {controlCenter.taskTracker.summary.staleAttention ? ` · ${controlCenter.taskTracker.summary.staleAttention} older` : ""}
                  </span>
                )
              }
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#60A5FA]/20 bg-[linear-gradient(135deg,rgba(96,165,250,0.12),rgba(167,139,250,0.12))] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Annie&apos;s task read</p>
                  <p className="mt-2 text-base font-semibold text-white">{controlCenter.taskTracker.headline}</p>
                  <p className="mt-1 text-sm text-white/70">{controlCenter.taskTracker.note}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryMiniCard label="Running" value={controlCenter.taskTracker.summary.running} tone="running" />
                  <SummaryMiniCard label="Queued" value={controlCenter.taskTracker.summary.queued} tone="queued" />
                  <SummaryMiniCard label="Attention" value={controlCenter.taskTracker.summary.attention} tone="attention" />
                  <SummaryMiniCard label="Done" value={controlCenter.taskTracker.summary.completed} tone="done" />
                </div>

                {controlCenter.taskTracker.summary.staleAttention ? (
                  <p className="text-xs text-white/45">
                    Annie tucked {controlCenter.taskTracker.summary.staleAttention} older failed task signal{controlCenter.taskTracker.summary.staleAttention === 1 ? "" : "s"} out of the live attention count so this runway stays focused on what&apos;s current.
                  </p>
                ) : null}

                <div>
                  <SectionLabel label="Recent task flow" />
                  <div className="mt-2 space-y-3">
                    {feedStatus.showBlockingControlCenterError ? (
                      <StatePanel
                        title="Task runway is unavailable"
                        detail={feedStatus.blockingControlCenterError || "Control center data is unavailable right now."}
                        tone="warning"
                        action={<RefreshButton onClick={() => void load("refresh")}>Refresh runway</RefreshButton>}
                      />
                    ) : controlCenter.taskTracker.items.length ? (
                      controlCenter.taskTracker.items.map((item) => (
                        <ItemCard
                          key={item.id}
                          eyebrow={item.updatedAt ? `Updated ${formatRelative(item.updatedAt)}` : "Task state"}
                          title={item.title}
                          detail={item.detail}
                          status={item.status}
                          highlight={item.statusTone === "running" || item.statusTone === "attention"}
                        />
                      ))
                    ) : sourcesByKey.get("tasks")?.status === "degraded" ? (
                      <StatePanel
                        title="Task state is partially unavailable"
                        detail={sourcesByKey.get("tasks")?.detail || "Mission Control couldn't confirm the local task queue."}
                        tone="warning"
                      />
                    ) : (
                      <EmptyPanel text="No live task queue is surfacing yet." />
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              id="automation-watch"
              title="Automation watch"
              headerRight={
                automationWatch ? <span className="text-xs text-white/40">{automationWatch.summary.failing} failing · {automationWatch.summary.warning} warning</span> : undefined
              }
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#60A5FA]/20 bg-[linear-gradient(135deg,rgba(96,165,250,0.12),rgba(167,139,250,0.12))] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Annie&apos;s automation read</p>
                  <p className="mt-2 text-base font-semibold text-white">{automationWatch?.headline || "Reading the automation runway…"}</p>
                  <p className="mt-1 text-sm text-white/70">{automationWatch?.note || "Loading recent run health without slowing down the main dashboard."}</p>
                </div>

                <div>
                  <SectionLabel label="Next up" />
                  <div className="mt-2 space-y-3">
                    {feedStatus.showBlockingControlCenterError ? (
                      <StatePanel
                        title="Schedule read is unavailable"
                        detail={feedStatus.blockingControlCenterError || "Control center data is unavailable right now."}
                        tone="warning"
                        action={<RefreshButton onClick={() => void load("refresh")}>Refresh schedule</RefreshButton>}
                      />
                    ) : controlCenter.agenda.length ? (
                      controlCenter.agenda.slice(0, 3).map((item) => (
                        <ItemCard
                          key={item.id}
                          eyebrow={new Date(item.timestamp).toLocaleString()}
                          title={item.title}
                          detail={item.detail}
                        />
                      ))
                    ) : sourcesByKey.get("cron")?.status === "degraded" ? (
                      <StatePanel
                        title="Schedule read is partially unavailable"
                        detail={sourcesByKey.get("cron")?.detail || "Mission Control couldn't confirm the next scheduled beats."}
                        tone="warning"
                      />
                    ) : (
                      <EmptyPanel text="No upcoming scheduled jobs." />
                    )}
                  </div>
                </div>

                <div>
                  <SectionLabel label="Recent run health" />
                  <div className="mt-2 space-y-3">
                    {feedStatus.blockingAutomationError ? (
                      <StatePanel
                        title="Automation watch is temporarily unavailable"
                        detail={feedStatus.blockingAutomationError}
                        tone="warning"
                        action={<RefreshButton onClick={() => void loadAutomationWatch()}>Refresh automation watch</RefreshButton>}
                      />
                    ) : automationWatch ? (
                      automationWatch.items.length ? (
                        automationWatch.items.map((item) => (
                          <ItemCard
                            key={item.id}
                            eyebrow={item.lastRunAt ? `Last run ${formatRelative(item.lastRunAt)}` : "No recent run logged"}
                            title={item.title}
                            detail={`${item.lastRunStatus} · ${item.lastRunSummary}`}
                            status={item.status}
                            highlight={item.status === "failing" || item.status === "warning"}
                          />
                        ))
                      ) : (
                        <EmptyPanel text="No automation health signals are available yet." />
                      )
                    ) : (
                      <div className="space-y-3">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <div key={index} className="h-20 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel id="project-pulse" title="Project pulse">
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#60A5FA]/20 bg-[linear-gradient(135deg,rgba(96,165,250,0.12),rgba(167,139,250,0.12))] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Annie&apos;s next move</p>
                  <p className="mt-2 text-base font-semibold text-white">{controlCenter.recommendation.headline}</p>
                  <p className="mt-1 text-sm text-white/70">{controlCenter.recommendation.note}</p>
                </div>

                {feedStatus.showBlockingControlCenterError ? (
                  <StatePanel
                    title="Project pulse is unavailable"
                    detail={feedStatus.blockingControlCenterError || "Control center data is unavailable right now."}
                    tone="warning"
                    action={<RefreshButton onClick={() => void load("refresh")}>Refresh project pulse</RefreshButton>}
                  />
                ) : controlCenter.projects.length ? (
                  controlCenter.projects.map((project) => <ProjectCard key={project.id} project={project} />)
                ) : (
                  <EmptyPanel text="No tracked projects are surfacing yet." />
                )}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function RefreshButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white/80 hover:text-white"
    >
      {children}
    </button>
  );
}
