import { ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { COLUMNS } from "./work-order-table-config";

interface TruncatedCellProps {
  text: string;
  className?: string;
  maxWidth?: number;
}

export function TruncatedCell({ text, className, maxWidth }: TruncatedCellProps) {
  const displayText = text || "—";
  const shouldTruncate = displayText.length > 20;

  if (!shouldTruncate) {
    return <span className={className}>{displayText}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("block truncate cursor-default", className)}
          style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined }}
        >
          {displayText}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px]">
        <p className="text-sm">{displayText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface SortableHeaderProps {
  columnKey: string;
  children: React.ReactNode;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  className?: string;
}

export function SortableHeader({
  columnKey,
  children,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps) {
  const isSorted = sortColumn === columnKey;
  return (
    <button
      className={cn(
        "flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wide",
        "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors",
        className
      )}
      onClick={() => onSort(columnKey)}
      data-testid={`sort-${columnKey}`}
    >
      {children}
      {isSorted &&
        (sortDirection === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        ))}
    </button>
  );
}

export function WorkOrderTableSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <div className="bg-slate-50 dark:bg-slate-800/50 border-b px-4 py-3">
        <div className="flex gap-4">
          {COLUMNS.slice(0, 6).map((col, i) => (
            <Skeleton key={i} className="h-4" style={{ width: col.width - 20 }} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkOrderTableEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-900 border rounded-lg">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No Work Orders Found</h3>
      <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
        Try adjusting your filters or create a new work order to get started.
      </p>
    </div>
  );
}
