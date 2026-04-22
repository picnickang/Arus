import type { AgentBriefing } from "@shared/schema";
import type {
  BriefingRepositoryPort,
  BriefingSection,
  BriefingSectionItem,
  BriefingDataPort,
} from "../domain/briefing-types";
import type { AgentRepositoryPort } from "../domain/ports";
import { logger } from "../../../utils/logger";

const LOG_CTX = "BriefingGeneratorService";

export class BriefingGeneratorService {
  constructor(
    private briefingRepo: BriefingRepositoryPort,
    private agentRepo: AgentRepositoryPort,
    private dataPort: BriefingDataPort
  ) {}

  async generate(orgId: string, scheduleRunId?: string): Promise<AgentBriefing> {
    const now = new Date();
    const periodEnd = new Date(now);
    const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const briefing = await this.briefingRepo.create({
      orgId,
      generatedAt: now,
      periodStart,
      periodEnd,
      sections: [],
      status: "generating",
      scheduleRunId: scheduleRunId || null,
    });

    try {
      const sections = await this.collectSections(orgId, periodStart, periodEnd);
      const aiSummary = await this.generateAISummary(sections);

      const updated = await this.briefingRepo.update(briefing.id, {
        sections,
        aiSummary,
        status: "ready",
      });

      logger.info(LOG_CTX, `Briefing ${briefing.id} generated for org ${orgId}`);
      return updated;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "unknown";
      logger.error(LOG_CTX, `Briefing generation failed: ${errMsg}`);
      await this.briefingRepo.update(briefing.id, {
        status: "failed",
        aiSummary: `Generation failed: ${errMsg}`,
      });
      throw error;
    }
  }

  async getLatestForToday(orgId: string): Promise<AgentBriefing | null> {
    return this.briefingRepo.getLatestForToday(orgId);
  }

  async list(orgId: string, limit?: number): Promise<AgentBriefing[]> {
    return this.briefingRepo.list(orgId, limit);
  }

  async getByDate(orgId: string, date: Date): Promise<AgentBriefing[]> {
    return this.briefingRepo.listByDate(orgId, date);
  }

