import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, ArrowLeft, AlertCircle } from "lucide-react";
import { useEffect, useMemo } from "react";

export interface NormalizedError {
  code?: string | undefined;
  title?: string | undefined;
  message: string;
  details?: string | undefined;
  statusCode?: number | undefined;
}

interface ErrorStateProps {
  error: NormalizedError | Error | string;
  title?: string;
  onRetry?: () => void | Promise<void>;
  onBack?: () => void;
  variant?: "inline" | "page";
  className?: string;
  showDetails?: boolean;
  logToBackend?: boolean; // Optional backend logging (default: true)
}

export function ErrorState({
  error,
  onRetry,
  onBack,
  variant = "inline",
  className = "",
  showDetails = true,
  logToBackend = false, // Default to false to minimize network churn
}: ErrorStateProps) {
  // Memoize normalized error to prevent re-renders from triggering repeated logging
  const normalizedError = useMemo(() => normalizeError(error), [error]);

  // Log error to backend (optional, with guard) - only once per unique error
  useEffect(() => {
    if (logToBackend) {
      logErrorToBackend(normalizedError).catch((err) => {
        // Silent fail - don't cascade errors
        console.warn("Failed to log error to backend:", err);
      });
    }
  }, [normalizedError, logToBackend]);

  if (variant === "page") {
    return (
      <div className={`min-h-[400px] flex items-center justify-center p-8 ${className}`}>
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold" data-testid="error-title">
              {normalizedError.title || "Something went wrong"}
            </h2>
            <p className="text-muted-foreground" data-testid="error-message">
              {normalizedError.message}
            </p>
            {showDetails && normalizedError.details && (
              <details className="text-left mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Error Details
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-40">
                  {normalizedError.details}
                </pre>
              </details>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            {onRetry && (
              <Button onClick={onRetry} data-testid="button-retry">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            {onBack && (
              <Button variant="outline" onClick={onBack} data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Inline variant
  const isServerError = normalizedError.statusCode && normalizedError.statusCode >= 500;
  const Icon = isServerError ? AlertTriangle : AlertCircle;

  return (
    <Alert variant="destructive" className={className} data-testid="error-state-inline">
      <Icon className="h-4 w-4" />
      <AlertTitle>{normalizedError.title || "Error"}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{normalizedError.message}</p>
        {showDetails && normalizedError.details && (
          <details className="text-xs">
            <summary className="cursor-pointer hover:underline">Show details</summary>
            <pre className="mt-2 p-2 bg-background/50 rounded overflow-auto max-h-32">
              {normalizedError.details}
            </pre>
          </details>
        )}
        {(onRetry || onBack) && (
          <div className="flex gap-2 mt-3">
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="bg-background"
                data-testid="button-retry-inline"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-inline">
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

function normalizeError(error: NormalizedError | Error | string): NormalizedError {
  if (typeof error === "string") {
    return {
      message: error,
      title: "Error",
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      title: error.name,
      details: error.stack,
    };
  }

  return error;
}

async function logErrorToBackend(error: NormalizedError): Promise<void> {
  // Guard against cascading errors with timeout and error handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch("/api/error-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-org-id": "default-org-id",
      },
      body: JSON.stringify({
        orgId: "default-org-id",
        severity: "error",
        category: "frontend",
        message: `${error.title || "Error"}: ${error.message}`,
        stackTrace: error.details || null,
        context: {
          code: error.code,
          statusCode: error.statusCode,
          url: globalThis.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
        errorCode: error.code || "UNKNOWN_ERROR",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Don't throw on non-2xx responses, just log
    if (!response.ok) {
      console.warn(`Error logging failed with status: ${response.status}`);
    }
  } catch (logError) {
    clearTimeout(timeoutId);
    // Only log to console, don't throw to prevent cascading errors
    if (logError instanceof Error && logError.name !== "AbortError") {
      console.warn("Failed to log error to backend:", logError.message);
    }
  }
}
