/**
 * Anomaly Detection Module
 *
 * Statistical and AI-enhanced anomaly detection for marine equipment sensors.
 * Implements Z-score analysis with optional OpenAI pattern recognition.
 */

import { db } from "../db";
import { telemetryAggregates } from "@shared/schema-runtime";
import { eq, and, gte, asc } from "drizzle-orm";
import OpenAI from "openai";
import type { StatisticalBaseline, AnomalyResult } from "./types";
import { calculateTrend, detectSeasonality } from "./statistical";

export async function calculateStatisticalBaseline(
  equipmentId: string,
  sensorType: string
): Promise<StatisticalBaseline> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const historicalData = await db
    .select()
    .from(telemetryAggregates)
    .where(
      and(
        eq(telemetryAggregates.equipmentId, equipmentId),
        eq(telemetryAggregates.sensorType, sensorType),
        eq(telemetryAggregates.timeWindow, "1h"),
        gte(telemetryAggregates.windowStart, thirtyDaysAgo)
      )
    )
    .orderBy(asc(telemetryAggregates.windowStart));

  if (historicalData.length < 10) {
    return {
      mean: 0,
      stdDev: 1,
      min: 0,
      max: 100,
      sampleCount: 0,
      trend: "stable",
      seasonality: false,
    };
  }

  const values = historicalData.map((d) => d.avgValue).filter((v) => v !== null) as number[];
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

  return {
    mean,
    stdDev: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
    sampleCount: values.length,
    trend: calculateTrend(values),
    seasonality: detectSeasonality(values),
  };
}

export function detectStatisticalAnomaly(
  currentValue: number,
  baseline: StatisticalBaseline
): AnomalyResult {
  const zScore =
    baseline.stdDev > 0 ? Math.abs((currentValue - baseline.mean) / baseline.stdDev) : 0;

  let isAnomaly = false;
  let severity: "low" | "medium" | "high" | "critical" = "low";
  let anomalyScore = 0;

  if (zScore > 3.5) {
    isAnomaly = true;
    severity = "critical";
    anomalyScore = Math.min(1, zScore / 4);
  } else if (zScore > 2.5) {
    isAnomaly = true;
    severity = "high";
    anomalyScore = Math.min(0.9, zScore / 3);
  } else if (zScore > 2) {
    isAnomaly = true;
    severity = "medium";
    anomalyScore = Math.min(0.7, zScore / 2.5);
  } else if (zScore > 1.5) {
    isAnomaly = true;
    severity = "low";
    anomalyScore = Math.min(0.5, zScore / 2);
  }

  const contributingFactors: string[] = [];
  const recommendedActions: string[] = [];

  if (isAnomaly) {
    contributingFactors.push(`Z-score: ${zScore.toFixed(2)} (threshold: 1.5)`);

    if (currentValue > baseline.mean + 2 * baseline.stdDev) {
      contributingFactors.push("Value significantly above normal range");
      recommendedActions.push("Check for equipment overload or sensor malfunction");
    } else if (currentValue < baseline.mean - 2 * baseline.stdDev) {
      contributingFactors.push("Value significantly below normal range");
      recommendedActions.push("Check for equipment underperformance or sensor calibration");
    }

    if (baseline.trend === "increasing" && currentValue > baseline.max) {
      contributingFactors.push("Value exceeds historical maximum during upward trend");
      recommendedActions.push("Monitor for accelerating deterioration");
    }
  }

  return {
    isAnomaly,
    anomalyScore,
    anomalyType: "statistical",
    severity,
    contributingFactors,
    recommendedActions:
      recommendedActions.length > 0 ? recommendedActions : ["Continue normal monitoring"],
    explanation: `Statistical analysis using Z-score (${zScore.toFixed(2)}) against ${baseline.sampleCount} historical data points`,
  };
}

export async function enhanceAnomalyDetectionWithAI(
  openai: OpenAI,
  equipmentId: string,
  sensorType: string,
  currentValue: number,
  baseline: StatisticalBaseline,
  statisticalResult: AnomalyResult
): Promise<AnomalyResult> {
  try {
    const prompt = `
You are a marine equipment condition monitoring expert. Analyze this sensor anomaly:

Equipment: ${equipmentId}
Sensor: ${sensorType}
Current Value: ${currentValue}
Historical Mean: ${baseline.mean.toFixed(2)}
Standard Deviation: ${baseline.stdDev.toFixed(2)}
Trend: ${baseline.trend}
Statistical Severity: ${statisticalResult.severity}

Based on marine industry expertise, provide:
1. Enhanced severity assessment (low/medium/high/critical)
2. Specific failure mode this could indicate
3. Three specific maintenance actions
4. Operational risk assessment

Response format: JSON only
{
  "enhancedSeverity": "severity level",
  "failureMode": "specific failure mode",
  "maintenanceActions": ["action1", "action2", "action3"],
  "operationalRisk": "risk description",
  "confidence": 0.85
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const aiAnalysis = JSON.parse(content);

      return {
        ...statisticalResult,
        severity: aiAnalysis.enhancedSeverity || statisticalResult.severity,
        anomalyType: "pattern",
        contributingFactors: [
          ...statisticalResult.contributingFactors,
          `AI-detected failure mode: ${aiAnalysis.failureMode}`,
          `Operational risk: ${aiAnalysis.operationalRisk}`,
        ],
        recommendedActions: aiAnalysis.maintenanceActions || statisticalResult.recommendedActions,
        explanation: `Enhanced AI analysis (confidence: ${aiAnalysis.confidence}) detected ${aiAnalysis.failureMode} with ${aiAnalysis.enhancedSeverity} severity`,
      };
    }
  } catch (error) {
    console.error("[ML Analytics] OpenAI enhancement error:", error);
  }

  return statisticalResult;
}

export function basicThresholdDetection(currentValue: number, sensorType: string): AnomalyResult {
  const limits: Record<string, { min: number; max: number }> = {
    temperature: { min: 0, max: 100 },
    pressure: { min: 0, max: 50 },
    vibration: { min: 0, max: 10 },
    flow_rate: { min: 0, max: 1000 },
  };

  const limit = limits[sensorType];
  if (!limit) {
    return {
      isAnomaly: false,
      anomalyScore: 0,
      anomalyType: "statistical",
      severity: "low",
      contributingFactors: [],
      recommendedActions: ["Continue monitoring"],
      explanation: "No baseline available for analysis",
    };
  }

  const isAnomaly = currentValue < limit.min || currentValue > limit.max;
  return {
    isAnomaly,
    anomalyScore: isAnomaly ? 0.8 : 0,
    anomalyType: "statistical",
    severity: isAnomaly ? "high" : "low",
    contributingFactors: isAnomaly
      ? [`Value ${currentValue} outside safe range [${limit.min}, ${limit.max}]`]
      : [],
    recommendedActions: isAnomaly ? ["Immediate inspection required"] : ["Continue monitoring"],
    explanation: "Basic threshold-based detection",
  };
}
