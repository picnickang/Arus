/**
 * Update Scheduler Service
 * Tier 3: Automated update checking with maintenance windows and marine-specific logic
 * Part of ARUS 3-Tier Patching System
 * 
 * DEPLOYMENT MODE: This service should ONLY run in CLOUD mode.
 * Vessel/embedded deployments receive updates through different channels.
 */

import cron from "node-cron";
import { getUpdateChecker } from "./update-checker";
import { patchApplicator } from "./patch-applicator";
import { db } from "../db";
import { updateSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { isCloudMode, canUseCloudFeature } from "../config/runtimeEnv";

/**
 * Check if we're in a maintenance window
 * Uses proper timezone conversion to honor vessel local time
 */
function isInMaintenanceWindow(
  windowStart: string, // HH:MM format
  windowEnd: string, // HH:MM format
  timezone: string = "UTC"
): boolean {
  try {
    // Get current time in the specified timezone using Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });

    // Extract hour and minute as numbers directly from formatToParts
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === "hour");
    const minutePart = parts.find((p) => p.type === "minute");

    if (!hourPart || !minutePart) {
      throw new Error("Failed to extract hour/minute from timezone conversion");
    }

    const currentHour = Number.parseInt(hourPart.value, 10);
    const currentMin = Number.parseInt(minutePart.value, 10);
    const currentTimeMinutes = currentHour * 60 + currentMin;

    // Parse window times
    const [startHour, startMin] = windowStart.split(":").map(Number);
    const [endHour, endMin] = windowEnd.split(":").map(Number);
    const startTimeMinutes = startHour * 60 + startMin;
    const endTimeMinutes = endHour * 60 + endMin;

    // Handle overnight windows (e.g., 22:00-06:00)
    if (endTimeMinutes < startTimeMinutes) {
      // Window crosses midnight
      return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
    } 
      // Normal window within same day
      return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    
  } catch (error) {
    console.error("[UpdateScheduler] Error checking maintenance window:", error);
    // On error, assume we're NOT in maintenance window (safer default)
    return false;
  }
}

/**
 * Check for updates for all organizations
 */
