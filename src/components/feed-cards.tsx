import type { ReactNode } from "react";
import Link from "next/link";

import { formatRelative } from "@/lib/feed-view-model";
import type { ControlCenterData, QuickActionPlan, SpotlightPlan } from "@/lib/feed-view-model";

export type QuickAction = QuickActionPlan & {
  onSelect?: () => void;
};

export type MobileCommand = {
  id: string;
  label: string;
  meta: string;
  tone: "info" | "success" | "warning" | "danger";
  kind: "link" | "button";
  href: string;
  onSelect?: () => void;
};

export function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function SummaryMiniCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "running" | "queued" | "attention" | "done";
}) {
  const toneClass =
    tone === "running"
      ? "border-[#34D399]/25 bg-[#34D399]/10 text-[#CFFCE9]"
      : tone === "queued"
        ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-100"
        : tone === "attention"
          ? "border-red-400/30 bg-red-400/10 text-red-100"
          : "border-[#60A5FA]/25 bg-[#60A5FA]/10 text-[#BFDBFE]";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] opacity-80">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function Panel({
  id,
  title,
  headerRight,
  children,
}: {
  id?: string;
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {headerRight}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function BriefCard({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-sm text-white/55">{detail}</p>
    </div>
  );
}

export function QuickActionCard({ action }: { action: QuickAction }) {
  const classes = `rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-white/20 ${quickActionTone(action.tone)}`;
  const content = (
    <>
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{action.label}</p>
      <p className="mt-2 text-sm font-medium text-white">{action.title}</p>
      <p className="mt-1 text-sm text-white/65">{action.detail}</p>
      <p className="mt-3 text-xs font-medium text-white/75">{action.kind === "button" ? "Refresh now →" : "Open →"}</p>
    </>
  );

  if (action.kind === "button") {
    return (
      <button type="button" onClick={action.onSelect} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <Link href={action.href} className={classes}>
      {content}
    </Link>
  );
}

export function SpotlightCard({ spotlight }: { spotlight: SpotlightPlan & { onSelect?: () => void } }) {
  const classes = `rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-white/20 ${quickActionTone(spotlight.tone)}`;
  const content = (
    <>
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{spotlight.label}</p>
      <p className="mt-2 text-base font-semibold text-white">{spotlight.title}</p>
      <p className="mt-1 text-sm text-white/70">{spotlight.detail}</p>
      <p className="mt-4 text-sm font-medium text-white/85">{spotlight.cta} →</p>
    </>
  );

  if (spotlight.kind === "button") {
    return (
      <button type="button" onClick={spotlight.onSelect} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <Link href={spotlight.href} className={classes}>
      {content}
    </Link>
  );
}

export function SectionLabel({ label }: { label: string }) {
  return <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{label}</p>;
}

export function ItemCard({
  eyebrow,
  title,
  detail,
  status,
  highlight,
  badgeLabel,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  status?: string;
  highlight?: boolean;
  badgeLabel?: string;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${highlight ? "border-[#34D399]/20 bg-[linear-gradient(135deg,rgba(52,211,153,0.08),rgba(96,165,250,0.08))]" : "border-white/8 bg-[#0E1020]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{eyebrow}</p>
          <p className="mt-2 text-sm font-medium text-white">{title}</p>
          {detail ? <p className="mt-1 text-sm text-white/60">{detail}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badgeLabel ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">{badgeLabel}</span> : null}
          {status ? <span className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${statusTone(status)}`}>{status}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function SourceBadge({ label, status, detail }: { label: string; status: "ok" | "empty" | "degraded"; detail: string }) {
  const toneClass =
    status === "ok"
      ? "border-[#34D399]/25 bg-[#34D399]/10 text-[#CFFCE9]"
      : status === "empty"
        ? "border-[#60A5FA]/25 bg-[#60A5FA]/10 text-[#BFDBFE]"
        : "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";

  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs ${toneClass}`}>
      <span className="font-medium text-white">{label}</span>
      <span className="ml-2 opacity-80">{detail}</span>
    </div>
  );
}

export function AttentionCard({ alert }: { alert: ControlCenterData["alerts"][number] }) {
  return (
    <div className={`rounded-2xl border p-3 ${attentionTone(alert.tone)}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Needs attention</p>
      <p className="mt-2 text-sm font-medium text-white">{alert.title}</p>
      <p className="mt-1 text-sm text-white/70">{alert.detail}</p>
    </div>
  );
}

export function ProjectCard({ project }: { project: ControlCenterData["projects"][number] }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0E1020] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white">{project.name}</p>
            {project.pinned ? <span className="rounded-full border border-[#60A5FA]/30 bg-[#60A5FA]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#93C5FD]">Pinned</span> : null}
          </div>
          <p className="mt-1 text-sm text-white/60">{project.nextStep || project.summary}</p>
          <p className="mt-2 text-xs text-white/35">Updated {formatRelative(project.updatedAt)}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] capitalize ${projectStatusTone(project.status)}`}>{project.status}</span>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/35">
          <span>Progress</span>
          <span>{project.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-[#60A5FA]" style={{ width: `${project.progress}%` }} />
        </div>
      </div>
    </div>
  );
}

export function EmptyPanel({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-white/10 bg-[#0E1020] p-4 text-sm text-white/45">{text}</p>;
}

export function MobileCommandDock({ commands }: { commands: MobileCommand[] }) {
  return (
    <div className="sm:hidden">
      <div className="fixed inset-x-4 bottom-4 z-30 rounded-[1.75rem] border border-white/10 bg-[#0A0A0F]/92 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="grid grid-cols-5 gap-2">
          {commands.map((command) => {
            const classes = `min-w-0 rounded-2xl border px-2 py-2 text-left ${quickActionTone(command.tone)}`;
            const content = (
              <>
                <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">{command.label}</p>
                <p className="mt-1 truncate text-xs text-white">{command.meta}</p>
              </>
            );

            if (command.kind === "button") {
              return (
                <button key={command.id} type="button" onClick={command.onSelect} className={classes}>
                  {content}
                </button>
              );
            }

            return (
              <Link key={command.id} href={command.href} className={classes}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (["running", "active", "in progress", "healthy", "success", "completed"].includes(normalized)) {
    return "border-[#34D399]/30 bg-[#34D399]/10 text-[#6EE7B7]";
  }
  if (["queued", "pending", "recent", "warning", "skipped"].includes(normalized)) {
    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  }
  if (["failing", "failed", "error", "timeout"].includes(normalized)) {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }
  if (["idle"].includes(normalized)) {
    return "border-[#60A5FA]/30 bg-[#60A5FA]/10 text-[#93C5FD]";
  }
  return "border-white/10 bg-white/5 text-white/70";
}

function projectStatusTone(status: ControlCenterData["projects"][number]["status"]) {
  if (status === "blocked") return "border-red-400/30 bg-red-400/10 text-red-200";
  if (status === "active") return "border-[#34D399]/30 bg-[#34D399]/10 text-[#6EE7B7]";
  if (status === "planned") return "border-[#60A5FA]/30 bg-[#60A5FA]/10 text-[#93C5FD]";
  return "border-white/10 bg-white/5 text-white/70";
}

function attentionTone(tone: ControlCenterData["alerts"][number]["tone"]) {
  if (tone === "warning") return "border-yellow-400/30 bg-yellow-400/10";
  if (tone === "focus") return "border-[#60A5FA]/25 bg-[#60A5FA]/10";
  return "border-white/10 bg-black/20";
}

function quickActionTone(tone: QuickAction["tone"]) {
  if (tone === "danger") return "border-red-400/30 bg-red-400/10";
  if (tone === "warning") return "border-yellow-400/30 bg-yellow-400/10";
  if (tone === "success") return "border-[#34D399]/25 bg-[#34D399]/10";
  return "border-[#60A5FA]/25 bg-[#60A5FA]/10";
}
