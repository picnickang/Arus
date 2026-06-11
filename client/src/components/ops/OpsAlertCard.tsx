import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { OpsStatusPill, type OpsSeverity } from "./OpsStatusPill";

export interface OpsAlertCardProps {
  title: string;
  description?: ReactNode;
  severity?: OpsSeverity;
  severityLabel?: string;
  timestamp?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  onClick?: () => void;
  className?: string;
  testId?: string;
}

const SEVERITY_ACCENT: Record<OpsSeverity, string> = {
  critical: "before:bg-rose-500",
  warning: "before:bg-amber-500",
  info: "before:bg-sky-500",
  success: "before:bg-emerald-500",
  neutral: "before:bg-slate-500",
};

const DEFAULT_SEVERITY_LABEL: Record<OpsSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
  success: "Resolved",
  neutral: "Status",
};

export function OpsAlertCard({
  title,
  description,
  severity = "info",
  severityLabel,
  timestamp,
  meta,
  action,
  onClick,
  className,
  testId,
}: OpsAlertCardProps) {
  const interactive = Boolean(onClick);
  return (
    <Card
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "ops-card relative overflow-hidden",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
        SEVERITY_ACCENT[severity],
        interactive &&
          "cursor-pointer transition-colors hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      data-testid={testId ?? "ops-alert-card"}
    >
      <CardContent className="flex flex-col gap-2 p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <OpsStatusPill
                label={severityLabel ?? DEFAULT_SEVERITY_LABEL[severity]}
                severity={severity}
              />
              {timestamp ? (
                <span className="text-xs text-muted-foreground">{timestamp}</span>
              ) : null}
            </div>
            <h3
              className="mt-2 text-sm font-semibold text-foreground"
              data-testid="ops-alert-title"
            >
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            ) : null}
            {meta ? <div className="mt-2 text-xs text-muted-foreground">{meta}</div> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default OpsAlertCard;
