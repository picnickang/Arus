/**
 * Enhanced Trends Pod - Advanced Telemetry Statistical Analysis
 *
 * Provides sophisticated statistical analysis capabilities for maritime equipment telemetry:
 * - Advanced anomaly detection using statistical models
 * - Time-series forecasting for predictive insights
 * - Cross-sensor correlation analysis
 * - Seasonal pattern detection
 * - Fleet-wide trend aggregation
 */

// Re-export all types
export * from "./types";

// Re-export helper functions for advanced usage
export { calculateStatisticalSummary, calculatePearsonCorrelation } from "./statistical-helpers";
export { detectAnomalies } from "./anomaly-detection";
export { performForecasting } from "./forecasting";
export { analyzeSeasonality } from "./seasonality";
export { alignTimeSeries, buildCorrelationAnalysis } from "./correlation";
export {
  aggregateFleetMetrics,
  rankEquipmentByRisk,
  generateFleetRecommendations,
} from "./fleet-analysis";

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("EnhancedTrends:Index");
import type {
  TrendAnalysisResult,
  CorrelationAnalysis,
  FleetTrendSummary,
  TelemetryDataPoint,
} from "./types";
import { calculateStatisticalSummary } from "./statistical-helpers";
import { detectAnomalies } from "./anomaly-detection";
import { performForecasting } from "./forecasting";
import { analyzeSeasonality } from "./seasonality";
import { alignTimeSeries, buildCorrelationAnalysis } from "./correlation";
import {
  aggregateFleetMetrics,
  rankEquipmentByRisk,
  generateFleetRecommendations,
  type EquipmentAnalysisResult,
} from "./fleet-analysis";

/**
 * Enhanced Trends Analysis Engine
 */
export class EnhancedTrendsAnalyzer {
  /**
   * Perform comprehensive statistical analysis of equipment sensor data
   */
  async analyzeEquipmentTrends(
    orgId: string,
    equipmentId: string,
    sensorType: string,
    hours: number = 168
  ): Promise<TrendAnalysisResult> {
    logger.info(`[Enhanced Trends] Analyzing ${orgId}:${equipmentId}:${sensorType} over ${hours}h`);

    const telemetryData = await this.getTelemetryData(orgId, equipmentId, sensorType, hours);

    if (telemetryData.length < 10) {
      throw new Error(
        `Insufficient data for statistical analysis (${telemetryData.length} points, need ≥10)`
      );
    }

    const values = telemetryData.map((d) => d.value);
    const timestamps = telemetryData.map((d) => d.timestamp);

    const statisticalSummary = calculateStatisticalSummary(values, timestamps);
    const anomalyDetection = detectAnomalies(values, timestamps);
    const forecasting = performForecasting(values, timestamps);
    const seasonality = analyzeSeasonality(values, timestamps);
    const correlations = await this.analyzeCorrelations(orgId, equipmentId, sensorType, hours);

    return {
      equipmentId,
      sensorType,
      timeRange: {
        start: new Date(Date.now() - hours * 60 * 60 * 1000),
        end: new Date(),
      },
      statisticalSummary,
      anomalyDetection,
      forecasting,
      seasonality,
      correlations,
    };
  }

