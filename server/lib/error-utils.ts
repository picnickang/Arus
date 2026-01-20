/**
 * Error Handling Utilities
 * Provides type-safe error message extraction and formatting
 */

/**
 * Safely extract error message from unknown error types
 * Handles Error objects, strings, and other types
 *
 * @param error - Unknown error value
 * @returns Safe error message string
 */
export function toErr(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  // For objects, try to extract message property or stringify
  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    return JSON.stringify(error);
  }

  return String(error);
}

/**
 * Safely parse date values from unknown types
 * Handles Date objects, strings, numbers, and invalid values
 *
 * @param value - Unknown date value
 * @returns Date object, or Invalid Date if parsing fails
 */
export function asDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }

  return new Date(String(value ?? ""));
}

/**
 * Type-safe severity levels for data integrity issues
 */
export type Severity = "low" | "medium" | "high" | "critical";

/**
 * Severity level constants to avoid typos
 */
export const severity = {
  low: "low" as Severity,
  medium: "medium" as Severity,
  high: "high" as Severity,
  critical: "critical" as Severity,
} as const;
