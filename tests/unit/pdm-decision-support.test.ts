import { describe, expect, it } from "@jest/globals";
import { PdmDecisionSupportService } from "../../server/domains/pdm-platform/decision-support/application/decision-support.service";
import { RecommendationSafetyAdapter } from "../../server/domains/pdm-platform/decision-support/infrastructure/recommendation-safety.adapter";
import { SyntheticTelemetryAdapter } from "../../server/domains/pdm-platform/decision-support/infrastructure/synthetic-telemetry.adapter";
import { EquipmentNotFoundError } from "../../server/domains/pdm-platform/decision-support/domain/errors";
import type {
  EquipmentContext,
  EquipmentFeatureSnapshot,
  NormalizedOperationalContext,
  OperationalContextInput,
  PdmHealthStatus,
} from "../../server/domains/pdm-platform/decision-support/domain/types";
import type {
  OperationalContextPort,
  PdmContextPort,
} from "../../server/domains/pdm-platform/decision-support/domain/ports";

class FakePdmContextPort implements PdmContextPort {
  constructor(
    private readonly equipment: EquipmentContext | null,
    private readonly features: EquipmentFeatureSnapshot[]
  ) {}

  async getEquipmentContext(_orgId: string, _equipmentId: string): Promise<EquipmentContext | null> {
    return this.equipment;
  }

  async getRecentFeatureSnapshots(
    _orgId: string,
    _equipmentId: string,
    limit: number
  ): Promise<EquipmentFeatureSnapshot[]> {
    return this.features.slice(0, limit);
  }
}

class FakeOperationalContextPort implements OperationalContextPort {
  normalize(
    _equipment: EquipmentContext | null,
    override?: OperationalContextInput
  ): NormalizedOperationalContext {
    return {
      operatingMode: override?.operatingMode ?? "transit",
      loadFactor: override?.loadFactor ?? 0.7,
      weatherSeverity: override?.weatherSeverity ?? 0.1,
      seaState: override?.seaState ?? 3,
      speedOverGround: override?.speedOverGround ?? null,
      fuelBurnRate: override?.fuelBurnRate ?? null,
      shaftPower: override?.shaftPower ?? null,
      cargoLoadPercent: override?.cargoLoadPercent ?? null,
      routeSegment: override?.routeSegment ?? null,
      contextConfidence: 0.9,
      notes: override ? ["test override supplied"] : [],
    };
  }
}

function buildService(features: EquipmentFeatureSnapshot[], equipment: EquipmentContext | null = defaultEquipment()) {
  return new PdmDecisionSupportService(
    new FakePdmContextPort(equipment, features),
    new FakeOperationalContextPort(),
    new RecommendationSafetyAdapter(),
    new SyntheticTelemetryAdapter()
  );
}

function defaultEquipment(): EquipmentContext {
  return {
    id: "eq-main-engine-1",
    name: "Main Engine 1",
    type: "main_engine",
    vesselId: "vessel-001",
    vesselName: "MV Test Vessel",
    criticalityLevel: "critical",
    operatingParameters: null,
  };
}

function snapshot(
  id: string,
  minutesAgo: number,
  overrides: Partial<EquipmentFeatureSnapshot>
): EquipmentFeatureSnapshot {
  return {
    id,
    timestamp: new Date(Date.UTC(2026, 0, 1, 12, 0, 0) - minutesAgo * 60_000),
    windowMinutes: 15,
    sampleCount: 120,
    meanTemp: 70,
    stdTemp: 2,
    meanVibration: 2.5,
    stdVibration: 0.2,
    meanPressure: 185,
    stdPressure: 3,
    rmsVibration: 2.7,
    peakToPeak: 6,
    kurtosis: 3,
    skewness: 0.1,
    ...overrides,
  };
}

function sumProbabilities(probabilities: Record<PdmHealthStatus, number>): number {
  return Object.values(probabilities).reduce((total, value) => total + value, 0);
}

