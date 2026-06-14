import { ArrowLeftRight, Cloud, CloudOff, RefreshCw, UploadCloud } from "lucide-react";
import { ObiAlertCategoryA } from "@oicl/openbridge-webcomponents-react/icons/icon-alert-category-a.js";
import { ObiAlertCategoryB } from "@oicl/openbridge-webcomponents-react/icons/icon-alert-category-b.js";
import { cn } from "@/lib/utils";

export interface OpsRailRisk {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  href?: string;
}

interface OpsStatusRailProps {
  risks?: OpsRailRisk[];
  outboxCount?: number;
  outboxHasConflict?: boolean;
  handoverOpenItems?: number;
  isOnline?: boolean;
  onAction?: (action: string, payload?: unknown) => void;
  className?: string;
  /**
   * When true, render nothing unless there is something urgent to surface
   * (a risk, a queued outbox, or an offline state). Used for the mobile mount,
   * where the global connectivity banner already covers steady-state status and
   * permanent chrome would waste scarce screen space.
   */
  hideWhenIdle?: boolean;
}

const chip = "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium";
const chipBtn =
  "inline-flex min-h-11 items-center rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Persistent Ops Status Rail — always-visible critical operational info
 * (top risk, offline outbox, handover) on the admin ops surface. Docked
 * (wraps; never scrolls critical items off-screen) and theme-token driven,
 * so it adapts to light/dark/bridge/daylight. S-Mode / IEC 62288 aligned.
 */
export default function OpsStatusRail({
  risks = [],
  outboxCount = 0,
  outboxHasConflict = false,
  handoverOpenItems,
  isOnline = true,
  onAction,
  className,
  hideWhenIdle = false,
}: OpsStatusRailProps) {
  const topRisk = risks[0];
  const idle = !topRisk && outboxCount <= 0 && isOnline;
  if (hideWhenIdle && idle) {
    return null;
  }
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2 text-card-foreground",
        className
      )}
      role="region"
      aria-label="Persistent operational status rail"
    >
      {topRisk && (
        <div className={cn(chip, "border-destructive/40 bg-destructive/10 text-destructive")}>
          {/* IEC-aligned priority symbol: category A for high, B for medium. */}
          {topRisk.severity === "high" ? (
            <ObiAlertCategoryA className="inline-block h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ObiAlertCategoryB className="inline-block h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="font-semibold">{topRisk.label}</span>
          <button
            type="button"
            onClick={() => onAction?.("open-risk", topRisk)}
            className={cn(chipBtn, "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            Review
          </button>
        </div>
      )}

      {outboxCount > 0 && (
        <div className={cn(chip, "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
          <UploadCloud className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {outboxCount} queued{outboxHasConflict ? " · conflict" : ""}
          </span>
          <button
            type="button"
            onClick={() => onAction?.("review-outbox")}
            className={cn(chipBtn, "bg-amber-500 text-white hover:bg-amber-500/90")}
          >
            Outbox
          </button>
        </div>
      )}

      {handoverOpenItems !== undefined && handoverOpenItems > 0 && (
        <div className={cn(chip, "border-primary/40 bg-primary/10 text-primary")}>
          <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{handoverOpenItems} before handover</span>
          <button
            type="button"
            onClick={() => onAction?.("open-handover")}
            className={cn(chipBtn, "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            Briefing
          </button>
        </div>
      )}

      <div className={cn(chip, "ml-auto border-border bg-muted text-muted-foreground")}>
        {isOnline ? (
          <Cloud className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span>{isOnline ? "Online" : "Offline"}</span>
        <button
          type="button"
          onClick={() => onAction?.("refresh-status")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Refresh status"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
