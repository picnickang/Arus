import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticatedRequest, requireOrgId } from "../../../middleware/auth";
import { logger } from "../../../utils/logger";
import { sensorCalibrationService, SensorNotFoundError } from "../application";

const router = Router();

function getOrgId(req: Request): string {
  return authenticatedRequest(req).orgId as string;
}

const SENSOR_TYPES = [
  "vibration",
  "temperature",
  "pressure",
  "flow",
  "level",
  "rpm",
  "torque",
  "humidity",
  "exhaust_gas",
  "fuel_flow",
  "other",
] as const;

const createSensorSchema = z.object({
  vesselId: z.string().min(1),
  equipmentId: z.string().optional(),
  sensorTag: z.string().min(1),
  sensorType: z.enum(SENSOR_TYPES),
  sensorLocation: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  calibrationIntervalDays: z.number().int().min(1).default(365),
  lastCalibrationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  calibrationStandard: z.string().optional(),
  measurementRangeMin: z.number().optional(),
  measurementRangeMax: z.number().optional(),
  measurementUnit: z.string().optional(),
  alarmLow: z.number().optional().nullable(),
  alarmHigh: z.number().optional().nullable(),
  tripLow: z.number().optional().nullable(),
  tripHigh: z.number().optional().nullable(),
  installedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().optional(),
});

const summaryQuerySchema = z.object({ vesselId: z.string().optional() });
const listQuerySchema = z.object({
  vesselId: z.string().optional(),
  equipmentId: z.string().optional(),
  sensorType: z.string().optional(),
  status: z.string().optional(),
});
const sensorIdParamSchema = z.object({ id: z.string().min(1) });

const calibrationEventSchema = z.object({
  calibrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  performedBy: z.string().min(1),
  performedByRank: z.string().optional(),
  status: z.enum(["pass", "fail", "adjusted", "replaced"]),
  driftBefore: z.number().optional(),
  driftAfter: z.number().optional(),
  referenceValue: z.number().optional(),
  measuredValue: z.number().optional(),
  adjustedTo: z.number().optional(),
  certificateNumber: z.string().optional(),
  certificateUrl: z.string().url().optional(),
  notes: z.string().optional(),
  method: z.enum(["field_check", "workshop", "manufacturer_service", "external_lab"]).optional(),
});

router.get("/summary", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { vesselId } = summaryQuerySchema.parse(req.query);
    const summary = await sensorCalibrationService.getSummary(orgId, vesselId);
    return res.json(summary);
  } catch (err) {
    logger.error("SensorCalibration", "Error getting calibration summary", err);
    return res.status(500).json({ error: "Failed to get calibration summary" });
  }
});

router.get("/overdue", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const sensors = await sensorCalibrationService.listOverdue(orgId);
    return res.json(sensors);
  } catch (err) {
    logger.error("SensorCalibration", "Error listing overdue calibrations", err);
    return res.status(500).json({ error: "Failed to list overdue calibrations" });
  }
});

router.get("/", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const filters = listQuerySchema.parse(req.query);
    const sensors = await sensorCalibrationService.list(orgId, filters);
    return res.json(sensors);
  } catch (err) {
    logger.error("SensorCalibration", "Error listing sensors", err);
    return res.status(500).json({ error: "Failed to list sensors" });
  }
});

router.get("/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id: sensorId } = sensorIdParamSchema.parse(req.params);
    const sensor = await sensorCalibrationService.getSensorDetail(orgId, sensorId);
    return res.json(sensor);
  } catch (err) {
    if (err instanceof SensorNotFoundError) {
      return res.status(404).json({ error: "Sensor not found" });
    }
    logger.error("SensorCalibration", "Error getting sensor detail", err);
    return res.status(500).json({ error: "Failed to get sensor" });
  }
});

router.post("/", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const data = createSensorSchema.parse(req.body);
    const sensor = await sensorCalibrationService.createSensor(orgId, data);
    return res.status(201).json(sensor);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    logger.error("SensorCalibration", "Error creating sensor", err);
    return res.status(500).json({ error: "Failed to create sensor" });
  }
});

router.post("/:id/calibrate", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id: sensorId } = sensorIdParamSchema.parse(req.params);
    const data = calibrationEventSchema.parse(req.body);
    const result = await sensorCalibrationService.recordCalibration(orgId, sensorId, data);
    logger.info("SensorCalibration", "Calibration recorded", {
      sensorId,
      sensorTag: result.sensorTag,
      status: data.status,
      nextDue: result.nextCalibrationDue.toISOString(),
    });
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof SensorNotFoundError) {
      return res.status(404).json({ error: "Sensor not found" });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.flatten() });
    }
    logger.error("SensorCalibration", "Error recording calibration", err);
    return res.status(500).json({ error: "Failed to record calibration" });
  }
});

router.delete("/:id", requireOrgId, async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id: sensorId } = sensorIdParamSchema.parse(req.params);
    await sensorCalibrationService.decommission(orgId, sensorId);
    return res.json({ success: true });
  } catch (err) {
    logger.error("SensorCalibration", "Error decommissioning sensor", err);
    return res.status(500).json({ error: "Failed to decommission sensor" });
  }
});

export { router as sensorCalibrationRouter };
export default router;
