/**
 * Database Type Utilities
 * 
 * SonarQube S4204/S4325 compliant type helpers for database operations.
 * Replaces `as any` casts with proper type extraction.
 */

/** Database delete/update result with rowsAffected */
export interface DbMutationResult {
  rowsAffected?: number;
  rowCount?: number;
}

/**
 * Extract rows affected from a database mutation result.
 * Works with both Drizzle and raw query results.
 */
export function getRowsAffected(result: unknown): number {
  if (result === null || result === undefined) {
    return 0;
  }
  
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    
    if (typeof obj.rowsAffected === 'number') {
      return obj.rowsAffected;
    }
    
    if (typeof obj.rowCount === 'number') {
      return obj.rowCount;
    }
    
    if (Array.isArray(result)) {
      return result.length;
    }
  }
  
  return 0;
}

/**
 * Extract error code from unknown error (for Node.js filesystem/database errors).
 * SonarQube S4204 compliant replacement for `(error as any).code`.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof Error && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Extract error message from unknown error.
 * SonarQube S4204 compliant replacement for `error.message`.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Safely access a property from a potentially untyped object.
 * Use when database schema doesn't include all runtime properties.
 */
export function getOptionalProperty<T>(obj: unknown, key: string, defaultValue: T): T {
  if (obj !== null && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key] as T;
  }
  return defaultValue;
}

/**
 * Type guard for objects with specific property.
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return obj !== null && typeof obj === 'object' && key in obj;
}

/**
 * Generic JSON object type for database JSONB columns.
 * Use instead of `any` for hyperparameters, metrics, and other JSON data.
 */
export type JsonObject = Record<string, unknown>;

/**
 * Safely cast JSONB column to JsonObject.
 */
export function asJsonObject(value: unknown): JsonObject {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

/**
 * Get a number property from a JSON object with a default value.
 */
export function getJsonNumber(obj: JsonObject | null | undefined, key: string, defaultValue: number = 0): number {
  if (!obj) return defaultValue;
  const value = obj[key];
  return typeof value === 'number' ? value : defaultValue;
}

/**
 * Get a string property from a JSON object with a default value.
 */
export function getJsonString(obj: JsonObject | null | undefined, key: string, defaultValue: string = ''): string {
  if (!obj) return defaultValue;
  const value = obj[key];
  return typeof value === 'string' ? value : defaultValue;
}
