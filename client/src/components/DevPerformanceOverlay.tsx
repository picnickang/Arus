import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { X, Activity, Timer, RefreshCw, MemoryStick, ChevronDown, ChevronUp } from "lucide-react";
import { getPerfSummary, isPerfDebugEnabled, setPerfDebug } from "@/utils/perfLog";
import { useLocation } from "wouter";

interface ApiLatency {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
}

interface RouteNavigation {
  from: string;
  to: string;
  duration: number;
  timestamp: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

declare global {
  interface Performance {
    memory?: MemoryInfo;
  }
  interface Window {
    __devPerfOriginalFetch?: typeof fetch;
    __devPerfInterceptorInstalled?: boolean;
  }
}

const API_HISTORY_LIMIT = 20;
const ROUTE_HISTORY_LIMIT = 10;

const WRAPPER_SYMBOL = Symbol.for("__devPerfFetchWrapper");

const apiLatenciesRef: { current: ApiLatency[] } = { current: [] };
let apiLatencyListeners: ((latencies: ApiLatency[]) => void)[] = [];

function notifyApiLatencyListeners() {
  apiLatencyListeners.forEach((listener) => listener([...apiLatenciesRef.current]));
}

function addApiLatency(latency: ApiLatency) {
  apiLatenciesRef.current = [latency, ...apiLatenciesRef.current].slice(0, API_HISTORY_LIMIT);
  notifyApiLatencyListeners();
}

export const FETCH_WRAPPER_SYMBOL = Symbol.for("__devPerfFetchWrapper");

export function installFetchInterceptor(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }

  if (window.__devPerfInterceptorInstalled) {
    return false;
  }

  const currentFetch = window.fetch;
  if ((currentFetch as object as Record<symbol, boolean>)[FETCH_WRAPPER_SYMBOL]) {
    return false;
  }

  window.__devPerfOriginalFetch = currentFetch;
  window.__devPerfInterceptorInstalled = true;

  const wrappedFetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const originalFetch = window.__devPerfOriginalFetch!;

    // Wrap ENTIRE interceptor logic in try/catch - if anything fails, just call original fetch
    try {
      let url: string | undefined;
      try {
        const input = args[0];
        if (typeof input === "string") {
          url = input;
        } else if (input instanceof Request) {
          url = input.url;
        } else if (input instanceof URL) {
          url = input.toString();
        } else if (input && typeof input === "object" && "toString" in input) {
          url = String(input);
        }
      } catch {
        // URL extraction failed - just pass through to original fetch
        return originalFetch.apply(window, args);
      }

      // Skip non-API calls
      if (!url || typeof url !== "string" || !url.includes("/api/")) {
        return originalFetch.apply(window, args);
      }

      const method = (args[1]?.method || "GET").toUpperCase();
      const start = performance.now();

      try {
        const response = await originalFetch.apply(window, args);
        const duration = performance.now() - start;

        try {
          const endpoint = url.replace(/^https?:\/\/[^/]+/, "");
          addApiLatency({
            endpoint,
            method,
            duration,
            status: response.status,
            timestamp: Date.now(),
          });
        } catch {
          // Latency tracking failed - don't block the response
        }

        return response;
      } catch (error) {
        const duration = performance.now() - start;

        try {
          const endpoint = url.replace(/^https?:\/\/[^/]+/, "");
          addApiLatency({ endpoint, method, duration, status: 0, timestamp: Date.now() });
        } catch {
          // Latency tracking failed - don't block the error
        }

        throw error;
      }
    } catch (interceptorError) {
      // If ANY part of the interceptor fails, fall back to original fetch
      // This ensures the interceptor never breaks the application
      console.warn(
        "[DevPerformanceOverlay] Fetch interceptor error, falling back:",
        interceptorError
      );
      return originalFetch.apply(window, args);
    }
  };

  (wrappedFetch as object as Record<symbol, boolean>)[FETCH_WRAPPER_SYMBOL] = true;
  window.fetch = wrappedFetch;
  return true;
}

export function uninstallFetchInterceptor(): void {
  if (!import.meta.env.DEV) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }

  if (window.__devPerfOriginalFetch) {
    window.fetch = window.__devPerfOriginalFetch;
    window.__devPerfOriginalFetch = undefined;
    window.__devPerfInterceptorInstalled = false;
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    uninstallFetchInterceptor();
  });
}

