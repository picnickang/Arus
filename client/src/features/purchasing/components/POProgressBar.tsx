/**
 * POProgressBar
 * Improvement #15: Displays PO delivery progress inline in the PO list.
 *
 * The GET /purchase-orders response already computes `progress` (0-100).
 * This component renders it as a compact visual indicator.
 *
 * Usage:
 *   <POProgressBar progress={po.progress} receivedQty={po.receivedQty} totalQty={po.totalQty} status={po.status} />
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface POProgressBarProps {
  progress:    number;    // 0-100
  receivedQty: number;
  totalQty:    number;
  rejectedQty?: number;
  status:      string;
  className?:  string;
}

const STATUS_COLORS: Record<string, string> = {
  sent:      "bg-blue-500",
  confirmed: "bg-violet-500",
  received:  "bg-emerald-500",
  cancelled: "bg-slate-400",
  draft:     "bg-slate-300",
};

export function POProgressBar({
  progress, receivedQty, totalQty, rejectedQty = 0, status, className,
}: POProgressBarProps) {
  const barColor     = STATUS_COLORS[status] ?? "bg-primary";
  const isComplete   = progress >= 100;
  const hasRejection = rejectedQty > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("w-full space-y-1", className)}>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{receivedQty} / {totalQty} received</span>
              <span className={cn("font-medium", isComplete ? "text-emerald-600" : "text-foreground")}>
                {progress}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-300", barColor)}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            {hasRejection && (
              <p className="text-[10px] text-destructive">
                {rejectedQty} item{rejectedQty !== 1 ? "s" : ""} rejected
              </p>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs space-y-1">
            <p>Ordered: {totalQty}</p>
            <p>Received: {receivedQty}</p>
            {hasRejection && <p className="text-destructive">Rejected: {rejectedQty}</p>}
            <p>Remaining: {Math.max(0, totalQty - receivedQty)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact inline badge variant for use in tight table cells.
 */
export function POProgressBadge({ progress, status }: { progress: number; status: string }) {
  if (status === "cancelled") {
    return <Badge variant="outline" className="text-xs text-muted-foreground">Cancelled</Badge>;
  }
  if (progress >= 100) {
    return <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Complete</Badge>;
  }
  return (
    <Badge variant="outline" className="text-xs font-mono">
      {progress}%
    </Badge>
  );
}
