import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  actionableInsights,
  equipment,
  failurePredictions,
  alertNotifications,
  sensorConfigurations,
  equipmentTelemetry,
  pdmScoreLogs,
} from "@shared/schema-runtime";
import type { InsertActionableInsight } from "@shared/schema";
import { logger } from "../../utils/logger.js";

export type InsightType =
  | "MAINTENANCE_DUE"
  | "FAILURE_PREDICTED"
  | "CONDITION_DETERIORATING"
  | "SENSOR_ANOMALY"
  | "OPTIMIZATION_OPPORTUNITY"
  | "COMPLIANCE_RISK";

export type InsightSeverity = "critical" | "high" | "medium" | "low";

type FailurePrediction = typeof failurePredictions.$inferSelect;
type AlertNotification = typeof alertNotifications.$inferSelect;
type EquipmentTelemetryRow = typeof equipmentTelemetry.$inferSelect;
type PdmScoreLog = typeof pdmScoreLogs.$inferSelect & { score?: number };
type SensorConfiguration = typeof sensorConfigurations.$inferSelect & { status?: string };

export interface EquipmentHealthContext {
  equipmentId: string;
  orgId: string;
  vesselId?: string;
  failurePrediction?: FailurePrediction;
  recentAlerts: AlertNotification[];
  recentTelemetry: EquipmentTelemetryRow[];
  pdmScoreLog?: PdmScoreLog;
  sensorData: SensorConfiguration[];
}

export interface GeneratedInsight {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  message: string;
  supportingSignals?: Record<string, unknown>;
  recommendedAction?: string;
  relatedProcedures?: string[];
}

export class InsightEngine {
  private static readonly RUL_CRITICAL_THRESHOLD = 7; // days
  private static readonly RUL_WARNING_THRESHOLD = 30; // days
  private static readonly PDM_CRITICAL_THRESHOLD = 80;
  private static readonly PDM_WARNING_THRESHOLD = 60;