export function DevPerformanceOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [apiLatencies, setApiLatencies] = useState<ApiLatency[]>([]);
  const [routeNavigations, setRouteNavigations] = useState<RouteNavigation[]>([]);
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [renderCounts, setRenderCounts] = useState<Record<string, number>>({});
  const [location] = useLocation();
  const lastLocationRef = useRef(location);
  const navigationStartRef = useRef(performance.now());

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (!isDev) {
      return;
    }

    installFetchInterceptor();

    const listener = (latencies: ApiLatency[]) => setApiLatencies(latencies);
    apiLatencyListeners.push(listener);

    setApiLatencies([...apiLatenciesRef.current]);

    return () => {
      apiLatencyListeners = apiLatencyListeners.filter((l) => l !== listener);
    };
  }, [isDev]);

  useEffect(() => {
    if (!isDev) {
      return;
    }
    if (lastLocationRef.current !== location) {
      const duration = performance.now() - navigationStartRef.current;

      setRouteNavigations((prev) => {
        return [
          { from: lastLocationRef.current, to: location, duration, timestamp: Date.now() },
          ...prev,
        ].slice(0, ROUTE_HISTORY_LIMIT);
      });

      lastLocationRef.current = location;
    }
    navigationStartRef.current = performance.now();
  }, [location, isDev]);

  useEffect(() => {
    if (!isDev || !isVisible) {
      return;
    }

    const updateMemory = () => {
      if (performance.memory) {
        setMemoryInfo({
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        });
      }
    };

    const updateRenderCounts = () => {
      const summary = getPerfSummary();
      setRenderCounts(summary.renderCounts);
    };

    updateMemory();
    updateRenderCounts();

    const interval = setInterval(() => {
      updateMemory();
      updateRenderCounts();
    }, 2000);

    return () => clearInterval(interval);
  }, [isVisible]);

  useEffect(() => {
    if (!isDev) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setIsVisible((prev) => !prev);
        if (!isPerfDebugEnabled()) {
          setPerfDebug(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDev]);

  if (!isDev) {
    return null;
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) {
      return "0 B";
    }
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1) {
      return "<1ms";
    }
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getLatencyColor = (ms: number) => {
    if (ms < 100) {
      return "text-green-600 dark:text-green-400";
    }
    if (ms < 300) {
      return "text-yellow-600 dark:text-yellow-400";
    }
    return "text-red-600 dark:text-red-400";
  };

  const avgApiLatency =
    apiLatencies.length > 0
      ? apiLatencies.reduce((sum, a) => sum + a.duration, 0) / apiLatencies.length
      : 0;

  const avgRouteTime =
    routeNavigations.length > 0
      ? routeNavigations.reduce((sum, r) => sum + r.duration, 0) / routeNavigations.length
      : 0;

  const topRenderCounts = Object.entries(renderCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!isVisible) {
    return (
      <div className="fixed bottom-20 md:bottom-4 right-4 z-50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsVisible(true)}
          className="opacity-50 hover:opacity-100 text-xs"
          data-testid="button-show-perf-overlay"
        >
          <Activity className="h-3 w-3 mr-1" />
          Perf
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 w-80 max-h-[80vh] overflow-hidden">
      <Card className="bg-background/95 backdrop-blur border shadow-lg">
        <div className="p-2 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Dev Performance</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid="button-toggle-perf-expanded"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setIsVisible(false)}
              data-testid="button-close-perf-overlay"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Timer className="h-3 w-3" />
                  <span>Avg API</span>
                </div>
                <span className={`font-mono font-medium ${getLatencyColor(avgApiLatency)}`}>
                  {formatDuration(avgApiLatency)}
                </span>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <RefreshCw className="h-3 w-3" />
                  <span>Avg Route</span>
                </div>
                <span className={`font-mono font-medium ${getLatencyColor(avgRouteTime)}`}>
                  {formatDuration(avgRouteTime)}
                </span>
              </div>
            </div>

            {memoryInfo && (
              <div className="p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <MemoryStick className="h-3 w-3" />
                  <span>JS Heap Memory</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono">
                    {formatBytes(memoryInfo.usedJSHeapSize)} /{" "}
                    {formatBytes(memoryInfo.totalJSHeapSize)}
                  </span>
                  <span className="text-muted-foreground">
                    ({Math.round((memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100)}%)
                  </span>
                </div>
              </div>
            )}

            {topRenderCounts.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">Top Render Counts</div>
                <div className="space-y-1">
                  {topRenderCounts.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="truncate max-w-[180px]">{name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {apiLatencies.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">Recent API Calls</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {apiLatencies.slice(0, 8).map((api, i) => (
                    <div key={i} className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <Badge variant="outline" className="text-[10px] px-1 shrink-0">
                          {api.method}
                        </Badge>
                        <span className="truncate text-muted-foreground max-w-[120px]">
                          {api.endpoint.replace("/api/", "")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`font-mono ${getLatencyColor(api.duration)}`}>
                          {formatDuration(api.duration)}
                        </span>
                        <Badge
                          variant={
                            api.status >= 200 && api.status < 300 ? "default" : "destructive"
                          }
                          className="text-[10px] px-1"
                        >
                          {api.status || "ERR"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {routeNavigations.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">Route Navigations</div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {routeNavigations.slice(0, 5).map((nav, i) => (
                    <div key={i} className="flex items-center justify-between gap-1">
                      <span className="truncate max-w-[180px] text-muted-foreground">{nav.to}</span>
                      <span className={`font-mono shrink-0 ${getLatencyColor(nav.duration)}`}>
                        {formatDuration(nav.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t text-muted-foreground text-center">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+Shift+P</kbd> to
              toggle
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
