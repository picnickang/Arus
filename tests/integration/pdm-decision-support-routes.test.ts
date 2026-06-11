import { describe, expect, it } from "@jest/globals";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import {
  createPdmDecisionSupportRouter,
  type PdmDecisionSupportRouteService,
} from "../../server/domains/pdm-platform/decision-support/interfaces/routes";
import type {
  PdmHealthStatus,
  StandardizedPdmDecision,
  SyntheticTelemetryResult,
} from "../../server/domains/pdm-platform/decision-support/domain/types";
import { EquipmentNotFoundError } from "../../server/domains/pdm-platform/decision-support/domain/errors";

interface CapturedCall {
  orgId?: string;
  equipmentId?: string;
  previousStatus?: PdmHealthStatus | null;
  minSequenceLength?: number;
  contextOverride?: Record<string, unknown>;
}

function buildDecision(overrides: Partial<StandardizedPdmDecision> = {}): StandardizedPdmDecision {
  return {
    equipmentId: "eq-main-engine-1",
    equipmentName: "Main Engine 1",
    equipmentType: "main_engine",
    predictedStatus: "degrading",
    previousStatus: "watch",
    predictedRulHours: 48,
    probabilities: {
      optimal: 0.05,
      watch: 0.15,
      degrading: 0.65,
      critical: 0.15,
    },
    confidence: 0.82,
    alertNeeded: true,
    decisionScore: 0.72,
    featureWindowStart: "2026-01-01T10:15:00.000Z",
    featureWindowEnd: "2026-01-01T12:00:00.000Z",
    featureSnapshotId: "feature-newest",
    operatingContext: {
      operatingMode: "transit",
      loadFactor: 0.72,
      weatherSeverity: 0.2,
      seaState: 3,
      speedOverGround: null,
      fuelBurnRate: null,
      shaftPower: null,
      cargoLoadPercent: null,
      routeSegment: null,
      contextConfidence: 0.9,
      notes: [],
    },
    performanceIndicators: {
      efficiencyLossPercent: 12.4,
      loadNormalizedVibration: 7.1,
      loadNormalizedTemperature: 119.2,
      fuelPenaltyScore: 0.21,
      dataQualityScore: 0.94,
      minimumSequenceSatisfied: true,
      sequenceLength: 8,
      requiredSequenceLength: 8,
    },
    recommendations: [
      {
        action: "Schedule targeted inspection for Main Engine 1.",
        priority: "urgent",
        dueInHours: 48,
        reason: "Risk trend suggests degradation rather than normal operating stress.",
        createWorkOrder: true,
      },
    ],
    safetyReview: {
      decision: "approved",
      reasons: [],
      sanitizedRecommendation: "Schedule targeted inspection for Main Engine 1.",
    },
    calibration: {
      totalFeedback: 4,
      accurateRate: 0.75,
      falsePositiveRate: 0.1,
      falseNegativeRate: 0.15,
      confirmedFailureRate: 0.25,
      scoreBias: 0.02,
      confidenceMultiplier: 0.95,
      source: "prediction-feedback",
      generatedAt: "2026-01-01T12:00:00.000Z",
      notes: ["route test calibration"],
    },
    lineage: {
      source: "pdm-decision-support",
      modelFamily: "heuristic-context-normalized",
      featureSetVersion: "v3.context-window-8.outcome-calibrated",
      contextVersion: "v1.operational-normalization",
      generatedAt: "2026-01-01T12:01:00.000Z",
    },
    ...overrides,
  };
}

function buildSynthetic(): SyntheticTelemetryResult {
  return {
    equipmentId: "eq-main-engine-1",
    scenario: "bearing_wear",
    hours: 24,
    intervalMinutes: 15,
    samples: [
      {
        timestamp: "2026-01-01T12:00:00.000Z",
        rpm: 1420,
        loadFactor: 0.72,
        oilTemp: 88,
        coolantTemp: 80,
        vibrationRms: 5.4,
        fuelFlow: 62,
        pressure: 180,
        sensorHealthy: true,
      },
    ],
    summary: {
      sampleCount: 96,
      expectedStatus: "degrading",
      failureMode: "bearing wear / alignment degradation",
      usefulFor: ["PdM inference smoke tests"],
    },
    featureHints: {
      meanTemp: 84,
      meanVibration: 5.1,
      rmsVibration: 5.4,
      meanPressure: 180,
      kurtosis: 4.2,
      sampleCount: 96,
    },
  };
}

interface FakeServiceOptions {
  evaluateError?: Error;
}

class FakeDecisionSupportRouteService implements PdmDecisionSupportRouteService {
  readonly evaluateCalls: CapturedCall[] = [];
  readonly syntheticCalls: Array<Record<string, unknown>> = [];
  readonly safetyCalls: Array<Record<string, unknown>> = [];

  constructor(private readonly options: FakeServiceOptions = {}) {}

  async evaluateEquipment(input: CapturedCall): Promise<StandardizedPdmDecision> {
    this.evaluateCalls.push(input);
    if (this.options.evaluateError) {
      throw this.options.evaluateError;
    }
    return buildDecision({
      equipmentId: input.equipmentId ?? "eq-main-engine-1",
      previousStatus: input.previousStatus ?? null,
    });
  }

  generateSyntheticTelemetry(input: {
    equipmentId: string;
    scenario: SyntheticTelemetryResult["scenario"];
    hours: number;
    intervalMinutes: number;
    loadFactor?: number;
    weatherSeverity?: number;
    seed?: string;
  }): SyntheticTelemetryResult {
    this.syntheticCalls.push(input);
    return {
      ...buildSynthetic(),
      equipmentId: input.equipmentId,
      scenario: input.scenario,
      hours: input.hours,
      intervalMinutes: input.intervalMinutes,
    };
  }

