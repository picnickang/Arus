import { db } from "../../../db";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Application:SuggestionEngine");
import {
  alertNotifications,
  failurePredictions,
  maintenanceSchedules,
  crewCertification,
  crew,
} from "@shared/schema";
import type { AgentRepositoryPort } from "../domain/ports";
import type { AgentSuggestion } from "@shared/schema/agent";
import type { AgentSignal } from "../domain/types";
import {
  DEFAULT_PREFERENCES,
  buildPredictionCostLine,
  meetsMinSeverity,
  queueSuggestionNotifications,
  summarizeSuggestionsWithAi,
  type SuggestionEnginePreferences,
} from "./suggestion-engine-support";

export class SuggestionEngine {
  private intervalIds: Map<string, NodeJS.Timeout> = new Map();
  private evaluationIntervalMs = 4 * 60 * 60 * 1000;
  private signalHandler: ((signal: AgentSignal) => Promise<void>) | null = null;
  private recentSignals: Map<string, number> = new Map();
  private signalCooldownMs = 4 * 60 * 60 * 1000;

  constructor(private repo: AgentRepositoryPort) {}

  setSignalHandler(handler: (signal: AgentSignal) => Promise<void>): void {
    this.signalHandler = handler;
  }

  startBackgroundEvaluation(orgId: string, intervalMs?: number): void {
    if (this.intervalIds.has(orgId)) {
      return;
    }
    if (intervalMs) {
      this.evaluationIntervalMs = intervalMs;
    }

    logger.info(
      `[SuggestionEngine] Starting background evaluation every ${this.evaluationIntervalMs / 60000} minutes for org ${orgId}`
    );

    const id = setInterval(async () => {
      try {
        const storedPrefs = await this.repo.suggestions.getPreferences(orgId);
        await this.generateProactiveSuggestions(orgId, storedPrefs ?? undefined);
      } catch (err) {
        logger.error(
          `[SuggestionEngine] Background evaluation error for org ${orgId}:`,
          undefined,
          err instanceof Error ? err.message : "unknown"
        );
      }
    }, this.evaluationIntervalMs);
    this.intervalIds.set(orgId, id);
  }

  stopBackgroundEvaluation(orgId?: string): void {
    if (orgId) {
      const id = this.intervalIds.get(orgId);
      if (id) {
        clearInterval(id);
        this.intervalIds.delete(orgId);
        logger.info(`[SuggestionEngine] Background evaluation stopped for org ${orgId}`);
      }
    } else {
      for (const [org, id] of this.intervalIds) {
        clearInterval(id);
        logger.info(`[SuggestionEngine] Background evaluation stopped for org ${org}`);
      }
      this.intervalIds.clear();
    }
  }

  async generateProactiveSuggestions(
    orgId: string,
    preferences?: SuggestionEnginePreferences
  ): Promise<AgentSuggestion[]> {
    const prefs = preferences || DEFAULT_PREFERENCES;
    const newSuggestions: AgentSuggestion[] = [];

    const existingPending = await this.repo.suggestions.list(orgId, "pending", 500);
    const pendingKeys = new Set(existingPending.map((s) => `${s.triggerType}:${s.entityId || ""}`));

    if (prefs.predictions) {
      const items = await this.evaluateHighRiskPredictions(orgId, prefs.minSeverity, pendingKeys);
      newSuggestions.push(...items);
    }

    if (prefs.maintenance) {
      const items = await this.evaluateOverdueMaintenance(orgId, prefs.minSeverity, pendingKeys);
      newSuggestions.push(...items);
    }

    if (prefs.inventory) {
      const items = await this.evaluateLowStock(orgId, prefs.minSeverity, pendingKeys);
      newSuggestions.push(...items);
    }

    if (prefs.alerts) {
      const items = await this.evaluateCriticalAlerts(orgId, prefs.minSeverity, pendingKeys);
      newSuggestions.push(...items);
    }

    if (prefs.crew) {
      const items = await this.evaluateExpiringCertifications(
        orgId,
        prefs.minSeverity,
        pendingKeys
      );
      newSuggestions.push(...items);
    }

    if (newSuggestions.length > 0) {
      await summarizeSuggestionsWithAi(this.repo, newSuggestions);
      const updatedSuggestions = await Promise.all(
        newSuggestions.map(async (s) => {
          const fresh = await this.repo.suggestions.getById(s.id);
          return fresh || s;
        })
      );
      await queueSuggestionNotifications(db, orgId, updatedSuggestions);
    }

    logger.info(
      `[SuggestionEngine] Generated ${newSuggestions.length} suggestions for org ${orgId}`
    );
    return newSuggestions;
  }

