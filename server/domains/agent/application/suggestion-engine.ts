import { db } from "../../../db";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import {
  alertNotifications, failurePredictions, maintenanceSchedules,
  crewCertification, crew, notificationQueue,
} from "@shared/schema";
import type { AgentRepositoryPort } from "../domain/ports";
import type { AgentSuggestion, InsertAgentSuggestion } from "@shared/schema/agent";

interface SuggestionPreferences {
  maintenance: boolean;
  predictions: boolean;
  crew: boolean;
  inventory: boolean;
  alerts: boolean;
  minSeverity: "info" | "warning" | "critical";
}

const DEFAULT_PREFERENCES: SuggestionPreferences = {
  maintenance: true,
  predictions: true,
  crew: true,
  inventory: true,
  alerts: true,
  minSeverity: "info",
};

const SEVERITY_RANK: Record<string, number> = { info: 0, warning: 1, critical: 2 };

function meetsMinSeverity(severity: string, min: string): boolean {
  return (SEVERITY_RANK[severity] ?? 0) >= (SEVERITY_RANK[min] ?? 0);
}

export class SuggestionEngine {
  private intervalIds: Map<string, NodeJS.Timeout> = new Map();
  private evaluationIntervalMs = 4 * 60 * 60 * 1000;

  constructor(private repo: AgentRepositoryPort) {}

  startBackgroundEvaluation(orgId: string, intervalMs?: number): void {
    if (this.intervalIds.has(orgId)) return;
    if (intervalMs) this.evaluationIntervalMs = intervalMs;

    console.log(`[SuggestionEngine] Starting background evaluation every ${this.evaluationIntervalMs / 60000} minutes for org ${orgId}`);

    const id = setInterval(async () => {
      try {
        const storedPrefs = await this.repo.suggestions.getPreferences(orgId);
        await this.generateProactiveSuggestions(orgId, storedPrefs);
      } catch (err) {
        console.error(`[SuggestionEngine] Background evaluation error for org ${orgId}:`, err instanceof Error ? err.message : "unknown");
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
        console.log(`[SuggestionEngine] Background evaluation stopped for org ${orgId}`);
      }
    } else {
      for (const [org, id] of this.intervalIds) {
        clearInterval(id);
        console.log(`[SuggestionEngine] Background evaluation stopped for org ${org}`);
      }
      this.intervalIds.clear();
    }
  }

  async generateProactiveSuggestions(orgId: string, preferences?: SuggestionPreferences): Promise<AgentSuggestion[]> {
    const prefs = preferences || DEFAULT_PREFERENCES;
    const newSuggestions: AgentSuggestion[] = [];

    const existingPending = await this.repo.suggestions.list(orgId, "pending", 500);
    const pendingKeys = new Set(existingPending.map(s => `${s.triggerType}:${s.entityId || ""}`));

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
      const items = await this.evaluateExpiringCertifications(orgId, prefs.minSeverity, pendingKeys);
      newSuggestions.push(...items);
    }

    if (newSuggestions.length > 0) {
      await this.aiSummarizeSuggestions(newSuggestions);
      await this.queueNotifications(orgId, newSuggestions);
    }

    console.log(`[SuggestionEngine] Generated ${newSuggestions.length} suggestions for org ${orgId}`);
    return newSuggestions;
  }

  private async evaluateHighRiskPredictions(orgId: string, minSeverity: string, pendingKeys: Set<string>): Promise<AgentSuggestion[]> {
    const results: AgentSuggestion[] = [];
    const highRiskPredictions = await db.select({
      equipmentId: failurePredictions.equipmentId,
      failureMode: failurePredictions.failureMode,
      failureProbability: failurePredictions.failureProbability,
      riskLevel: failurePredictions.riskLevel,
      predictedFailureDate: failurePredictions.predictedFailureDate,
    }).from(failurePredictions)
      .where(and(
        eq(failurePredictions.orgId, orgId),
        gte(failurePredictions.predictionTimestamp, new Date(Date.now() - 86400000)),
      ))
      .orderBy(desc(failurePredictions.failureProbability))
      .limit(10);

    for (const pred of highRiskPredictions) {
      if (pred.failureProbability > 0.8) {
        const dedupKey = `high_risk_prediction:${pred.equipmentId}`;
        if (pendingKeys.has(dedupKey)) continue;
        const severity = pred.failureProbability >= 0.9 ? "critical" : "warning";
        if (!meetsMinSeverity(severity, minSeverity)) continue;
        const sug = await this.repo.suggestions.create({
          orgId,
          triggerType: "high_risk_prediction",
          title: `High failure risk: ${pred.failureMode || "Unknown"} on ${pred.equipmentId}`,
          summary: `Failure probability ${(pred.failureProbability * 100).toFixed(0)}% (${pred.riskLevel}). Predicted failure: ${pred.predictedFailureDate ? new Date(pred.predictedFailureDate).toLocaleDateString() : "Unknown"}.`,
          entityType: "equipment",
          entityId: pred.equipmentId,
          severity,
          status: "pending",
          context: { prediction: pred },
        });
        results.push(sug);
      }
    }
    return results;
  }