  reviewRecommendation(input: { recommendation: string; riskLevel: string; equipmentId?: string }) {
    this.safetyCalls.push(input);
    const isUnsafe = /bypass|disable|operate until failure/i.test(input.recommendation);
    return {
      decision: isUnsafe ? ("blocked" as const) : ("approved" as const),
      reasons: isUnsafe ? ["Unsafe maintenance recommendation was blocked."] : [],
      sanitizedRecommendation: isUnsafe ? "Escalate to the chief engineer." : input.recommendation,
    };
  }
}

function buildApp(service: PdmDecisionSupportRouteService, orgId: string | null = "org-test") {
  const app = express();
  app.use(express.json());
  if (orgId) {
    app.use((req: Request & { orgId?: string }, _res: Response, next: NextFunction) => {
      req.orgId = orgId;
      next();
    });
  }
  app.use("/api/pdm/decision-support", createPdmDecisionSupportRouter(service));
  return app;
}

describe("PdM decision-support API routes", () => {
  it("evaluates equipment with organization context and returns the standardized contract", async () => {
    const service = new FakeDecisionSupportRouteService();
    const app = buildApp(service);

    const response = await request(app)
      .post("/api/pdm/decision-support/evaluate")
      .send({
        equipmentId: "eq-main-engine-1",
        previousStatus: "watch",
        minSequenceLength: 8,
        contextOverride: {
          operatingMode: "transit",
          loadFactor: 0.72,
          weatherSeverity: 0.2,
          seaState: 3,
        },
      })
      .expect(200);

    expect(service.evaluateCalls).toHaveLength(1);
    expect(service.evaluateCalls[0]).toMatchObject({
      orgId: "org-test",
      equipmentId: "eq-main-engine-1",
      previousStatus: "watch",
      minSequenceLength: 8,
    });
    expect(service.evaluateCalls[0]?.contextOverride).toMatchObject({ loadFactor: 0.72 });
    expect(response.body).toMatchObject({
      equipmentId: "eq-main-engine-1",
      predictedStatus: "degrading",
      alertNeeded: true,
      lineage: { source: "pdm-decision-support" },
    });
  });

  it("rejects invalid evaluate payloads before calling the service", async () => {
    const service = new FakeDecisionSupportRouteService();
    const app = buildApp(service);

    const response = await request(app)
      .post("/api/pdm/decision-support/evaluate")
      .send({ equipmentId: "", minSequenceLength: 2 })
      .expect(400);

    expect(service.evaluateCalls).toHaveLength(0);
    expect(response.body.error).toMatchObject({
      equipmentId: expect.any(Array),
      minSequenceLength: expect.any(Array),
    });
  });

  it("returns 404 when the service cannot find equipment", async () => {
    const service = new FakeDecisionSupportRouteService({
      evaluateError: new EquipmentNotFoundError("missing-equipment"),
    });
    const app = buildApp(service);

    const response = await request(app)
      .post("/api/pdm/decision-support/evaluate")
      .send({ equipmentId: "missing-equipment" })
      .expect(404);

    expect(response.body.error).toContain("Equipment not found");
  });

  it("generates synthetic telemetry through the route and applies schema defaults", async () => {
    const service = new FakeDecisionSupportRouteService();
    const app = buildApp(service);

    const response = await request(app)
      .post("/api/pdm/decision-support/synthetic-telemetry")
      .send({ equipmentId: "eq-main-engine-1" })
      .expect(200);

    expect(service.syntheticCalls).toEqual([
      {
        equipmentId: "eq-main-engine-1",
        scenario: "normal",
        hours: 24,
        intervalMinutes: 15,
      },
    ]);
    expect(response.body).toMatchObject({
      equipmentId: "eq-main-engine-1",
      scenario: "normal",
      hours: 24,
      intervalMinutes: 15,
    });
  });

  it("rejects invalid synthetic telemetry ranges", async () => {
    const service = new FakeDecisionSupportRouteService();
    const app = buildApp(service);

    await request(app)
      .post("/api/pdm/decision-support/synthetic-telemetry")
      .send({ equipmentId: "eq-main-engine-1", hours: 999, intervalMinutes: 0 })
      .expect(400);

    expect(service.syntheticCalls).toHaveLength(0);
  });

  it("runs the safety-check route and blocks unsafe recommendations", async () => {
    const service = new FakeDecisionSupportRouteService();
    const app = buildApp(service);

    const response = await request(app)
      .post("/api/pdm/decision-support/safety-check")
      .send({
        recommendation: "Bypass alarm and operate until failure.",
        riskLevel: "critical",
        equipmentId: "eq-main-engine-1",
      })
      .expect(200);

    expect(service.safetyCalls).toEqual([
      {
        recommendation: "Bypass alarm and operate until failure.",
        riskLevel: "critical",
        equipmentId: "eq-main-engine-1",
      },
    ]);
    expect(response.body).toMatchObject({
      decision: "blocked",
      sanitizedRecommendation: "Escalate to the chief engineer.",
    });
  });

  it("rejects requests when org context is missing", async () => {
    const service = new FakeDecisionSupportRouteService();
    const app = buildApp(service, null);

    const response = await request(app)
      .post("/api/pdm/decision-support/evaluate")
      .send({ equipmentId: "eq-main-engine-1" })
      .expect(401);

    expect(response.body.error).toMatch(/Organization context/i);
    expect(service.evaluateCalls).toHaveLength(0);
  });
});
