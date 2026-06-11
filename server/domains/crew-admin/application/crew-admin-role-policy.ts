import { ADMIN_CAPABLE_ROLE_KEYS, PROTECTED_ROLE_KEYS } from "@shared/role-dashboard";
import { CrewAdminError } from "./crew-admin-errors.js";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const OFFBOARDING_SAFE_ROLE = "viewer";

const BASE_ROLE_NAMES = ["admin", "manager", "technician", "viewer"] as const;

export function isProtectedRoleName(name: string): boolean {
  return (PROTECTED_ROLE_KEYS as readonly string[]).includes(name);
}

export function isAdminCapableRole(name: string): boolean {
  return (ADMIN_CAPABLE_ROLE_KEYS as readonly string[]).includes(name);
}

export function isBuiltinRoleName(name: string): boolean {
  return (
    isProtectedRoleName(name) ||
    isAdminCapableRole(name) ||
    (BASE_ROLE_NAMES as readonly string[]).includes(name)
  );
}

export function humanizeRoleName(name: string): string {
  return name
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new CrewAdminError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      "PASSWORD_TOO_SHORT"
    );
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new CrewAdminError(
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
      "PASSWORD_TOO_LONG"
    );
  }
  if (/[\r\n\0]/.test(password)) {
    throw new CrewAdminError("Password contains invalid characters", "INVALID_CHARACTERS");
  }
}
