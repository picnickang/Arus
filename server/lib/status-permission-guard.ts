/**
 * Status-Aware Permission Guard
 * 
 * Provides middleware and utilities for enforcing permissions based on record status.
 * When a record is in "draft" status, normal edit/delete is allowed.
 * When a record is submitted (non-draft), only users with "approve" permission can modify it.
 */

import type { Request } from "express";
import { permissionService } from "../domains/permissions/service";
import type { ActionCode } from "../config/permission-registry";

interface AuthenticatedRequest extends Request {
  user?: { id: string; role?: string };
  orgId?: string;
}

interface StatusAwareGuardOptions {
  resource: string;
  draftStatuses: string[];
  requiredActionForSubmitted: ActionCode;
}

/**
 * Check if user can modify a record based on its status
 * @param userId - The user's ID
 * @param orgId - The organization ID
 * @param currentStatus - The current status of the record
 * @param options - Configuration for the guard
 * @returns Object with allowed flag and optional error message
 */
export async function canModifyRecord(
  userId: string,
  orgId: string,
  currentStatus: string,
  options: StatusAwareGuardOptions
): Promise<{ allowed: boolean; reason?: string }> {
  const isDraft = options.draftStatuses.includes(currentStatus);
  
  if (isDraft) {
    return { allowed: true };
  }
  
  const hasPermission = await permissionService.hasPermission(
    userId,
    orgId,
    options.resource,
    options.requiredActionForSubmitted
  );
  
  if (!hasPermission) {
    return {
      allowed: false,
      reason: `Only users with ${options.requiredActionForSubmitted} permission can modify ${options.resource} in ${currentStatus} status`,
    };
  }
  
  return { allowed: true };
}

/**
 * Purchase Request permission guard options
 */
export const PR_PERMISSION_GUARD: StatusAwareGuardOptions = {
  resource: "purchase_requests",
  draftStatuses: ["draft"],
  requiredActionForSubmitted: "approve",
};

/**
 * Service Order permission guard options
 */
export const SO_PERMISSION_GUARD: StatusAwareGuardOptions = {
  resource: "service_orders",
  draftStatuses: ["draft"],
  requiredActionForSubmitted: "approve",
};