  private async evaluateHighRiskPredictions(
    orgId: string,
    minSeverity: string,
    pendingKeys: Set<string>
  ): Promise<AgentSuggestion[]> {
    const results: AgentSuggestion[] = [];
    const highRiskPredictions = await db
      .select({
        id: failurePredictions.id,
        equipmentId: failurePredictions.equipmentId,
        failureMode: failurePredictions.failureMode,
        failureProbability: failurePredictions.failureProbability,
        riskLevel: failurePredictions.riskLevel,
        predictedFailureDate: failurePredictions.predictedFailureDate,
        modelId: failurePredictions.modelId,
        confidenceInterval: failurePredictions.confidenceInterval,
        costImpact: failurePredictions.costImpact,
      })
      .from(failurePredictions)
      .where(
        and(
          eq(failurePredictions.orgId, orgId),
          gte(failurePredictions.predictionTimestamp, new Date(Date.now() - 86400000))
        )
      )
      .orderBy(desc(failurePredictions.failureProbability))
      .limit(10);

    let config: import("@shared/schema/agent").AgentConfigType | null = null;
    try {
      config = (await this.repo.config.get(orgId)) ?? null;
    } catch {
      // Non-critical — auto-trigger defaults to off
    }

    const autoTriggerEnabled = config?.autoTriggerEnabled ?? false;
    const autoTriggerThreshold = config?.autoTriggerThreshold ?? 0.85;

    for (const pred of highRiskPredictions) {
      if (pred.failureProbability > 0.8) {
        const dedupKey = `high_risk_prediction:${pred.equipmentId}`;
        if (pendingKeys.has(dedupKey)) {
          continue;
        }
        const severity = pred.failureProbability >= 0.9 ? "critical" : "warning";
        if (!meetsMinSeverity(severity, minSeverity)) {
          continue;
        }

        const costImpact = pred.costImpact as {
          estimatedRepairCost?: number;
          estimatedDowntime?: number;
          revenueImpact?: number;
        } | null;
        const costLine = buildPredictionCostLine(costImpact);

        const sug = await this.repo.suggestions.create({
          orgId,
          triggerType: "high_risk_prediction",
          title: `High failure risk: ${pred.failureMode || "Unknown"} on ${pred.equipmentId}`,
          summary: `Failure probability ${(pred.failureProbability * 100).toFixed(0)}% (${pred.riskLevel}). Predicted failure: ${pred.predictedFailureDate ? new Date(pred.predictedFailureDate).toLocaleDateString() : "Unknown"}.${costLine}`,
          entityType: "equipment",
          entityId: pred.equipmentId,
          severity,
          status: "pending",
          context: { prediction: pred, costImpact: costImpact || undefined },
        });
        results.push(sug);

        if (
          autoTriggerEnabled &&
          this.signalHandler &&
          pred.failureProbability >= autoTriggerThreshold
        ) {
          const cooldownKey = `${orgId}:${pred.equipmentId}:high_risk_prediction`;
          const lastDispatch = this.recentSignals.get(cooldownKey);
          const now = Date.now();
          if (!lastDispatch || now - lastDispatch >= this.signalCooldownMs) {
            this.recentSignals.set(cooldownKey, now);
            const signal: AgentSignal = {
              type: "high_risk_prediction",
              orgId,
              predictionId: pred.id,
              equipmentId: pred.equipmentId,
              failureProbability: pred.failureProbability,
              failureMode: pred.failureMode || "Unknown",
              riskLevel: pred.riskLevel || "high",
              modelId: pred.modelId,
              confidenceInterval: pred.confidenceInterval,
              predictedFailureDate: pred.predictedFailureDate
                ? new Date(pred.predictedFailureDate).toISOString()
                : null,
              suggestionId: sug.id,
              costImpact: costImpact || null,
            };
            this.dispatchSignal(signal);
          }
        }
      }
    }
    return results;
  }