  static async evaluateEquipment(equipmentId: string, orgId: string): Promise<GeneratedInsight[]> {
    try {
      const context = await this.gatherHealthContext(equipmentId, orgId);
      const insights: GeneratedInsight[] = [];

      insights.push(...this.evaluateFailurePredictions(context));
      insights.push(...this.evaluatePDMScore(context));
      insights.push(...this.evaluateRecentAlerts(context));
      insights.push(...this.evaluateSensorHealth(context));

      return insights.sort(
        (a, b) => this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity)
      );
    } catch (error) {
      logger.error("Insight evaluation failed", { equipmentId, error });
      return [];
    }
  }

  private static async gatherHealthContext(
    equipmentId: string,
    orgId: string
  ): Promise<EquipmentHealthContext> {
    const [equipmentData] = await db
      .select()
      .from(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .limit(1);

    const [failurePrediction] = await db
      .select()
      .from(failurePredictions)
      .where(eq(failurePredictions.equipmentId, equipmentId))
      .orderBy(sql`${failurePredictions.predictionTimestamp} DESC`)
      .limit(1);

    const recentAlerts = await db
      .select()
      .from(alertNotifications)
      .where(
        and(
          eq(alertNotifications.equipmentId, equipmentId),
          eq(alertNotifications.orgId, orgId),
          eq(alertNotifications.acknowledged, false)
        )
      )
      .orderBy(sql`${alertNotifications.createdAt} DESC`)
      .limit(10);

    const sensorData = await db
      .select()
      .from(sensorConfigurations)
      .where(
        and(
          eq(sensorConfigurations.equipmentId, equipmentId),
          eq(sensorConfigurations.orgId, orgId)
        )
      );

    const [pdmScoreLog] = await db
      .select()
      .from(pdmScoreLogs)
      .where(eq(pdmScoreLogs.equipmentId, equipmentId))
      .orderBy(sql`${pdmScoreLogs.ts} DESC`)
      .limit(1);

    const recentTelemetry = await db
      .select()
      .from(equipmentTelemetry)
      .where(
        and(eq(equipmentTelemetry.equipmentId, equipmentId), eq(equipmentTelemetry.orgId, orgId))
      )
      .orderBy(sql`${equipmentTelemetry.ts} DESC`)
      .limit(50);

    return {
      equipmentId,
      orgId,
      vesselId: equipmentData?.vesselId ?? undefined,
      failurePrediction,
      recentAlerts,
      recentTelemetry,
      pdmScoreLog,
      sensorData,
    };
  }

  private static evaluateFailurePredictions(context: EquipmentHealthContext): GeneratedInsight[] {
    const insights: GeneratedInsight[] = [];

    if (!context.failurePrediction) {
      return insights;
    }

    const prediction = context.failurePrediction;
    const probability = prediction.failureProbability ?? 0;

    if (probability > 0.8) {
      insights.push({
        type: "FAILURE_PREDICTED",
        severity: "critical",
        title: `High Failure Risk Detected`,
        message: `Equipment has ${(probability * 100).toFixed(0)}% probability of failure. Immediate attention required.`,
        supportingSignals: {
          failureProbability: probability,
          predictionId: prediction.id,
          timestamp: prediction.predictionTimestamp,
        },
        recommendedAction:
          "Schedule emergency maintenance immediately. Order replacement parts if not in inventory. Prepare backup equipment.",
        relatedProcedures: ["EMERGENCY_MAINTENANCE", "PARTS_ORDERING", "EQUIPMENT_SWAP"],
      });
    } else if (probability > 0.6) {
      insights.push({
        type: "MAINTENANCE_DUE",
        severity: "high",
        title: `Elevated Failure Risk`,
        message: `Equipment shows ${(probability * 100).toFixed(0)}% failure probability. Preventive maintenance recommended.`,
        supportingSignals: {
          failureProbability: probability,
          predictionId: prediction.id,
        },
        recommendedAction:
          "Schedule preventive maintenance within the next week. Verify parts availability.",
        relatedProcedures: ["PREVENTIVE_MAINTENANCE", "PARTS_CHECK"],
      });
    }

    return insights;
  }

  private static evaluatePDMScore(context: EquipmentHealthContext): GeneratedInsight[] {
    const insights: GeneratedInsight[] = [];

    if (!context.pdmScoreLog) {
      return insights;
    }

    const score = context.pdmScoreLog.score;
    if (score == null) {
      return insights;
    }

    if (score >= this.PDM_CRITICAL_THRESHOLD) {
      insights.push({
        type: "CONDITION_DETERIORATING",
        severity: "critical",
        title: `Critical Equipment Condition - PDM Score ${score}`,
        message: `Equipment health score has reached critical level (${score}/100). Immediate attention required.`,
        supportingSignals: {
          pdmScore: score,
          timestamp: context.pdmScoreLog.ts,
        },
        recommendedAction:
          "Perform comprehensive equipment inspection. Review maintenance history. Check for abnormal operating conditions.",
        relatedProcedures: ["COMPREHENSIVE_INSPECTION", "MAINTENANCE_REVIEW"],
      });
    } else if (score >= this.PDM_WARNING_THRESHOLD) {
      insights.push({
        type: "CONDITION_DETERIORATING",
        severity: "medium",
        title: `Equipment Condition Declining - PDM Score ${score}`,
        message: `Equipment health score is elevated (${score}/100). Monitor closely and consider maintenance.`,
        supportingSignals: {
          pdmScore: score,
        },
        recommendedAction:
          "Increase monitoring frequency. Review sensor data for early warning signs.",
        relatedProcedures: ["INCREASED_MONITORING"],
      });
    }

    return insights;
  }

  private static evaluateRecentAlerts(context: EquipmentHealthContext): GeneratedInsight[] {
    const insights: GeneratedInsight[] = [];

    const criticalAlerts = context.recentAlerts.filter(
      (a) => a.alertType === "CRITICAL" || a.alertType === "THRESHOLD_EXCEEDED"
    );

    if (criticalAlerts.length >= 3) {
      insights.push({
        type: "SENSOR_ANOMALY",
        severity: "high",
        title: `Multiple Critical Alerts - ${criticalAlerts.length} Unacknowledged`,
        message: `${criticalAlerts.length} critical alerts detected. Equipment may be operating outside safe parameters.`,
        supportingSignals: {
          alertCount: criticalAlerts.length,
          alertTypes: [...new Set(criticalAlerts.map((a) => a.alertType))],
          sensorTypes: [...new Set(criticalAlerts.map((a) => a.sensorType))],
        },
        recommendedAction:
          "Review all alerts immediately. Check if equipment is operating within design limits. Consider reducing load or shutting down.",
        relatedProcedures: ["ALERT_INVESTIGATION", "EQUIPMENT_SHUTDOWN"],
      });
    }

    return insights;
  }

  private static evaluateSensorHealth(context: EquipmentHealthContext): GeneratedInsight[] {
    const insights: GeneratedInsight[] = [];

    const inactiveSensors = context.sensorData.filter((s) => s.status !== "active");

    if (inactiveSensors.length > 0) {
      insights.push({
        type: "SENSOR_ANOMALY",
        severity: inactiveSensors.length > 2 ? "high" : "medium",
        title: `${inactiveSensors.length} Sensor(s) Offline`,
        message: `${inactiveSensors.length} sensors are not reporting data. Equipment monitoring may be incomplete.`,
        supportingSignals: {
          inactiveSensors: inactiveSensors.map((s) => ({
            id: s.id,
            type: s.sensorType,
            status: s.status,
          })),
        },
        recommendedAction:
          "Check sensor connectivity. Verify power supply. Replace faulty sensors.",
        relatedProcedures: ["SENSOR_DIAGNOSTICS", "SENSOR_REPLACEMENT"],
      });
    }

    return insights;
  }

  private static calculatePDMTrend(
    context: EquipmentHealthContext
  ): "rising" | "stable" | "falling" {
    return "rising";
  }

  private static getSeverityScore(severity: InsightSeverity): number {
    const scores = { critical: 4, high: 3, medium: 2, low: 1 };
    return scores[severity];
  }

  static async storeInsight(
    orgId: string,
    equipmentId: string,
    vesselId: string | null,
    insight: GeneratedInsight
  ): Promise<string> {
    const [existingInsight] = await db
      .select()
      .from(actionableInsights)
      .where(
        and(
          eq(actionableInsights.equipmentId, equipmentId),
          eq(actionableInsights.type, insight.type),
          eq(actionableInsights.resolved, false)
        )
      )
      .limit(1);

    if (existingInsight) {
      logger.debug("InsightEngine", "Insight already exists", { equipmentId, type: insight.type });
      return existingInsight.id;
    }

    const insightData: InsertActionableInsight = {
      orgId,
      equipmentId,
      vesselId,
      type: insight.type,
      severity: insight.severity,
      title: insight.title,
      message: insight.message,
      supportingSignals: insight.supportingSignals
        ? JSON.stringify(insight.supportingSignals)
        : null,
      recommendedAction: insight.recommendedAction || null,
      relatedProcedures: insight.relatedProcedures
        ? JSON.stringify(insight.relatedProcedures)
        : null,
    };

    const [created] = await db.insert(actionableInsights).values(insightData).returning();

    logger.info("InsightEngine", "Actionable insight created", {
      insightId: created.id,
      equipmentId,
      type: insight.type,
      severity: insight.severity,
    });

    return created.id;
  }

  static async evaluateAndStoreInsights(
    equipmentId: string,
    orgId: string,
    vesselId?: string
  ): Promise<string[]> {
    const insights = await this.evaluateEquipment(equipmentId, orgId);
    const insightIds: string[] = [];

    for (const insight of insights) {
      try {
        const id = await this.storeInsight(orgId, equipmentId, vesselId || null, insight);
        insightIds.push(id);
      } catch (error) {
        logger.error("Failed to store insight", { equipmentId, insight, error });
      }
    }

    return insightIds;
  }
}
