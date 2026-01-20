/**
 * Safe Operation Wrappers
 */

import { circuitBreaker } from "./circuit-breaker";
import { withRetry, withTimeout } from "./retry-utils";
import { ERROR_HANDLING_CONFIG } from "./types";

export async function safeDbOperation<T>(operation: () => Promise<T>, operationName: string, fallback?: () => Promise<T>): Promise<T> {
  return circuitBreaker.execute(
    "database",
    () => withTimeout(() => withRetry(operation, `db_${operationName}`), ERROR_HANDLING_CONFIG.TIMEOUT.DATABASE_MS, `db_${operationName}`),
    fallback
  );
}

export async function safeExternalOperation<T>(serviceName: string, operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
  return circuitBreaker.execute(
    serviceName,
    () => withTimeout(operation, ERROR_HANDLING_CONFIG.TIMEOUT.EXTERNAL_API_MS, serviceName),
    fallback
  );
}
