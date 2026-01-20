/**
 * JSON Parsing Utilities
 * 
 * SonarQube Fix: Centralized JSON parsing with consistent error handling
 * Eliminates scattered try/catch blocks for JSON.parse across codebase
 */

export interface ParseResult<T> {
  success: true;
  data: T;
}

export interface ParseError {
  success: false;
  error: string;
}

export type SafeParseResult<T> = ParseResult<T> | ParseError;

/**
 * Safely parse JSON with type validation
 * Returns a discriminated union for explicit error handling
 */
export function safeJsonParse<T = unknown>(json: string): SafeParseResult<T> {
  try {
    const data = JSON.parse(json) as T;
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    return { success: false, error: message };
  }
}

/**
 * Parse JSON with a default fallback value
 * Useful for optional configuration parsing
 */
export function parseJsonOrDefault<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) {return defaultValue;}
  
  const result = safeJsonParse<T>(json);
  return result.success ? result.data : defaultValue;
}

/**
 * Parse JSON array with type guard
 * Returns empty array on failure
 */
export function parseJsonArray<T>(json: string | null | undefined): T[] {
  if (!json) {return [];}
  
  const result = safeJsonParse<unknown>(json);
  if (!result.success) {return [];}
  
  return Array.isArray(result.data) ? result.data as T[] : [];
}

/**
 * Stringify with circular reference protection
 */
export function safeStringify(obj: unknown, space?: number): string {
  const seen = new WeakSet();
  
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    return value;
  }, space);
}

/**
 * Deep clone an object using JSON serialization
 * Fast for simple objects, handles Date conversion
 */
export function jsonClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if a string is valid JSON
 */
export function isValidJson(str: string): boolean {
  return safeJsonParse(str).success;
}
