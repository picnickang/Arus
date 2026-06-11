import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticatedRequest } from "../../../../middleware/auth";
import type {
  PdmHealthStatus,
  StandardizedPdmDecision,
  SyntheticTelemetryResult,
} from "../domain/types";
import { EquipmentNotFoundError, PdmResponseValidationError } from "../domain/errors";

const healthStatusSchema = z.enum(["optimal", "watch", "degrading", "critical"]);

const operationalContextSchema = z.object({
  operatingMode: z
    .enum(["harbour", "transit", "maneuvering", "heavy_weather", "unknown"])
    .optional(),
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

const probabilitySchema = z.object({
  optimal: z.number().min(0).max(1),
  watch: z.number().min(0).max(1),
  degrading: z.number().min(0).max(1),
  critical: z.number().min(0).max(1),
});

const calibrationSchema = z.object({
  totalFeedback: z.number().int().min(0),
  accurateRate: z.number().min(0).max(1),
  falsePositiveRate: z.number().min(0).max(1),
  falseNegativeRate: z.number().min(0).max(1),
  confirmedFailureRate: z.number().min(0).max(1),
  scoreBias: z.number().min(-1).max(1),
  confidenceMultiplier: z.number().min(0).max(2),
  source: z.enum(["prediction-feedback", "default"]),
  generatedAt: z.string(),
  notes: z.array(z.string()),
});

const recommendationResponseSchema = z.object({
  action: z.string(),
  priority: z.enum(["routine", "soon", "urgent", "immediate"]),
  dueInHours: z.number().min(0),
  reason: z.string(),
  createWorkOrder: z.boolean(),
});

const safetyReviewResponseSchema = z.object({
  decision: z.enum(["approved", "needs_engineer_review", "blocked"]),
  reasons: z.array(z.string()),
  sanitizedRecommendation: z.string(),
});

const pdmDecisionResponseSchema = z.object({
  equipmentId: z.string(),
  equipmentName: z.string().nullable().optional(),
  equipmentType: z.string().nullable().optional(),
  predictedStatus: healthStatusSchema,
  previousStatus: healthStatusSchema.nullable().optional(),
  predictedRulHours: z.number().min(0),
  probabilities: probabilitySchema,
  confidence: z.number().min(0).max(1),
  alertNeeded: z.boolean(),
  decisionScore: z.number().min(0).max(1),
  featureWindowStart: z.string().nullable(),
  featureWindowEnd: z.string().nullable(),
  featureSnapshotId: z.string().nullable(),
  operatingContext: z.object({
    operatingMode: z.string(),
    loadFactor: z.number(),
    weatherSeverity: z.number(),
    seaState: z.number(),
    speedOverGround: z.number().nullable(),
    fuelBurnRate: z.number().nullable(),
    shaftPower: z.number().nullable(),
    cargoLoadPercent: z.number().nullable(),
    routeSegment: z.string().nullable(),
    contextConfidence: z.number().min(0).max(1),
    notes: z.array(z.string()),
  }),
  performanceIndicators: z.object({
    efficiencyLossPercent: z.number(),
    loadNormalizedVibration: z.number().nullable(),
    loadNormalizedTemperature: z.number().nullable(),
    fuelPenaltyScore: z.number(),
    dataQualityScore: z.number().min(0).max(1),
    minimumSequenceSatisfied: z.boolean(),
    sequenceLength: z.number().int().min(0),
    requiredSequenceLength: z.number().int().min(1),
  }),
  recommendations: z.array(recommendationResponseSchema),
  safetyReview: safetyReviewResponseSchema,
  calibration: calibrationSchema.optional(),
  lineage: z.object({
    source: z.literal("pdm-decision-support"),
    modelFamily: z.string(),
    featureSetVersion: z.string(),
    contextVersion: z.string(),
    generatedAt: z.string(),
  }),
});

const syntheticTelemetryResponseSchema = z.object({
  equipmentId: z.string(),
  scenario: syntheticScenarioSchema,
  hours: z.number().int().min(1),
  intervalMinutes: z.number().int().min(1),
  samples: z.array(
    z.object({
      timestamp: z.string(),
      rpm: z.number(),
      loadFactor: z.number(),
      oilTemp: z.number(),
      coolantTemp: z.number(),
      vibrationRms: z.number(),
      fuelFlow: z.number(),
      pressure: z.number(),
      sensorHealthy: z.boolean(),
    })
  ),
  summary: z.object({
    sampleCount: z.number().int().min(0),
    expectedStatus: healthStatusSchema,
    failureMode: z.string(),
    usefulFor: z.array(z.string()),
  }),
  featureHints: z.object({
    meanTemp: z.number(),
    meanVibration: z.number(),
    rmsVibration: z.number(),
    meanPressure: z.number(),
    kurtosis: z.number(),
    sampleCount: z.number().int().min(0),
  }),
});

function validateOutbound<T>(schema: z.ZodTypeAny, value: T): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new PdmResponseValidationError(parsed.error.message);
  }
  return parsed.data as T;
}

export interface PdmDecisionSupportRouteService {
  evaluateEquipment(input: {
    orgId: string;
    equipmentId: string;
    previousStatus?: PdmHealthStatus | null | undefined;
    minSequenceLength?: number | undefined;
    contextOverride?: z.infer<typeof operationalContextSchema> | undefined;
  }): Promise<StandardizedPdmDecision>;
  generateSyntheticTelemetry(
    input: z.infer<typeof syntheticTelemetrySchema>
  ): SyntheticTelemetryResult;
  reviewRecommendation(input: z.infer<typeof safetyCheckSchema>): {
    decision: "approved" | "needs_engineer_review" | "blocked";
    reasons: string[];
    sanitizedRecommendation: string;
  };
}

async function buildDefaultService(): Promise<PdmDecisionSupportRouteService> {
  const [
    { PdmDecisionSupportService },
    { DrizzlePdmContextAdapter, DrizzlePdmCalibrationAdapter, EquipmentOperationalContextAdapter },
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
    new SyntheticTelemetryAdapter(),
    new DrizzlePdmCalibrationAdapter()
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected PdM decision-support error";
}

function getOrgId(req: Request): string | null {
  const orgId = authenticatedRequest(req).orgId;
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

export function createPdmDecisionSupportRouter(service: PdmDecisionSupportRouteService): Router {
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
      res.json(validateOutbound(pdmDecisionResponseSchema, result));
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (error instanceof EquipmentNotFoundError) {
        res.status(404).json({ error: message });
        return;
      }
      if (error instanceof PdmResponseValidationError) {
        res.status(502).json({ error: message });
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
      res.json(
        validateOutbound(
          syntheticTelemetryResponseSchema,
          service.generateSyntheticTelemetry(parsed.data)
        )
      );
    } catch (error: unknown) {
      if (error instanceof PdmResponseValidationError) {
        res.status(502).json({ error: getErrorMessage(error) });
        return;
      }
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
      res.json(
        validateOutbound(safetyReviewResponseSchema, service.reviewRecommendation(parsed.data))
      );
    } catch (error: unknown) {
      if (error instanceof PdmResponseValidationError) {
        res.status(502).json({ error: getErrorMessage(error) });
        return;
      }
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  return router;
}

const pdmDecisionSupportRouter = Router();
let lazyInner: Router | null = null;
let lazyInnerPromise: Promise<Router> | null = null;

async function getLazyInner(): Promise<Router> {
  if (lazyInner) {
    return lazyInner;
  }
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
