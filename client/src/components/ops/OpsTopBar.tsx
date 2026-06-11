import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface OpsTopBarProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  filters?: ReactNode;
  className?: string;
  testId?: string;
}

export function OpsTopBar({
  title,
  subtitle,
  leading,
  trailing,
  filters,
  className,
  testId,
}: OpsTopBarProps) {
  return (
    <header
      className={cn(
        "ops-topbar sticky top-0 z-30 flex flex-col gap-2 border-b border-border/60 px-4 py-3 backdrop-blur md:px-6",
        className
      )}
      data-testid={testId ?? "ops-topbar"}
    >
      <div className="flex items-center gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          {title ? (
            <h1
              className="truncate text-base font-semibold text-foreground md:text-lg"
              data-testid="ops-topbar-title"
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
      </div>
      {filters ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="ops-topbar-filters">
          {filters}
        </div>
      ) : null}
    </header>
  );
}

export default OpsTopBar;
