/**
 * Engine Log Auto-fill & Anomaly Detection Routes
 *
 * Handles telemetry-based auto-fill and anomaly detection:
 * - Auto-fill hourly entries from telemetry
 * - Anomaly summary and thresholds
 * - Unsigned log notifications
 */

import type { Express } from "express";
import { z } from "zod";
import type { RateLimiters } from "./types";
import { withErrorHandling } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";
import {
  autoFillFromTelemetry,
  autoFillGeneratorsFromTelemetry,
  getAnomalySummary,
  ENGINE_ANOMALY_THRESHOLDS,
  GENERATOR_ANOMALY_THRESHOLDS,
  getUnsignedLogs,
} from "../../../services/engine-log-autofill-service";
import { emailNotificationService } from "../../../services/email-notification-service";

const autoFillRequestSchema = z.object({
  vesselId: z.string().uuid("Invalid vessel ID format"),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD required)"),
  hours: z.array(z.number().int().min(0).max(23)).optional(),
  overwriteManual: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
});

const notifyRequestSchema = z.object({
  vesselId: z.string().uuid().optional(),
  daysBack: z.number().int().min(1).max(90).optional().default(7),
});

export function registerAutofillRoutes(app: Express, rateLimit: RateLimiters) {
  const { writeOperationRateLimit } = rateLimit;

  app.post(
    "/api/logbook/engine/autofill",
    writeOperationRateLimit,
    withErrorHandling("auto-fill engine log from telemetry", async (req, res) => {
      const orgId = req.orgId;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }

      const parseResult = autoFillRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const { vesselId, logDate, hours, overwriteManual, dryRun } = parseResult.data;

      const [mainEngineResult, generatorResult] = await Promise.all([
        autoFillFromTelemetry(vesselId, orgId, logDate, { hours, overwriteManual, dryRun }),
        autoFillGeneratorsFromTelemetry(vesselId, orgId, logDate, {
          hours,
          overwriteManual,
          dryRun,
        }),
      ]);

      return res.json({
        success: true,
        mainEngine: mainEngineResult,
        generators: generatorResult,
      });
    })
  );

  app.get(
    "/api/logbook/engine/daily/:id/anomalies",
    withErrorHandling("get anomaly summary", async (req, res) => {
      const orgId = req.orgId;

      const summary = await getAnomalySummary(req.params["id"] ?? "", orgId);
      return res.json(summary);
    })
  );

  app.get(
    "/api/logbook/engine/thresholds",
    withErrorHandling("get anomaly thresholds", async (req, res) => {
      res.json({
        engine: ENGINE_ANOMALY_THRESHOLDS,
        generator: GENERATOR_ANOMALY_THRESHOLDS,
      });
    })
  );

  app.get(
    "/api/logbook/engine/unsigned",
    withErrorHandling("get unsigned logs", async (req, res) => {
      const orgId = req.orgId;
      const vesselId = req.query["vesselId"] as string | undefined;
      const daysBack = req.query["daysBack"] ? Number.parseInt(req.query["daysBack"] as string) : 7;

      const unsignedLogs = await getUnsignedLogs(orgId, {
        ...(vesselId !== undefined && { vesselId }),
        daysBack,
      });

      return res.json(unsignedLogs);
    })
  );

  app.post(
    "/api/logbook/engine/notify-unsigned",
    writeOperationRateLimit,
    withErrorHandling("send unsigned log notifications", async (req, res) => {
      const orgId = req.orgId;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }

      const parseResult = notifyRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const { vesselId, daysBack: parsedDaysBack } = parseResult.data;
      const daysBack = parsedDaysBack ?? 7;

      const unsignedLogs = await getUnsignedLogs(orgId, {
        ...(vesselId !== undefined && { vesselId }),
        daysBack,
      });

      if (unsignedLogs.length === 0) {
        return res.json({ message: "No unsigned logs found", sent: 0 });
      }

      let sentCount = 0;
      const errors: string[] = [];

      for (const log of unsignedLogs) {
        try {
          await emailNotificationService.sendLogbookReminderNotification(
            "engine",
            log.vesselId,
            log.vesselName ?? "",
            log.logDate,
            orgId
          );
          sentCount++;
        } catch (err) {
          logger.error("Logbook", `Failed to send notification for ${log.vesselName}`, err);
          errors.push(`${log.vesselName}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      logger.info(
        "Logbook",
        `Sent ${sentCount}/${unsignedLogs.length} notifications for org ${orgId}`
      );

      return res.json({
        message: `Sent ${sentCount} of ${unsignedLogs.length} notifications`,
        logs: unsignedLogs,
        sent: sentCount,
        total: unsignedLogs.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    })
  );

  return 5;
}
