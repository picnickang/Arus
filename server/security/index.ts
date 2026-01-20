/**
 * Security Module - Backward-compatible re-exports
 *
 * MODULARIZED: 647 lines → 9 focused modules (~20-100 lines each)
 */

export type { IPSecurityInfo } from "./types";

export {
  sanitizeInput,
  validateDatabaseIdentifier,
  sanitizeForHTML,
  sanitizeMongoQuery,
} from "./sanitization";

export { additionalSecurityHeaders, sanitizeRequestData } from "./middleware";

export { detectAttackPatterns } from "./attack-detection";

export { secureErrorHandler } from "./error-handler";

export { requireAuthentication } from "./authentication";

export { requireAdminRole, validateOrganizationAccess, requireAdminAuth } from "./authorization";

export { auditAdminAction } from "./audit";
