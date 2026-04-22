/**
 * Equipment Repository with full tenant-scoped CRUD operations
 * Production-ready implementation for Phase 2 migration
 */

import { db } from "../../db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { equipment, pdmScoreLogs } from "@shared/schema-runtime";
import { TenantScopedRepository } from "./base";

export class EquipmentRepository extends TenantScopedRepository {
  /**
   * Get all equipment for this organization
   */
  async getAll() {
    const { equipment } = await import("@shared/schema");

    return db.select().from(equipment).where(this.orgWhere(equipment)).orderBy(equipment.name);
  }

  /**
   * Get equipment by ID
   * Validates it belongs to this organization
   */
  async getById(equipmentId: string) {
    const { equipment } = await import("@shared/schema");

    const result = await db
      .select()
      .from(equipment)
      .where(this.orgWhere(equipment, eq(equipment.id, equipmentId)))
      .limit(1);

    return result[0];
  }

  /**
   * Get equipment by vessel ID
   */
  async getByVesselId(vesselId: string) {
    const { equipment } = await import("@shared/schema");

    return db
      .select()
      .from(equipment)
      .where(this.orgWhere(equipment, eq(equipment.vesselId, vesselId)))
      .orderBy(equipment.name);
  }

  /**
   * Get equipment by device ID
   */
  async getByDeviceId(deviceId: string) {
    const { equipment } = await import("@shared/schema");

    const result = await db
      .select()
      .from(equipment)
      .where(this.orgWhere(equipment, eq(equipment.deviceId, deviceId)))
      .limit(1);

    return result[0];
  }

  /**
   * Create new equipment
   * Automatically sets correct orgId
   */
  async create(data: Omit<any, "id" | "orgId">) {
    const { equipment } = await import("@shared/schema");

    const [created] = await db
      .insert(equipment)
      .values({
        ...data,
        orgId: this.orgId,
      })
      .returning();

    return created;
  }

  /**
   * Update equipment
   * Validates ownership before update
   */
  async update(equipmentId: string, data: Partial<any>) {
    const { equipment } = await import("@shared/schema");

    const existing = await this.getById(equipmentId);
    if (!existing) {
      throw new Error("Equipment not found");
    }

    const [updated] = await db
      .update(equipment)
      .set(data)
      .where(this.orgWhere(equipment, eq(equipment.id, equipmentId)))
      .returning();

    return updated;
  }

  /**
   * Delete equipment
   * Validates ownership before deletion with cascade delete of related records
   * Cascade deletes: alertConfigurations, sensorConfigurations, sensorStates, equipmentTelemetry,
   * pdmScoreLogs, anomalyDetections, failurePredictions, vibrationFeatures, vibrationAnalysis,
   * conditionMonitoring, oilAnalysis, wearParticleAnalysis, dtcFaults
   */
  async delete(equipmentId: string) {
    const {
      equipment,
      alertConfigurations,
      sensorConfigurations,
      sensorStates,
      equipmentTelemetry,
      pdmScoreLogs,
      anomalyDetections,
      failurePredictions,
      vibrationFeatures,
      vibrationAnalysis,
      conditionMonitoring,
      oilAnalysis,
      wearParticleAnalysis,
      dtcFaults,
    } = await import("@shared/schema");

    const existing = await this.getById(equipmentId);
    if (!existing) {
      throw new Error("Equipment not found");
    }

    const orgId = this.orgId;

    await db.transaction(async (tx) => {
      await tx.delete(alertConfigurations).where(eq(alertConfigurations.equipmentId, equipmentId));
      await tx
        .delete(sensorConfigurations)
        .where(eq(sensorConfigurations.equipmentId, equipmentId));
      await tx.delete(sensorStates).where(eq(sensorStates.equipmentId, equipmentId));
      await tx.delete(equipmentTelemetry).where(eq(equipmentTelemetry.equipmentId, equipmentId));
      await tx.delete(pdmScoreLogs).where(eq(pdmScoreLogs.equipmentId, equipmentId));
      await tx.delete(anomalyDetections).where(eq(anomalyDetections.equipmentId, equipmentId));
      await tx.delete(failurePredictions).where(eq(failurePredictions.equipmentId, equipmentId));
      await tx.delete(vibrationFeatures).where(eq(vibrationFeatures.equipmentId, equipmentId));
      await tx.delete(vibrationAnalysis).where(eq(vibrationAnalysis.equipmentId, equipmentId));
      await tx.delete(conditionMonitoring).where(eq(conditionMonitoring.equipmentId, equipmentId));
      await tx.delete(oilAnalysis).where(eq(oilAnalysis.equipmentId, equipmentId));
      await tx
        .delete(wearParticleAnalysis)
        .where(eq(wearParticleAnalysis.equipmentId, equipmentId));
      await tx.delete(dtcFaults).where(eq(dtcFaults.equipmentId, equipmentId));
      await tx
        .delete(equipment)
        .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)));
    });

    return true;
  }

  /**
   * Disassociate equipment from vessel
   */
  async disassociateFromVessel(equipmentId: string) {
    const { equipment } = await import("@shared/schema");

    const existing = await this.getById(equipmentId);
    if (!existing) {
      throw new Error("Equipment not found");
    }

    const [updated] = await db
      .update(equipment)
      .set({ vesselId: null })
      .where(this.orgWhere(equipment, eq(equipment.id, equipmentId)))
      .returning();

    return updated;
  }

  /**
   * Get related equipment (same vessel OR same type, excluding self)
   */
  async getRelated(equipmentId: string) {
    const { equipment } = await import("@shared/schema");
    const { ne, or } = await import("drizzle-orm");

    const target = await this.getById(equipmentId);
    if (!target) {
      throw new Error("Equipment not found");
    }

    const orConditions: any[] = [];

    if (target.vesselId) {
      orConditions.push(eq(equipment.vesselId, target.vesselId));
    }

    if (target.type) {
      orConditions.push(eq(equipment.type, target.type));
    }

    if (orConditions.length === 0) {
      return [];
    }

    return db
      .select()
      .from(equipment)
      .where(this.orgWhere(equipment, and(ne(equipment.id, equipmentId), or(...orConditions))))
      .orderBy(equipment.name);
  }

  /**
   * Get equipment health metrics with latest PDM score per equipment
   */
  async getHealthMetrics(vesselId?: string) {
    const equipmentList = await db
      .select()
      .from(equipment)
      .where(this.orgWhere(equipment, vesselId ? eq(equipment.vesselId, vesselId) : undefined))
      .orderBy(equipment.name);

    if (equipmentList.length === 0) {
      return [];
    }

    const equipmentIds = equipmentList.map((e) => e.id);

    const latestScores = await db
      .select({
        equipmentId: pdmScoreLogs.equipmentId,
        score: pdmScoreLogs.healthIdx,
        timestamp: pdmScoreLogs.ts,
        failureProbability: pdmScoreLogs.pFail30d,
      })
      .from(pdmScoreLogs)
      .where(
        and(eq(pdmScoreLogs.orgId, this.orgId), inArray(pdmScoreLogs.equipmentId, equipmentIds))
      )
      .orderBy(sql`${pdmScoreLogs.ts} DESC`);

    const scoreMap = new Map();
    for (const score of latestScores) {
      if (!scoreMap.has(score.equipmentId)) {
        scoreMap.set(score.equipmentId, score);
      }
    }

    return equipmentList.map((equip) => ({
      equipment: equip,
      latestScore: scoreMap.get(equip.id) || null,
    }));
  }
}