  private async evaluateOverdueMaintenance(orgId: string, minSeverity: string, pendingKeys: Set<string>): Promise<AgentSuggestion[]> {
    const results: AgentSuggestion[] = [];
    if (!meetsMinSeverity("warning", minSeverity)) return results;

    const overdueMaint = await db.select({
      id: maintenanceSchedules.id,
      equipmentId: maintenanceSchedules.equipmentId,
      scheduledDate: maintenanceSchedules.scheduledDate,
      maintenanceType: maintenanceSchedules.maintenanceType,
      description: maintenanceSchedules.description,
    }).from(maintenanceSchedules)
      .where(and(
        eq(maintenanceSchedules.orgId, orgId),
        eq(maintenanceSchedules.status, "scheduled"),
        lte(maintenanceSchedules.scheduledDate, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      ))
      .limit(10);

    for (const maint of overdueMaint) {
      const dedupKey = `overdue_maintenance:${maint.id}`;
      if (pendingKeys.has(dedupKey)) continue;
      const daysOverdue = Math.floor((Date.now() - new Date(maint.scheduledDate).getTime()) / (24 * 60 * 60 * 1000));
      const severity = daysOverdue > 7 ? "critical" : "warning";
      if (!meetsMinSeverity(severity, minSeverity)) continue;
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

  private async evaluateLowStock(orgId: string, minSeverity: string, pendingKeys: Set<string>): Promise<AgentSuggestion[]> {
    const results: AgentSuggestion[] = [];
    if (!meetsMinSeverity("info", minSeverity)) return results;

    try {
      const lowStockResult = await db.execute(sql`
        SELECT id, part_name, quantity_on_hand, min_stock_level
        FROM parts_inventory
        WHERE org_id = ${orgId} AND quantity_on_hand <= min_stock_level
        LIMIT 5
      `);
      const lowStockRows = (lowStockResult as { rows?: Array<Record<string, unknown>> }).rows || [];

      for (const part of lowStockRows) {
        const dedupKey = `low_stock:${part.id as string}`;
        if (pendingKeys.has(dedupKey)) continue;
        const severity = Number(part.quantity_on_hand) === 0 ? "critical" : "info";
        if (!meetsMinSeverity(severity, minSeverity)) continue;
        const sug = await this.repo.suggestions.create({
          orgId,
          triggerType: "low_stock",
          title: `Low stock: ${part.part_name}`,
          summary: `Current stock ${part.quantity_on_hand} is at or below minimum level ${part.min_stock_level}. Reorder recommended.`,
          entityType: "inventory",
          entityId: part.id as string,
          severity,
          status: "pending",
          context: { part },
        });
        results.push(sug);
      }
    } catch (err) {
      console.warn("[SuggestionEngine] Low stock query failed:", err instanceof Error ? err.message : "unknown");
    }
    return results;
  }

  private async evaluateCriticalAlerts(orgId: string, minSeverity: string, pendingKeys: Set<string>): Promise<AgentSuggestion[]> {
    const results: AgentSuggestion[] = [];
    if (!meetsMinSeverity("critical", minSeverity)) return results;

    try {
      const recentAlerts = await db.select({
        id: alertNotifications.id,
        equipmentId: alertNotifications.equipmentId,
        sensorType: alertNotifications.sensorType,
        alertType: alertNotifications.alertType,
        message: alertNotifications.message,
        value: alertNotifications.value,
        threshold: alertNotifications.threshold,
      }).from(alertNotifications)
        .where(and(
          eq(alertNotifications.orgId, orgId),
          eq(alertNotifications.acknowledged, false),
          gte(alertNotifications.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
          sql`${alertNotifications.alertType} IN ('critical', 'high', 'danger', 'emergency')`,
        ))
        .orderBy(desc(alertNotifications.createdAt))
        .limit(10);

      for (const alert of recentAlerts) {
        const dedupKey = `critical_alert:${alert.equipmentId}`;
        if (pendingKeys.has(dedupKey)) continue;
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
      console.warn("[SuggestionEngine] Critical alerts query failed:", err instanceof Error ? err.message : "unknown");
    }
    return results;
  }

  private async evaluateExpiringCertifications(orgId: string, minSeverity: string, pendingKeys: Set<string>): Promise<AgentSuggestion[]> {
    const results: AgentSuggestion[] = [];
    if (!meetsMinSeverity("warning", minSeverity)) return results;

    try {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringCerts = await db.select({
        certId: crewCertification.id,
        crewId: crewCertification.crewId,
        cert: crewCertification.cert,
        expiresAt: crewCertification.expiresAt,
        crewName: crew.name,
      }).from(crewCertification)
        .innerJoin(crew, eq(crewCertification.crewId, crew.id))
        .where(and(
          eq(crewCertification.orgId, orgId),
          lte(crewCertification.expiresAt, thirtyDaysFromNow),
          gte(crewCertification.expiresAt, new Date()),
        ))
        .limit(10);

      for (const cert of expiringCerts) {
        const dedupKey = `expiring_certification:${cert.crewId}`;
        if (pendingKeys.has(dedupKey)) continue;
        const daysUntilExpiry = Math.ceil((new Date(cert.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        const severity = daysUntilExpiry <= 7 ? "critical" : "warning";
        if (!meetsMinSeverity(severity, minSeverity)) continue;
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
      console.warn("[SuggestionEngine] Certification expiry query failed:", err instanceof Error ? err.message : "unknown");
    }
    return results;
  }

  private async aiSummarizeSuggestions(suggestions: AgentSuggestion[]): Promise<void> {
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI();

      const triggerSummaries = suggestions.map((s, i) =>
        `${i + 1}. [${s.severity?.toUpperCase()}] ${s.triggerType}: ${s.title} — ${s.summary}`
      ).join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: "You are a marine operations assistant. Given a list of triggered alerts/suggestions, produce:\n1. A brief executive summary (2-3 sentences) of the overall situation.\n2. For each item, a one-sentence actionable recommendation.\nFormat: First the executive summary, then numbered items matching the input order.\nBe concise and actionable. Use marine operations terminology.",
          },
          {
            role: "user",
            content: `The following ${suggestions.length} conditions were detected:\n${triggerSummaries}\n\nProvide the executive summary and per-item recommendations.`,
          },
        ],
      });

      const aiContent = response.choices[0]?.message?.content;
      if (aiContent && suggestions.length > 0) {
        const lines = aiContent.split("\n").filter(l => l.trim());
        for (let i = 0; i < suggestions.length; i++) {
          const recLine = lines.find(l => l.trim().startsWith(`${i + 1}.`));
          if (recLine) {
            await this.repo.suggestions.update(suggestions[i].id, {
              summary: `${suggestions[i].summary} AI recommendation: ${recLine.replace(/^\d+\.\s*/, "")}`,
            } as Partial<AgentSuggestion>);
          }
        }

        await this.repo.suggestions.create({
          orgId: suggestions[0].orgId,
          triggerType: "ai_summary",
          title: `AI Summary: ${suggestions.length} new conditions detected`,
          summary: aiContent,
          severity: suggestions.some(s => s.severity === "critical") ? "critical" : "warning",
          status: "pending",
          context: { suggestionIds: suggestions.map(s => s.id), count: suggestions.length },
        });
      }
    } catch (err) {
      console.warn("[SuggestionEngine] AI summarization failed (non-blocking):", err instanceof Error ? err.message : "unknown");
    }
  }

  private async queueNotifications(orgId: string, suggestions: AgentSuggestion[]): Promise<void> {
    try {
      for (const sug of suggestions) {
        if (sug.triggerType === "ai_summary") continue;
        await db.insert(notificationQueue).values({
          orgId,
          notificationType: "ai_suggestion",
          subject: sug.title,
          body: sug.summary,
          recipients: [],
          relatedEntityType: sug.entityType || sug.triggerType,
          relatedEntityId: sug.entityId || sug.id,
          status: "pending",
        });
      }
    } catch (err) {
      console.warn("[SuggestionEngine] Notification queue integration failed (non-blocking):", err instanceof Error ? err.message : "unknown");
    }
  }
}
