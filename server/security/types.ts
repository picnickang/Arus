/**
 * Security Types - Interfaces and type definitions
 *
 * Push B1: `orgId` is sourced from the authenticated user's claim
 * (`server/types/express.d.ts` declares the authoritative shape).
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

export interface IPSecurityInfo {
  suspiciousActivityCount: number;
  firstSeen: Date;
  lastSeen: Date;
  blockedUntil?: Date;
}
