import { usePermissions } from "@/contexts/PermissionsContext";
import { ShieldX } from "lucide-react";

export function PagePermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <ShieldX className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
      <p className="text-muted-foreground text-center max-w-md">
        You do not have permission to view this page. Please contact your administrator if you
        believe this is an error.
      </p>
    </div>
  );
}

interface PermissionGateProps {
  resource: string;
  action?: string;
  actions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  resource,
  action,
  actions,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, permissions } = usePermissions();

  if (import.meta.env.DEV && permissions.isDevMode) {
    return <>{children}</>;
  }

  if (permissions.isLoading) {
    return null;
  }

  let hasAccess = false;

  if (action) {
    hasAccess = hasPermission(resource, action);
  } else if (actions && actions.length > 0) {
    if (requireAll) {
      hasAccess = hasAllPermissions(actions.map((a) => ({ resource, action: a })));
    } else {
      hasAccess = hasAnyPermission(resource, actions);
    }
  } else {
    hasAccess = hasPermission(resource, "view");
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

interface MultiPermissionGateProps {
  checks: Array<{ resource: string; action: string }>;
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function MultiPermissionGate({
  checks,
  requireAll = true,
  fallback = null,
  children,
}: MultiPermissionGateProps) {
  const { hasPermission, hasAllPermissions, permissions } = usePermissions();

  if (import.meta.env.DEV && permissions.isDevMode) {
    return <>{children}</>;
  }

  if (permissions.isLoading) {
    return null;
  }

  let hasAccess = false;

  if (requireAll) {
    hasAccess = hasAllPermissions(checks);
  } else {
    hasAccess = checks.some((check) => hasPermission(check.resource, check.action));
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

interface PermissionGatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  resource: string;
  action: string;
  hideWhenDenied?: boolean;
  disabledTooltip?: string;
  children: React.ReactNode;
}

export function PermissionGatedButton({
  resource,
  action,
  hideWhenDenied = false,
  children,
  ...buttonProps
}: PermissionGatedButtonProps) {
  const { hasPermission, permissions } = usePermissions();

  if (import.meta.env.DEV && permissions.isDevMode) {
    return <button {...buttonProps}>{children}</button>;
  }

  const hasAccess = hasPermission(resource, action);

  if (!hasAccess && hideWhenDenied) {
    return null;
  }

  return (
    <button {...buttonProps} disabled={!hasAccess || buttonProps.disabled}>
      {children}
    </button>
  );
}

export function usePermissionGate(
  resource: string,
  action: string
): {
  hasAccess: boolean;
  isLoading: boolean;
  isDevMode: boolean;
} {
  const { hasPermission, permissions } = usePermissions();

  return {
    hasAccess: (import.meta.env.DEV && permissions.isDevMode) || hasPermission(resource, action),
    isLoading: permissions.isLoading,
    isDevMode: permissions.isDevMode,
  };
}

export function useMultiPermissionGate(
  checks: Array<{ resource: string; action: string }>,
  requireAll = true
): {
  hasAccess: boolean;
  isLoading: boolean;
  isDevMode: boolean;
} {
  const { hasPermission, hasAllPermissions, permissions } = usePermissions();

  let hasAccess = false;
  if (import.meta.env.DEV && permissions.isDevMode) {
    hasAccess = true;
  } else if (requireAll) {
    hasAccess = hasAllPermissions(checks);
  } else {
    hasAccess = checks.some((check) => hasPermission(check.resource, check.action));
  }

  return {
    hasAccess,
    isLoading: permissions.isLoading,
    isDevMode: permissions.isDevMode,
  };
}