  private dispatchSignal(signal: AgentSignal): void {
    if (!this.signalHandler) {
      return;
    }
    const handler = this.signalHandler;
    setImmediate(async () => {
      try {
        await handler(signal);
      } catch (err) {
        logger.error(
          `[SuggestionEngine] Signal dispatch failed for ${signal.type} on ${signal.equipmentId}:`,
          undefined,
          err instanceof Error ? err.message : "unknown"
        );
      }
    });
  }

  private async evaluateOverdueMaintenance(
    orgId: string,
    minSeverity: string,
    pendingKeys: Set<string>
  ): Promise<AgentSuggestion[]> {
    const results: AgentSuggestion[] = [];
    if (!meetsMinSeverity("warning", minSeverity)) {
      return results;
    }

    const overdueMaint = await db
      .select({
        id: maintenanceSchedules.id,
        equipmentId: maintenanceSchedules.equipmentId,
        scheduledDate: maintenanceSchedules.scheduledDate,
        maintenanceType: maintenanceSchedules.maintenanceType,
        description: maintenanceSchedules.description,
      })
      .from(maintenanceSchedules)
      .where(
        and(
          eq(maintenanceSchedules.orgId, orgId),
          eq(maintenanceSchedules.status, "scheduled"),
          lte(maintenanceSchedules.scheduledDate, new Date(Date.now() - 24 * 60 * 60 * 1000))
        )
      )
      .limit(10);

    for (const maint of overdueMaint) {
      const dedupKey = `overdue_maintenance:${maint.id}`;
      if (pendingKeys.has(dedupKey)) {
        continue;
      }
      const daysOverdue = Math.floor(
        (Date.now() - new Date(maint.scheduledDate).getTime()) / (24 * 60 * 60 * 1000)
      );
      const severity = daysOverdue > 7 ? "critical" : "warning";
      if (!meetsMinSeverity(severity, minSeverity)) {
        continue;
      }
      const sug = await this.repo.suggestions.create({
        orgId,
        triggerType: "overdue_maintenance",
        title: `Overdue maintenance: ${maint.maintenanceType} on ${maint.equipmentId}`,
        summary: `${maint.description || maint.maintenanceType} was scheduled for ${new Date(maint.scheduledDate).toLocaleDateString()} (${daysOverdue} days overdue).`,
        entityType: "maintenance_schedule",
        entityId: maint.id,
        severity,
        status: "pending",
        context: { schedule: maint, daysOverdue },
      });
      results.push(sug);
    }
    return results;
  }

  private async evaluateLowStock(
    orgId: string,
    minSeverity: string,
    pendingKeys: Set<string>
  ): Promise<AgentSuggestion[]> {
    const results: AgentSuggestion[] = [];
    if (!meetsMinSeverity("info", minSeverity)) {
      return results;
    }

    try {
      const lowStockResult = await db.execute(sql`
        SELECT id, part_name, quantity_on_hand, min_stock_level
        FROM parts_inventory
        WHERE org_id = ${orgId} AND quantity_on_hand <= min_stock_level
        LIMIT 5
      `);
      const lowStockRows = (lowStockResult as { rows?: Array<Record<string, unknown>> }).rows || [];

      for (const part of lowStockRows) {
        const dedupKey = `low_stock:${part["id"] as string}`;
        if (pendingKeys.has(dedupKey)) {
          continue;
        }
        const severity = Number(part["quantity_on_hand"]) === 0 ? "critical" : "info";
        if (!meetsMinSeverity(severity, minSeverity)) {
          continue;
        }
        const sug = await this.repo.suggestions.create({
          orgId,
          triggerType: "low_stock",
          title: `Low stock: ${part["part_name"]}`,
          summary: `Current stock ${part["quantity_on_hand"]} is at or below minimum level ${part["min_stock_level"]}. Reorder recommended.`,
          entityType: "inventory",
          entityId: part["id"] as string,
          severity,
          status: "pending",
          context: { part },
        });
        results.push(sug);
      }
    } catch (err) {
      logger.warn("[SuggestionEngine] Low stock query failed:", {
        details: err instanceof Error ? err.message : "unknown",
      });
    }
    return results;
  }

