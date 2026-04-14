/**
 * Briefing Landing — Role-Based Redirect
 *
 * Redirects returning users to their role's landing page.
 * Does NOT redirect on initial role selection — the user should see their
 * customized home page first, then get redirected on subsequent visits.
 *
 * The session flag (sessionStorage) distinguishes "just picked a role" from
 * "returning user who already has a role." sessionStorage clears on tab close,
 * so the next time they open ARUS, the redirect fires.
 */

const ROLE_LANDING: Record<string, string> = {
  chief_engineer: "/briefing",
  deck_officer: "/briefing",
  fleet_manager: "/dashboard",
  system_admin: "/system",
};

const STORAGE_KEY = "arus-user-role";
const REDIRECT_DISABLED_KEY = "arus-landing-redirect-disabled";
/** Set in sessionStorage when a role is picked this session — suppresses redirect once */
const JUST_SELECTED_KEY = "arus-role-just-selected";

/**
 * Returns the landing page URL for the current role, or null if no redirect
 * should happen. Returns null when:
 *   - No role is set (first visit)
 *   - Role is "default" (skipped selection)
 *   - User disabled redirects
 *   - Role was just selected this session (let them see the home page first)
 */
export function getBriefingRedirect(): string | null {
  if (typeof window === "undefined") return null;

  if (localStorage.getItem(REDIRECT_DISABLED_KEY) === "true") return null;

  const role = localStorage.getItem(STORAGE_KEY);
  if (!role || role === "default") return null;

  // Don't redirect if the user just picked this role — let them see the home page
  if (sessionStorage.getItem(JUST_SELECTED_KEY) === "true") {
    return null;
  }

  return ROLE_LANDING[role] || null;
}

/**
 * Call this when a role is selected to suppress the redirect for this session.
 * On the next visit (new tab/session), the redirect will fire normally.
 */
export function markRoleJustSelected(): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(JUST_SELECTED_KEY, "true");
  }
}

/**
 * Clear the "just selected" flag. Called when the user navigates away from
 * the home page, so that if they return to "/" later in the same session,
 * the redirect fires.
 */
export function clearRoleJustSelected(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(JUST_SELECTED_KEY);
  }
}

export function isVesselRole(): boolean {
  const role = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return ["chief_engineer", "deck_officer"].includes(role || "");
}

export function disableLandingRedirect(): void {
  localStorage.setItem(REDIRECT_DISABLED_KEY, "true");
}

export function enableLandingRedirect(): void {
  localStorage.removeItem(REDIRECT_DISABLED_KEY);
}
