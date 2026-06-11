/**
 * Fleet Health Analysis using OpenAI
 */

import type { EquipmentTelemetry, TelemetryTrend } from "@shared/schema";
import type { EquipmentHealth } from "../db/equipment/types.js";
import type { FleetAnalysis } from "./types";
import { calculateDynamicTokens } from "./client";
import { llmGateway } from "../composition/llm-gateway";
import { buildEquipmentDossiers, type EquipmentDossier } from "./dossier-builder";
import { parseRecommendations } from "./risk-parser";
import { calculateFleetBenchmarks } from "./fleet-benchmarks";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Openai:FleetAnalysis");

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
function buildUserPrompt(
  equipmentDossiers: EquipmentDossier[],
  telemetrySummary: TelemetrySummary
): string {
  return `FLEET ANALYSIS REQUEST:
    
    Equipment: ${equipmentDossiers
      .slice(0, 3)
      .map(
        (e) =>
          `${e.id}(health:${e.healthIndex},alerts:${e.context.alertPattern.total}/${e.context.alertPattern.critical}crit,work-orders:${e.context.workOrderStats.openCount}open,pdm-trend:${e.context.pdmTrend.degradationRate.toFixed(1)}/day)`
      )
      .join(", ")}
    
    Active Issues: ${telemetrySummary.recentIssues.map((i) => `${i.equipment}-${i.sensor}:${i.status}`).join(", ")}
    
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
interface TelemetryIssue {
  equipment: string;
  sensor: string;
  status: string;
  value: string | number;
}

interface TelemetrySummary {
  totalReadings: number;
  equipmentTypes: string[];
  recentIssues: TelemetryIssue[];
}

type TelemetryRow = (EquipmentTelemetry | TelemetryTrend) & {
  status?: string;
  currentValue?: number;
  value?: number;
};

function buildTelemetrySummary(
  telemetryData: EquipmentTelemetry[] | TelemetryTrend[]
): TelemetrySummary {
  if (!Array.isArray(telemetryData) || telemetryData.length === 0) {
    return { totalReadings: 0, equipmentTypes: [], recentIssues: [] };
  }

  const rows = telemetryData as TelemetryRow[];

  return {
    totalReadings: rows.length,
    equipmentTypes: [...new Set(rows.map((t) => t.equipmentId))],
    recentIssues: rows
      .filter((t) => t.status === "critical" || t.status === "warning")
      .slice(-5)
      .map<TelemetryIssue>((t) => ({
        equipment: t.equipmentId,
        sensor: t.sensorType,
        status: t.status ?? "unknown",
        value:
          typeof t.currentValue === "number"
            ? t.currentValue
            : typeof t.value === "number"
              ? t.value
              : "N/A",
      })),
  };
}

/**
 * Analyzes fleet-wide telemetry data to provide overall maintenance recommendations
 */
export async function analyzeFleetHealth(
  equipmentHealthData: EquipmentHealth[],
  telemetryData: EquipmentTelemetry[] | TelemetryTrend[],
  storageInstance?: unknown
): Promise<FleetAnalysis> {
  try {
    logger.info(
      `[Fleet Analysis] Starting enriched analysis with ${equipmentHealthData.length} equipment units and ${telemetryData.length} telemetry records`
    );

    const { dbWorkOrderStorage, dbAlertStorage, dbDevicesStorage, dbMaintenanceStorage } =
      await import("../repositories");
    const storageToUse = storageInstance ?? {
      getWorkOrders: (equipmentId: string) => dbWorkOrderStorage.getWorkOrders(equipmentId),
      getAlertNotifications: () => dbAlertStorage.getAlertNotifications(),
      getPdmScores: (equipmentId: string) => dbDevicesStorage.getPdmScores(equipmentId),
      getMaintenanceRecords: (equipmentId: string) =>
        dbMaintenanceStorage.getMaintenanceRecords(equipmentId),
    };

    const equipmentDossiers = await buildEquipmentDossiers(equipmentHealthData, storageToUse);
    const telemetrySummary = buildTelemetrySummary(telemetryData);

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(equipmentDossiers, telemetrySummary);

    const inputSize = systemPrompt.length + userPrompt.length;
    const maxTokens = calculateDynamicTokens(inputSize, 1500, 3500);

    const response = await llmGateway.chat({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      jsonMode: true,
      maxCompletionTokens: maxTokens,
      meta: { caller: "fleet-analysis", equipmentCount: equipmentHealthData.length },
    });

    let analysis;
    try {
      if (!response.content) {
        throw new Error("No content in LLM response");
      }
      analysis = JSON.parse(response.content);
    } catch (parseError) {
      logger.error("Failed to parse LLM fleet analysis response:", undefined, parseError);
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
    logger.error("Fleet analysis failed:", undefined, error);

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
