import { Calendar, RefreshCw, WifiOff, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TelemetryStaleWarning({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
      <WifiOff className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm">
        Telemetry delayed on {count} vessel{count > 1 ? "s" : ""}; schedule confidence may be
        reduced.
      </span>
    </div>
  );
}

export function EmptyScheduleState({ hasBlockedTasks }: { hasBlockedTasks: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/30 rounded-lg">
      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="font-medium text-lg mb-2">
        {hasBlockedTasks ? "No Tasks Scheduled" : "No PdM Tasks"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        {hasBlockedTasks
          ? "Tasks exist but none could be scheduled for this period. Check the blocked tasks section below for details."
          : "No predictive maintenance tasks found for the current filters and date range."}
      </p>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
      <XCircle className="h-12 w-12 text-red-500 mb-4" />
      <h3 className="font-medium text-lg mb-2">Failed to Load Schedule</h3>
      <p className="text-sm text-muted-foreground mb-4">
        There was an error loading the maintenance schedule. Please try again.
      </p>
      <Button onClick={onRetry} variant="outline" data-testid="btn-retry">
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </Button>
    </div>
  );
}
