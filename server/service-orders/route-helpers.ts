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
  // Build the result via Object.fromEntries rather than a dynamic
  // `result[k] = …` write: the latter is a property-injection sink when the
  // key derives from a request body (CodeQL js/remote-property-injection).
  // fromEntries also defines own properties, so a "__proto__" key cannot
  // walk the prototype chain — we still drop it (and constructor/prototype)
  // to preserve the prior filtering behaviour exactly.
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => k !== "__proto__" && k !== "constructor" && k !== "prototype")
      .map(([k, v]) => [k, v === "" ? null : v])
  );
};
