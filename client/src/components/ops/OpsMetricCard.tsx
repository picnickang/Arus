import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { OpsStatusPill, type OpsSeverity } from "./OpsStatusPill";

export interface OpsMetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  severity?: OpsSeverity;
  trendLabel?: string;
  trendSeverity?: OpsSeverity;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}

const SEVERITY_ACCENT: Record<OpsSeverity, string> = {
  critical: "before:bg-rose-500/80",
  warning: "before:bg-amber-500/80",
  info: "before:bg-sky-500/80",
  success: "before:bg-emerald-500/80",
  neutral: "before:bg-slate-500/60",
};

export function OpsMetricCard({
  label,
  value,
  hint,
  severity = "neutral",
  trendLabel,
  trendSeverity,
  icon,
  className,
  testId,
}: OpsMetricCardProps) {
  return (
    <Card
      className={cn(
        "ops-card relative overflow-hidden",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
        SEVERITY_ACCENT[severity],
        className,
      )}
      data-testid={testId ?? "ops-metric-card"}
    >
      <CardContent className="flex flex-col gap-2 p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-foreground" data-testid="ops-metric-value">
            {value}
          </span>
          {trendLabel ? (
            <OpsStatusPill label={trendLabel} severity={trendSeverity ?? severity} />
          ) : null}
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default OpsMetricCard;