async function checkForUpdatesAllOrgs(): Promise<void> {
  // GUARD: Update scheduler only runs in CLOUD mode
  if (!isCloudMode || !canUseCloudFeature('updateScheduler')) {
    console.log("[UpdateScheduler] Skipped - not available in VESSEL mode");
    return;
  }

  try {
    console.log("[UpdateScheduler] Running scheduled update check...");

    // Get update checker instance
    const updateChecker = await getUpdateChecker();

    // Get all organizations with auto-update enabled
    const orgsWithAutoUpdate = await db
      .select()
      .from(updateSettings)
      .where(eq(updateSettings.autoUpdateEnabled, true));

    if (orgsWithAutoUpdate.length === 0) {
      console.log("[UpdateScheduler] No organizations have auto-update enabled");
      return;
    }

    for (const settings of orgsWithAutoUpdate) {
      try {
        // ALWAYS check for updates (marine workflow: background download + stage)
        const manifest = await updateChecker.checkForUpdates(
          settings.orgId,
          settings.updateChannel || "stable"
        );

        if (!manifest) {
          console.log(`[UpdateScheduler] Org ${settings.orgId}: No updates available`);
          continue;
        }

        console.log(
          `[UpdateScheduler] Org ${settings.orgId}: Update available - ${manifest.version} (${manifest.severity})`
        );

        // Register patch in database
        const patch = await updateChecker.registerPatch(settings.orgId, manifest);

        // ALWAYS download patch (background staging for marine vessels)
        console.log(
          `[UpdateScheduler] Org ${settings.orgId}: Starting background download for patch ${patch.id}...`
        );
        try {
          const patchPath = await updateChecker.downloadPatch(patch.id, settings.orgId);
          console.log(
            `[UpdateScheduler] Org ${settings.orgId}: Patch downloaded and staged at ${patchPath}`
          );
        } catch (downloadError) {
          console.error(
            `[UpdateScheduler] Org ${settings.orgId}: Background download failed:`,
            downloadError
          );
          // Continue to notify admin even if download fails
        }

        // Check if in maintenance window (for auto-apply decision)
        let inMaintenanceWindow = true; // Default: assume in window if not configured
        if (settings.maintenanceWindowStart && settings.maintenanceWindowEnd) {
          inMaintenanceWindow = isInMaintenanceWindow(
            settings.maintenanceWindowStart,
            settings.maintenanceWindowEnd,
            settings.maintenanceWindowTimezone || "UTC"
          );
        }

        // Decide if we should auto-apply (marine workflow: defer to maintenance window)
        const shouldAutoApply =
          !settings.requireManualApproval &&
          inMaintenanceWindow &&
          (manifest.severity === "critical" || settings.autoUpdateCriticalOnly === false);

        if (shouldAutoApply) {
          console.log(
            `[UpdateScheduler] Org ${settings.orgId}: Auto-applying patch ${patch.id} during maintenance globalThis...`
          );

          // Import WebSocket server for broadcasting
          const { wsServer } = await import("../websocket");

          try {
            const patchPath = await updateChecker.downloadPatch(patch.id, settings.orgId);
            const result = await patchApplicator.applyPatch(patch.id, patchPath);

            if (result.success) {
              console.log(`[UpdateScheduler] Org ${settings.orgId}: Patch applied successfully`);

              // Broadcast success notification
              wsServer.broadcastUpdateNotification({
                id: `update-${patch.id}-${Date.now()}`,
                type: "update_completed",
                version: manifest.version,
                message: `Update to version ${manifest.version} was automatically applied. ${manifest.requiresRestart ? "Restart required." : "No restart required."}`,
                severity: "info",
                metadata: {
                  orgId: settings.orgId,
                  patchId: patch.id,
                  requiresRestart: manifest.requiresRestart,
                },
              });
            } else {
              console.error(
                `[UpdateScheduler] Org ${settings.orgId}: Patch application failed:`,
                result.error
              );

              // Broadcast failure notification
              wsServer.broadcastUpdateNotification({
                id: `update-${patch.id}-failed-${Date.now()}`,
                type: "update_failed",
                version: manifest.version,
                message: `Update to version ${manifest.version} failed: ${result.error || "Unknown error"}`,
                severity: "critical",
                metadata: {
                  orgId: settings.orgId,
                  patchId: patch.id,
                  error: result.error,
                },
              });
            }
          } catch (applyError) {
            console.error(
              `[UpdateScheduler] Org ${settings.orgId}: Error auto-applying patch:`,
              applyError
            );

            // Broadcast failure notification
            wsServer.broadcastUpdateNotification({
              id: `update-${patch.id}-error-${Date.now()}`,
              type: "update_failed",
              version: manifest.version,
              message: `Update to version ${manifest.version} failed with an error`,
              severity: "critical",
              metadata: {
                orgId: settings.orgId,
                patchId: patch.id,
                error: String(applyError),
              },
            });
          }
        } else {
          // Notify admin - patch is staged but needs approval or waiting for window
          const reason = settings.requireManualApproval
            ? "manual approval required"
            : !inMaintenanceWindow
              ? "waiting for maintenance window"
              : "auto-update disabled";

          console.log(`[UpdateScheduler] Org ${settings.orgId}: Patch staged, ${reason}`);

          // Notify admin via WebSocket
          const { wsServer } = await import("../websocket");
          wsServer.broadcastUpdateNotification({
            id: `update-${patch.id}-${Date.now()}`,
            type: "update_available",
            version: manifest.version,
            message: `Update ${manifest.version} is available (${reason})`,
            severity: manifest.severity === "critical" ? "critical" : "info",
            metadata: {
              orgId: settings.orgId,
              patchId: patch.id,
              manifestSeverity: manifest.severity,
              requiresApproval: settings.requireManualApproval || !inMaintenanceWindow,
            },
          });
        }
      } catch (orgError) {
        console.error(
          `[UpdateScheduler] Error checking updates for org ${settings.orgId}:`,
          orgError
        );
      }
    }

    console.log("[UpdateScheduler] Update check complete");
  } catch (error) {
    console.error("[UpdateScheduler] Error in scheduled update check:", error);
  }
}

/**
 * Setup automated update checking scheduler
 */
export function setupUpdateScheduler(): void {
  // GUARD: Update scheduler only runs in CLOUD mode
  if (!isCloudMode || !canUseCloudFeature('updateScheduler')) {
    console.log("[UpdateScheduler] Disabled - update scheduler is cloud-only (vessel mode uses different update channels)");
    return;
  }

  // Get check interval from environment or use default (6 hours)
  const checkIntervalHours = Number.parseInt(process.env.UPDATE_CHECK_INTERVAL_HOURS || "6", 10);

  // Schedule update checks
  // Default: every 6 hours at minute 0 (00:00, 06:00, 12:00, 18:00)
  const cronPattern = `0 */${checkIntervalHours} * * *`;

  cron.schedule(cronPattern, async () => {
    await checkForUpdatesAllOrgs();
  });

  console.log(`🔄 Update scheduler configured (checking every ${checkIntervalHours} hours)`);

  // Run initial check 5 minutes after startup (if enabled)
  if (process.env.UPDATE_CHECK_ON_STARTUP !== "false") {
    setTimeout(
      async () => {
        console.log("[UpdateScheduler] Running initial update check...");
        await checkForUpdatesAllOrgs();
      },
      5 * 60 * 1000
    ); // 5 minutes
  }
}

/**
 * Manual trigger for update check (for testing/admin use)
 */
export async function triggerUpdateCheck(orgId?: string): Promise<void> {
  const updateChecker = await getUpdateChecker();

  if (orgId) {
    // Check specific organization
    const settings = await updateChecker.getUpdateSettings(orgId);
    if (settings) {
      const manifest = await updateChecker.checkForUpdates(
        orgId,
        settings.updateChannel || "stable"
      );
      if (manifest) {
        await updateChecker.registerPatch(orgId, manifest);
      }
    }
  } else {
    // Check all organizations
    await checkForUpdatesAllOrgs();
  }
}