  private async evaluateCriticalAlerts(
    orgId: string,
    minSeverity: string,
    pendingKeys: Set<string>
  ): Promise<AgentSuggestion[]> {
    const results: AgentSuggestion[] = [];
    if (!meetsMinSeverity("critical", minSeverity)) {
      return results;
    }

    try {
      const recentAlerts = await db
        .select({
          id: alertNotifications.id,
          equipmentId: alertNotifications.equipmentId,
          sensorType: alertNotifications.sensorType,
          alertType: alertNotifications.alertType,
          message: alertNotifications.message,
          value: alertNotifications.value,
          threshold: alertNotifications.threshold,
        })
        .from(alertNotifications)
        .where(
          and(
            eq(alertNotifications.orgId, orgId),
            eq(alertNotifications.acknowledged, false),
            gte(alertNotifications.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
            sql`${alertNotifications.alertType} IN ('critical', 'high', 'danger', 'emergency')`
          )
        )
        .orderBy(desc(alertNotifications.createdAt))
        .limit(10);

      for (const alert of recentAlerts) {
        const dedupKey = `critical_alert:${alert.equipmentId}`;
        if (pendingKeys.has(dedupKey)) {
          continue;
        }
        const sug = await this.repo.suggestions.create({
          orgId,
          triggerType: "critical_alert",
          title: `Unacknowledged alert: ${alert.alertType} on ${alert.equipmentId}`,
          summary: `${alert.message}. Sensor ${alert.sensorType} read ${alert.value} (threshold: ${alert.threshold}).`,
          entityType: "equipment",
          entityId: alert.equipmentId,
          severity: "critical",
          status: "pending",
          context: { alert },
        });
        results.push(sug);
      }
    } catch (err) {
      logger.warn("[SuggestionEngine] Critical alerts query failed:", {
        details: err instanceof Error ? err.message : "unknown",
      });
    }
    return results;
  }

  private async evaluateExpiringCertifications(
    orgId: string,
    minSeverity: string,
    pendingKeys: Set<string>
  ): Promise<AgentSuggestion[]> {
    const results: AgentSuggestion[] = [];
    if (!meetsMinSeverity("warning", minSeverity)) {
      return results;
    }

    try {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringCerts = await db
        .select({
          certId: crewCertification.id,
          crewId: crewCertification.crewId,
          cert: crewCertification.cert,
          expiresAt: crewCertification.expiresAt,
          crewName: crew.name,
        })
        .from(crewCertification)
        .innerJoin(crew, eq(crewCertification.crewId, crew.id))
        .where(
          and(
            eq(crewCertification.orgId, orgId),
            lte(crewCertification.expiresAt, thirtyDaysFromNow),
            gte(crewCertification.expiresAt, new Date())
          )
        )
        .limit(10);

      for (const cert of expiringCerts) {
        const dedupKey = `expiring_certification:${cert.crewId}`;
        if (pendingKeys.has(dedupKey)) {
          continue;
        }
        const daysUntilExpiry = Math.ceil(
          (new Date(cert.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );
        const severity = daysUntilExpiry <= 7 ? "critical" : "warning";
        if (!meetsMinSeverity(severity, minSeverity)) {
          continue;
        }
        const sug = await this.repo.suggestions.create({
          orgId,
          triggerType: "expiring_certification",
          title: `Certification expiring: ${cert.cert} for ${cert.crewName}`,
          summary: `${cert.cert} expires in ${daysUntilExpiry} days (${new Date(cert.expiresAt).toLocaleDateString()}). Renewal action needed.`,
          entityType: "crew",
          entityId: cert.crewId,
          severity,
          status: "pending",
          context: { certification: cert, daysUntilExpiry },
        });
        results.push(sug);
      }
    } catch (err) {
      logger.warn("[SuggestionEngine] Certification expiry query failed:", {
        details: err instanceof Error ? err.message : "unknown",
      });
    }
    return results;
  }
}
