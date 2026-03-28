/**
 * Connectivity Banner
 *
 * UX REFACTOR: Persistent indicator showing connection status.
 * Maritime users need to know immediately when connectivity drops.
 *
 * States:
 *   - online: Hidden (no distraction)
 *   - degraded: Yellow bar ("Slow connection — data may be delayed")
 *   - offline: Red bar ("Offline — changes saved locally")
 *   - syncing: Blue bar ("Syncing X items...")
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, CloudOff, Loader2 } from "lucide-react";

type ConnectionState = "online" | "degraded" | "offline" | "syncing";

interface ConnectivityBannerProps {
  /** Number of items queued for sync */
  pendingSyncCount?: number;
  className?: string;
}

export function ConnectivityBanner({ pendingSyncCount = 0, className }: ConnectivityBannerProps) {
  const [state, setState] = useState<ConnectionState>("online");
  const [dismissed, setDismissed] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setState("offline");
      setDismissed(false);
      return;
    }

    if (pendingSyncCount > 0) {
      setState("syncing");
      return;
    }

    // Ping the health endpoint to detect degraded connectivity
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const start = Date.now();
      await fetch("/api/healthz", { signal: controller.signal });
      clearTimeout(timeout);

      const latency = Date.now() - start;
      setState(latency > 3000 ? "degraded" : "online");
    } catch {
      setState(navigator.onLine ? "degraded" : "offline");
      setDismissed(false);
    }
  }, [pendingSyncCount]);

  useEffect(() => {
    checkConnection();

    const handleOnline = () => checkConnection();
    const handleOffline = () => { setState("offline"); setDismissed(false); };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection]);

  // Don't show banner when online
  if (state === "online" || dismissed) return null;

  const config = {
    offline: {
      icon: WifiOff,
      text: "Offline — changes will be saved locally and synced when connected",
      bg: "bg-destructive/10 border-destructive/30",
      iconColor: "text-destructive",
      textColor: "text-destructive",
      dismissable: false,
    },
    degraded: {
      icon: CloudOff,
      text: "Slow connection — data may be delayed",
      bg: "bg-yellow-500/10 border-yellow-500/30",
      iconColor: "text-yellow-600 dark:text-yellow-400",
      textColor: "text-yellow-700 dark:text-yellow-300",
      dismissable: true,
    },
    syncing: {
      icon: Loader2,
      text: `Syncing ${pendingSyncCount} item${pendingSyncCount !== 1 ? "s" : ""}...`,
      bg: "bg-primary/10 border-primary/30",
      iconColor: "text-primary",
      textColor: "text-primary",
      dismissable: true,
    },
  }[state]!;

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 border-b text-sm",
        config.bg,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.iconColor, state === "syncing" && "animate-spin")} />
        <span className={cn("text-xs font-medium", config.textColor)} data-testid={`text-connectivity-${state}`}>
          {config.text}
        </span>
      </div>

      {config.dismissable && (
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-muted-foreground hover:text-foreground px-2"
          aria-label="Dismiss"
          data-testid="button-dismiss-connectivity"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default ConnectivityBanner;
