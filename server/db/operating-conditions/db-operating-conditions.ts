/**
 * Operating Conditions - Database Storage
 */

import { eq, and, desc, gte, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { operatingParameters, operatingConditionAlerts, equipment, equipmentTelemetry as equipmentTelemetryTable, type InsertOperatingParameter, type OperatingParameter, type InsertOperatingConditionAlert, type OperatingConditionAlert } from "@shared/schema";
import { recordAndPublish, publishEvent } from "../../sync-events";
import type { OperatingViolation, CheckConditionsResult } from "./types.js";

export class DbOperatingConditionsStorage {
  async getOperatingParameters(orgId?: string, equipmentType?: string, manufacturer?: string): Promise<OperatingParameter[]> { const c = []; if (orgId) {c.push(eq(operatingParameters.orgId, orgId));} if (equipmentType) {c.push(eq(operatingParameters.equipmentType, equipmentType));} if (manufacturer) {c.push(eq(operatingParameters.manufacturer, manufacturer));} let q = db.select().from(operatingParameters); if (c.length > 0) {q = q.where(and(...c));} return q.orderBy(operatingParameters.equipmentType, operatingParameters.parameterName); }
  async getOperatingParameter(id: string, orgId?: string): Promise<OperatingParameter | undefined> { const c = [eq(operatingParameters.id, id)]; if (orgId) {c.push(eq(operatingParameters.orgId, orgId));} const r = await db.select().from(operatingParameters).where(and(...c)); return r[0]; }
  async createOperatingParameter(parameter: InsertOperatingParameter): Promise<OperatingParameter> { const [n] = await recordAndPublish(db.insert(operatingParameters).values(parameter).returning(), "operating_parameter", "create"); return n; }
  async updateOperatingParameter(id: string, parameter: Partial<InsertOperatingParameter>, orgId?: string): Promise<OperatingParameter> { const c = [eq(operatingParameters.id, id)]; if (orgId) {c.push(eq(operatingParameters.orgId, orgId));} const [u] = await recordAndPublish(db.update(operatingParameters).set({ ...parameter, updatedAt: new Date() }).where(and(...c)).returning(), "operating_parameter", "update"); if (!u) {throw new Error(`Operating parameter ${id} not found`);} return u; }
  async deleteOperatingParameter(id: string, orgId?: string): Promise<void> { const c = [eq(operatingParameters.id, id)]; if (orgId) {c.push(eq(operatingParameters.orgId, orgId));} const r = await recordAndPublish(db.delete(operatingParameters).where(and(...c)).returning(), "operating_parameter", "delete"); if (r.length === 0) {throw new Error(`Operating parameter ${id} not found`);} }
  async bulkCreateOperatingParameters(parameters: InsertOperatingParameter[]): Promise<OperatingParameter[]> { if (parameters.length === 0) {return [];} return db.transaction(async (tx) => { const created = await tx.insert(operatingParameters).values(parameters).returning(); for (const param of created) {await publishEvent("operating_parameter", "create", param);} return created; }); }

  async getOperatingConditionAlerts(orgId?: string, equipmentId?: string, acknowledged?: boolean): Promise<OperatingConditionAlert[]> { const c = []; if (orgId) {c.push(eq(operatingConditionAlerts.orgId, orgId));} if (equipmentId) {c.push(eq(operatingConditionAlerts.equipmentId, equipmentId));} if (acknowledged !== undefined) { if (acknowledged) {c.push(isNotNull(operatingConditionAlerts.acknowledgedAt));} else {c.push(isNull(operatingConditionAlerts.acknowledgedAt));} } let q = db.select().from(operatingConditionAlerts); if (c.length > 0) {q = q.where(and(...c));} return q.orderBy(sql`${operatingConditionAlerts.alertedAt} DESC`); }
  async getOperatingConditionAlert(id: string, orgId?: string): Promise<OperatingConditionAlert | undefined> { const c = [eq(operatingConditionAlerts.id, id)]; if (orgId) {c.push(eq(operatingConditionAlerts.orgId, orgId));} const r = await db.select().from(operatingConditionAlerts).where(and(...c)); return r[0]; }
  async createOperatingConditionAlert(alert: InsertOperatingConditionAlert): Promise<OperatingConditionAlert> { if (alert.equipmentId && alert.parameterId) { const recent = await db.select().from(operatingConditionAlerts).where(and(eq(operatingConditionAlerts.equipmentId, alert.equipmentId), eq(operatingConditionAlerts.parameterId, alert.parameterId), eq(operatingConditionAlerts.resolved, false), gte(operatingConditionAlerts.createdAt, new Date(Date.now() - 10 * 60 * 1000)))).limit(1); if (recent.length > 0) {return recent[0];} } const [n] = await recordAndPublish(db.insert(operatingConditionAlerts).values(alert).returning(), "operating_condition_alert", "create"); return n; }
  async updateOperatingConditionAlert(id: string, alert: Partial<InsertOperatingConditionAlert>, orgId?: string): Promise<OperatingConditionAlert> { const c = [eq(operatingConditionAlerts.id, id)]; if (orgId) {c.push(eq(operatingConditionAlerts.orgId, orgId));} const [u] = await recordAndPublish(db.update(operatingConditionAlerts).set(alert).where(and(...c)).returning(), "operating_condition_alert", "update"); if (!u) {throw new Error(`Operating condition alert ${id} not found`);} return u; }
  async acknowledgeOperatingConditionAlert(id: string, acknowledgedBy: string, notes?: string, orgId?: string): Promise<OperatingConditionAlert> { const c = [eq(operatingConditionAlerts.id, id)]; if (orgId) {c.push(eq(operatingConditionAlerts.orgId, orgId));} const [ack] = await recordAndPublish(db.update(operatingConditionAlerts).set({ acknowledged: true, acknowledgedBy, acknowledgedAt: new Date(), notes: notes ?? null }).where(and(...c)).returning(), "operating_condition_alert", "update"); if (!ack) {throw new Error(`Operating condition alert ${id} not found`);} return ack; }
  async resolveOperatingConditionAlert(id: string, notes?: string, orgId?: string): Promise<OperatingConditionAlert> { const c = [eq(operatingConditionAlerts.id, id)]; if (orgId) {c.push(eq(operatingConditionAlerts.orgId, orgId));} const [resolved] = await recordAndPublish(db.update(operatingConditionAlerts).set({ resolved: true, resolvedAt: new Date(), notes: notes ?? null }).where(and(...c)).returning(), "operating_condition_alert", "update"); if (!resolved) {throw new Error(`Operating condition alert ${id} not found`);} return resolved; }
  async getActiveOperatingAlerts(equipmentId: string, orgId?: string): Promise<OperatingConditionAlert[]> { const c = [eq(operatingConditionAlerts.equipmentId, equipmentId), eq(operatingConditionAlerts.resolved, false)]; if (orgId) {c.push(eq(operatingConditionAlerts.orgId, orgId));} return db.select().from(operatingConditionAlerts).where(and(...c)).orderBy(sql`${operatingConditionAlerts.severity} DESC`, sql`${operatingConditionAlerts.createdAt} DESC`); }

  private async fetchEquipment(equipmentId: string, orgId?: string) {
    const conditions = [eq(equipment.id, equipmentId)];
    if (orgId) {conditions.push(eq(equipment.orgId, orgId));}
    const result = await db.select().from(equipment).where(and(...conditions)).limit(1);
    if (result.length === 0) {throw new Error(`Equipment ${equipmentId} not found`);}
    return result[0];
  }

  private async fetchLatestTelemetry(equipmentId: string): Promise<{ sensorType: string; value: number }[]> {
    const latestReadings = await db.select({ sensorType: equipmentTelemetryTable.sensorType, value: equipmentTelemetryTable.value }).from(equipmentTelemetryTable).where(eq(equipmentTelemetryTable.equipmentId, equipmentId)).orderBy(sql`${equipmentTelemetryTable.ts} DESC`).limit(50);
    const telemetryMap = new Map<string, number>();
    for (const reading of latestReadings) {
      if (!telemetryMap.has(reading.sensorType)) {telemetryMap.set(reading.sensorType, reading.value);}
    }
    return Array.from(telemetryMap.entries()).map(([sensorType, value]) => ({ sensorType, value }));
  }

  private async fetchParameters(orgId?: string, equipmentType?: string | null, manufacturer?: string | null) {
    const conditions = [];
    if (orgId) {conditions.push(eq(operatingParameters.orgId, orgId));}
    if (equipmentType) {conditions.push(eq(operatingParameters.equipmentType, equipmentType));}
    if (manufacturer) {conditions.push(eq(operatingParameters.manufacturer, manufacturer));}
    return db.select().from(operatingParameters).where(and(...conditions));
  }

  private detectViolation(param: OperatingParameter, value: number): OperatingViolation | null {
    const base = { parameterId: param.id, parameterName: param.parameterName, currentValue: value, lifeImpact: param.lifeImpactDescription || undefined, recommendedAction: param.recommendedAction || undefined };
    if (param.criticalMin !== null && value < param.criticalMin) {return { ...base, thresholdType: "below_critical", severity: "critical" };}
    if (param.criticalMax !== null && value > param.criticalMax) {return { ...base, thresholdType: "above_critical", severity: "critical" };}
    if (param.optimalMin !== null && value < param.optimalMin) {return { ...base, thresholdType: "below_optimal", severity: "warning" };}
    if (param.optimalMax !== null && value > param.optimalMax) {return { ...base, thresholdType: "above_optimal", severity: "warning" };}
    return null;
  }

  private getAlertThresholds(violation: OperatingViolation, param: OperatingParameter): { optimalMin?: number; optimalMax?: number } {
    if (violation.thresholdType === "below_critical") {return { optimalMin: param.criticalMin ?? undefined };}
    if (violation.thresholdType === "above_critical") {return { optimalMax: param.criticalMax ?? undefined };}
    return { optimalMin: param.optimalMin ?? undefined, optimalMax: param.optimalMax ?? undefined };
  }

  async checkOperatingConditions(equipmentId: string, telemetry?: { sensorType: string; value: number }[], orgId?: string): Promise<CheckConditionsResult> {
    const equipmentData = await this.fetchEquipment(equipmentId, orgId);
    const telemetryData = telemetry?.length ? telemetry : await this.fetchLatestTelemetry(equipmentId);
    const parameters = await this.fetchParameters(orgId, equipmentData.type, equipmentData.manufacturer);

    const violations: OperatingViolation[] = [];
    let alertsCreated = 0;

    for (const reading of telemetryData) {
      const matchingParams = parameters.filter((p) => p.parameterType === reading.sensorType);
      for (const param of matchingParams) {
        const violation = this.detectViolation(param, reading.value);
        if (!violation) {continue;}

        violations.push(violation);
        const thresholds = this.getAlertThresholds(violation, param);
        try {
          await this.createOperatingConditionAlert({
            orgId: orgId || equipmentData.orgId, equipmentId, parameterId: param.id, parameterName: param.parameterName,
            currentValue: reading.value, optimalMin: thresholds.optimalMin, optimalMax: thresholds.optimalMax,
            thresholdType: violation.thresholdType, severity: violation.severity,
            lifeImpact: param.lifeImpactDescription ?? undefined, recommendedAction: param.recommendedAction ?? undefined,
            message: `${param.parameterName} is ${violation.thresholdType.replace("_", " ")}: ${reading.value} ${param.unit || ""}`,
            acknowledged: false, resolved: false
          });
          alertsCreated++;
        } catch { /* Alert might already exist */ }
      }
    }
    return { violations, alertsCreated };
  }
}
