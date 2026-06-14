/**
 * ML Analytics Application Service
 *
 * Orchestrates the ML-analytics read/write operations behind injected ports,
 * normalizing storage rows for the HTTP interface layer and emitting PdM domain
 * events. All cross-domain storage access is supplied via ports (see
 * domain/ports.ts); the concrete adapters are wired in application/index.ts from
 * the composition layer, so this domain holds no direct cross-domain storage
 * coupling.
 */

import type {
  AnomalyDetection,
  InsertAnomalyDetection,
  FailurePrediction,
  InsertFailurePrediction,
  ThresholdOptimization,
  InsertThresholdOptimization,
  DigitalTwin,
  TwinSimulation,
  InsightSnapshot,
  MlModel,
  PdmScoreLog,
} from "@shared/schema";
import type {
  IMlAnalyticsStore,
  IDigitalTwinStore,
  IInsightSnapshotStore,
  IEquipmentLookupPort,
  IPdmScoreStore,
} from "../domain/ports.js";
import {
  normalizeAnomalyDetection,
  normalizeAnomalyDetections,
  normalizeFailurePrediction,
  normalizeFailurePredictions,
  normalizeThresholdOptimization,
  normalizeThresholdOptimizations,
  normalizeDigitalTwin,
  normalizeDigitalTwins,
  normalizeInsightSnapshot,
  normalizeInsightSnapshots,
} from "../../../analytics-data-normalizer.js";
import { domainEventBus, createDomainEvent } from "../../../lib/domain-event-bus/index.js";
import { logger } from "../../../utils/logger.js";

export class MlAnalyticsService {
  constructor(
    private readonly store: IMlAnalyticsStore,
    private readonly twins: IDigitalTwinStore,
    private readonly insights: IInsightSnapshotStore,
    private readonly equipment: IEquipmentLookupPort,
    private readonly pdmScores: IPdmScoreStore
  ) {}

  // --- Anomaly detections ---

  async listAnomalies(
    orgId: string,
    equipmentId?: string,
    severity?: string
  ): Promise<AnomalyDetection[]> {
    return normalizeAnomalyDetections(
      await this.store.getAnomalyDetections(orgId, equipmentId, severity)
    );
  }

  async getAnomaly(id: number, orgId: string): Promise<AnomalyDetection | undefined> {
    const detection = await this.store.getAnomalyDetection(id, orgId);
    return detection ? normalizeAnomalyDetection(detection) : undefined;
  }

  async createAnomaly(
    data: InsertAnomalyDetection,
    orgId: string
  ): Promise<AnomalyDetection> {
    const detection = await this.store.createAnomalyDetection(data, orgId);

    if (detection.severity === "high" || detection.severity === "critical") {
      try {
        const equipment = await this.equipment.getEquipment(orgId, detection.equipmentId);
        if (equipment) {
          domainEventBus.emit(
            "pdm.anomaly.created",
            createDomainEvent("pdm.anomaly.created", orgId, {
              vesselId: equipment.vesselId || "unknown",
              equipmentId: detection.equipmentId,
              severity: detection.severity as "low" | "medium" | "high" | "critical",
              anomalyType: detection.anomalyType || "unknown",
            })
          );
        }
      } catch (eventError) {
        logger.error("MlAnalyticsService", "Failed to emit anomaly event", eventError);
      }
    }

    return normalizeAnomalyDetection(detection);
  }

  async acknowledgeAnomaly(
    id: number,
    acknowledgedBy: string,
    orgId: string
  ): Promise<AnomalyDetection> {
    return normalizeAnomalyDetection(
      await this.store.acknowledgeAnomaly(id, acknowledgedBy, orgId)
    );
  }

  // --- Failure predictions ---

  async listPredictions(
    orgId: string,
    equipmentId?: string,
    riskLevel?: string
  ): Promise<FailurePrediction[]> {
    return normalizeFailurePredictions(
      await this.store.getFailurePredictions(orgId, equipmentId, riskLevel)
    );
  }

  async getPrediction(id: number, orgId: string): Promise<FailurePrediction | undefined> {
    const prediction = await this.store.getFailurePrediction(id, orgId);
    return prediction ? normalizeFailurePrediction(prediction) : undefined;
  }

