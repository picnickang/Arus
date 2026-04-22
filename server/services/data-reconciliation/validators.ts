/**
 * Data Reconciliation - Validation Functions
 */

import { db } from '../../db';
import { equipmentTelemetry, equipment, anomalyDetections, failurePredictions } from '../../../shared/schema';
import { telemetryPointSchema, type TelemetryPoint } from '../../../shared/telemetry-schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import type { ReconciliationIssue, ValidationResult } from './types.js';
import { reconciliationMetrics } from './metrics.js';

export async function validateTelemetryIntegrity(orgId: string): Promise<ValidationResult> {
  const issues: ReconciliationIssue[] = [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const telemetryData = await db.select().from(equipmentTelemetry).where(and(eq(equipmentTelemetry.orgId, orgId), gte(equipmentTelemetry.ts, since))).limit(1000);

  for (const record of telemetryData) {
    const [existingEquipment] = await db.select({ id: equipment.id }).from(equipment).where(and(eq(equipment.id, record.equipmentId), eq(equipment.orgId, orgId))).limit(1);

    if (!existingEquipment) {
      issues.push({ type: 'missing_equipment', severity: 'high', recordId: record.id, equipmentId: record.equipmentId, orgId, message: `Telemetry references non-existent equipment: ${record.equipmentId}`, detectedAt: new Date(), metadata: { sensorType: record.sensorType } });
      continue;
    }

    try {
      const point: TelemetryPoint = { timestamp: record.ts, value: record.value, unit: record.unit ?? '', sensorType: record.sensorType, quality: record.quality ?? 1, dataSource: record.dataSource ?? 'unknown', metadata: record.metadata as Record<string, unknown> | undefined };
      telemetryPointSchema.parse(point);
      if (point.quality < 0.5) {
        issues.push({ type: 'data_quality', severity: point.quality < 0.3 ? 'high' : 'medium', recordId: record.id, equipmentId: record.equipmentId, orgId, message: `Low data quality score: ${point.quality.toFixed(2)}`, detectedAt: new Date(), metadata: { quality: point.quality, sensorType: record.sensorType } });
      }
    } catch {
      issues.push({ type: 'invalid_sensor', severity: 'medium', recordId: record.id, equipmentId: record.equipmentId, orgId, message: `Telemetry validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, detectedAt: new Date() });
    }
  }
  return { issues, scanned: telemetryData.length };
}

export async function validateAnomalyDetections(orgId: string): Promise<ValidationResult> {
  const issues: ReconciliationIssue[] = [];
  const anomalies = await db.select().from(anomalyDetections).where(eq(anomalyDetections.orgId, orgId)).limit(500);

  for (const anomaly of anomalies) {
    const [existingEquipment] = await db.select({ id: equipment.id, orgId: equipment.orgId }).from(equipment).where(eq(equipment.id, anomaly.equipmentId)).limit(1);

    if (!existingEquipment) {
      issues.push({ type: 'orphaned_record', severity: 'medium', recordId: anomaly.id, equipmentId: anomaly.equipmentId, orgId, message: `Anomaly detection references deleted equipment: ${anomaly.equipmentId}`, detectedAt: new Date() });
      reconciliationMetrics.orphanedRecords.set({ orgId, recordType: 'anomaly_detection' }, issues.filter(i => i.type === 'orphaned_record').length);
    } else if (existingEquipment.orgId !== orgId) {
      issues.push({ type: 'org_mismatch', severity: 'critical', recordId: anomaly.id, equipmentId: anomaly.equipmentId, orgId, message: `Anomaly orgId (${anomaly.orgId}) doesn't match equipment orgId (${existingEquipment.orgId})`, detectedAt: new Date() });
    }
  }
  return { issues, scanned: anomalies.length };
}

export async function validateFailurePredictions(orgId: string): Promise<ValidationResult> {
  const issues: ReconciliationIssue[] = [];
  const predictions = await db.select().from(failurePredictions).where(eq(failurePredictions.orgId, orgId)).limit(500);

  for (const prediction of predictions) {
    const [existingEquipment] = await db.select({ id: equipment.id, orgId: equipment.orgId }).from(equipment).where(eq(equipment.id, prediction.equipmentId)).limit(1);

    if (!existingEquipment) {
      issues.push({ type: 'orphaned_record', severity: 'high', recordId: prediction.id, equipmentId: prediction.equipmentId, orgId, message: `Failure prediction references deleted equipment: ${prediction.equipmentId}`, detectedAt: new Date() });
      reconciliationMetrics.orphanedRecords.set({ orgId, recordType: 'failure_prediction' }, issues.filter(i => i.type === 'orphaned_record').length);
    } else if (existingEquipment.orgId !== orgId) {
      issues.push({ type: 'org_mismatch', severity: 'critical', recordId: prediction.id, equipmentId: prediction.equipmentId, orgId, message: `Prediction orgId (${prediction.orgId}) doesn't match equipment orgId (${existingEquipment.orgId})`, detectedAt: new Date() });
    }
  }
  return { issues, scanned: predictions.length };
}

export async function validateOrgConsistency(orgId: string): Promise<ValidationResult> {
  const issues: ReconciliationIssue[] = [];
  const mismatchedTelemetry = await db.select({ id: equipmentTelemetry.id, equipmentId: equipmentTelemetry.equipmentId, telemetryOrgId: equipmentTelemetry.orgId, equipmentOrgId: equipment.orgId }).from(equipmentTelemetry).innerJoin(equipment, eq(equipmentTelemetry.equipmentId, equipment.id)).where(sql`${equipmentTelemetry.orgId} != ${equipment.orgId}`).limit(100);

  for (const record of mismatchedTelemetry) {
    issues.push({ type: 'org_mismatch', severity: 'critical', recordId: record.id, equipmentId: record.equipmentId, orgId, message: `Telemetry orgId (${record.telemetryOrgId}) doesn't match equipment orgId (${record.equipmentOrgId})`, detectedAt: new Date(), metadata: { telemetryOrgId: record.telemetryOrgId, equipmentOrgId: record.equipmentOrgId } });
  }
  return { issues, scanned: mismatchedTelemetry.length };
}
