/**
 * Security Types - Interfaces and type definitions
 *
 * SINGLE-TENANT SYSTEM: orgId removed from user (uses default-org-id)
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
      };
    }
  }
}

export interface IPSecurityInfo {
  suspiciousActivityCount: number;
  firstSeen: Date;
  lastSeen: Date;
  blockedUntil?: Date;
}
