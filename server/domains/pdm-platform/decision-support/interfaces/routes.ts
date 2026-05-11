import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import type { PdmHealthStatus, StandardizedPdmDecision, SyntheticTelemetryResult } from "../domain/types";

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

export interface PdmDecisionSupportRouteService {
  evaluateEquipment(input: {
    orgId: string;
    equipmentId: string;
    previousStatus?: PdmHealthStatus | null;
    minSequenceLength?: number;
    contextOverride?: z.infer<typeof operationalContextSchema>;
  }): Promise<StandardizedPdmDecision>;
  generateSyntheticTelemetry(input: z.infer<typeof syntheticTelemetrySchema>): SyntheticTelemetryResult;
  reviewRecommendation(input: z.infer<typeof safetyCheckSchema>): {
    decision: "approved" | "needs_engineer_review" | "blocked";
    reasons: string[];
    sanitizedRecommendation: string;
  };
}


async function buildDefaultService(): Promise<PdmDecisionSupportRouteService> {
  const [
    { PdmDecisionSupportService },
    { DrizzlePdmContextAdapter, EquipmentOperationalContextAdapter },
    { RecommendationSafetyAdapter },
    { SyntheticTelemetryAdapter },
  ] = await Promise.all([
    import("../application/decision-support.service"),
    import("../infrastructure/drizzle-pdm-context.adapter"),
    import("../infrastructure/recommendation-safety.adapter"),
    import("../infrastructure/synthetic-telemetry.adapter"),
  ]);
  return new PdmDecisionSupportService(
    new DrizzlePdmContextAdapter(),
    new EquipmentOperationalContextAdapter(),
    new RecommendationSafetyAdapter(),
    new SyntheticTelemetryAdapter()
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected PdM decision-support error";
}

function getOrgId(req: Request): string | null {
  const orgId = (req as AuthenticatedRequest).orgId;
  return typeof orgId === "string" && orgId.trim() !== "" ? orgId : null;
}

function requireOrgId(req: Request, res: Response): string | null {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(401).json({ error: "Organization context is required" });
    return null;
  }
  return orgId;
}

export function createPdmDecisionSupportRouter(
  service: PdmDecisionSupportRouteService
): Router {
  const router = Router();

  router.post("/evaluate", async (req: Request, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) {
      return;
    }

    try {
      const parsed = evaluateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten().fieldErrors });
        return;
      }

      const result = await service.evaluateEquipment({
        orgId,
        ...parsed.data,
      });
      res.json(result);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message.includes("Equipment not found")) {
        res.status(404).json({ error: message });
        return;
      }
      res.status(500).json({ error: message });
    }
  });

  router.post("/synthetic-telemetry", (req: Request, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) {
      return;
    }

    try {
      const parsed = syntheticTelemetrySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten().fieldErrors });
        return;
      }
      res.json(service.generateSyntheticTelemetry(parsed.data));
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  router.post("/safety-check", (req: Request, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) {
      return;
    }

    try {
      const parsed = safetyCheckSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten().fieldErrors });
        return;
      }
      res.json(service.reviewRecommendation(parsed.data));
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  return router;
}

const pdmDecisionSupportRouter = Router();
let lazyInner: Router | null = null;
let lazyInnerPromise: Promise<Router> | null = null;

async function getLazyInner(): Promise<Router> {
  if (lazyInner) return lazyInner;
  if (!lazyInnerPromise) {
    lazyInnerPromise = buildDefaultService().then((service) => {
      lazyInner = createPdmDecisionSupportRouter(service);
      return lazyInner;
    });
  }
  return lazyInnerPromise;
}

pdmDecisionSupportRouter.use((req, res, next) => {
  if (lazyInner) {
    return lazyInner(req, res, next);
  }
  getLazyInner()
    .then((inner) => inner(req, res, next))
    .catch(next);
});

export { pdmDecisionSupportRouter };
