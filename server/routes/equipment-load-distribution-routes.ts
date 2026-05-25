import { Router } from "express";
import { dbEquipmentStorage, dbTelemetryStorage } from "../repositories";
import { createLogger } from "../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Routes:EquipmentLoadDistributionRoutes");

const router = Router();

router.get("/:id/load-distribution", async (req, res) => {
  try {
    const equipmentId = req.params.id;
    const orgId = DEFAULT_ORG_ID;

    const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);
    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate = req.query['startDate'] ? new Date(req.query['startDate'] as string) : defaultStart;
    const endDate = req.query['endDate'] ? new Date(req.query['endDate'] as string) : now;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use ISO 8601 strings." });
    }

    if (startDate > endDate) {
      return res.status(400).json({ message: "Start date must be before end date" });
    }

    const { computeEquipmentLoadDistribution } = await import("../vps-kpi-service.js");

    const loadDistribution = await computeEquipmentLoadDistribution(equipmentId, orgId, {
      start: startDate,
      end: endDate,
    });

    const telemetry = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
      equipmentId,
      startDate,
      endDate
    );

    const torqueCount = telemetry.filter(
      (t) => t.sensorType === "shaft_torque" || t.sensorType === "torque"
    ).length;

    res.setHeader("Cache-Control", "public, max-age=300");
    return res.json({
      bins: loadDistribution,
      metadata: {
        equipmentId,
        equipmentName: equipment.name,
        equipmentType: equipment.type,
        sampleCount: torqueCount,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        timezone: "UTC",
      },
    });
  } catch (error) {
    logger.error("Failed to compute load distribution:", undefined, error);
    return res.status(500).json({ message: "Failed to compute load distribution" });
  }
});

export { router as equipmentLoadDistributionRouter };
