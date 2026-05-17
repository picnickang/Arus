// @ts-nocheck
interface ErrorContext {
  url?: string;
  userAgent?: string;
  timestamp?: string;
  [key: string]: string | number | undefined;
}

let isInitialized = false;

async function logErrorToBackend(
  severity: "info" | "warning" | "error" | "critical",
  category: "frontend" | "backend" | "api" | "database" | "security" | "performance",
  message: string,
  stackTrace?: string,
  context?: ErrorContext,
  errorCode?: string
) {
  try {
    await fetch("/api/error-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-org-id": "default-org-id",
      },
      body: JSON.stringify({
        orgId: "default-org-id",
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
        const url = typeof args[0] === "string" ? args[0] : args[0].url;
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
      const errMsg = (error as Error).message || "";
      if (errMsg === "Load failed" || errMsg === "Failed to fetch") {
        throw error;
      }
      const url = typeof args[0] === "string" ? args[0] : args[0].url;
      logErrorToBackend(
        "error",
        "api",
        `Network Error: ${errMsg}`,
        (error as Error).stack,
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
