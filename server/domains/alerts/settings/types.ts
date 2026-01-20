/**
 * Alert Settings - Types
 * Interface definitions for alert settings
 */

export interface ClaimResult {
  claimed: boolean;
  cooldownId?: string;
  reason?: string;
  snapshot?: CooldownSnapshot;
}

export interface CooldownSnapshot {
  lastAlertAt: Date;
  lastEmailAt: Date | null;
  alertCount: number;
  claimUpdatedAt: Date;
}

export interface EmailLogOptions {
  vesselId?: string;
  alertType?: string;
  alertKey?: string;
  status?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}
