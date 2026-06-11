import { ReactNode, useSyncExternalStore } from "react";
import { Redirect, useLocation } from "wouter";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { getApiSessionToken, subscribeToApiSessionToken } from "@/lib/sessionToken";

/**
 * Routes that must render even when there is no active session. The
 * portal-login split is the entry point for an unauthenticated user, so
 * it would defeat the purpose to redirect it back to itself.
 */
const PUBLIC_PATHS = new Set<string>(["/portal-login"]);

export function SessionGate({ children }: { children: ReactNode }) {
  const { isAdminUnlocked } = useAdminAccess();
  const [location] = useLocation();

  // Both admins and regular users authenticate via `/api/portal/login`, which
  // sets an in-memory session token. Track its presence reactively so any
  // signed-in user passes the gate. The legacy "Unlock ARUS" shared-password
  // gate is intentionally retired; Admin sign-in is username + password only.
  const hasSession = useSyncExternalStore(
    subscribeToApiSessionToken,
    () => getApiSessionToken() !== null,
    () => false
  );

  const currentPath = location.split("?")[0] ?? "";

  if (import.meta.env.DEV || isAdminUnlocked || hasSession || PUBLIC_PATHS.has(currentPath)) {
    return <>{children}</>;
  }

  // No session and not a public route: send the user to the sign-in split
  // where they can choose the User or Admin portal and authenticate.
  return <Redirect to="/portal-login" />;
}
