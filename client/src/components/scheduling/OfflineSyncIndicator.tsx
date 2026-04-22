import { Cloud, CloudOff, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { OfflineSyncState } from "@/features/crew/hooks/useOfflineSync";

interface OfflineSyncIndicatorProps {
  state: OfflineSyncState;
  onSyncClick?: () => void;
}

export function OfflineSyncIndicator({ state, onSyncClick }: OfflineSyncIndicatorProps) {
  const { isOnline, pendingCount, hasConflicts, isSyncing } = state;

  if (isOnline && pendingCount === 0 && !hasConflicts) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-1.5 text-muted-foreground"
            data-testid="sync-indicator-online"
          >
            <Cloud className="h-4 w-4" />
            <span className="text-sm">Online</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Connected and synced</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!isOnline) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5" data-testid="sync-indicator-offline">
            <CloudOff className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-amber-600 dark:text-amber-400">Offline</span>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingCount} pending
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Working offline. Changes will sync when reconnected.</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (hasConflicts) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5" data-testid="sync-indicator-conflict">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">Conflicts</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Some changes conflict with server. Review required.</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5" data-testid="sync-indicator-syncing">
        <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm text-blue-600 dark:text-blue-400">Syncing...</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSyncClick}
            className="flex items-center gap-1.5"
            data-testid="sync-indicator-pending"
          >
            <Cloud className="h-4 w-4 text-amber-500" />
            <Badge variant="secondary" className="text-xs">
              {pendingCount} pending
            </Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to sync pending changes</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
