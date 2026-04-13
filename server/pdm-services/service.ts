/**
 * PdM Services - Main Service Class
 * PdmPackService orchestrator
 */

import { PdmBaseline, PdmAlert } from "../../shared/schema.js";
import { extractBearingFeatures, extractPumpFeatures } from "../pdm-features.js";
import type { BaselinePoint, AnalysisResult, BearingParams, PumpParams } from "./types.js";
import { upsertBaselinePoint, getBaselineStats } from "./baseline.js";
import { recordAlert, getRecentAlerts } from "./alerts.js";
import { evaluateAgainstBaseline, generateLLMExplanation } from "./analysis.js";

export class PdmPackService {
  constructor(
    private db: any
  ) {}

  async upsertBaselinePoint(orgId: string, point: BaselinePoint): Promise<void> {
    if (!this.db) {throw new Error("Database not available for PdM operations");}
    return upsertBaselinePoint(this.db, orgId, point);
  }

  async evaluateAgainstBaseline(
    orgId: string,
    vesselName: string,
    assetId: string,
    assetClass: "bearing" | "pump",
    features: Record<string, number>
  ): Promise<AnalysisResult> {
    if (!this.db) {throw new Error("Database not available for PdM operations");}
    return evaluateAgainstBaseline(this.db, orgId, vesselName, assetId, assetClass, features);
  }

  async analyzeBearing(params: BearingParams): Promise<AnalysisResult> {
    const { orgId, vesselName, assetId, fs, rpm, series, spectrum, autoBaseline = false } = params;
    console.log(`[PdM Service] Analyzing bearing ${assetId} with ${series.length} samples at ${fs}Hz`);

    const bearingFeatures = extractBearingFeatures({ fs, rpm, series, spectrum });
    const features = {
      rms: bearingFeatures.rms,
      kurtosis: bearingFeatures.kurtosis,
      env_rms: bearingFeatures.env_rms,
      iso_10_100: bearingFeatures.iso_10_100,
      order_1x: bearingFeatures.order_1x,
      order_2x: bearingFeatures.order_2x,
    };

    const analysis = await this.evaluateAgainstBaseline(orgId, vesselName, assetId, "bearing", features);

    if (autoBaseline && analysis.worstZ < 2) {
      await this.upsertBaselinePoint(orgId, { vesselName, assetId, assetClass: "bearing", features });
    }

    if (analysis.severity !== "info") {
      await this.recordAlert(orgId, {
        vesselName,
        assetId,
        assetClass: "bearing",
        features,
        scores: analysis.scores,
        severity: analysis.severity,
        explanation: { ...analysis.explanation, rpm, fs, samples: series.length, trigger: "bearing_vibration_analysis" },
      });
    }

    return analysis;
  }

  async analyzePump(params: PumpParams): Promise<AnalysisResult> {
    const { orgId, vesselName, assetId, flow, pressure, current, fs, vibSeries, autoBaseline = false } = params;
    const sampleCount = Math.max(flow?.length || 0, pressure?.length || 0, current?.length || 0, vibSeries?.length || 0);
    console.log(`[PdM Service] Analyzing pump ${assetId} with ${sampleCount} process samples`);

    const pumpFeatures = extractPumpFeatures({ flow, pressure, current, fs, vib_series: vibSeries });
    const features: Record<string, number> = {};
    Object.entries(pumpFeatures).forEach(([key, value]) => {
      if (Number.isFinite(value)) {features[key] = value;}
    });

    if (Object.keys(features).length === 0) {
      throw new Error("No valid pump features extracted from provided data");
    }

    const analysis = await this.evaluateAgainstBaseline(orgId, vesselName, assetId, "pump", features);

    if (autoBaseline && analysis.worstZ < 2) {
      await this.upsertBaselinePoint(orgId, { vesselName, assetId, assetClass: "pump", features });
    }

    const llmExplanation = await generateLLMExplanation({
      assetId,
      vesselName,
      features,
      scores: analysis.scores,
      severity: analysis.severity,
      worstZ: analysis.worstZ,
      dataSources: { flow: flow?.length || 0, pressure: pressure?.length || 0, current: current?.length || 0, vibration: vibSeries?.length || 0 },
    });

    const enhancedAnalysis = {
      ...analysis,
      explanation: {
        ...analysis.explanation,
        llmSummary: llmExplanation || "Analysis completed successfully. Monitor pump parameters for optimal performance.",
        data_sources: { flow: flow?.length || 0, pressure: pressure?.length || 0, current: current?.length || 0, vibration: vibSeries?.length || 0 },
        trigger: "pump_process_analysis",
      },
    };

    if (analysis.severity !== "info") {
      await this.recordAlert(orgId, {
        vesselName,
        assetId,
        assetClass: "pump",
        features,
        scores: analysis.scores,
        severity: analysis.severity,
        explanation: enhancedAnalysis.explanation,
      });
    }

    return enhancedAnalysis;
  }

  async recordAlert(orgId: string, alert: any): Promise<void> {
    if (!this.db) {throw new Error("Database not available for PdM operations");}
    return recordAlert(this.db, orgId, alert);
  }

  async getRecentAlerts(orgId: string, limit: number = 200): Promise<PdmAlert[]> {
    if (!this.db) {throw new Error("Database not available for PdM operations");}
    return getRecentAlerts(this.db, orgId, limit);
  }

  async getBaselineStats(orgId: string, vesselName: string, assetId: string): Promise<PdmBaseline[]> {
    if (!this.db) {throw new Error("Database not available for PdM operations");}
    return getBaselineStats(this.db, orgId, vesselName, assetId);
  }

  async healthCheck(): Promise<{ status: string; features: string[] }> {
    return {
      status: "operational",
      features: ["statistical_baselines", "bearing_vibration_analysis", "pump_process_monitoring", "z_score_alerting", "welford_updates"],
    };
  }
}
