import { createHeaders } from "@/lib/queryClient";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";

interface ErrorContext {
  url?: string;
  userAgent?: string;
  timestamp?: string;
  [key: string]: string | number | undefined;
}

let isInitialized = false;

/**
 * Failures of these endpoints must never be reported back through them —
 * a 5xx from /api/error-logs would otherwise re-trigger the reporter forever.
 */
const SELF_LOG_URL_PATTERNS = ["/api/error-logs", "/api/observability/"];

function isSelfLogUrl(url: string): boolean {
  return SELF_LOG_URL_PATTERNS.some((pattern) => url.includes(pattern));
}

// Token bucket: at most 10 reports per minute, and never the same message
// twice within 30s — an error loop should degrade to console noise, not
// a request storm.
const MAX_REPORTS_PER_MINUTE = 10;
let reportTimestamps: number[] = [];
let lastReportKey = "";
let lastReportAt = 0;

function shouldReport(message: string): boolean {
  const now = Date.now();
  reportTimestamps = reportTimestamps.filter((t) => now - t < 60_000);
  if (reportTimestamps.length >= MAX_REPORTS_PER_MINUTE) {
    return false;
  }
  if (message === lastReportKey && now - lastReportAt < 30_000) {
    return false;
  }
  reportTimestamps.push(now);
  lastReportKey = message;
  lastReportAt = now;
  return true;
}

async function logErrorToBackend(
  severity: "info" | "warning" | "error" | "critical",
  category: "frontend" | "backend" | "api" | "database" | "security" | "performance",
  message: string,
  stackTrace?: string,
  context?: ErrorContext,
  errorCode?: string
) {
  if (!shouldReport(message)) {
    return;
  }
  try {
    await fetch("/api/error-logs", {
      method: "POST",
      headers: createHeaders(true),
      body: JSON.stringify({
        orgId: getCurrentOrgId() || "default-org-id",
        severity,
        category,
        message,
        stackTrace,
        context: {
          ...context,
          url: globalThis.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
        errorCode,
      }),
    });
  } catch (error) {
    console.error("Failed to log error to backend:", error);
  }
}

export function initializeGlobalErrorHandlers() {
  // Prevent duplicate initialization in React StrictMode
  if (isInitialized) {
    console.info("Global error handlers already initialized, skipping");
    return;
  }
  isInitialized = true;

  globalThis.addEventListener("error", (event) => {
    const { message, filename, lineno, colno, error } = event;

    logErrorToBackend(
      "error",
      "frontend",
      message,
      error?.stack,
      {
        filename,
        line: lineno,
        column: colno,
      },
      error?.name
    );
  });

  globalThis.addEventListener("unhandledrejection", (event) => {
    const error = event.reason;
    const message = error?.message || String(event.reason);

    // Suppress harmless Vite HMR WebSocket errors in development
    if (
      import.meta.env.DEV &&
      (message.includes("The string did not match the expected pattern") ||
        message.includes("WebSocket") ||
        error?.stack?.includes("@vite/client"))
    ) {
      event.preventDefault();
      return;
    }

    logErrorToBackend(
      "error",
      "frontend",
      `Unhandled Promise Rejection: ${message}`,
      error?.stack,
      {
        reason: String(event.reason),
      },
      "UnhandledPromiseRejection"
    );
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);

      if (!response.ok && response.status >= 500) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as { url: string }).url;
        if (isSelfLogUrl(url)) {
          return response;
        }
        logErrorToBackend(
          "error",
          "api",
          `API Error: ${response.status} ${response.statusText}`,
          undefined,
          {
            url,
            status: response.status,
            statusText: response.statusText,
            method: typeof args[1] === "object" ? args[1]?.method : "GET",
          },
          `HTTP_${response.status}`
        );
      }

      return response;
    } catch (error) {
      const errMsg = ((error instanceof Error ? error.message : String(error))) || "";
      if (errMsg === "Load failed" || errMsg === "Failed to fetch") {
        throw error;
      }
      const url = typeof args[0] === "string" ? args[0] : (args[0] as { url: string }).url;
      if (isSelfLogUrl(url)) {
        throw error;
      }
      logErrorToBackend(
        "error",
        "api",
        `Network Error: ${errMsg}`,
        ((error instanceof Error ? error.stack : undefined)),
        {
          url,
          method: typeof args[1] === "object" ? args[1]?.method : "GET",
        },
        "NetworkError"
      );
      throw error;
    }
  };

  console.info("Global error handlers initialized");
}

export function logPerformanceWarning(message: string, duration: number) {
  if (duration > 3000) {
    logErrorToBackend("warning", "performance", message, undefined, { duration }, "SlowOperation");
  }
}

export function logSecurityEvent(message: string, context?: ErrorContext) {
  logErrorToBackend("warning", "security", message, undefined, context, "SecurityEvent");
}
