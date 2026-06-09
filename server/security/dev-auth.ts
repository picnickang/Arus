/**
 * Temporary dev-login identity helpers.
 *
 * The old no-token development admin fallback has been removed. Development
 * superuser access now requires an explicit temporary dev-login token minted by
 * `/api/portal/dev-login`, which keeps the backdoor modular and deletable.
 */
import { isDevLoginEnabled } from "./dev-login/config";

/** Stable id of the synthetic dev-login superuser (no real DB row). */
export const DEV_BYPASS_USER_ID = "dev-admin-user";

/** Legacy name retained for permission code that recognizes the dev superuser. */
export function isDevAuthBypassEnabled(): boolean {
  return isDevLoginEnabled();
}

/** True when the resolved user id is the synthetic dev-login superuser. */
export function isDevBypassUser(userId: string | null | undefined): boolean {
  return userId === DEV_BYPASS_USER_ID;
}
