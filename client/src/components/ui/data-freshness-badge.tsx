import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDataFreshness, type FreshnessLevel } from "@/lib/severity";
import { Clock, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataFreshnessBadgeProps {
  lastUpdated: Date | string | number | null | undefined;
  staleThresholdMs?: number;
  criticalThresholdMs?: number;
  className?: string;
}

const freshnessStyles: Record<FreshnessLevel, { icon: React.ElementType; badgeClass: string }> = {
  fresh: {
    icon: Clock,
    badgeClass: "",
  },
  stale: {
    icon: Clock,
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-700",
  },
  critical: {
    icon: AlertTriangle,
    badgeClass: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-700",
  },
  unknown: {
    icon: HelpCircle,
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

export function DataFreshnessBadge({
  lastUpdated,
  staleThresholdMs,
  criticalThresholdMs,
  className,
}: DataFreshnessBadgeProps) {
  const freshness = getDataFreshness(lastUpdated, {
    staleThresholdMs,
    criticalThresholdMs,
  });

  if (freshness.level === "fresh") {
    return null;
  }

  const style = freshnessStyles[freshness.level];
  const Icon = style.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium gap-1 cursor-default focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              style.badgeClass,
              className
            )}
            data-testid="data-freshness-badge"
            aria-label={`Data freshness: ${freshness.label}`}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {freshness.label}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">{freshness.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
