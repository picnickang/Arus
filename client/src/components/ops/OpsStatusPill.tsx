import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type OpsSeverity = "critical" | "warning" | "info" | "success" | "neutral";

export interface OpsStatusPillProps {
  label: string;
  severity?: OpsSeverity;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}

const SEVERITY_CLASSES: Record<OpsSeverity, string> = {
  critical: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/40",
  warning: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/40",
  info: "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/40",
  success: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/40",
  neutral: "bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-500/40",
};

export function OpsStatusPill({
  label,
  severity = "neutral",
  icon,
  className,
  testId,
}: OpsStatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        SEVERITY_CLASSES[severity],
        className
      )}
      data-testid={testId ?? `ops-status-pill-${severity}`}
    >
      {icon ? <span className="flex h-3 w-3 items-center justify-center">{icon}</span> : null}
      <span className="leading-none">{label}</span>
    </span>
  );
}

export default OpsStatusPill;
