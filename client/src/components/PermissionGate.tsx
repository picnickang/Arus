import { usePermissions } from "@/contexts/PermissionsContext";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ShieldAlert, ShieldX } from "lucide-react";

export function PagePermissionDenied() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[400px] p-8"
      data-testid="permission-gate-denied"
    >
      <ShieldX className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
      <p className="text-muted-foreground text-center max-w-md">
        You do not have permission to view this page. Please contact your administrator if you
        believe this is an error.
      </p>
    </div>
  );
}

export function PermissionGateLoading() {
  return (
    <div
      className="min-h-[260px] p-4 md:p-6 space-y-4"
      data-testid="permission-gate-loading"
      role="status"
      aria-live="polite"
    >
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Loading access...</p>
        <p className="text-xs text-muted-foreground">
          Checking your permissions for this page.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-32 rounded-lg" />
    </div>
  );
}

function retryPermissions() {
  void queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });
}

export function PermissionGateError({ error }: { error: Error | null }) {
  return (
    <div
      className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center"
      data-testid="permission-gate-error"
      role="alert"
    >
      <ShieldAlert className="mb-4 h-12 w-12 text-muted-foreground/70" />
      <h2 className="mb-2 text-lg font-semibold">Could not load permissions</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error?.message || "The access check did not complete. Try again or check connectivity."}
      </p>
      <Button className="mt-4 min-h-11" variant="outline" onClick={retryPermissions}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry Access Check
      </Button>
    </div>
  );
}

interface PermissionGateProps {
  resource: string;
  action?: string;
  actions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  resource,
  action,
  actions,
  requireAll = false,
  fallback = null,
  loadingFallback,
  errorFallback,
  children,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, permissions } = usePermissions();

  if (import.meta.env.DEV && permissions.isDevMode) {
    return <>{children}</>;
  }

  if (permissions.isLoading) {
    return <>{loadingFallback ?? <PermissionGateLoading />}</>;
  }

  if (permissions.error) {
    return <>{errorFallback ?? <PermissionGateError error={permissions.error} />}</>;
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
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  children: React.ReactNode;
}

export function MultiPermissionGate({
  checks,
  requireAll = true,
  fallback = null,
  loadingFallback,
  errorFallback,
  children,
}: MultiPermissionGateProps) {
  const { hasPermission, hasAllPermissions, permissions } = usePermissions();

  if (import.meta.env.DEV && permissions.isDevMode) {
    return <>{children}</>;
  }

  if (permissions.isLoading) {
    return <>{loadingFallback ?? <PermissionGateLoading />}</>;
  }

  if (permissions.error) {
    return <>{errorFallback ?? <PermissionGateError error={permissions.error} />}</>;
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
