/**
 * Safety Bulletin Domain - Domain Types
 * Pure domain types without infrastructure dependencies.
 */

export interface SafetyBulletinEntity {
  id: string;
  orgId: string;
  vesselId: string | null;
  title: string;
  body: string | null;
  severity: string;
  category: string;
  reference: string | null;
  active: boolean;
  effectiveDate: Date | null;
  expiresAt: Date | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateSafetyBulletinCommand {
  orgId: string;
  vesselId?: string | undefined;
  title: string;
  body?: string | undefined;
  severity?: string | undefined;
  category?: string | undefined;
  reference?: string | undefined;
  effectiveDate?: string | undefined;
  expiresAt?: string | undefined;
  createdBy?: string | undefined;
}

export interface ListSafetyBulletinsFilters {
  vesselId?: string | undefined;
  activeOnly?: boolean | undefined;
}
