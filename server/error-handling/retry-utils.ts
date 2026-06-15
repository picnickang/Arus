/**
 * Retry and Timeout Utilities
 */

import { structuredLog } from "../logging";
import { AppError, ERROR_HANDLING_CONFIG } from "./types";

export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts: number = ERROR_HANDLING_CONFIG.RETRY.MAX_ATTEMPTS
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        structuredLog("info", `${operationName} succeeded after ${attempt} attempts`);
      }
      return result;
    } catch (err) {
      lastError = err as Error;

      if (attempt === maxAttempts) {
        structuredLog("error", `${operationName} failed after ${maxAttempts} attempts`, {
          operation: "retry_failed",
          metadata: { attempts: maxAttempts, operationName },
        });
        break;
      }

      const delay = Math.min(
        ERROR_HANDLING_CONFIG.RETRY.BASE_DELAY_MS *
          Math.pow(ERROR_HANDLING_CONFIG.RETRY.BACKOFF_MULTIPLIER, attempt - 1),
        ERROR_HANDLING_CONFIG.RETRY.MAX_DELAY_MS
      );
      structuredLog(
        "warn",
        `${operationName} failed, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError!;
}

export function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AppError(
          `Operation ${operationName} timed out after ${timeoutMs}ms`,
          408,
          "TIMEOUT_ERROR",
          { timeoutMs, operationName }
        )
      );
    }, timeoutMs);
  });
  // Clear the timer once the race settles so a fast-completing operation does
  // not leave a pending timeout firing (and keeping the event loop alive).
  return Promise.race([operation(), timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}
