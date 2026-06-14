import { createContext, useContext, useMemo, useEffect, useRef, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, retryUnlessClientError } from "@/lib/queryClient";
import { getApiSessionToken, subscribeToApiSessionToken } from "@/lib/sessionToken";

export interface PermissionMatrix {
  [resource: string]: {
    [action: string]: boolean;
  };
}

export interface UserPermissions {
  userId: string;
  orgId: string;
  roleIds: string[];
  roleNames: string[];
  permissions: PermissionMatrix;
  hubAdmin: boolean;
  hubAccess: string[] | null;
  isDevMode: boolean;
  isLoading: boolean;
  error: Error | null;
}

interface PermissionsContextType {
  permissions: UserPermissions;
  hasPermission: (resource: string, action: string) => boolean;
  hasAnyPermission: (resource: string, actions: string[]) => boolean;
  hasAllPermissions: (checks: Array<{ resource: string; action: string }>) => boolean;
  canView: (resource: string) => boolean;
  canCreate: (resource: string) => boolean;
  canEdit: (resource: string) => boolean;
  canDelete: (resource: string) => boolean;
  canExport: (resource: string) => boolean;
}

const defaultPermissions: UserPermissions = {
  userId: "",
  orgId: "",
  roleIds: [],
  roleNames: [],
  permissions: {},
  hubAdmin: false,
  hubAccess: null,
  isDevMode: false,
  isLoading: true,
  error: null,
};

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

interface PermissionsResponse {
  userId: string;
  orgId: string;
  roles: Array<{ id: string; name: string; displayName: string }>;
  permissions: PermissionMatrix;
  hubAdmin?: boolean;
  hubAccess?: string[] | null;
  isDevMode?: boolean;
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  // Track the live API session token. A login or logout changes the identity,
  // and the permissions response is cached for 5 minutes — so without this a
  // real user could briefly inherit the previous identity's grants
  // until the stale window elapsed. `resetQueries` (not just invalidate) drops
  // the cached payload so access collapses to "deny" during the refetch instead
  // of showing stale elevated permissions.
  const sessionToken = useSyncExternalStore(
    subscribeToApiSessionToken,
    getApiSessionToken,
    () => null
  );
  const isFirstTokenRun = useRef(true);
  useEffect(() => {
    if (isFirstTokenRun.current) {
      isFirstTokenRun.current = false;
      return;
    }
    queryClient.resetQueries({ queryKey: ["/api/permissions/me"] });
  }, [sessionToken]);

  const { data, isLoading, error } = useQuery<PermissionsResponse>({
    queryKey: ["/api/permissions/me"],
    staleTime: 5 * 60 * 1000,
    // Never retry a 401 — on a fresh (unauthenticated) load the probe is
    // expected to fail once and drive the login redirect; retrying it just
    // fired 4 redundant 401s. Transient errors still retry up to 3x.
    retry: retryUnlessClientError(3),
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  // Only the server may mark a session as dev-all-access. Regular dev-user
  // preview sessions deliberately return isDevMode=false.
  const effectiveDevMode = data?.isDevMode === true;

  const permissions: UserPermissions = useMemo(() => {
    if (isLoading) {
      return { ...defaultPermissions, isLoading: true, isDevMode: false };
    }
    if (error || !data) {
      return {
        ...defaultPermissions,
        isLoading: false,
        error: error ? error : null,
        isDevMode: effectiveDevMode,
      };
    }
    return {
      userId: data.userId,
      orgId: data.orgId,
      roleIds: data.roles.map((r) => r.id),
      roleNames: data.roles.map((r) => r.name),
      permissions: data.permissions,
      hubAdmin: data.hubAdmin ?? false,
      hubAccess: data.hubAccess ?? null,
      isDevMode: effectiveDevMode,
      isLoading: false,
      error: null,
    };
  }, [data, isLoading, error, effectiveDevMode]);

  // The context value (object + the nine checker closures) is memoized on the
  // already-memoized `permissions` snapshot. Without this, every provider
  // render handed a fresh object identity to all consumers, re-rendering the
  // entire shell/nav tree even when permissions had not changed.
  const value = useMemo<PermissionsContextType>(() => {
    const hasPermission = (resource: string, action: string): boolean => {
      if (import.meta.env.DEV && permissions.isDevMode) {
        return true;
      }
      if (permissions.isLoading) {
        return false;
      }
      return permissions.permissions[resource]?.[action] === true;
    };

    const hasAnyPermission = (resource: string, actions: string[]): boolean => {
      if (import.meta.env.DEV && permissions.isDevMode) {
        return true;
      }
      if (permissions.isLoading) {
        return false;
      }
      return actions.some((action) => permissions.permissions[resource]?.[action] === true);
    };

    const hasAllPermissions = (checks: Array<{ resource: string; action: string }>): boolean => {
      if (import.meta.env.DEV && permissions.isDevMode) {
        return true;
      }
      if (permissions.isLoading) {
        return false;
      }
      return checks.every(
        (check) => permissions.permissions[check.resource]?.[check.action] === true
      );
    };

    return {
      permissions,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canView: (resource: string) => hasPermission(resource, "view"),
      canCreate: (resource: string) => hasPermission(resource, "create"),
      canEdit: (resource: string) => hasPermission(resource, "edit"),
      canDelete: (resource: string) => hasPermission(resource, "delete"),
      canExport: (resource: string) => hasPermission(resource, "export"),
    };
  }, [permissions]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}

export function useHasPermission(resource: string, action: string): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(resource, action);
}

export function useCanView(resource: string): boolean {
  const { canView } = usePermissions();
  return canView(resource);
}

export function useCanCreate(resource: string): boolean {
  const { canCreate } = usePermissions();
  return canCreate(resource);
}

export function useCanEdit(resource: string): boolean {
  const { canEdit } = usePermissions();
  return canEdit(resource);
}

export function useCanDelete(resource: string): boolean {
  const { canDelete } = usePermissions();
  return canDelete(resource);
}
