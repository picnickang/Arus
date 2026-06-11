import { CheckCircle2, RefreshCw, CloudOff, AlertCircle } from "lucide-react";
import { type SyncStatus } from "@/features/crew/hooks/useSchedulePlannerData";

export function SyncStatusIndicator({
  status,
  pendingCount = 0,
}: {
  status: SyncStatus;
  pendingCount?: number;
}) {
  switch (status) {
    case "up_to_date":
      return (
        <div
          className="flex items-center gap-1.5 text-green-600 dark:text-green-400"
          data-testid="sync-status-up-to-date"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">Up to date</span>
        </div>
      );
    case "syncing":
      return (
        <div
          className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400"
          data-testid="sync-status-syncing"
        >
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">
            {pendingCount > 0 ? `Syncing ${pendingCount} pending` : "Syncing"}
          </span>
        </div>
      );
    case "offline":
      return (
        <div
          className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"
          data-testid="sync-status-offline"
        >
          <CloudOff className="h-4 w-4" />
          <span className="text-sm">
            {pendingCount > 0 ? `Offline (${pendingCount} pending)` : "Offline"}
          </span>
        </div>
      );
    case "error":
      return (
        <div
          className="flex items-center gap-1.5 text-red-600 dark:text-red-400"
          data-testid="sync-status-error"
        >
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Sync Error</span>
        </div>
      );
  }
}
