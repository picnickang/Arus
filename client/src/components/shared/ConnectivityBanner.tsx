import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { WifiOff, CloudOff, Loader2 } from "lucide-react";

type ConnectionState = "online" | "degraded" | "offline" | "syncing";

interface ConnectivityBannerProps {
  pendingSyncCount?: number;
  className?: string;
}

const FAST_INTERVAL_MS = 30 * 1000;
const SLOW_INTERVAL_MS = 120 * 1000;
const STABLE_THRESHOLD = 3;

export function ConnectivityBanner({ pendingSyncCount = 0, className }: ConnectivityBannerProps) {
  const [state, setState] = useState<ConnectionState>("online");
  const [dismissed, setDismissed] = useState(false);
  const consecutiveSuccesses = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<ConnectionState>(state);

  stateRef.current = state;

  const checkConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setState("offline");
      setDismissed(false);
      consecutiveSuccesses.current = 0;
      return;
    }

    if (pendingSyncCount > 0) {
      setState("syncing");
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const start = Date.now();
      await fetch("/api/healthz", { signal: controller.signal });
      clearTimeout(timeout);

      const latency = Date.now() - start;
      if (latency > 3000) {
        setState("degraded");
        consecutiveSuccesses.current = 0;
      } else {
        setState("online");
        consecutiveSuccesses.current++;
      }
    } catch {
      setState(navigator.onLine ? "degraded" : "offline");
      setDismissed(false);
      consecutiveSuccesses.current = 0;
    }
  }, [pendingSyncCount]);

  const schedulePolling = useCallback(() => {
    if (intervalRef.current) {clearInterval(intervalRef.current);}

    if (stateRef.current === "offline") {return;}

    const interval = consecutiveSuccesses.current >= STABLE_THRESHOLD
      ? SLOW_INTERVAL_MS
      : FAST_INTERVAL_MS;

    intervalRef.current = setInterval(() => {
      checkConnection().then(() => schedulePolling());
    }, interval);
  }, [checkConnection]);

  useEffect(() => {
    checkConnection().then(() => schedulePolling());

    const handleOnline = () => {
      consecutiveSuccesses.current = 0;
      checkConnection().then(() => schedulePolling());
    };
    const handleOffline = () => {
      setState("offline");
      setDismissed(false);
      consecutiveSuccesses.current = 0;
      if (intervalRef.current) {clearInterval(intervalRef.current);}
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (intervalRef.current) {clearInterval(intervalRef.current);}
    };
  }, [checkConnection, schedulePolling]);

  if (state === "online" || dismissed) {return null;}

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
  }[state];

  const Icon = config.icon;

  return (
    <div
      className={cn("flex items-center justify-between px-4 py-2 border-b text-sm", config.bg, className)}
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
