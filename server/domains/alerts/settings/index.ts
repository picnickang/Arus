/**
 * Alert Settings - Main Entry Point
 * Combines all settings modules into a single repository class
 */

export type { ClaimResult, CooldownSnapshot, EmailLogOptions } from "./types.js";
export * from "./org-settings.js";
export * from "./thresholds.js";
export * from "./email-logs.js";
export * from "./crew-settings.js";
export * from "./cooldown.js";

import * as orgSettings from "./org-settings.js";
import * as thresholds from "./thresholds.js";
import * as emailLogs from "./email-logs.js";
import * as crewSettings from "./crew-settings.js";
import * as cooldown from "./cooldown.js";

export class AlertSettingsRepository {
  getOrgSettings = orgSettings.getOrgSettings;
  upsertOrgSettings = orgSettings.upsertOrgSettings;
  getVesselSettings = orgSettings.getVesselSettings;
  getAllVesselSettings = orgSettings.getAllVesselSettings;
  upsertVesselSettings = orgSettings.upsertVesselSettings;
  deleteVesselSettings = orgSettings.deleteVesselSettings;

  getThresholds = thresholds.getThresholds;
  getThresholdByKey = thresholds.getThresholdByKey;
  upsertThreshold = thresholds.upsertThreshold;
  deleteThreshold = thresholds.deleteThreshold;

  logEmail = emailLogs.logEmail;
  updateEmailLogStatus = emailLogs.updateEmailLogStatus;
  updateEmailLogStatusByMessageId = emailLogs.updateEmailLogStatusByMessageId;
  getEmailLogs = emailLogs.getEmailLogs;

  getCrewAlertSettings = crewSettings.getCrewAlertSettings;
  getAllCrewAlertSettings = crewSettings.getAllCrewAlertSettings;
  upsertCrewAlertSettings = crewSettings.upsertCrewAlertSettings;
  deleteCrewAlertSettings = crewSettings.deleteCrewAlertSettings;

  getCooldown = cooldown.getCooldown;
  isInCooldown = cooldown.isInCooldown;
  recordAlertSent = cooldown.recordAlertSent;
  recordEmailSent = cooldown.recordEmailSent;
  atomicClaimAlertSlot = cooldown.atomicClaimAlertSlot;
  revertCooldownClaim = cooldown.revertCooldownClaim;
  cleanupExpiredCooldowns = cooldown.cleanupExpiredCooldowns;
}

export const alertSettingsRepository = new AlertSettingsRepository();
