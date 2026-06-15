import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";

interface Organization {
  id: string;
  name: string;
}

interface OrganizationContextType {
  currentOrgId: string | null;
  setCurrentOrgId: (orgId: string) => void;
  organizations: Organization[];
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const ORG_STORAGE_KEY = "arus_current_org_id";
const USER_STORAGE_KEY = "currentUser";
const TOKEN_STORAGE_KEY = "authToken";

/**
 * SINGLE-TENANT MODE: Always returns default-org-id
 * Multi-tenant isolation is handled by permissions/RBAC instead
 */
function resolveOrgId(): { orgId: string; orgName: string; source: string } {
  // Single-tenant mode: always use default organization
  return {
    orgId: "default-org-id",
    orgName: "ARUS Fleet",
    source: "single-tenant",
  };
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [_orgName, setOrgName] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [_error, _setError] = useState<string | null>(null);

  const loadOrgContext = useCallback(() => {
    const { orgId, orgName: name, source } = resolveOrgId();

    console.info("[OrgContext] Resolved:", { orgId, source });

    setCurrentOrgIdState(orgId);
    setOrgName(name);

    if (orgId) {
      setOrganizations([{ id: orgId, name: name || "Your Organization" }]);
      if (typeof globalThis !== "undefined") {
        localStorage.setItem(ORG_STORAGE_KEY, orgId);
      }
    } else {
      setOrganizations([]);
      if (typeof globalThis !== "undefined") {
        localStorage.removeItem(ORG_STORAGE_KEY);
      }
    }

    setIsLoading(false);
    setIsReady(true);
  }, []);

  useEffect(() => {
    loadOrgContext();
  }, [loadOrgContext]);

  useEffect(() => {
    if (typeof globalThis === "undefined") {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === USER_STORAGE_KEY || e.key === TOKEN_STORAGE_KEY) {
        console.info("[OrgContext] Storage change detected, reloading context");
        loadOrgContext();
      }
    };

    const channel = new BroadcastChannel("arus_org_context");

    channel.onmessage = (event) => {
      if (event.data.type === "ORG_CHANGED") {
        console.info("[OrgContext] Cross-tab sync: org changed");
        loadOrgContext();
      }
    };

    globalThis.addEventListener("storage", handleStorageChange);

    return () => {
      globalThis.removeEventListener("storage", handleStorageChange);
      channel.close();
    };
  }, [loadOrgContext]);

  const setCurrentOrgId = useCallback((orgId: string) => {
    setCurrentOrgIdState(orgId);

    if (typeof globalThis !== "undefined") {
      localStorage.setItem(ORG_STORAGE_KEY, orgId);

      const channel = new BroadcastChannel("arus_org_context");
      channel.postMessage({ type: "ORG_CHANGED", orgId });
      channel.close();
    }
  }, []);

  const value = useMemo(
    () => ({
      currentOrgId,
      setCurrentOrgId,
      organizations,
      isLoading,
      isReady,
      error: _error,
    }),
    [currentOrgId, setCurrentOrgId, organizations, isLoading, isReady, _error]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return context;
}

export function getCurrentOrgId(): string | null {
  const { orgId } = resolveOrgId();
  return orgId;
}
