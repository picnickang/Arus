import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WebSocketStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  connectionCount: number;
  onReconnect?: () => void;
}

export function WebSocketStatus({
  isConnected,
  isConnecting,
  connectionCount,
  onReconnect,
}: WebSocketStatusProps) {
  const [showStatus, setShowStatus] = useState(false);
  const [hasBeenConnected, setHasBeenConnected] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setHasBeenConnected(true);
      // Show reconnection success briefly
      if (connectionCount > 1) {
        setShowStatus(true);
        const timer = setTimeout(() => setShowStatus(false), 3000);
        return () => clearTimeout(timer);
      }
    } else if (hasBeenConnected) {
      // Show disconnection status
      setShowStatus(true);
    }
  }, [isConnected, isConnecting, connectionCount, hasBeenConnected]);

  // Don't show anything on initial load if never connected
  if (!hasBeenConnected && !isConnected) {
    return null;
  }

  // Don't show if connected and not a reconnection
  if (isConnected && connectionCount <= 1) {
    return null;
  }

  // Hide the status bar if everything is normal
  if (!showStatus) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
      <Alert
        className={cn(
          "border-2",
          isConnected && "border-green-500 bg-green-50 dark:bg-green-950",
          isConnecting && "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
          !isConnected && !isConnecting && "border-red-500 bg-red-50 dark:bg-red-950"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isConnected && (
              <>
                <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Real-time connection restored
                </AlertDescription>
              </>
            )}
            {isConnecting && (
              <>
                <RefreshCw className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  Reconnecting to server...
                </AlertDescription>
              </>
            )}
            {!isConnected && !isConnecting && (
              <>
                <WifiOff className="h-5 w-5 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  Connection lost. Retrying...
                </AlertDescription>
              </>
            )}
          </div>
          {!isConnected && !isConnecting && onReconnect && (
            <Button
              size="sm"
              variant="outline"
              onClick={onReconnect}
              className="flex-shrink-0"
              aria-label="Retry connection"
              data-testid="button-retry-connection"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </Alert>
    </div>
  );
}
