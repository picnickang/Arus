/**
 * Operating Conditions - Database Storage
 *
 * FIXES APPLIED:
 * - Import path corrected: ../../db → ../../db-config
 * - Import path corrected: @shared/schema → @shared/schema-runtime
 * - recordAndPublish signature updated at every call site
 * - "operating_parameter" and "operating_condition_alert" need to be added
 *   to EntityType union in sync-events.ts (see wave2 EntityType patch below)
 * - Reformatted from single-line-per-method style
 *
 * DEPENDS ON:
 * - shared/schema-runtime.ts cast fix (wave 1)
 * - shared/schema/wave2-parity.patch.ts — adds the threshold columns
 *   (criticalMin/Max, optimalMin/Max), boolean flags (acknowledged, resolved),
 *   and context fields (lifeImpactDescription, recommendedAction, parameterType)
 * - shared/sync-events.ts — add these EntityType members:
 *     | "operating_parameter"
 *     | "operating_condition_alert"
 */

import { eq, and, desc, gte, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db-config";
import {
  operatingParameters,
  operatingConditionAlerts,
  equipment,
  equipmentTelemetry as equipmentTelemetryTable,
  type InsertOperatingParameter,
  type OperatingParameter,
  type InsertOperatingConditionAlert,
  type OperatingConditionAlert,
} from "@shared/schema-runtime";
import { recordAndPublish, publishEvent, type EntityType, type EventType } from "../../sync-events";
import type { OperatingViolation, CheckConditionsResult } from "./types.js";

export class DbOperatingConditionsStorage {
  // ──────────────────────────────────────────────────────────────────────
  // Operating Parameters
  // ──────────────────────────────────────────────────────────────────────

  async getOperatingParameters(
    orgId?: string,
    equipmentType?: string,
    manufacturer?: string
  ): Promise<OperatingParameter[]> {
    const c = [];
    if (orgId) c.push(eq(operatingParameters.orgId, orgId));
    if (equipmentType) c.push(eq(operatingParameters.equipmentType, equipmentType));
    if (manufacturer) c.push(eq(operatingParameters.manufacturer, manufacturer));
    let q = db.select().from(operatingParameters);
    if (c.length > 0) q = q.where(and(...c)) as typeof q;
    return q.orderBy(operatingParameters.equipmentType, operatingParameters.parameterName);
  }

  async getOperatingParameter(
    id: string,
    orgId?: string
  ): Promise<OperatingParameter | undefined> {
    const c = [eq(operatingParameters.id, id)];
    if (orgId) c.push(eq(operatingParameters.orgId, orgId));
    const r = await db.select().from(operatingParameters).where(and(...c));
    return r[0];
  }

  async createOperatingParameter(
    parameter: InsertOperatingParameter
  ): Promise<OperatingParameter> {
    const [n] = await db.insert(operatingParameters).values(parameter).returning();
    await recordAndPublish("operating_parameter" as EntityType, n.id, "create", n);
    return n;
  }

  async updateOperatingParameter(
    id: string,
    parameter: Partial<InsertOperatingParameter>,
    orgId?: string
  ): Promise<OperatingParameter> {
    const c = [eq(operatingParameters.id, id)];
    if (orgId) c.push(eq(operatingParameters.orgId, orgId));
    const [u] = await db
      .update(operatingParameters)
      .set({ ...parameter, updatedAt: new Date() })
      .where(and(...c))
      .returning();
    if (!u) throw new Error(`Operating parameter ${id} not found`);
    await recordAndPublish("operating_parameter" as EntityType, u.id, "update", u);
    return u;
  }

  async deleteOperatingParameter(id: string, orgId?: string): Promise<void> {
    const c = [eq(operatingParameters.id, id)];
    if (orgId) c.push(eq(operatingParameters.orgId, orgId));
    const r = await db.delete(operatingParameters).where(and(...c)).returning();
    if (r.length === 0) throw new Error(`Operating parameter ${id} not found`);
    await recordAndPublish("operating_parameter" as EntityType, id, "delete", r[0]);
  }

  async bulkCreateOperatingParameters(
    parameters: InsertOperatingParameter[]
  ): Promise<OperatingParameter[]> {
    if (parameters.length === 0) return [];
    return db.transaction(async (tx) => {
      const created = await tx.insert(operatingParameters).values(parameters).returning();
      for (const param of created) {
        await publishEvent("operating_parameter.created" as EventType, { id: param.id, data: param });
      }
      return created;
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Operating Condition Alerts
  // ──────────────────────────────────────────────────────────────────────

  async getOperatingConditionAlerts(
    orgId?: string,
    equipmentId?: string,
    acknowledged?: boolean
  ): Promise<OperatingConditionAlert[]> {
    const c = [];
    if (orgId) c.push(eq(operatingConditionAlerts.orgId, orgId));
    if (equipmentId) c.push(eq(operatingConditionAlerts.equipmentId, equipmentId));
    if (acknowledged !== undefined) {
      if (acknowledged) c.push(isNotNull(operatingConditionAlerts.acknowledgedAt));
      else c.push(isNull(operatingConditionAlerts.acknowledgedAt));
    }
    let q = db.select().from(operatingConditionAlerts);
    if (c.length > 0) q = q.where(and(...c)) as typeof q;
    return q.orderBy(desc(operatingConditionAlerts.alertedAt));
  }

  async getOperatingConditionAlert(
    id: string,
    orgId?: string
  ): Promise<OperatingConditionAlert | undefined> {
    const c = [eq(operatingConditionAlerts.id, id)];
    if (orgId) c.push(eq(operatingConditionAlerts.orgId, orgId));
    const r = await db.select().from(operatingConditionAlerts).where(and(...c));
    return r[0];
  }

  async createOperatingConditionAlert(
    alert: InsertOperatingConditionAlert
  ): Promise<OperatingConditionAlert> {
    // Dedupe: if a similar unresolved alert exists in the last 10 min, reuse it.
    if (alert.equipmentId && alert.parameterId) {
      const recent = await db
        .select()
        .from(operatingConditionAlerts)
        .where(
          and(
            eq(operatingConditionAlerts.equipmentId, alert.equipmentId),
            eq(operatingConditionAlerts.parameterId, alert.parameterId),
            eq(operatingConditionAlerts.resolved, false),
            gte(
              operatingConditionAlerts.createdAt,
              new Date(Date.now() - 10 * 60 * 1000)
            )
          )
        )
        .limit(1);
      if (recent.length > 0) return recent[0];
    }
    const [n] = await db.insert(operatingConditionAlerts).values(alert).returning();
    await recordAndPublish("operating_condition_alert" as EntityType, n.id, "create", n);
    return n;
  }

  async updateOperatingConditionAlert(
    id: string,
    alert: Partial<InsertOperatingConditionAlert>,
    orgId?: string
  ): Promise<OperatingConditionAlert> {
    const c = [eq(operatingConditionAlerts.id, id)];
    if (orgId) c.push(eq(operatingConditionAlerts.orgId, orgId));
    const [u] = await db
      .update(operatingConditionAlerts)
      .set(alert)
      .where(and(...c))
      .returning();
    if (!u) throw new Error(`Operating condition alert ${id} not found`);
    await recordAndPublish("operating_condition_alert" as EntityType, u.id, "update", u);
    return u;
  }

  async acknowledgeOperatingConditionAlert(
    id: string,
    acknowledgedBy: string,
    notes?: string,
    orgId?: string
  ): Promise<OperatingConditionAlert> {
    const c = [eq(operatingConditionAlerts.id, id)];
    if (orgId) c.push(eq(operatingConditionAlerts.orgId, orgId));
    const [ack] = await db
      .update(operatingConditionAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(),
        notes: notes ?? null,
      })
      .where(and(...c))
      .returning();
    if (!ack) throw new Error(`Operating condition alert ${id} not found`);
    await recordAndPublish("operating_condition_alert" as EntityType, ack.id, "update", ack);
    return ack;
  }

  async resolveOperatingConditionAlert(
    id: string,
    notes?: string,
    orgId?: string
  ): Promise<OperatingConditionAlert> {
    const c = [eq(operatingConditionAlerts.id, id)];
    if (orgId) c.push(eq(operatingConditionAlerts.orgId, orgId));
    const [resolved] = await db
      .update(operatingConditionAlerts)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        notes: notes ?? null,
      })
      .where(and(...c))
      .returning();
    if (!resolved) throw new Error(`Operating condition alert ${id} not found`);
    await recordAndPublish("operating_condition_alert" as EntityType, resolved.id, "update", resolved);
    return resolved;
  }

  async getActiveOperatingAlerts(
    equipmentId: string,
    orgId?: string
  ): Promise<OperatingConditionAlert[]> {
    const c = [
      eq(operatingConditionAlerts.equipmentId, equipmentId),
      eq(operatingConditionAlerts.resolved, false),
    ];
    if (orgId) c.push(eq(operatingConditionAlerts.orgId, orgId));
    return db
      .select()
      .from(operatingConditionAlerts)
      .where(and(...c))
      .orderBy(desc(operatingConditionAlerts.severity), desc(operatingConditionAlerts.createdAt));
  }

  // ──────────────────────────────────────────────────────────────────────
  // Condition checking logic
  // ──────────────────────────────────────────────────────────────────────

  private async fetchEquipment(equipmentId: string, orgId?: string) {
    const conditions = [eq(equipment.id, equipmentId)];
    if (orgId) conditions.push(eq(equipment.orgId, orgId));
    const result = await db.select().from(equipment).where(and(...conditions)).limit(1);
    if (result.length === 0) throw new Error(`Equipment ${equipmentId} not found`);
    return result[0];
  }

  private async fetchLatestTelemetry(
    equipmentId: string
  ): Promise<{ sensorType: string; value: number }[]> {
    const latestReadings = await db
      .select({
        sensorType: equipmentTelemetryTable.sensorType,
        value: equipmentTelemetryTable.value,
      })
      .from(equipmentTelemetryTable)
      .where(eq(equipmentTelemetryTable.equipmentId, equipmentId))
      .orderBy(desc(equipmentTelemetryTable.ts))
      .limit(50);
    const telemetryMap = new Map<string, number>();
    for (const reading of latestReadings) {
      if (!telemetryMap.has(reading.sensorType)) {
        telemetryMap.set(reading.sensorType, reading.value);
      }
    }
    return Array.from(telemetryMap.entries()).map(([sensorType, value]) => ({ sensorType, value }));
  }

  private async fetchParameters(
    orgId?: string,
    equipmentType?: string | null,
    manufacturer?: string | null
  ) {
    const conditions = [];
    if (orgId) conditions.push(eq(operatingParameters.orgId, orgId));
    if (equipmentType) conditions.push(eq(operatingParameters.equipmentType, equipmentType));
    if (manufacturer) conditions.push(eq(operatingParameters.manufacturer, manufacturer));
    return db.select().from(operatingParameters).where(and(...conditions));
  }

  private detectViolation(
    param: OperatingParameter,
    value: number
  ): OperatingViolation | null {
    const base = {
      parameterId: param.id,
      parameterName: param.parameterName,
      currentValue: value,
      lifeImpact: param.lifeImpactDescription || undefined,
      recommendedAction: param.recommendedAction || undefined,
    };
    if (param.criticalMin !== null && value < (param.criticalMin ?? -Infinity)) {
      return { ...base, thresholdType: "below_critical", severity: "critical" };
    }
    if (param.criticalMax !== null && value > (param.criticalMax ?? Infinity)) {
      return { ...base, thresholdType: "above_critical", severity: "critical" };
    }
    if (param.optimalMin !== null && value < (param.optimalMin ?? -Infinity)) {
      return { ...base, thresholdType: "below_optimal", severity: "warning" };
    }
    if (param.optimalMax !== null && value > (param.optimalMax ?? Infinity)) {
      return { ...base, thresholdType: "above_optimal", severity: "warning" };
    }
    return null;
  }

  private getAlertThresholds(
    violation: OperatingViolation,
    param: OperatingParameter
  ): { optimalMin?: number; optimalMax?: number } {
    if (violation.thresholdType === "below_critical") {
      return { optimalMin: param.criticalMin ?? undefined };
    }
    if (violation.thresholdType === "above_critical") {
      return { optimalMax: param.criticalMax ?? undefined };
    }
    return {
      optimalMin: param.optimalMin ?? undefined,
      optimalMax: param.optimalMax ?? undefined,
    };
  }

  async checkOperatingConditions(
    equipmentId: string,
    telemetry?: { sensorType: string; value: number }[],
    orgId?: string
  ): Promise<CheckConditionsResult> {
    const equipmentData = await this.fetchEquipment(equipmentId, orgId);
    const telemetryData = telemetry?.length
      ? telemetry
      : await this.fetchLatestTelemetry(equipmentId);
    const parameters = await this.fetchParameters(
      orgId,
      (equipmentData as any).type,
      (equipmentData as any).manufacturer
    );

    const violations: OperatingViolation[] = [];
    let alertsCreated = 0;

    for (const reading of telemetryData) {
      const matchingParams = parameters.filter(
        (p: OperatingParameter) => p.parameterType === reading.sensorType
      );
      for (const param of matchingParams) {
        const violation = this.detectViolation(param, reading.value);
        if (!violation) continue;

        violations.push(violation);
        const thresholds = this.getAlertThresholds(violation, param);
        try {
          await this.createOperatingConditionAlert({
            orgId: orgId || equipmentData.orgId,
            equipmentId,
            parameterId: param.id,
            parameterName: param.parameterName,
            currentValue: reading.value,
            optimalMin: thresholds.optimalMin,
            optimalMax: thresholds.optimalMax,
            thresholdType: violation.thresholdType,
            severity: violation.severity,
            lifeImpact: param.lifeImpactDescription ?? undefined,
            recommendedAction: param.recommendedAction ?? undefined,
            message: `${param.parameterName} is ${violation.thresholdType.replace(
              "_",
              " "
            )}: ${reading.value} ${param.unit || ""}`,
            acknowledged: false,
            resolved: false,
            alertType: "operating_condition",
          } as InsertOperatingConditionAlert);
          alertsCreated++;
        } catch {
          /* Alert might already exist */
        }
      }
    }
    return { violations, alertsCreated };
  }
}
