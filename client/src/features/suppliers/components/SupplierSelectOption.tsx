import { Star, AlertTriangle } from "lucide-react";
import type { SupplierPerformanceSummary } from "../hooks/useSupplierPerformance";
import { cn } from "@/lib/utils";

interface SupplierSelectOptionProps {
  supplierId: string;
  name: string;
  code?: string | undefined;
  performance?: SupplierPerformanceSummary | undefined;
}

function getScoreColor(score: number): string {
  if (score >= 80) {
    return "bg-emerald-500";
  }
  if (score >= 60) {
    return "bg-amber-500";
  }
  return "bg-red-500";
}

function getScoreTextColor(score: number): string {
  if (score >= 80) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (score >= 60) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-red-600 dark:text-red-400";
}

export function SupplierSelectOption({
  supplierId,
  name,
  code,
  performance,
}: SupplierSelectOptionProps) {
  return (
    <div
      className="flex items-center gap-2 w-full min-w-0"
      data-testid={`supplier-option-${supplierId}`}
    >
      <span className="truncate flex-1">{code ? `${code} - ${name}` : name}</span>
      {performance && (
        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-full",
              getScoreColor(performance.performanceScore)
            )}
            title={`Score: ${performance.performanceScore}`}
          />
          <span
            className={cn(
              "font-medium tabular-nums",
              getScoreTextColor(performance.performanceScore)
            )}
          >
            {performance.performanceScore}
          </span>
          {performance.totalOrders > 0 && (
            <span className="text-muted-foreground tabular-nums">
              {Math.round(performance.onTimeRate * 100)}%
            </span>
          )}
          <span className="text-muted-foreground tabular-nums">
            {performance.qualityRating.toFixed(1)}q
          </span>
          {performance.status === "preferred" && (
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
          )}
          {performance.performanceScore < 60 && <AlertTriangle className="h-3 w-3 text-red-500" />}
        </div>
      )}
    </div>
  );
}
