/**
 * Composition - ML Analytics Cross-Domain Data Providers
 *
 * The ml-analytics domain owns no storage of its own: anomaly / failure-
 * prediction / threshold rows live in the pdm-platform storage, digital twins in
 * the digital-twin storage, and equipment lookups in the equipment domain. These
 * adapters live in the composition layer (outside server/domains/) so the
 * ml-analytics domain stays free of cross-domain storage coupling; the ports are
 * injected into the application service by application/index.ts (mirrors the
 * insights→analytics and equipment→sensor seams).
 */

import { dbMlAnalyticsStorage, dbDevicesStorage } from "../repositories.js";
import { dbDigitalTwinStorage } from "../db/digital-twin/index.js";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import type {
  IMlAnalyticsStore,
  IDigitalTwinStore,
  IEquipmentLookupPort,
  IPdmScoreStore,
} from "../domains/ml-analytics/domain/ports.js";

export const mlAnalyticsStoreProvider: IMlAnalyticsStore = {
  getMlModels: (orgId, modelType, status) =>
    dbMlAnalyticsStorage.getMlModels(orgId, modelType, status),
  getAnomalyDetections: (orgId, equipmentId, severity) =>
    dbMlAnalyticsStorage.getAnomalyDetections(orgId, equipmentId, severity),
  getAnomalyDetection: (id, orgId) => dbMlAnalyticsStorage.getAnomalyDetection(id, orgId),
  createAnomalyDetection: (detection, orgId) =>
    dbMlAnalyticsStorage.createAnomalyDetection(detection, orgId),
  acknowledgeAnomaly: (id, acknowledgedBy, orgId) =>
    dbMlAnalyticsStorage.acknowledgeAnomaly(id, acknowledgedBy, orgId),
  getFailurePredictions: (orgId, equipmentId, riskLevel) =>
    dbMlAnalyticsStorage.getFailurePredictions(orgId, equipmentId, riskLevel),
  getFailurePrediction: (id, orgId) => dbMlAnalyticsStorage.getFailurePrediction(id, orgId),
  createFailurePrediction: (prediction, orgId) =>
    dbMlAnalyticsStorage.createFailurePrediction(prediction, orgId),
  getThresholdOptimizations: (orgId, equipmentId, status) =>
    dbMlAnalyticsStorage.getThresholdOptimizations(orgId, equipmentId, status),
  getThresholdOptimization: (id, orgId) =>
    dbMlAnalyticsStorage.getThresholdOptimization(id, orgId),
  createThresholdOptimization: (optimization, orgId) =>
    dbMlAnalyticsStorage.createThresholdOptimization(optimization, orgId),
  applyThresholdOptimization: (id, orgId) =>
    dbMlAnalyticsStorage.applyThresholdOptimization(id, orgId),
};

export const mlAnalyticsTwinProvider: IDigitalTwinStore = {
  getDigitalTwins: (orgId, vesselId, twinType) =>
    dbDigitalTwinStorage.getDigitalTwins(orgId, vesselId, twinType),
  getDigitalTwin: (id, orgId) => dbDigitalTwinStorage.getDigitalTwin(id, orgId),
  getTwinSimulations: (digitalTwinId, scenarioType, status) =>
    dbDigitalTwinStorage.getTwinSimulations(digitalTwinId, scenarioType, status),
  getTwinSimulation: (id) => dbDigitalTwinStorage.getTwinSimulation(id),
};

export const mlAnalyticsEquipmentLookupProvider: IEquipmentLookupPort = {
  getEquipment: (orgId, equipmentId) => dbEquipmentStorage.getEquipment(orgId, equipmentId),
};

export const mlAnalyticsPdmScoreProvider: IPdmScoreStore = {
  getPdmScores: (equipmentId, orgId) => dbDevicesStorage.getPdmScores(equipmentId, orgId),
};