  async createPrediction(
    data: InsertFailurePrediction,
    orgId: string
  ): Promise<FailurePrediction> {
    const prediction = await this.store.createFailurePrediction(data, orgId);

    try {
      const equipment = await this.equipment.getEquipment(orgId, data.equipmentId);
      if (equipment) {
        const remainingDays = data.predictedFailureDate
          ? Math.max(
              0,
              Math.floor(
                (new Date(data.predictedFailureDate).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : 30;

        const riskLevel =
          remainingDays <= 3
            ? "critical"
            : remainingDays <= 7
              ? "high"
              : remainingDays <= 14
                ? "medium"
                : "low";
        domainEventBus.emit(
          "pdm.rul.updated",
          createDomainEvent("pdm.rul.updated", orgId, {
            vesselId: equipment.vesselId || "unknown",
            equipmentId: data.equipmentId,
            remainingDays,
            riskLevel,
          })
        );
      }
    } catch (eventError) {
      logger.error("MlAnalyticsService", "Failed to emit RUL update event", eventError);
    }

    return normalizeFailurePrediction(prediction);
  }

  // --- Threshold optimizations ---

  async listThresholds(
    orgId: string,
    equipmentId?: string,
    status?: string
  ): Promise<ThresholdOptimization[]> {
    return normalizeThresholdOptimizations(
      await this.store.getThresholdOptimizations(orgId, equipmentId, status)
    );
  }

  async getThreshold(id: number, orgId: string): Promise<ThresholdOptimization | undefined> {
    const optimization = await this.store.getThresholdOptimization(id, orgId);
    return optimization ? normalizeThresholdOptimization(optimization) : undefined;
  }

  async createThreshold(
    data: InsertThresholdOptimization,
    orgId: string
  ): Promise<ThresholdOptimization> {
    return normalizeThresholdOptimization(
      await this.store.createThresholdOptimization(data, orgId)
    );
  }

  async applyThreshold(id: number, orgId: string): Promise<ThresholdOptimization> {
    return normalizeThresholdOptimization(
      await this.store.applyThresholdOptimization(id, orgId)
    );
  }

  // --- Digital twins ---

  async listDigitalTwins(
    orgId: string,
    vesselId?: string,
    twinType?: string
  ): Promise<DigitalTwin[]> {
    return normalizeDigitalTwins(await this.twins.getDigitalTwins(orgId, vesselId, twinType));
  }

  async getDigitalTwin(id: string, orgId: string): Promise<DigitalTwin | undefined> {
    const twin = await this.twins.getDigitalTwin(id, orgId);
    return twin ? normalizeDigitalTwin(twin) : undefined;
  }

  async listTwinSimulations(
    digitalTwinId?: string,
    scenarioType?: string,
    status?: string
  ): Promise<TwinSimulation[]> {
    return this.twins.getTwinSimulations(digitalTwinId, scenarioType, status);
  }

  async getTwinSimulation(id: string): Promise<TwinSimulation | undefined> {
    return this.twins.getTwinSimulation(id);
  }

  // --- Insight snapshots ---

  async listInsightSnapshots(orgId: string, scope?: string): Promise<InsightSnapshot[]> {
    return normalizeInsightSnapshots(await this.insights.getInsightSnapshots(orgId, scope));
  }

  async getLatestInsightSnapshot(
    orgId: string,
    scope: string
  ): Promise<InsightSnapshot | undefined> {
    const snapshot = await this.insights.getLatestInsightSnapshot(orgId, scope);
    return snapshot ? normalizeInsightSnapshot(snapshot) : undefined;
  }

  // --- Exports (raw, un-normalized datasets) ---

  async getMlModels(orgId: string): Promise<MlModel[]> {
    return this.store.getMlModels(orgId);
  }

  async getFailurePredictionsRaw(orgId: string): Promise<FailurePrediction[]> {
    return this.store.getFailurePredictions(orgId);
  }

  /** Datasets backing the complete ML/PDM export (raw rows, enrichment/format done by caller). */
  async getCompleteExportDatasets(orgId: string): Promise<{
    mlModels: MlModel[];
    failurePredictions: FailurePrediction[];
    anomalyDetections: AnomalyDetection[];
    thresholdOptimizations: ThresholdOptimization[];
    pdmScores: PdmScoreLog[];
  }> {
    const [mlModels, failurePredictions, anomalyDetections, thresholdOptimizations, pdmScores] =
      await Promise.all([
        this.store.getMlModels(orgId),
        this.store.getFailurePredictions(orgId),
        this.store.getAnomalyDetections(orgId),
        this.store.getThresholdOptimizations(orgId),
        this.pdmScores.getPdmScores(),
      ]);
    return { mlModels, failurePredictions, anomalyDetections, thresholdOptimizations, pdmScores };
  }
}
