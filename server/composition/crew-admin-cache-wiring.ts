/**
 * Composition root: connect the crew-admin domain's permission-cache
 * invalidation port to the permissions domain's in-memory cache.
 *
 * Lives outside `server/domains/` on purpose: the crew-admin domain mutates
 * role hub-access and user↔role assignments but must not import the permissions
 * domain directly (that would break the boundary enforced by
 * `check:domain-leaks`). It exposes a `PermissionCacheInvalidatorPort` instead,
 * and this file is the single place that binds that port to the concrete
 * permission-cache invalidators so a changed access level takes effect on the
 * user's very next request rather than after the cache TTL elapses.
 */

import { crewAdminService } from "../domains/crew-admin/service.js";
import {
  invalidateOrgPermissionCache,
  invalidateUserPermissionCache,
} from "../domains/permissions/service.js";

let wired = false;

export function wireCrewAdminPermissionCache(): void {
  if (wired) {return;}
  crewAdminService.setPermissionCacheInvalidator({
    invalidateOrg: (orgId) => invalidateOrgPermissionCache(orgId),
    invalidateUser: (userId, orgId) => invalidateUserPermissionCache(userId, orgId),
  });
  wired = true;
}
