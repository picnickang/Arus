import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type LoadingVariant = "table" | "card" | "list" | "form" | "custom";

interface LoadingStateProps {
  variant?: LoadingVariant;
  rows?: number;
  cols?: number;
  className?: string;
  children?: React.ReactNode;
}

export function LoadingState({
  variant = "card",
  rows = 5,
  cols = 4,
  className = "",
  children,
}: LoadingStateProps) {
  if (children) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className} data-testid="loading-state">
      {variant === "table" && <TableSkeleton rows={rows} cols={cols} />}
      {variant === "card" && <CardSkeleton />}
      {variant === "list" && <ListSkeleton rows={rows} />}
      {variant === "form" && <FormSkeleton />}
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-3" data-testid="table-skeleton">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-4 flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <Card data-testid="card-skeleton">
      <CardHeader>
        <Skeleton className="h-6 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

interface ListSkeletonProps {
  rows?: number;
}

function ListSkeleton({ rows = 5 }: ListSkeletonProps) {
  return (
    <div className="space-y-3" data-testid="list-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`list-item-${i}`} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6" data-testid="form-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`field-${i}`} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}
