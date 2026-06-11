import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { getApiSessionToken, setApiSessionToken } from "@/lib/sessionToken";
import { ROLE_STORAGE_KEY } from "@/config/roles";
import { isSuperAdminRole } from "@shared/role-dashboard";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clearAllPortalState } from "@/infrastructure/navigation/nav-storage";
import { clearDevLoginSession } from "@/features/dev-login";

interface AdminAccessContextType {
  isAdminUnlocked: boolean;
  sessionToken: string | null;
  sessionExpiresAt: Date | null;
  unlockAdminFromUserSession: (token: string, expiresInSeconds: number) => void;
  lockAdmin: () => void;
  logout: () => Promise<void>;
}

const AdminAccessContext = createContext<AdminAccessContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// SECURITY: All session data (tokens, activity, state) stored in-memory only
// This prevents XSS attacks from detecting or stealing admin sessions
// Trade-off: Sessions don't persist across page reloads, but immune to storage-based attacks

// Backwards-compatible accessor for admin utilities.
export function getAdminSessionToken(): string | null {
  return getApiSessionToken();
}

const DEV_MODE = import.meta.env.DEV === true;

// Default client-side session window used when adopting a session that was
// established before this provider mounted (the desktop setup wizard signs in
// via `/api/portal/login` outside this provider, then completes setup and
// remounts the app tree). The server remains the source of truth for the real
// token lifetime; this only drives the client idle/expiry countdown until the
// next authenticated request revalidates.
const ADOPTED_SESSION_MS = 12 * 60 * 60 * 1000;

export function AdminAccessProvider({ children }: { children: React.ReactNode }) {
  // Start locked. Development superuser access now comes only from an explicit
  // temporary dev-login token, never from an automatic no-token unlock.
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Adopt a session that was established before this provider mounted. On the
  // desktop build the setup wizard signs in via `/api/portal/login` (outside
  // this provider) and then completes setup, which remounts the app tree with a
  // fresh provider instance. The in-memory token survives that remount, so we
  // pick it up here, restore the session, and unlock the admin portal when the
  // stored role is admin-capable. In the web flow no token exists at app start
  // (login happens later, inside this provider), so this is a no-op there.
  // This runs in every mode now (no token is injected in dev), so a real token
  // present at mount is always adopted.
  useEffect(() => {
    const existing = getApiSessionToken();
    if (!existing) {
      return;
    }
    setSessionToken(existing);
    setSessionExpiresAt(new Date(Date.now() + ADOPTED_SESSION_MS));
    let roleHint: string | null = null;
    try {
      roleHint = localStorage.getItem(ROLE_STORAGE_KEY);
    } catch {
      roleHint = null;
    }
    if (isSuperAdminRole(roleHint)) {
      setIsAdminUnlocked(true);
    }
  }, []);

  // Update last activity timestamp (in-memory only for security)
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Lock admin (clear session)
  const lockAdmin = useCallback(() => {
    setIsAdminUnlocked(false);
    setSessionToken(null);
    setSessionExpiresAt(null);

    // Clear in-memory API session token
    setApiSessionToken(null);
    clearDevLoginSession();

    // Clear timers
    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }

    if (idleTimerRef.current) {
      clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    console.info("🔒 Admin mode locked");
  }, []);

  // Full sign-out: revoke the session on the server FIRST (while the in-memory
  // token is still present so the request authenticates), then tear down every
  // piece of local state so the next user starts clean. Best-effort on the
  // network call — an offline/failed revoke must never strand the user in a
  // half-logged-in UI, so we always proceed to clear local state.
  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/me/logout");
    } catch {
      // Ignore — the local teardown below still runs.
    }
    // Drop role hint + bottom-nav override so navigation policy resets.
    clearAllPortalState();
    // Discard every cached query so no previous user's data lingers.
    queryClient.clear();
    // Clear in-memory token, admin-unlock flag, and countdown timers.
    lockAdmin();
  }, [lockAdmin]);

  // Adopt an authenticated admin session minted by `/api/portal/login`.
  // The shared admin password is no longer a sign-in path; an admin signs in
  // with a username + password like any other user, and once we've confirmed
  // the returned account is admin-capable we mark the admin portal unlocked
  // using the same in-memory session the rest of the app already holds.
  const unlockAdminFromUserSession = useCallback(
    (token: string, expiresInSeconds: number) => {
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      setSessionToken(token);
      setSessionExpiresAt(expiresAt);
      setIsAdminUnlocked(true);
      setApiSessionToken(token);
      updateActivity();
      console.info("🔓 Admin mode unlocked", {
        expiresIn: `${Math.floor(expiresInSeconds / 60)} minutes`,
      });
    },
    [updateActivity]
  );

  // SECURITY NOTE: Sessions are NOT persisted to localStorage to prevent XSS token theft
  // Users will need to re-authenticate after page reload
  // This is a security vs. convenience trade-off in favor of security

  // Enforce session expiry / idle timeout while unlocked. The checks run on an
  // interval but do NOT touch state on each tick (the old per-second countdown
  // state had no consumers and re-rendered the provider once a second), so the
  // only render this effect ever causes is the lockAdmin() teardown itself.
  // Skipped in dev so a real admin session used for local testing isn't torn
  // down mid-session; production always enforces the cap. (The server token
  // still expires regardless.)
  useEffect(() => {
    if (!isAdminUnlocked || !sessionExpiresAt || DEV_MODE) {
      return;
    }

    const checkSessionTimeouts = () => {
      const now = Date.now();
      const expiryMs = sessionExpiresAt.getTime() - now;
      const idleMs = IDLE_TIMEOUT_MS - (now - lastActivityRef.current);

      if (expiryMs <= 0) {
        console.info("⏰ Session expired (max duration reached)");
        lockAdmin();
        return;
      }

      if (idleMs <= 0) {
        console.info("⏰ Session expired (idle timeout)");
        lockAdmin();
      }
    };

    checkSessionTimeouts();
    const timerId = setInterval(checkSessionTimeouts, 1000);
    expiryTimerRef.current = timerId;

    return () => {
      clearInterval(timerId);
    };
  }, [isAdminUnlocked, sessionExpiresAt, lockAdmin]);

  // Track user activity to reset idle timeout
  useEffect(() => {
    if (!isAdminUnlocked) {
      return;
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart"];

    const handleActivity = () => {
      updateActivity();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isAdminUnlocked, updateActivity]);

  // Memoized so consumers only re-render on real session transitions.
  const value: AdminAccessContextType = useMemo(
    () => ({
      isAdminUnlocked,
      sessionToken,
      sessionExpiresAt,
      unlockAdminFromUserSession,
      lockAdmin,
      logout,
    }),
    [isAdminUnlocked, sessionToken, sessionExpiresAt, unlockAdminFromUserSession, lockAdmin, logout]
  );

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const context = useContext(AdminAccessContext);
  if (context === undefined) {
    throw new Error("useAdminAccess must be used within an AdminAccessProvider");
  }
  return context;
}