describe("PdM decision-support hexagonal service", () => {
  it("returns the standardized decision contract and alerts when equipment worsens", async () => {
    const features: EquipmentFeatureSnapshot[] = [
      snapshot("newest", 0, {
        meanTemp: 122,
        rmsVibration: 10.4,
        meanVibration: 9.8,
        peakToPeak: 26,
        kurtosis: 8.4,
        meanPressure: 72,
      }),
      snapshot("f-2", 15, { meanTemp: 96, rmsVibration: 6.5, meanVibration: 6.2, peakToPeak: 16, kurtosis: 5.2, meanPressure: 105 }),
      snapshot("f-3", 30, { meanTemp: 90, rmsVibration: 5.8, meanVibration: 5.5, peakToPeak: 13, kurtosis: 4.8, meanPressure: 118 }),
      snapshot("f-4", 45, { meanTemp: 86, rmsVibration: 5.1, meanVibration: 4.9, peakToPeak: 11, kurtosis: 4.3, meanPressure: 130 }),
      snapshot("f-5", 60, { meanTemp: 81, rmsVibration: 4.4, meanVibration: 4.2, peakToPeak: 9, kurtosis: 3.9, meanPressure: 145 }),
      snapshot("f-6", 75, { meanTemp: 78, rmsVibration: 3.8, meanVibration: 3.7, peakToPeak: 8, kurtosis: 3.5, meanPressure: 160 }),
      snapshot("f-7", 90, { meanTemp: 75, rmsVibration: 3.2, meanVibration: 3.0, peakToPeak: 7, kurtosis: 3.2, meanPressure: 172 }),
      snapshot("oldest", 105, { meanTemp: 72, rmsVibration: 2.8, meanVibration: 2.6, peakToPeak: 6, kurtosis: 3.1, meanPressure: 182 }),
    ];

    const result = await buildService(features).evaluateEquipment({
      orgId: "org-test",
      equipmentId: "eq-main-engine-1",
      previousStatus: "optimal",
      minSequenceLength: 8,
      contextOverride: {
        operatingMode: "heavy_weather",
        loadFactor: 0.92,
        weatherSeverity: 0.25,
        fuelBurnRate: 110,
        shaftPower: 260,
        routeSegment: "sea-trial",
      },
    });

    expect(result.equipmentId).toBe("eq-main-engine-1");
    expect(result.equipmentName).toBe("Main Engine 1");
    expect(["degrading", "critical"]).toContain(result.predictedStatus);
    expect(result.previousStatus).toBe("optimal");
    expect(result.alertNeeded).toBe(true);
    expect(result.predictedRulHours).toBeGreaterThanOrEqual(6);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(sumProbabilities(result.probabilities)).toBeGreaterThanOrEqual(0.995);
    expect(sumProbabilities(result.probabilities)).toBeLessThanOrEqual(1.005);
    expect(result.performanceIndicators.minimumSequenceSatisfied).toBe(true);
    expect(result.performanceIndicators.sequenceLength).toBe(8);
    expect(result.performanceIndicators.efficiencyLossPercent).toBeGreaterThan(0);
    expect(result.recommendations.some((recommendation) => recommendation.createWorkOrder)).toBe(true);
    expect(result.safetyReview.decision).not.toBe("blocked");
    expect(result.featureWindowStart).toBe("2026-01-01T10:15:00.000Z");
    expect(result.featureWindowEnd).toBe("2026-01-01T12:00:00.000Z");
    expect(result.featureSnapshotId).toBe("newest");
    expect(result.lineage.source).toBe("pdm-decision-support");
    expect(result.lineage.featureSetVersion).toBe("v3.context-window-8.outcome-calibrated");
  });

  it("keeps low-data decisions from becoming irreversible work orders", async () => {
    const features: EquipmentFeatureSnapshot[] = [
      snapshot("newest", 0, { meanTemp: 82, rmsVibration: 3.7, meanPressure: 170 }),
      snapshot("oldest", 15, { meanTemp: 80, rmsVibration: 3.4, meanPressure: 174 }),
    ];

    const result = await buildService(features).evaluateEquipment({
      orgId: "org-test",
      equipmentId: "eq-main-engine-1",
      previousStatus: "watch",
      minSequenceLength: 8,
    });

    expect(result.performanceIndicators.minimumSequenceSatisfied).toBe(false);
    expect(result.performanceIndicators.sequenceLength).toBe(2);
    expect(result.recommendations[0]?.action).toContain("Collect more telemetry");
    expect(result.recommendations[0]?.createWorkOrder).toBe(false);
    expect(result.confidence).toBeLessThan(0.75);
  });

  it("blocks unsafe AI or PdM recommendations before they reach operators", () => {
    const service = buildService([]);

    const review = service.reviewRecommendation({
      recommendation: "Bypass alarm and continue running until failure.",
      riskLevel: "critical",
      equipmentId: "eq-main-engine-1",
    });

    expect(review.decision).toBe("blocked");
    expect(review.reasons.join(" ")).toMatch(/bypass|safety|interlocks|shutdowns/i);
    expect(review.sanitizedRecommendation).toMatch(/Escalate to the chief engineer/i);
  });

  it("generates deterministic synthetic telemetry scenarios for PdM pipeline smoke tests", () => {
    const service = buildService([]);

    const result = service.generateSyntheticTelemetry({
      equipmentId: "eq-main-engine-1",
      scenario: "bearing_wear",
      hours: 12,
      intervalMinutes: 30,
      loadFactor: 0.72,
      weatherSeverity: 0.15,
      seed: "bearing-wear-regression",
    });

    expect(result.equipmentId).toBe("eq-main-engine-1");
    expect(result.scenario).toBe("bearing_wear");
    expect(result.samples).toHaveLength(24);
    expect(result.summary.expectedStatus).toBe("degrading");
    expect(result.summary.failureMode).toMatch(/bearing/i);
    expect(result.featureHints.sampleCount).toBeGreaterThan(0);
    expect(result.featureHints.rmsVibration).toBeGreaterThan(0);
    expect(result.samples.every((sample) => sample.timestamp && Number.isFinite(sample.rpm))).toBe(true);
  });


  it("adjusts scoring using outcome feedback calibration", async () => {
    const features: EquipmentFeatureSnapshot[] = [
      snapshot("newest", 0, { meanTemp: 82, rmsVibration: 3.7, meanPressure: 170 }),
      snapshot("f-2", 15, { meanTemp: 80, rmsVibration: 3.4, meanPressure: 174 }),
      snapshot("f-3", 30, { meanTemp: 78, rmsVibration: 3.1, meanPressure: 178 }),
      snapshot("oldest", 45, { meanTemp: 76, rmsVibration: 2.9, meanPressure: 180 }),
    ];

    const calibratedService = new PdmDecisionSupportService(
      new FakePdmContextPort(defaultEquipment(), features),
      new FakeOperationalContextPort(),
      new RecommendationSafetyAdapter(),
      new SyntheticTelemetryAdapter(),
      {
        async getCalibrationSnapshot() {
          return {
            totalFeedback: 12,
            accurateRate: 0.75,
            falsePositiveRate: 0.05,
            falseNegativeRate: 0.25,
            confirmedFailureRate: 0.2,
            scoreBias: 0.05,
            confidenceMultiplier: 1,
            source: "prediction-feedback",
            generatedAt: "2026-01-01T12:00:00.000Z",
            notes: ["test calibration"],
          };
        },
      }
    );

    const result = await calibratedService.evaluateEquipment({
      orgId: "org-test",
      equipmentId: "eq-main-engine-1",
      previousStatus: "optimal",
      minSequenceLength: 4,
    });

    expect(result.calibration?.source).toBe("prediction-feedback");
    expect(result.calibration?.totalFeedback).toBe(12);
    expect(result.decisionScore).toBeGreaterThan(0);
    expect(result.lineage.featureSetVersion).toContain("outcome-calibrated");
  });

  it("fails clearly when equipment context is missing", async () => {
    await expect(
      buildService([], null).evaluateEquipment({
        orgId: "org-test",
        equipmentId: "missing-equipment",
      })
    ).rejects.toBeInstanceOf(EquipmentNotFoundError);
  });
});

