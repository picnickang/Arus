/**
 * Vessel Performance Routes - Operating Mode Detection
 */

import type { Express, Response } from "express";
import type { VesselPerformanceRoutesConfig, AuthenticatedRequest } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { dbEquipmentStorage } from "../../../db/equipment/index.js";
import { dbTelemetryStorage } from "../../../db/telemetry/index.js";
import { requireOrgId } from "../../../middleware/auth.js";

export function registerModeRoutes(app: Express, _config: VesselPerformanceRoutesConfig): void {
  app.get(
    "/api/vessels/:id/operating-mode",
    requireOrgId,
    withErrorHandling("detect operating mode", async (req: AuthenticatedRequest, res: Response) => {
      const { id: vesselId } = req.params;
      const orgId = req.orgId;

      const now = new Date(),
        oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const equipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);
      const vesselEquipment = equipment.filter((e) => e.vesselId === vesselId);

      if (vesselEquipment.length === 0) {
        return res.status(404).json({ message: "No equipment found for vessel" });
      }

      const { ModeDetector } = await import("../../../context/mode-detector.js");
      const detector = new ModeDetector();
      let latestMode: ReturnType<typeof detector.detectModeFromWindow> | null = null;

      for (const eq of vesselEquipment) {
        const telemetry = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
          eq.id,
          oneHourAgo,
          now,
          orgId
        );
        if (telemetry.length > 0) {
          const windows = telemetry.map((t) => detector.toTelemetryWindow(t));
          const detection = detector.detectModeFromWindow(windows);
          if (!latestMode || detection.confidence > latestMode.confidence) {
            latestMode = detection;
          }
        }
      }

      if (!latestMode) {
        return res.json({
          mode: "Unknown",
          confidence: 0,
          indicators: ["No recent telemetry data"],
          timestamp: now.toISOString(),
        });
      }

      res.setHeader("Cache-Control", "private, max-age=60");
      return res.json({
        ...latestMode,
        timestamp: latestMode.timestamp.toISOString(),
        color: detector.getModeColor(latestMode.mode),
        label: detector.getModeLabel(latestMode.mode),
      });
    })
  );
}
