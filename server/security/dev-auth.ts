/**
 * Dev auth bypass — shared gate.
 *
 * In development the app can run without a real login so the preview is usable
 * before anyone signs in. This convenience is OPT-OUT: it is ON by default in
 * development and turned off by setting `DEV_AUTH_BYPASS=0`. It NEVER applies in
 * production, and it must never override a real authenticated session — callers
 * fall back to the dev identity ONLY when there is no real user.
 */

/** Stable id of the synthetic dev-bypass admin (no real DB row). */
export const DEV_BYPASS_USER_ID = "dev-admin-user";

/** True when the no-login dev convenience is allowed for this process. */
export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env["NODE_ENV"] === "development" &&
    process.env["DEV_AUTH_BYPASS"] !== "0"
  );
}

/** True when the resolved user id is the synthetic dev-bypass identity. */
export function isDevBypassUser(userId: string | null | undefined): boolean {
  return userId === DEV_BYPASS_USER_ID;
}
