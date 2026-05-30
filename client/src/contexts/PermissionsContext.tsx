import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDevModeOverride } from "@/components/DevModeToggle";

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

function useDevModeState(): boolean {
  const [devMode, setDevMode] = useState(() => getDevModeOverride());

  useEffect(() => {
    const handleChange = () => setDevMode(getDevModeOverride());
    window.addEventListener("devModeChange", handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener("devModeChange", handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  return devMode;
}

const defaultPermissions: UserPermissions = {
  userId: "",
  orgId: "",
  roleIds: [],
  roleNames: [],
  permissions: {},
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
  isDevMode?: boolean;
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const clientDevMode = useDevModeState();

  const { data, isLoading, error } = useQuery<PermissionsResponse>({
    queryKey: ["/api/permissions/me"],
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  const isViteDev = import.meta.env.DEV === true;
  const effectiveDevMode =
    clientDevMode || data?.isDevMode === true || (isViteDev && !data && !!error);

  const permissions: UserPermissions = useMemo(() => {
    if (isLoading) {
      return { ...defaultPermissions, isLoading: true, isDevMode: clientDevMode || isViteDev };
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
      isDevMode: effectiveDevMode,
      isLoading: false,
      error: null,
    };
  }, [data, isLoading, error, effectiveDevMode, clientDevMode, isViteDev]);

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

  const canView = (resource: string) => hasPermission(resource, "view");
  const canCreate = (resource: string) => hasPermission(resource, "create");
  const canEdit = (resource: string) => hasPermission(resource, "edit");
  const canDelete = (resource: string) => hasPermission(resource, "delete");
  const canExport = (resource: string) => hasPermission(resource, "export");

  const value: PermissionsContextType = {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
  };

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
