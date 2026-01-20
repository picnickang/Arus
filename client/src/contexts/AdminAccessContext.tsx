import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { adminPasswordVerifySchema, type AdminSessionResponse } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface AdminAccessContextType {
  isAdminUnlocked: boolean;
  sessionToken: string | null;
  sessionExpiresAt: Date | null;
  unlockAdmin: (password: string) => Promise<void>;
  lockAdmin: () => void;
  isUnlocking: boolean;
  unlockError: string | null;
  timeUntilExpiry: number | null;
  timeUntilIdleTimeout: number | null;
}

const AdminAccessContext = createContext<AdminAccessContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// SECURITY: All session data (tokens, activity, state) stored in-memory only
// This prevents XSS attacks from detecting or stealing admin sessions
// Trade-off: Sessions don't persist across page reloads, but immune to storage-based attacks

// Global session token accessor for use outside React components
let globalSessionToken: string | null = null;

export function getAdminSessionToken(): string | null {
  return globalSessionToken;
}

// Development mode: auto-unlock admin without password
// Use Vite's built-in environment detection for safety
const DEV_MODE = import.meta.env.DEV === true;
const DEV_SESSION_TOKEN = "dev-admin-session-token";

export function AdminAccessProvider({ children }: { children: React.ReactNode }) {
  // In dev mode, start unlocked with dev token
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(DEV_MODE);
  const [sessionToken, setSessionToken] = useState<string | null>(DEV_MODE ? DEV_SESSION_TOKEN : null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(DEV_MODE ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null);
  const [timeUntilIdleTimeout, setTimeUntilIdleTimeout] = useState<number | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize global token in dev mode
  if (DEV_MODE && !globalSessionToken) {
    globalSessionToken = DEV_SESSION_TOKEN;
  }

  // Update last activity timestamp (in-memory only for security)
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Lock admin (clear session)
  const lockAdmin = useCallback(() => {
    setIsAdminUnlocked(false);
    setSessionToken(null);
    setSessionExpiresAt(null);
    setTimeUntilExpiry(null);
    setTimeUntilIdleTimeout(null);

    // Clear global session token
    globalSessionToken = null;

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

  // Unlock admin with password
  const unlockAdmin = useCallback(
    async (password: string) => {
      setIsUnlocking(true);
      setUnlockError(null);

      try {
        // Validate password format
        adminPasswordVerifySchema.parse({ password });

        // Call backend verification endpoint
        const response = await apiRequest<AdminSessionResponse>("POST", "/api/admin/auth/verify", {
          password,
        });

        // Store session
        const expiresAt = new Date(response.expiresAt);
        setSessionToken(response.sessionToken);
        setSessionExpiresAt(expiresAt);
        setIsAdminUnlocked(true);

        // Sync global session token for non-React contexts
        globalSessionToken = response.sessionToken;

        // Update activity
        updateActivity();

        // Log success without exposing sensitive data
        console.info("🔓 Admin mode unlocked", {
          expiresIn: `${Math.floor(response.expiresIn / 60)} minutes`,
        });
      } catch (error) {
        // Log error without exposing password or tokens
        console.error("Failed to unlock admin:", (error as Error).message || "Authentication failed");

        // Handle specific error cases
        if ((error as { code?: string }).code === "INVALID_PASSWORD") {
          setUnlockError("Invalid password. Please try again.");
        } else if ((error as { code?: string }).code === "ADMIN_SERVICE_DISABLED") {
          setUnlockError("Admin service is not configured. Contact your administrator.");
        } else {
          setUnlockError("Failed to unlock admin mode. Please try again.");
        }

        throw error;
      } finally {
        setIsUnlocking(false);
      }
    },
    [updateActivity]
  );

  // SECURITY NOTE: Sessions are NOT persisted to localStorage to prevent XSS token theft
  // Users will need to re-authenticate after page reload
  // This is a security vs. convenience trade-off in favor of security

  // Set up expiry and idle timeout timers
  useEffect(() => {
    if (!isAdminUnlocked || !sessionExpiresAt) { return; }

    // Update countdown timers every second
    const updateTimers = () => {
      const now = Date.now();
      const expiryMs = sessionExpiresAt.getTime() - now;
      const idleMs = IDLE_TIMEOUT_MS - (now - lastActivityRef.current);

      setTimeUntilExpiry(Math.max(0, Math.floor(expiryMs / 1000)));
      setTimeUntilIdleTimeout(Math.max(0, Math.floor(idleMs / 1000)));

      // Auto-lock on expiry
      if (expiryMs <= 0) {
        console.info("⏰ Session expired (max duration reached)");
        lockAdmin();
        return;
      }

      // Auto-lock on idle timeout
      if (idleMs <= 0) {
        console.info("⏰ Session expired (idle timeout)");
        lockAdmin();
        return;
      }
    };

    // Initial update
    updateTimers();

    // Update every second
    const timerId = setInterval(updateTimers, 1000);
    expiryTimerRef.current = timerId;

    return () => {
      if (timerId) {clearInterval(timerId);}
    };
  }, [isAdminUnlocked, sessionExpiresAt, lockAdmin]);

  // Track user activity to reset idle timeout
  useEffect(() => {
    if (!isAdminUnlocked) { return; }

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

  const value: AdminAccessContextType = {
    isAdminUnlocked,
    sessionToken,
    sessionExpiresAt,
    unlockAdmin,
    lockAdmin,
    isUnlocking,
    unlockError,
    timeUntilExpiry,
    timeUntilIdleTimeout,
  };

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const context = useContext(AdminAccessContext);
  if (context === undefined) {
    throw new Error("useAdminAccess must be used within an AdminAccessProvider");
  }
  return context;
}
