/**
 * Alert Settings - Types
 * Interface definitions for alert settings
 */

export interface ClaimResult {
  claimed: boolean;
  cooldownId?: string | undefined;
  reason?: string | undefined;
  logId?: string | undefined;
  snapshot?: CooldownSnapshot | undefined;
}

export interface CooldownSnapshot {
  lastAlertAt: Date;
  lastEmailAt: Date | null;
  alertCount: number;
  claimUpdatedAt: Date;
}

export interface EmailLogOptions {
  vesselId?: string | undefined;
  alertType?: string | undefined;
  alertKey?: string | undefined;
  status?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}
