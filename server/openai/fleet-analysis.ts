/**
 * Fleet Health Analysis using OpenAI
 */

import type { EquipmentTelemetry, TelemetryTrend } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";
import type { FleetAnalysis } from "./types";
import { createOpenAIClient, callWithModelFallback, calculateDynamicTokens } from "./client";
import { buildEquipmentDossiers, type EquipmentDossier } from "./dossier-builder";
import { parseRecommendations } from "./risk-parser";
import { calculateFleetBenchmarks } from "./fleet-benchmarks";

/**
 * Build fleet analysis system prompt
 */
function buildSystemPrompt(): string {
  return `Chief Marine Engineer analyzing fleet maintenance for critical business decisions.
    
    For EACH equipment, analyze:
    - Failure probability from degradation patterns and alert clusters
    - Safety/compliance impact (SOLAS, class society requirements)
    - Maintenance window constraints (port calls, weather, crew availability)
    - Cost impact (preventive vs reactive, downtime losses)
    
    Return structured JSON:
    {
      "totalEquipment": number,
      "healthyEquipment": number,
      "equipmentAtRisk": number,
      "criticalEquipment": number,
      "topRecommendations": [
        "EXACT FORMAT: EquipmentID: FailureMode hypothesis (XX%) - SafetyImpact/ComplianceRisk - MaintenanceWindow - ClassRequirement"
      ],
      "costEstimate": number,
      "summary": "Executive summary with risk prioritization and operational impact"
    }`;
}

/**
 * Build fleet analysis user prompt
 */
function buildUserPrompt(equipmentDossiers: EquipmentDossier[], telemetrySummary: any): string {
  return `FLEET ANALYSIS REQUEST:
    
    Equipment: ${equipmentDossiers
      .slice(0, 3)
      .map(
        (e) =>
          `${e.id}(health:${e.healthIndex},alerts:${e.context.alertPattern.total}/${e.context.alertPattern.critical}crit,work-orders:${e.context.workOrderStats.openCount}open,pdm-trend:${e.context.pdmTrend.degradationRate.toFixed(1)}/day)`
      )
      .join(", ")}
    
    Active Issues: ${telemetrySummary.recentIssues.map((i: any) => `${i.equipment}-${i.sensor}:${i.status}`).join(", ")}
    
    Maintenance Context: ${equipmentDossiers
      .slice(0, 3)
      .map(
        (e) =>
          `${e.id}:recent-maintenance=${e.context.maintenanceSummary.hasRecentMaintenance},alert-sensors=${e.context.alertPattern.topAlertTypes.join("/")}`
      )
      .join("; ")}
    
    MANDATORY FORMAT EXAMPLES:
    "PUMP001: Bearing failure hypothesis (65%) - Safety critical/SOLAS Ch.II compliance - Next port window (48hrs) - Class survey required"
    "ENG001: Injection pump degradation (40%) - Performance impact/emissions - Weekly maintenance - Manufacturer service bulletin"
    
    MUST INCLUDE for each equipment:
    1. Specific failure mode hypothesis with percentage probability
    2. Safety/compliance impact (SOLAS, MLC, class society)
    3. Maintenance window timing (hours/days/next port)
    4. Required certification or compliance action`;
}

/**
 * Build telemetry summary for token efficiency
 */
function buildTelemetrySummary(telemetryData: EquipmentTelemetry[] | TelemetryTrend[]): any {
  if (!Array.isArray(telemetryData) || telemetryData.length === 0) {
    return { totalReadings: 0, equipmentTypes: [], recentIssues: [] };
  }

  return {
    totalReadings: telemetryData.length,
    equipmentTypes: [...new Set(telemetryData.map((t: any) => t.equipmentId))],
    recentIssues: telemetryData
      .filter((t: any) => t.status === "critical" || t.status === "warning")
      .slice(-5)
      .map((t: any) => ({
        equipment: t.equipmentId,
        sensor: t.sensorType,
        status: t.status,
        value: "currentValue" in t ? t.currentValue : "value" in t ? t.value : "N/A",
      })),
  };
}

/**
 * Analyzes fleet-wide telemetry data to provide overall maintenance recommendations
 */
export async function analyzeFleetHealth(
  equipmentHealthData: EquipmentHealth[],
  telemetryData: EquipmentTelemetry[] | TelemetryTrend[],
  storageInstance?: any
): Promise<FleetAnalysis> {
  try {
    console.log(
      `[Fleet Analysis] Starting enriched analysis with ${equipmentHealthData.length} equipment units and ${telemetryData.length} telemetry records`
    );

    const { storage } = await import("../repositories");
    const storageToUse = storageInstance ?? storage;

    const equipmentDossiers = await buildEquipmentDossiers(equipmentHealthData, storageToUse);
    const telemetrySummary = buildTelemetrySummary(telemetryData);

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(equipmentDossiers, telemetrySummary);

    const openai = await createOpenAIClient();
    if (!openai) {
      throw new Error("OpenAI client not available - API key not configured");
    }

    const inputSize = systemPrompt.length + userPrompt.length;
    const maxTokens = calculateDynamicTokens(inputSize, 1500, 3500);

    const response = await callWithModelFallback(openai, {
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: maxTokens,
    });

    let analysis;
    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }
      analysis = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse OpenAI fleet analysis response:", parseError);
      throw new Error(
        `Invalid AI response format: ${parseError instanceof Error ? parseError.message : "Unknown error"}`
      );
    }

    const { riskMatrix, prioritizedActions } = parseRecommendations(
      analysis.topRecommendations,
      equipmentDossiers
    );

    const linkedWorkOrders = equipmentDossiers.reduce(
      (sum, d) => sum + d.context.workOrderStats.openCount,
      0
    );
    const pendingComplianceItems = riskMatrix.filter(
      (r) => r.complianceRequirement.includes("Class") || r.complianceRequirement.includes("SOLAS")
    ).length;
    const scheduledMaintenanceOverlap = riskMatrix.filter(
      (r) => r.urgency === "NextPort" || r.urgency === "Weekly"
    ).length;

    const { fleetBenchmarks, equipmentComparisons } = calculateFleetBenchmarks(
      equipmentHealthData,
      equipmentDossiers
    );

    return {
      totalEquipment: analysis.totalEquipment ?? equipmentHealthData.length,
      healthyEquipment: analysis.healthyEquipment ?? 0,
      equipmentAtRisk: analysis.equipmentAtRisk ?? 0,
      criticalEquipment: analysis.criticalEquipment ?? 0,
      topRecommendations: analysis.topRecommendations ?? [],
      costEstimate: analysis.costEstimate ?? 0,
      summary: analysis.summary ?? "Fleet analysis unavailable",
      riskMatrix,
      prioritizedActions,
      systemIntegration: {
        linkedWorkOrders,
        pendingComplianceItems,
        scheduledMaintenanceOverlap,
      },
      fleetBenchmarks,
      equipmentComparisons,
    };
  } catch (error) {
    console.error("Fleet analysis failed:", error);

    const totalEquipment = equipmentHealthData.length;
    return {
      totalEquipment,
      healthyEquipment: Math.floor(totalEquipment * 0.6),
      equipmentAtRisk: Math.floor(totalEquipment * 0.3),
      criticalEquipment: Math.floor(totalEquipment * 0.1),
      topRecommendations: [
        "AI analysis service temporarily unavailable",
        "Schedule manual fleet inspection",
        "Review equipment maintenance schedules",
      ],
      costEstimate: 0,
      summary: "Fleet analysis service temporarily unavailable. Manual assessment recommended.",
    };
  }
}
