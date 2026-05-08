import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { PdmDecisionSupportService } from "../application/decision-support.service";
import { DrizzlePdmContextAdapter, EquipmentOperationalContextAdapter } from "../infrastructure/drizzle-pdm-context.adapter";
import { RecommendationSafetyAdapter } from "../infrastructure/recommendation-safety.adapter";
import { SyntheticTelemetryAdapter } from "../infrastructure/synthetic-telemetry.adapter";

const pdmDecisionSupportRouter = Router();

const service = new PdmDecisionSupportService(
  new DrizzlePdmContextAdapter(),
  new EquipmentOperationalContextAdapter(),
  new RecommendationSafetyAdapter(),
  new SyntheticTelemetryAdapter()
);

const healthStatusSchema = z.enum(["optimal", "watch", "degrading", "critical"]);

const operationalContextSchema = z.object({
  operatingMode: z.enum(["harbour", "transit", "maneuvering", "heavy_weather", "unknown"]).optional(),
  loadFactor: z.number().min(0.05).max(1.5).optional(),
  weatherSeverity: z.number().min(0).max(1).optional(),
  seaState: z.number().min(0).max(12).optional(),
  speedOverGround: z.number().min(0).optional(),
  fuelBurnRate: z.number().min(0).optional(),
  shaftPower: z.number().min(0).optional(),
  cargoLoadPercent: z.number().min(0).max(150).optional(),
  routeSegment: z.string().max(120).optional(),
});

const evaluateSchema = z.object({
  equipmentId: z.string().min(1),
  previousStatus: healthStatusSchema.optional().nullable(),
  minSequenceLength: z.number().int().min(3).max(96).optional(),
  contextOverride: operationalContextSchema.optional(),
});

const syntheticScenarioSchema = z.enum([
  "normal",
  "heavy_weather",
  "cooling_degradation",
  "bearing_wear",
  "fuel_inefficiency",
  "sensor_drift",
  "sensor_dropout",
  "progressive_failure",
  "post_maintenance_recovery",
]);

const syntheticTelemetrySchema = z.object({
  equipmentId: z.string().min(1),
  scenario: syntheticScenarioSchema.default("normal"),
  hours: z.number().int().min(1).max(168).default(24),
  intervalMinutes: z.number().int().min(1).max(120).default(15),
  loadFactor: z.number().min(0.05).max(1.5).optional(),
  weatherSeverity: z.number().min(0).max(1).optional(),
  seed: z.string().max(120).optional(),
});

const safetyCheckSchema = z.object({
  recommendation: z.string().min(1).max(1000),
  riskLevel: z.string().min(1).max(60).default("watch"),
  equipmentId: z.string().optional(),
});

function getOrgId(req: Request): string {
  return (req as AuthenticatedRequest).orgId;
}

pdmDecisionSupportRouter.post("/evaluate", async (req: Request, res: Response) => {
  try {
    const parsed = evaluateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const result = await service.evaluateEquipment({
      orgId: getOrgId(req),
      ...parsed.data,
    });
    res.json(result);
  } catch (error: any) {
    if (String(error?.message).includes("Equipment not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

pdmDecisionSupportRouter.post("/synthetic-telemetry", async (req: Request, res: Response) => {
  try {
    const parsed = syntheticTelemetrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    res.json(service.generateSyntheticTelemetry(parsed.data));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

pdmDecisionSupportRouter.post("/safety-check", async (req: Request, res: Response) => {
  try {
    const parsed = safetyCheckSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    res.json(service.reviewRecommendation(parsed.data));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { pdmDecisionSupportRouter };
