/**
 * User Permissions Hook
 *
 * Fetches and caches the current user's permissions from the backend.
 * Provides helper functions to check if user can perform specific actions.
 */

import { useQuery } from "@tanstack/react-query";

export interface PermissionRole {
  id: string;
  name: string;
  displayName: string;
}

interface UserPermissionsResponse {
  userId: string;
  orgId: string;
  roles: PermissionRole[];
  permissions: Record<string, Record<string, boolean>>;
}

export function useUserPermissions() {
  const { data, isLoading, error } = useQuery<UserPermissionsResponse>({
    queryKey: ["/api/permissions/me"],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const hasPermission = (resource: string, action: string): boolean => {
    if (!data?.permissions) {
      return false;
    }
    return data.permissions[resource]?.[action] === true;
  };

  const canApprove = (resource: string): boolean => {
    return hasPermission(resource, "approve");
  };

  const canEdit = (resource: string): boolean => {
    return hasPermission(resource, "edit");
  };

  const canDelete = (resource: string): boolean => {
    return hasPermission(resource, "delete");
  };

  return {
    permissions: data?.permissions ?? {},
    roles: data?.roles ?? [],
    isLoading,
    error,
    hasPermission,
    canApprove,
    canEdit,
    canDelete,
  };
}

/**
 * Hook to check if user can modify a record based on its status
 * Returns true if:
 * - Record is in draft status (anyone with edit permission can modify)
 * - Record is submitted AND user has approve permission
 */
export function useCanModifyRecord(
  resource: string,
  recordStatus: string | undefined,
  draftStatuses: string[] = ["draft"]
) {
  const { canApprove, canEdit, isLoading } = useUserPermissions();

  if (!recordStatus) {
    return { canModify: false, canDelete: false, isLoading };
  }

  const isDraft = draftStatuses.includes(recordStatus);

  if (isDraft) {
    return {
      canModify: canEdit(resource),
      canDelete: canEdit(resource),
      isLoading,
    };
  }

  const hasApprovePermission = canApprove(resource);
  return {
    canModify: hasApprovePermission,
    canDelete: hasApprovePermission,
    isLoading,
  };
}
