/**
 * Return a shallow copy of `obj` with all own enumerable keys whose value
 * is `undefined` removed. Falsy values that are NOT `undefined` (0, false,
 * empty string, null) are preserved.
 *
 * Use this at the Drizzle update boundary: `.set({ col: undefined })`
 * semantics are version-dependent (older versions skip the key, newer
 * versions write SQL `NULL`), so stripping undefined keys before `.set`
 * keeps partial updates safe across Drizzle releases.
 *
 * The generic is widened to `T extends object` (rather than the narrower
 * `Record<string, unknown>`) so the helper accepts `Partial<InsertX>`
 * shapes without forcing callers to add a cast at every call site.
 */
export function stripUndefined<T extends object>(obj: T): T {
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}
