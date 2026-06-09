import type { DevUserRole } from "./roles";

const DEV_LOGIN_SESSION_KEY = "arus-dev-login-session";

export type DevLoginClientSession = { persona: "admin" } | { persona: "user"; role: DevUserRole };

export function isDevLoginClientEnabled(): boolean {
  if (import.meta.env.PROD) {
    return false;
  }
  if (import.meta.env["VITE_ARUS_DEV_LOGIN"] === "0") {
    return false;
  }
  return import.meta.env.DEV === true || import.meta.env["VITE_ARUS_DEV_LOGIN"] === "1";
}

export function readDevLoginSession(): DevLoginClientSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(DEV_LOGIN_SESSION_KEY);
    return raw ? (JSON.parse(raw) as DevLoginClientSession) : null;
  } catch {
    return null;
  }
}

export function writeDevLoginSession(session: DevLoginClientSession): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(DEV_LOGIN_SESSION_KEY, JSON.stringify(session));
}

export function clearDevLoginSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.removeItem(DEV_LOGIN_SESSION_KEY);
}
