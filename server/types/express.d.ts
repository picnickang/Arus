/**
 * SINGLE-TENANT SYSTEM
 * - orgId is always "default-org-id" (single tenant)
 * - user tracking preserved for traceability
 */
declare global {
  namespace Express {
    interface Request {
      orgId: string;
      user?: {
        id: string;
        email: string;
        role: string;
        name?: string;
        isActive: boolean;
      };
    }
  }
}

export {};
