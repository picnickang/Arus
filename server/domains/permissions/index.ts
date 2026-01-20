/**
 * Permissions Domain - Public API
 * 
 * Central exports for permission management functionality.
 */

export { permissionService } from "./service";
export { permissionRepository } from "./repository";
export {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  attachUserPermissions,
  checkPermissionInDev,
} from "./middleware";
export * from "../../config/permission-registry";
