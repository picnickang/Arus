/**
 * Enhanced Security Middleware and Utilities
 * Provides additional security measures beyond basic rate limiting and HMAC validation
 *
 * MODULARIZED: 647 lines → 9 focused modules (~20-100 lines each)
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        role: string;
        isActive: boolean;
        orgId?: string;
      };
    }
  }
}

export {
  sanitizeInput,
  validateDatabaseIdentifier,
  sanitizeForHTML,
  sanitizeMongoQuery,
} from "./security/sanitization";

export { additionalSecurityHeaders, sanitizeRequestData } from "./security/middleware";

export { detectAttackPatterns } from "./security/attack-detection";

export { secureErrorHandler } from "./security/error-handler";

export { requireAuthentication } from "./security/authentication";

export {
  requireAdminRole,
  validateOrganizationAccess,
  requireAdminAuth,
} from "./security/authorization";

export { auditAdminAction } from "./security/audit";
