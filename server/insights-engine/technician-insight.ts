/**
 * Technician Insight Generation
 *
 * Generate plain-language insights for equipment technicians.
 */

import { dbEquipmentStorage, dbTelemetryStorage, vesselService } from "../repositories";
import { predictWithEnsemble } from "../ml-prediction";
import { recordTechnicianInsight, recordTechnicianInsightFallback } from "../ml-prometheus-metrics";
import {
  determineStatusLevel,
  getPriorityFromStatus,
  STATUS_DEFINITIONS,
  formatConfidence,
} from "@shared/technician-status";
import type { TechnicianInsightView, TriggerInfo } from "./types.js";

/**
 * Generate technician-friendly insight view for equipment
 */
export async function generateTechnicianInsight(
  equipmentId: string,
  orgId: string
): Promise<TechnicianInsightView | null> {
  const startTime = Date.now();
  try {
    const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);
    if (!equipment || equipment.orgId !== orgId) {
      return null;
    }

    let vesselName: string | null = null;
    if (equipment.vesselId) {
      const vessel = await vesselService.getVessel(equipment.vesselId, orgId);
      vesselName = vessel?.name || equipment.vesselName || null;
    }

    const prediction = await predictWithEnsemble(equipmentId, orgId);

    const telemetry = await dbTelemetryStorage.getLatestTelemetryReadings(equipmentId, 100);

    const statusLevel = determineStatusLevel(
      prediction?.failureProbability ?? 0,
      prediction?.confidence ?? 0
    );
    const statusDef = STATUS_DEFINITIONS[statusLevel];
    const priority = getPriorityFromStatus(statusLevel);

    const triggers: TriggerInfo[] = [];

    for (const reading of telemetry) {
      const val = Number(reading.value);
      if (!Number.isFinite(val)) {
        continue;
      }
      if (reading.status === "warning" || reading.status === "critical") {
        const thr = Number.isFinite(reading.threshold) ? Number(reading.threshold) : null;
        const deviation =
          thr != null && thr !== 0
            ? `${Math.abs(((val - thr) / thr) * 100).toFixed(0)}% ${val > thr ? "above" : "below"} normal`
            : "deviation detected";
        triggers.push({
          sensorType: reading.sensorType,
          value: val,
          threshold: thr ?? 0,
          deviation,
        });
      }
    }

    const displayName = equipment.plainLanguageName || equipment.name;
    const failureProbPct = ((prediction?.failureProbability ?? 0) * 100).toFixed(1);

    const { summary, explanation, actionSteps } = generateStatusContent(
      statusLevel,
      displayName,
      failureProbPct,
      triggers
    );

    let nextReviewDate: Date | null = null;
    if (priority === "immediate") {
      nextReviewDate = new Date(Date.now() + 4 * 60 * 60 * 1000);
    } else if (priority === "urgent") {
      nextReviewDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    } else if (priority === "scheduled") {
      nextReviewDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    }

    const daysUntilFailure =
      (prediction as any)?.daysUntilFailure ?? (prediction as any)?.remainingDays ?? null;

    const technicianView: TechnicianInsightView = {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      plainLanguageName: equipment.plainLanguageName || null,
      vesselId: equipment.vesselId || null,
      vesselName,
      systemType: equipment.systemType || null,
      componentType: equipment.componentType || null,
      criticalityLevel: equipment.criticalityLevel || "medium",

      statusLevel,
      statusLabel: statusDef.label,
      statusColor: statusDef.color,
      priority,
      priorityTimeframe:
        priority === "immediate"
          ? "Immediately"
          : priority === "urgent"
            ? "Within 24-72 hours"
            : priority === "scheduled"
              ? "Within 1-2 weeks"
              : "Routine",

      summary,
      explanation,
      confidence: formatConfidence(prediction?.confidence ?? 0),

      actionSteps,

      mlPrediction: {
        failureProbability: prediction?.failureProbability ?? 0,
        confidence: prediction?.confidence ?? 0,
        daysUntilFailure,
        triggers,
      },

      lastUpdated: new Date(),
      nextReviewDate,
    };

    const duration = (Date.now() - startTime) / 1000;
    recordTechnicianInsight(orgId, statusLevel, duration, true);

    console.log(
      JSON.stringify({
        msg: "technician_insight_done",
        orgId,
        equipmentId,
        vesselId: equipment.vesselId ?? null,
        statusLevel,
        failureProb: prediction?.failureProbability ?? 0,
        confidence: prediction?.confidence ?? 0,
      })
    );

    return technicianView;
  } catch (error) {
    console.error("[Insights] Failed to generate technician insight:", error);

    const duration = (Date.now() - startTime) / 1000;
    recordTechnicianInsight(orgId, "error", duration, false);
    recordTechnicianInsightFallback(orgId, "exception");

    return null;
  }
}

function generateStatusContent(
  statusLevel: string,
  displayName: string,
  failureProbPct: string,
  triggers: TriggerInfo[]
): { summary: string; explanation: string; actionSteps: string[] } {
  let summary = "";
  let explanation = "";
  let actionSteps: string[] = [];

  if (statusLevel === "critical") {
    summary = `Critical alert: ${displayName} shows high failure risk (${failureProbPct}%)`;
    explanation =
      "Multiple sensors have exceeded safety thresholds. Equipment failure may be imminent.";
    actionSteps = [
      "Inspect equipment immediately",
      "Check all sensor readings and verify accuracy",
      "Contact supervisor or shore-based support",
      "Prepare contingency plan if equipment must be taken offline",
    ];
  } else if (statusLevel === "action_required") {
    summary = `Action needed: ${displayName} requires maintenance attention`;
    explanation = "Sensor readings indicate developing issues that need scheduled maintenance.";
    actionSteps = [
      "Schedule inspection during next maintenance window",
      "Review recent operating history for unusual conditions",
      "Order any recommended replacement parts",
      "Document current readings for trend analysis",
    ];
  } else if (statusLevel === "monitor") {
    summary = `Monitor: ${displayName} shows minor deviations from normal`;
    explanation = "Some readings are outside normal range but not yet concerning.";
    actionSteps = [
      "Continue normal monitoring",
      "Check sensor readings during routine rounds",
      "Note any changes in operating conditions",
    ];
  } else {
    summary = `Normal: ${displayName} operating within expected parameters`;
    explanation = "All sensors reading within normal ranges. No action needed.";
    actionSteps = [
      "Continue routine monitoring",
      "Perform scheduled preventive maintenance as planned",
    ];
  }

  if (triggers.length > 0) {
    const triggerList = triggers.map((t) => `${t.sensorType} (${t.deviation})`).join(", ");
    explanation += ` Triggers: ${triggerList}.`;
  }

  return { summary, explanation, actionSteps };
}