  private async collectSections(
    orgId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<BriefingSection[]> {
    const [
      overnightAlerts,
      pendingApprovals,
      maintenanceDue,
      expiringCerts,
      lowStock,
      equipmentHealth,
    ] = await Promise.all([
      this.collectOvernightAlerts(orgId, periodStart, periodEnd),
      this.collectPendingApprovals(orgId),
      this.collectMaintenanceDue(orgId),
      this.collectExpiringCertifications(orgId),
      this.collectLowStock(orgId),
      this.collectEquipmentHealth(orgId, periodStart),
    ]);

    return [
      overnightAlerts,
      pendingApprovals,
      maintenanceDue,
      expiringCerts,
      lowStock,
      equipmentHealth,
    ];
  }

  private async collectOvernightAlerts(
    orgId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<BriefingSection> {
    const items: BriefingSectionItem[] = [];
    try {
      const alerts = await this.dataPort.getOvernightAlerts(orgId, periodStart, periodEnd);
      for (const alert of alerts) {
        items.push({
          id: String(alert.id),
          title: `${alert.alertType} alert on ${alert.equipmentId}`,
          description:
            alert.message ||
            `Sensor ${alert.sensorType}: ${alert.value} (threshold: ${alert.threshold})`,
          severity:
            alert.alertType === "critical" || alert.alertType === "danger" ? "critical" : "warning",
          entityType: "equipment",
          entityId: alert.equipmentId,
          linkTo: `/fleet?equipment=${alert.equipmentId}`,
        });
      }
    } catch (err) {
      logger.warn(
        LOG_CTX,
        `Failed to collect overnight alerts: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
    return {
      key: "overnight_alerts",
      title: "Overnight Alerts",
      icon: "AlertTriangle",
      items,
      emptyMessage: "No alerts during the overnight period.",
    };
  }

  private async collectPendingApprovals(orgId: string): Promise<BriefingSection> {
    const items: BriefingSectionItem[] = [];
    try {
      const pendingDrafts = await this.agentRepo.drafts.list(orgId, "pending");
      for (const draft of pendingDrafts.slice(0, 10)) {
        items.push({
          id: draft.id,
          title: draft.title,
          description: `${draft.draftType} draft awaiting review`,
          severity: "warning",
          entityType: "agent_draft",
          entityId: draft.id,
          linkTo: `/findings?source=draft&status=pending&id=${draft.id}`,
        });
      }

      const pendingSuggestions = await this.agentRepo.suggestions.list(orgId, "pending", 10);
      for (const sug of pendingSuggestions) {
        items.push({
          id: sug.id,
          title: sug.title,
          description: sug.summary.slice(0, 150),
          severity: (sug.severity as "info" | "warning" | "critical") || "info",
          entityType: sug.entityType || "suggestion",
          entityId: sug.entityId || sug.id,
          linkTo: `/findings?source=suggestion&status=pending&id=${sug.id}`,
        });
      }
    } catch (err) {
      logger.warn(
        LOG_CTX,
        `Failed to collect pending approvals: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
    return {
      key: "pending_approvals",
      title: "Pending Approvals",
      icon: "CheckCircle",
      items,
      emptyMessage: "No pending approvals at this time.",
    };
  }

  private async collectMaintenanceDue(orgId: string): Promise<BriefingSection> {
    const items: BriefingSectionItem[] = [];
    try {
      const records = await this.dataPort.getMaintenanceDueToday(orgId);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      for (const maint of records) {
        const isOverdue = new Date(maint.scheduledDate) < todayStart;
        items.push({
          id: maint.id,
          title: `${maint.maintenanceType} — ${maint.equipmentId}`,
          description:
            maint.description ||
            `Scheduled for ${new Date(maint.scheduledDate).toLocaleDateString()}`,
          severity: isOverdue ? "critical" : "warning",
          entityType: "maintenance_schedule",
          entityId: maint.id,
          linkTo: `/maintenance?highlight=${maint.id}`,
          metadata: { isOverdue },
        });
      }
    } catch (err) {
      logger.warn(
        LOG_CTX,
        `Failed to collect maintenance due: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
    return {
      key: "maintenance_due",
      title: "Maintenance Due Today",
      icon: "Wrench",
      items,
      emptyMessage: "No maintenance tasks due today.",
    };
  }

  private async collectExpiringCertifications(orgId: string): Promise<BriefingSection> {
    const items: BriefingSectionItem[] = [];
    try {
      const certs = await this.dataPort.getExpiringCertifications(orgId, 30);
      for (const cert of certs) {
        const daysUntil = Math.ceil(
          (new Date(cert.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );
        items.push({
          id: String(cert.certId),
          title: `${cert.cert} — ${cert.crewName}`,
          description: `Expires in ${daysUntil} days (${new Date(cert.expiresAt).toLocaleDateString()})`,
          severity: daysUntil <= 7 ? "critical" : "warning",
          entityType: "crew",
          entityId: cert.crewId,
          linkTo: `/crew-management?highlight=${cert.crewId}`,
          metadata: { daysUntilExpiry: daysUntil },
        });
      }
    } catch (err) {
      logger.warn(
        LOG_CTX,
        `Failed to collect expiring certs: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
    return {
      key: "expiring_certifications",
      title: "Expiring Certifications",
      icon: "Shield",
      items,
      emptyMessage: "No certifications expiring within 30 days.",
    };
  }

  private async collectLowStock(orgId: string): Promise<BriefingSection> {
    const items: BriefingSectionItem[] = [];
    try {
      const parts = await this.dataPort.getLowStockParts(orgId, 10);
      for (const part of parts) {
        items.push({
          id: part.id,
          title: part.partName,
          description: `Stock: ${part.quantityOnHand} / Min: ${part.minStockLevel}`,
          severity: part.quantityOnHand === 0 ? "critical" : "warning",
          entityType: "inventory",
          entityId: part.id,
          linkTo: `/inventory-management?part=${part.id}`,
        });
      }
    } catch (err) {
      logger.warn(
        LOG_CTX,
        `Failed to collect low stock: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
    return {
      key: "low_stock",
      title: "Low Stock Items",
      icon: "Package",
      items,
      emptyMessage: "All parts are above minimum stock levels.",
    };
  }

  private async collectEquipmentHealth(orgId: string, since: Date): Promise<BriefingSection> {
    const items: BriefingSectionItem[] = [];
    try {
      const recentSuggestions = await this.agentRepo.suggestions.list(orgId, undefined, 50);
      const healthRelated = recentSuggestions
        .filter(
          (s) =>
            s.createdAt &&
            new Date(s.createdAt) >= since &&
            (s.triggerType === "high_risk_prediction" || s.triggerType === "critical_alert")
        )
        .slice(0, 10);

      for (const sug of healthRelated) {
        items.push({
          id: sug.id,
          title: sug.title,
          description: sug.summary.slice(0, 150),
          severity: (sug.severity as "info" | "warning" | "critical") || "warning",
          entityType: sug.entityType || "equipment",
          entityId: sug.entityId || sug.id,
          linkTo:
            sug.entityType === "equipment" && sug.entityId
              ? `/fleet?equipment=${sug.entityId}`
              : `/findings?id=${sug.id}`,
        });
      }
    } catch (err) {
      logger.warn(
        LOG_CTX,
        `Failed to collect equipment health: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
    return {
      key: "equipment_health",
      title: "Equipment Health Changes",
      icon: "Activity",
      items,
      emptyMessage: "No significant equipment health changes in the last 24 hours.",
    };
  }

  private async generateAISummary(sections: BriefingSection[]): Promise<string> {
    const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
    if (totalItems === 0) {
      return "All clear — no significant events or items requiring attention in the past 24 hours. All systems operating within normal parameters.";
    }

    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI();

      const sectionSummaries = sections
        .map((s) => {
          if (s.items.length === 0) {
            return `${s.title}: None`;
          }
          const itemLines = s.items
            .slice(0, 5)
            .map((i) => `  - [${i.severity?.toUpperCase() || "INFO"}] ${i.title}: ${i.description}`)
            .join("\n");
          return `${s.title} (${s.items.length} items):\n${itemLines}`;
        })
        .join("\n\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You are the ARUS marine operations briefing system. Write a concise executive summary paragraph (3-5 sentences) for the shift handover. Highlight critical items first, then notable warnings, and close with overall status. Use professional marine operations language. Do not use bullet points or headers — write a single flowing paragraph.",
          },
          {
            role: "user",
            content: `Daily briefing data:\n\n${sectionSummaries}\n\nWrite the executive summary paragraph.`,
          },
        ],
      });

      return response.choices[0]?.message?.content || this.buildFallbackSummary(sections);
    } catch (err) {
      logger.warn(
        LOG_CTX,
        `AI summary generation failed, using fallback: ${err instanceof Error ? err.message : "unknown"}`
      );
      return this.buildFallbackSummary(sections);
    }
  }

  private buildFallbackSummary(sections: BriefingSection[]): string {
    const counts = sections
      .map((s) => `${s.items.length} ${s.title.toLowerCase()}`)
      .filter((s) => !s.startsWith("0"));
    if (counts.length === 0) {
      return "All clear — no items requiring attention.";
    }
    const criticalCount = sections.reduce(
      (sum, s) => sum + s.items.filter((i) => i.severity === "critical").length,
      0
    );
    const prefix =
      criticalCount > 0 ? `${criticalCount} critical item(s) require immediate attention. ` : "";
    return `${prefix}Today's briefing includes: ${counts.join(", ")}.`;
  }
}
