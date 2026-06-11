import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { OpsStatusPill, type OpsSeverity } from "./OpsStatusPill";

export interface OpsActionCardProps {
  title: string;
  description?: ReactNode;
  severity?: OpsSeverity;
  confidenceLabel?: string;
  icon?: ReactNode;
  meta?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
  testId?: string;
}

export function OpsActionCard({
  title,
  description,
  severity = "info",
  confidenceLabel,
  icon,
  meta,
  primaryAction,
  secondaryAction,
  className,
  testId,
}: OpsActionCardProps) {
  return (
    <Card className={cn("ops-card", className)} data-testid={testId ?? "ops-action-card"}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {icon ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground" data-testid="ops-action-title">
                {title}
              </h3>
              {description ? (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {confidenceLabel ? <OpsStatusPill label={confidenceLabel} severity={severity} /> : null}
        </div>
        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
        {primaryAction || secondaryAction ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default OpsActionCard;
