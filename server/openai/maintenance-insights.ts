/**
 * Maintenance Recommendations and Pump Analysis using OpenAI
 */

import type { MaintenanceInsight, PumpAnalysisParams } from "./types";
import { createOpenAIClient, callWithModelFallback, calculateDynamicTokens } from "./client";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Openai:MaintenanceInsights");

/**
 * Generates maintenance recommendations based on specific alert conditions
 */
export async function generateMaintenanceRecommendations(
  alertType: string,
  equipmentId: string,
  sensorData: any,
  equipmentType?: string
): Promise<MaintenanceInsight> {
  try {
    const systemPrompt = `You are a marine maintenance specialist providing specific action recommendations for equipment alerts.
    Generate actionable maintenance recommendations for marine equipment based on alert conditions.
    
    Focus on immediate actionable steps, safety considerations, and marine-specific maintenance procedures.
    
    Respond with JSON in this exact format:
    {
      "severity": "low|medium|high|critical",
      "title": "string",
      "description": "string",
      "recommendations": ["string"],
      "estimatedCost": number,
      "urgency": "routine|scheduled|urgent|emergency", 
      "affectedSystems": ["string"],
      "predictedFailureRisk": number (0-100)
    }`;

    const userPrompt = `Generate maintenance recommendations for this marine equipment alert:
    
    Alert Type: ${alertType}
    Equipment ID: ${equipmentId}
    Equipment Type: ${equipmentType || "Unknown"}
    Sensor Data: ${JSON.stringify(sensorData, null, 2)}
    
    Provide specific, actionable maintenance recommendations for marine operations.`;

    const openai = await createOpenAIClient();
    if (!openai) {
      throw new Error("OpenAI client not available - API key not configured");
    }

    const inputSize = systemPrompt.length + userPrompt.length;
    const maxTokens = calculateDynamicTokens(inputSize, 1000, 2500);

    const response = await callWithModelFallback(openai, {
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: maxTokens,
    });

    let recommendation;
    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }
      recommendation = JSON.parse(content);
    } catch (parseError) {
      logger.error("Failed to parse OpenAI maintenance recommendation response:", undefined, parseError);
      throw new Error(
        `Invalid AI response format: ${parseError instanceof Error ? parseError.message : "Unknown error"}`
      );
    }

    return {
      severity: recommendation.severity || "medium",
      title: recommendation.title || `${alertType} Alert - ${equipmentId}`,
      description: recommendation.description || "Equipment requires attention",
      recommendations: recommendation.recommendations || ["Schedule inspection"],
      estimatedCost: recommendation.estimatedCost || 0,
      urgency: recommendation.urgency || "scheduled",
      affectedSystems: recommendation.affectedSystems || [equipmentType || "Unknown System"],
      predictedFailureRisk: Math.max(0, Math.min(100, recommendation.predictedFailureRisk || 50)),
    };
  } catch (error) {
    logger.error(`Maintenance recommendation failed for ${alertType}:`, undefined, error);

    return {
      severity: "medium",
      title: `${alertType} - Attention Required`,
      description: "Equipment alert detected. Manual assessment recommended.",
      recommendations: [
        "Schedule equipment inspection",
        "Review recent maintenance history",
        "Monitor equipment parameters closely",
      ],
      estimatedCost: 0,
      urgency: "scheduled",
      affectedSystems: [equipmentType || "System"],
      predictedFailureRisk: 50,
    };
  }
}

/**
 * Generate intelligent LLM explanation for pump analysis results
 */
export async function generatePumpAnalysisExplanation(params: PumpAnalysisParams): Promise<string> {
  try {
    const { assetId, vesselName, features, scores, severity, worstZ, dataSources } = params;

    const systemPrompt = `You are a marine pump condition monitoring expert analyzing pump performance data.
    
    Provide clear, actionable explanations for pump analysis results focusing on:
    - Flow efficiency and cavitation indicators
    - Pressure performance and hydraulic conditions
    - Motor current analysis and electrical health
    - Vibration signatures and mechanical condition
    - Marine-specific operating challenges
    
    Use professional but accessible language. Focus on practical insights for marine engineers.`;

    const userPrompt = `Analyze pump condition for ${assetId} on vessel ${vesselName}:

Performance Features:
${Object.entries(features)
  .map(([feature, value]) => `- ${feature}: ${value.toFixed(3)}`)
  .join("\n")}

Z-Score Analysis:
${Object.entries(scores)
  .map(([feature, score]) => `- ${feature}: ${score.toFixed(2)}σ deviation`)
  .join("\n")}

Overall Assessment:
- Severity Level: ${severity.toUpperCase()}
- Worst Z-Score: ${worstZ.toFixed(2)}σ
- Data Sources: Flow(${dataSources.flow}), Pressure(${dataSources.pressure}), Current(${dataSources.current}), Vibration(${dataSources.vibration})

Provide a concise technical explanation of the pump's current condition, highlighting any concerns and recommended actions for marine operations.`;

    const openai = await createOpenAIClient();
    if (!openai) {
      throw new Error("OpenAI client not available - API key not configured");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 800,
    });

    return (
      response.choices[0].message.content?.trim() ||
      "Pump analysis completed. Parameters within operational limits."
    );
  } catch (error) {
    logger.error(`Pump analysis explanation failed for ${params.assetId}:`, undefined, error);

    const severityMessages = {
      info: "Pump operating within normal parameters. Continue regular monitoring schedule.",
      warn: "Pump showing minor deviations from baseline. Schedule inspection during next maintenance globalThis.",
      high: "Pump requires immediate attention. Critical parameters exceed operational thresholds. Consider emergency maintenance to prevent failure.",
    };

    return (
      severityMessages[params.severity] ||
      "Pump analysis completed. Review parameters for optimal performance."
    );
  }
}
