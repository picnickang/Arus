/**
 * Equipment Health Analysis — now talks to the LLM Gateway instead of the
 * raw OpenAI SDK. Provider switching, retries, and token telemetry live
 * inside the gateway; this file is pure prompt construction + parsing.
 */

import type { EquipmentTelemetry, TelemetryTrend } from "@shared/schema";
import type { EquipmentAnalysis } from "./types";
import { calculateDynamicTokens } from "./client";
import { llmGateway } from "../composition/llm-gateway";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Openai:EquipmentAnalysis");

/**
 * Analyzes individual equipment telemetry data using AI to generate predictive maintenance insights
 */
export async function analyzeEquipmentHealth(
  telemetryData: EquipmentTelemetry[] | TelemetryTrend[],
  equipmentId: string,
  equipmentType?: string
): Promise<EquipmentAnalysis> {
  try {
    const systemPrompt = `You are a marine predictive maintenance expert analyzing vessel equipment telemetry data. 
    Analyze the provided telemetry data and generate comprehensive maintenance insights for maritime equipment.
    
    Focus on marine-specific failure patterns:
    - Saltwater corrosion and environmental effects
    - Vibration analysis for engines and pumps
    - Temperature monitoring for cooling systems
    - Pressure monitoring for hydraulic systems
    - Flow rate analysis for fuel and water systems
    
    Respond with JSON in this exact format:
    {
      "equipmentId": "string",
      "overallHealth": number (0-100),
      "insights": [
        {
          "severity": "low|medium|high|critical",
          "title": "string",
          "description": "string", 
          "recommendations": ["string"],
          "estimatedCost": number,
          "urgency": "routine|scheduled|urgent|emergency",
          "affectedSystems": ["string"],
          "predictedFailureRisk": number (0-100)
        }
      ],
      "summary": "string",
      "nextMaintenanceDate": "YYYY-MM-DD",
      "criticalAlerts": ["string"]
    }`;

    const formattedData =
      Array.isArray(telemetryData) && telemetryData.length > 0
        ? telemetryData[0] && "data" in telemetryData[0]
          ? (telemetryData as TelemetryTrend[]).map((trend: TelemetryTrend & {
              unit?: string;
              currentValue?: number;
              threshold?: number;
              status?: string;
              trend?: string;
              changePercent?: number;
              data?: unknown[];
            }) => ({
              equipmentId: trend.equipmentId,
              sensorType: trend.sensorType,
              unit: trend.unit,
              currentValue: trend.currentValue,
              threshold: trend.threshold,
              status: trend.status,
              trend: trend.trend,
              changePercent: trend.changePercent,
              recentData: trend.data?.slice(-5) ?? [],
            }))
          : (telemetryData as EquipmentTelemetry[]).slice(-20)
        : [];

    const userPrompt = `Analyze this marine equipment telemetry data:
    
    Equipment ID: ${equipmentId}
    Equipment Type: ${equipmentType || "Unknown"}
    
    Recent telemetry readings:
    ${JSON.stringify(formattedData, null, 2)}
    
    Provide detailed predictive maintenance analysis focusing on marine environment challenges.`;

    const inputSize = systemPrompt.length + userPrompt.length;
    const maxTokens = calculateDynamicTokens(inputSize, 2048, 4096);

    const response = await llmGateway.chat({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      jsonMode: true,
      maxCompletionTokens: maxTokens,
      meta: { caller: "equipment-analysis", equipmentId },
    });

    let analysis;
    try {
      if (!response.content) {
        throw new Error("No content in LLM response");
      }
      analysis = JSON.parse(response.content);
    } catch (parseError) {
      logger.error("Failed to parse LLM response:", undefined, parseError);
      throw new Error(
        `Invalid AI response format: ${parseError instanceof Error ? parseError.message : "Unknown error"}`
      );
    }

    return {
      equipmentId: analysis.equipmentId ?? equipmentId,
      overallHealth: Math.max(0, Math.min(100, analysis.overallHealth ?? 50)),
      insights: analysis.insights ?? [],
      summary: analysis.summary ?? "No analysis available",
      nextMaintenanceDate:
        analysis.nextMaintenanceDate ??
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      criticalAlerts: analysis.criticalAlerts ?? [],
    };
  } catch (error) {
    logger.error(`Equipment analysis failed for ${equipmentId}:`, undefined, error);
    logger.warn(`Returning fallback analysis for equipment ${equipmentId} - AI service unavailable`);

    return {
      equipmentId,
      overallHealth: 50,
      insights: [
        {
          severity: "medium",
          title: "Analysis Unavailable",
          description: "AI analysis service temporarily unavailable",
          recommendations: ["Schedule manual inspection", "Monitor key parameters"],
          estimatedCost: 0,
          urgency: "scheduled",
          affectedSystems: ["All Systems"],
          predictedFailureRisk: 50,
        },
      ],
      summary: "Unable to complete AI analysis. Manual inspection recommended.",
      nextMaintenanceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0] ?? '',
      criticalAlerts: ["AI analysis service unavailable"],
    };
  }
}
