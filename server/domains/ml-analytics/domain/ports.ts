/**
 * ML Analytics Domain - Ports
 *
 * Pure interfaces describing the data the ML-analytics application service
 * needs. ml-analytics owns no storage of its own — anomaly/prediction/threshold
 * data lives in the pdm-platform storage, twins in digital-twin, insights in
 * analytics, and equipment lookups in the equipment domain. Concrete adapters
 * for these ports live in the composition layer (outside server/domains/), so
 * the domain stays free of cross-domain storage coupling.
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
  Equipment,
  MlModel,
  PdmScoreLog,
} from "@shared/schema";

/** Anomaly / failure-prediction / threshold reads + writes (pdm-platform storage). */
export interface IMlAnalyticsStore {
  getMlModels(orgId: string, modelType?: string, status?: string): Promise<MlModel[]>;
  getAnomalyDetections(
    orgId: string,
    equipmentId?: string,
    severity?: string
  ): Promise<AnomalyDetection[]>;
  getAnomalyDetection(id: number, orgId: string): Promise<AnomalyDetection | undefined>;
  createAnomalyDetection(
    detection: InsertAnomalyDetection,
    orgId: string
  ): Promise<AnomalyDetection>;
  acknowledgeAnomaly(
    id: number,
    acknowledgedBy: string,
    orgId: string
  ): Promise<AnomalyDetection>;

  getFailurePredictions(
    orgId: string,
    equipmentId?: string,
    riskLevel?: string
  ): Promise<FailurePrediction[]>;
  getFailurePrediction(id: number, orgId: string): Promise<FailurePrediction | undefined>;
  createFailurePrediction(
    prediction: InsertFailurePrediction,
    orgId: string
  ): Promise<FailurePrediction>;

  getThresholdOptimizations(
    orgId: string,
    equipmentId?: string,
    status?: string
  ): Promise<ThresholdOptimization[]>;
  getThresholdOptimization(
    id: number,
    orgId: string
  ): Promise<ThresholdOptimization | undefined>;
  createThresholdOptimization(
    optimization: InsertThresholdOptimization,
    orgId: string
  ): Promise<ThresholdOptimization>;
  applyThresholdOptimization(id: number, orgId: string): Promise<ThresholdOptimization>;
}

/** Digital-twin + twin-simulation reads (digital-twin storage). */
export interface IDigitalTwinStore {
  getDigitalTwins(
    orgId: string,
    vesselId?: string,
    twinType?: string
  ): Promise<DigitalTwin[]>;
  getDigitalTwin(id: string, orgId: string): Promise<DigitalTwin | undefined>;
  getTwinSimulations(
    digitalTwinId?: string,
    scenarioType?: string,
    status?: string
  ): Promise<TwinSimulation[]>;
  getTwinSimulation(id: string): Promise<TwinSimulation | undefined>;
}

/** Insight-snapshot reads (analytics storage). */
export interface IInsightSnapshotStore {
  getInsightSnapshots(orgId?: string, scope?: string): Promise<InsightSnapshot[]>;
  getLatestInsightSnapshot(orgId: string, scope: string): Promise<InsightSnapshot | undefined>;
}

/** Equipment lookup used to enrich emitted PdM domain events (equipment storage). */
export interface IEquipmentLookupPort {
  getEquipment(orgId: string, equipmentId: string): Promise<Equipment | undefined>;
}

/** PdM score reads used by the complete ML/PDM export (devices storage). */
export interface IPdmScoreStore {
  getPdmScores(equipmentId?: string, orgId?: string): Promise<PdmScoreLog[]>;
}
