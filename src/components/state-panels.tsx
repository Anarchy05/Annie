import type { ReactNode } from "react";

type StatePanelProps = {
  title: string;
  detail: string;
  action?: ReactNode;
  tone?: "neutral" | "warning" | "danger";
};

const toneClasses = {
  neutral: "border-white/10 bg-[#0E1020] text-white/70",
  warning: "border-yellow-400/30 bg-yellow-400/10 text-yellow-100",
  danger: "border-red-400/30 bg-red-400/10 text-red-100",
} as const;

export function StatePanel({ title, detail, action, tone = "neutral" }: StatePanelProps) {
  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-sm opacity-80">{detail}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
