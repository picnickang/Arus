import { Skeleton } from "@/components/ui/skeleton";

export interface PageLoaderProps {
  variant?: "default" | "table" | "cards" | "form";
}

export function PageLoader({ variant = "default" }: PageLoaderProps) {
  switch (variant) {
    case "table":
      return (
        <div className="p-6 space-y-4" data-testid="page-loader-table">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      );
    case "cards":
      return (
        <div className="p-6 space-y-4" data-testid="page-loader-cards">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[180px]" />
            ))}
          </div>
        </div>
      );
    case "form":
      return (
        <div className="p-6 space-y-4 max-w-2xl" data-testid="page-loader-form">
          <Skeleton className="h-8 w-64" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      );
    default:
      return (
        <div className="p-6 space-y-4" data-testid="page-loader">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[200px] w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-[150px]" />
            <Skeleton className="h-[150px]" />
          </div>
        </div>
      );
  }
}
