import { dbTelemetryStorage } from "../repositories";
import { db } from "../db";
import { vibrationAnalysis } from "@shared/schema-runtime";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { beastModeManager } from "../beast-mode-config";
import type { VibrationAnalysis } from "@shared/schema";

export type EnrichedVibrationAnalysis = VibrationAnalysis & {
  timestamp: Date;
  dominantFrequency: number;
  dominantMagnitude: number;
  anomalyScore: number;
  anomalyType: string;
  healthScore: number;
  isAnomalous: boolean;
  confidence: number;
};
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("VibrationAnalysis:Analyzer");

import type { VibrationData } from "./types";
import { performFFT, SAMPLE_RATE, WINDOW_SIZE } from "./fft-processor";
import { detectAnomalies } from "./anomaly-detector";
import { calculateHealthScore, calculateISOBands, calculateFaultBands } from "./health-scoring";

export class VibrationAnalyzer {
  private readonly sampleRate = SAMPLE_RATE;
  private readonly windowSize = WINDOW_SIZE;

  async analyzeVibration(
    equipmentId: string,
    orgId: string = "default-org-id"
  ): Promise<EnrichedVibrationAnalysis | null> {
    try {
      const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "vibration_analysis");
      if (!isEnabled) {
        logger.info(`[Vibration Analysis] Feature disabled for org: ${orgId}`);
        return null;
      }

      const vibrationData = await this.getVibrationData(equipmentId, orgId);
      if (!vibrationData || vibrationData.length < this.windowSize) {
        logger.info(`[Vibration Analysis] Insufficient data for ${equipmentId} (${vibrationData?.length || 0} samples, need ${this.windowSize})`);
        return null;
      }

      const fftResult = performFFT(vibrationData);
      const anomalyDetection = detectAnomalies(fftResult);
      const healthScore = calculateHealthScore(fftResult, anomalyDetection);

      const insertRow = {
        id: randomUUID(),
        orgId,
        equipmentId,
        overallRms: 0,
        sampleRate: this.sampleRate,
        shaftRpm: null,
        windowType: "hann",
        rawData: JSON.stringify(vibrationData.slice(-this.windowSize).map((d) => d.value)),
        spectrumData: JSON.stringify({
          frequencies: fftResult.frequencies,
          magnitudes: fftResult.magnitudes,
        }),
        isoBands: JSON.stringify(calculateISOBands(fftResult)),
        faultBands: JSON.stringify(calculateFaultBands(fftResult, anomalyDetection)),
        createdAt: new Date(),
      };

      const [savedAnalysis] = await db
        .insert(vibrationAnalysis)
        .values(insertRow)
        .returning();
      if (!savedAnalysis) {throw new Error("Failed to save vibration analysis");}
      logger.info(`[Vibration Analysis] Analysis completed for ${equipmentId}: ${anomalyDetection.isAnomalous ? "ANOMALY DETECTED" : "NORMAL"} (score: ${anomalyDetection.anomalyScore.toFixed(2)})`);
      return {
        ...savedAnalysis,
        timestamp: savedAnalysis.createdAt ?? new Date(),
        dominantFrequency: fftResult.dominantFreq,
        dominantMagnitude: fftResult.dominantMagnitude,
        anomalyScore: anomalyDetection.anomalyScore,
        anomalyType: anomalyDetection.anomalyType,
        healthScore,
        isAnomalous: anomalyDetection.isAnomalous,
        confidence: anomalyDetection.confidence,
      };
    } catch (error) {
      logger.error(`[Vibration Analysis] Error analyzing ${equipmentId}:`, undefined, error);
      return null;
    }
  }

  private async getVibrationData(equipmentId: string, orgId: string): Promise<VibrationData[]> {
    try {
      const allTelemetry = await dbTelemetryStorage.getLatestTelemetryReadings(undefined, 1000);
      const telemetryData = allTelemetry.filter(
        (t) => t.equipmentId === equipmentId && t.sensorType === "vibration"
      );
      return telemetryData
        .map((reading) => ({
          timestamp: reading.ts,
          value: reading.value,
          equipmentId: reading.equipmentId,
          sensorType: reading.sensorType,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      logger.error(`[Vibration Analysis] Error retrieving data for ${equipmentId}:`, undefined, error);
      return [];
    }
  }

  async getAnalysisHistory(
    equipmentId: string,
    orgId: string = "default-org-id",
    limit: number = 50
  ): Promise<EnrichedVibrationAnalysis[]> {
    try {
      const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "vibration_analysis");
      if (!isEnabled) {
        return [];
      }
      const rows = await db
        .select()
        .from(vibrationAnalysis)
        .where(
          and(eq(vibrationAnalysis.orgId, orgId), eq(vibrationAnalysis.equipmentId, equipmentId))
        )
        .orderBy(desc(vibrationAnalysis.createdAt))
        .limit(limit);
      return rows.map((row) => {
        let faultBands: Record<string, unknown> = {};
        try {
          faultBands = row.faultBands ? JSON.parse(row.faultBands as string) : {};
        } catch {
          faultBands = {};
        }
        return {
          ...row,
          timestamp: row.createdAt ?? new Date(),
          dominantFrequency: Number(faultBands['dominantFreq'] ?? 0),
          dominantMagnitude: Number(faultBands['dominantMagnitude'] ?? 0),
          anomalyScore: Number(faultBands['anomalyScore'] ?? 0),
          anomalyType: String(faultBands['anomalyType'] ?? "normal"),
          healthScore: Number(faultBands['healthScore'] ?? 100),
          isAnomalous: Boolean(faultBands['isAnomalous'] ?? false),
          confidence: Number(faultBands['confidence'] ?? 0),
        };
      });
    } catch (error) {
      logger.error(`[Vibration Analysis] Error getting history for ${equipmentId}:`, undefined, error);
      return [];
    }
  }

  async batchAnalyze(
    equipmentIds: string[],
    orgId: string = "default-org-id"
  ): Promise<EnrichedVibrationAnalysis[]> {
    const results: EnrichedVibrationAnalysis[] = [];
    for (const equipmentId of equipmentIds) {
      const analysis = await this.analyzeVibration(equipmentId, orgId);
      if (analysis) {
        results.push(analysis);
      }
    }
    return results;
  }
}

export const vibrationAnalyzer = new VibrationAnalyzer();