  /**
   * Cross-sensor correlation analysis
   */
  async analyzeSensorCorrelations(
    orgId: string,
    equipmentId: string,
    hours: number,
    minCorrelation: number = 0
  ): Promise<CorrelationAnalysis[]> {
    const sensors = await this.getEquipmentSensorTypes(orgId, equipmentId);
    const seen = new Set<string>();
    const all: CorrelationAnalysis[] = [];
    for (const target of sensors) {
      const partial = await this.analyzeCorrelations(orgId, equipmentId, target, hours);
      for (const c of partial) {
        const key = [c.targetSensor, c.correlatedSensor].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          all.push(c);
        }
      }
    }
    return all.filter((c) => Math.abs(c.correlation) >= minCorrelation);
  }

  private async analyzeCorrelations(
    orgId: string,
    equipmentId: string,
    targetSensor: string,
    hours: number
  ): Promise<CorrelationAnalysis[]> {
    const correlations: CorrelationAnalysis[] = [];

    const allSensors = await this.getEquipmentSensorTypes(orgId, equipmentId);
    const otherSensors = allSensors.filter((s) => s !== targetSensor);

    for (const sensor of otherSensors) {
      try {
        const sensorData = await this.getTelemetryData(orgId, equipmentId, sensor, hours);
        if (sensorData.length < 10) {
          continue;
        }

        const targetData = await this.getTelemetryData(orgId, equipmentId, targetSensor, hours);

        const alignedData = alignTimeSeries(targetData, sensorData);
        if (alignedData.length < 10) {
          continue;
        }

        const targetValues = alignedData.map((d) => d.target);
        const sensorValues = alignedData.map((d) => d.sensor);

        const correlation = buildCorrelationAnalysis(
          targetSensor,
          sensor,
          targetValues,
          sensorValues
        );
        if (correlation) {
          correlations.push(correlation);
        }
      } catch (error) {
        logger.warn(`[Enhanced Trends] Correlation analysis failed for ${sensor}:`, { details: error });
      }
    }

    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  /**
   * Fleet-wide trend aggregation and analysis
   */
  async analyzeFleetTrends(
    orgId: string,
    equipmentIds: string[],
    hours: number = 168
  ): Promise<FleetTrendSummary> {
    logger.info(`[Enhanced Trends] Analyzing fleet trends for ${orgId}: ${equipmentIds.length} equipment units`);

    const equipmentAnalyses: EquipmentAnalysisResult[] = [];
    const sensorTypes = new Set<string>();

    for (const equipmentId of equipmentIds) {
      try {
        const equipmentSensors = await this.getEquipmentSensorTypes(orgId, equipmentId);
        equipmentSensors.forEach((sensor) => sensorTypes.add(sensor));

        const primarySensors = equipmentSensors.filter((s) =>
          ["temperature", "vibration", "pressure"].includes(s.toLowerCase())
        );

        for (const sensor of primarySensors.slice(0, 2)) {
          const analysis = await this.analyzeEquipmentTrends(orgId, equipmentId, sensor, hours);
          equipmentAnalyses.push({ equipmentId, sensor, analysis });
        }
      } catch (error) {
        logger.warn(`[Enhanced Trends] Fleet analysis failed for ${orgId}:${equipmentId}:`, { details: error });
      }
    }

    const aggregatedMetrics = aggregateFleetMetrics(equipmentAnalyses);
    const equipmentRankings = rankEquipmentByRisk(equipmentAnalyses);
    const recommendations = generateFleetRecommendations(equipmentAnalyses, aggregatedMetrics);

    return {
      fleetId: "default-fleet",
      equipmentCount: equipmentIds.length,
      sensorTypes: Array.from(sensorTypes),
      timeRange: {
        start: new Date(Date.now() - hours * 60 * 60 * 1000),
        end: new Date(),
      },
      aggregatedMetrics,
      equipmentRankings,
      recommendations,
    };
  }

  private async getTelemetryData(
    orgId: string,
    equipmentId: string,
    sensorType: string,
    hours: number
  ): Promise<TelemetryDataPoint[]> {
    try {
      const { dbTelemetryStorage } = await import("../repositories");

      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

      logger.info(`[Enhanced Trends] Fetching ${orgId}:${equipmentId}:${sensorType} from ${startTime.toISOString()} to ${endTime.toISOString()}`);

      const readings = await (dbTelemetryStorage as object as { getTelemetryHistory: (orgId: string, equipmentId: string, sensorType: string, startTime: Date, endTime: Date) => Promise<Array<{ ts: string | Date; value: number; unit?: string }>> }).getTelemetryHistory(
        orgId,
        equipmentId,
        sensorType,
        startTime,
        endTime
      );

      return readings.map((reading: { ts: string | Date; value: number; unit?: string }) => ({
        timestamp: typeof reading.ts === "string" ? new Date(reading.ts) : reading.ts,
        value: reading.value,
        unit: reading.unit || "unknown",
      }));
    } catch (error) {
      logger.warn(`[Enhanced Trends] Failed to fetch telemetry data for ${orgId}:${equipmentId}:${sensorType}:`, { details: error });
      return [];
    }
  }

  private async getEquipmentSensorTypes(orgId: string, equipmentId: string): Promise<string[]> {
    try {
      const { dbEquipmentStorage } = await import("../repositories");

      const sensorTypes = await dbEquipmentStorage.getEquipmentSensorTypes(orgId, equipmentId);

      logger.info(`[Enhanced Trends] Found ${sensorTypes.length} sensor types for ${orgId}:${equipmentId}:`, { details: sensorTypes });
      return sensorTypes;
    } catch (error) {
      logger.warn(`[Enhanced Trends] Failed to get sensor types for ${orgId}:${equipmentId}:`, { details: error });
      return [];
    }
  }
}

// Export singleton instance
export const enhancedTrendsAnalyzer = new EnhancedTrendsAnalyzer();
