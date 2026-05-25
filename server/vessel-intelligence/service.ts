/**
 * Vessel Intelligence Service
 *
 * Main service class orchestrating vessel intelligence operations.
 */

import { dbEquipmentStorage, vesselService } from "../repositories";
import type { VesselLearnings, HistoricalContext } from "./types.js";
import {
  calculateOperatingHours,
  calculateVesselAge,
  calculateAverageResolutionTime,
  calculatePerformanceMetrics,
  analyzeEquipmentHealth,
  calculateComplianceScore,
} from "./calculation-helpers.js";
import { analyzeFailurePatterns, analyzeMaintenancePatterns } from "./pattern-analyzers.js";
import {
  analyzeOperationalPatterns,
  analyzeCosts,
  identifyPredictiveIndicators,
} from "./operational-analysis.js";
import {
  getWorkOrdersForVessel,
  getTelemetryForVessel,
  getMaintenanceSchedulesForVessel,
} from "./data-fetchers.js";

export class VesselIntelligenceService {
  async learnVesselPatterns(
    vesselId: string,
    lookbackDays: number = 365
  ): Promise<VesselLearnings> {
    const vessel = await vesselService.getVessel(vesselId);
    if (!vessel) {
      throw new Error(`Vessel not found: ${vesselId}`);
    }

    const [workOrders, equipment, telemetry, schedules] = await Promise.all([
      getWorkOrdersForVessel(vesselId, lookbackDays),
      dbEquipmentStorage.getEquipmentRegistry(),
      getTelemetryForVessel(vesselId, lookbackDays),
      getMaintenanceSchedulesForVessel(vesselId),
    ]);

    const vesselEquipment = equipment.filter((e) => e.vesselId === vesselId);

    const failurePatterns = analyzeFailurePatterns(workOrders, vesselEquipment, telemetry);
    const maintenancePatterns = analyzeMaintenancePatterns(schedules, workOrders);
    const operationalInsights = analyzeOperationalPatterns(telemetry, vesselEquipment);
    const costAnalysis = analyzeCosts(workOrders);
    const predictiveIndicators = identifyPredictiveIndicators(telemetry, workOrders);

    const totalHours = calculateOperatingHours(vessel);

    return {
      vesselId,
      totalOperatingHours: totalHours,
      failurePatterns,
      maintenancePatterns,
      operationalInsights,
      costAnalysis,
      predictiveIndicators,
    };
  }

  async getHistoricalContext(vesselId: string): Promise<HistoricalContext> {
    const vessel = await vesselService.getVessel(vesselId);
    if (!vessel) {
      throw new Error(`Vessel not found: ${vesselId}`);
    }

    const [workOrders, equipment] = await Promise.all([
      getWorkOrdersForVessel(vesselId),
      dbEquipmentStorage.getEquipmentRegistry(),
    ]);

    const vesselEquipment = equipment.filter((e) => e.vesselId === vesselId);
    const vesselAge = calculateVesselAge(vessel);

    const completedOrders = workOrders.filter((wo) => wo.status === "completed");
    const avgResolutionTime = calculateAverageResolutionTime(completedOrders);
    const criticalIncidents = workOrders.filter(
      (wo) => (wo.priority as unknown) === "critical" || (wo.priority as unknown) === "urgent"
    ).length;

    const maintenanceHistory = {
      scheduled: workOrders.filter((wo) => (wo as Record<string, unknown>)['workOrderType'] === "scheduled").length,
      unscheduled: workOrders.filter((wo) => (wo as Record<string, unknown>)['workOrderType'] === "unscheduled").length,
      emergency: workOrders.filter((wo) => (wo.priority as unknown) === "critical").length,
      preventive: workOrders.filter((wo) => (wo as Record<string, unknown>)['workOrderType'] === "preventive").length,
    };

    const performanceMetrics = calculatePerformanceMetrics(workOrders, vesselAge);
    const equipmentHealth = analyzeEquipmentHealth(vesselEquipment);

    return {
      vesselId,
      age: vesselAge,
      totalWorkOrders: workOrders.length,
      completedWorkOrders: completedOrders.length,
      avgResolutionTime,
      criticalIncidents,
      complianceScore: calculateComplianceScore(workOrders, maintenanceHistory),
      maintenanceHistory,
      performanceMetrics,
      equipmentHealth,
    };
  }
}

export const vesselIntelligence = new VesselIntelligenceService();
