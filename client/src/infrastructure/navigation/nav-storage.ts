/**
 * Navigation storage adapter (follow-up #194).
 *
 * Single, typed door to the localStorage keys the navigation policy
 * reads: the role hint (`arus-user-role`) and the per-user BottomNav
 * category override (`arus-bottom-nav-items`).
 *
 * Why this exists
 * ---------------
 * Before this module, BottomNav, SwitchPortalButton, and PortalLogin
 * each duplicated their own `try { localStorage.getItem(...) }` /
 * `JSON.parse` / `Array.isArray` checks against the same two keys.
 * Three of those call sites also held a *magic-string* copy of the
 * key. That is exactly the shape that produces override-leak bugs:
 * one site forgets to clear on portal switch, or accepts a value the
 * others would have rejected, and stale admin-portal nav follows the
 * user into the user portal on next reload.
 *
 * Contract
 * --------
 *   - All access to the two nav storage keys MUST go through this
 *     module. The keys themselves are still exported from
 *     `@/config/roles` for backwards compatibility (BottomNav imports
 *     them as a regression sentinel + the test suite pins them), but
 *     new code should not call `localStorage` directly for these
 *     keys — call `readUserRole` / `writeUserRole` / `readNavOverride`
 *     / `writeNavOverride` / `clearNavOverride` / `clearAllPortalState`.
 *   - The adapter is `try/catch` everywhere: SSR, private mode, or a
 *     hostile policy that throws on access must never crash a render.
 *     Reads return `null`, writes/clears silently no-op.
 *   - The override reader validates the parsed JSON is a `string[]`
 *     and returns `null` for any other shape — corrupted/tampered
 *     values cannot reach the navigation layer.
 *   - This module is pure infrastructure: no policy decisions, no
 *     role->category mapping, no React. The policy layer
 *     (`application/navigation/role-navigation-policy.ts`) remains
 *     the single source of truth for what a role may see.
 */

import {
  ROLE_STORAGE_KEY,
  BOTTOM_NAV_OVERRIDE_STORAGE_KEY,
} from "@/config/roles";

/** Read the persisted role hint, or `null` if absent / storage unavailable. */
export function readUserRole(): string | null {
  try {
    return localStorage.getItem(ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Persist the role hint. Silently no-ops if storage is unavailable. */
export function writeUserRole(role: string): void {
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  } catch {
    /* storage unavailable — policy will fall back to default */
  }
}

/** Remove the persisted role hint. */
export function clearUserRole(): void {
  try {
    localStorage.removeItem(ROLE_STORAGE_KEY);
  } catch {
    /* storage unavailable — nothing to clean up */
  }
}

/**
 * Read the persisted BottomNav category-id override.
 *
 * Returns `null` if:
 *   - storage is unavailable,
 *   - the key is unset,
 *   - the stored value is not valid JSON, or
 *   - the parsed value is not a `string[]` (defensive against
 *     tampered or older-shape values).
 *
 * Callers MUST still pass the result through
 * `intersectOverrideWithPolicy` before rendering — this reader is
 * not an authority check, only a shape check.
 */
export function readNavOverride(): string[] | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(BOTTOM_NAV_OVERRIDE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((v): v is string => typeof v === "string")
    ) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Persist the BottomNav override id list. Pass an empty array (or
 * call `clearNavOverride`) to remove the override entirely; we
 * normalise both cases to a single `removeItem` so a subsequent
 * `readNavOverride` returns `null` rather than `[]` (the policy
 * default branch keys on `null`/`length === 0` identically, but
 * removing the key keeps storage tidy and prevents an empty array
 * from being interpreted as "user explicitly cleared" by future
 * surfaces).
 */
export function writeNavOverride(ids: readonly string[]): void {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(BOTTOM_NAV_OVERRIDE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      BOTTOM_NAV_OVERRIDE_STORAGE_KEY,
      JSON.stringify([...ids]),
    );
  } catch {
    /* storage unavailable — override is best-effort personalisation */
  }
}

/** Remove the BottomNav override. */
export function clearNavOverride(): void {
  try {
    localStorage.removeItem(BOTTOM_NAV_OVERRIDE_STORAGE_KEY);
  } catch {
    /* storage unavailable — nothing to clean up */
  }
}

/**
 * Clear every nav-related storage key in one call.
 *
 * Used by the Switch Portal affordance so the user is guaranteed to
 * land on the next portal's policy default with no carry-over from
 * the previous role. Centralising the list here means future keys
 * (e.g. a persisted portal selection, sidebar collapse state) only
 * need to be added in one place to participate in the switch reset.
 */
export function clearAllPortalState(): void {
  clearUserRole();
  clearNavOverride();
}
