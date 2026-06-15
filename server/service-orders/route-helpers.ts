/**
 * Service Order Route Helpers
 *
 * Pure input-normalization / sanitization helpers extracted from `routes.ts`.
 * These have no dependency on Express request types or domain wiring, so they
 * live here to keep the route module focused on handlers.
 */

export function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function headerString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Improvement #20: maps empty strings to null (not undefined).
 * Previously empty strings became undefined, which Drizzle ORM treats as
 * "do not update this column", so clearing a text field had no effect.
 * null explicitly sets the column to NULL in the database.
 */
export const sanitize = (obj: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") {
      continue;
    }
    result[k] = v === "" ? null : v;
  }
  return result;
};
