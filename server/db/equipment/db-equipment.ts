/**
 * Equipment - Database Storage
 */

import { randomUUID } from "node:crypto";
import { eq, and, sql, lte, or } from "drizzle-orm";
import { db } from "../../db-config";
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Equipment:DbEquipment");
import {
  equipment,
  equipmentLifecycle,
  sensorConfigurations,
  sensorStates,
  equipmentTelemetry as equipmentTelemetryTable,
  rawTelemetry,
  pdmScoreLogs as pdmScoreLogsTable,
  anomalyDetections,
  failurePredictions,
  vibrationFeatures,
  vibrationAnalysis,
  twinSimulations,
  conditionMonitoring,
  oilAnalysis,
  wearParticleAnalysis,
  dtcFaults,
  insightReports,
  insightSnapshots,
  vessels,
  alertConfigurations,
} from "@shared/schema-runtime";
import type {
  Equipment,
  InsertEquipment,
  EquipmentLifecycle,
  InsertEquipmentLifecycle,
} from "@shared/schema";
import type { EquipmentHealthFilters, EquipmentHealth } from "./types.js";
import { getWebSocketServer } from "./websocket.js";

export class DatabaseEquipmentStorage {
  private validateOrgId(orgId: string | undefined, method: string): void {
    if (!orgId) {
      throw new Error(`[${method}] orgId is required`);
    }
  }

  async getEquipment(orgId: string, equipmentId: string): Promise<Equipment | undefined> {
    this.validateOrgId(orgId, "getEquipment");
    const [result] = await db
      .select()
      .from(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)));
    return result;
  }
  async getEquipmentRegistry(orgId?: string): Promise<Equipment[]> {
    const results = await db
      .select()
      .from(equipment)
      .leftJoin(vessels, eq(equipment.vesselId, vessels.id))
      .where(orgId ? eq(equipment.orgId, orgId) : undefined)
      .orderBy(equipment.name);
    return results.map((row) => ({
      ...row.equipment,
      vesselName: row.vessels?.name || row.equipment.vesselName || null,
    }));
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    let vesselName = equipmentData.vesselName;
    if (equipmentData.vesselId && equipmentData.vesselId !== "unassigned") {
      try {
        const [vessel] = await db
          .select({ name: vessels.name })
          .from(vessels)
          .where(eq(vessels.id, equipmentData.vesselId))
          .limit(1);
        if (vessel) {
          vesselName = vessel.name;
        }
      } catch (error) {
        logger.warn(`Failed to lookup vessel name for ID ${equipmentData.vesselId}:`, { details: error });
      }
    }
    const [newEquipment] = await db
      .insert(equipment)
      .values({
        ...equipmentData,
        vesselName,
        id: (equipmentData as any).id || randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();
    // Push A2 — project new equipment into the knowledge graph. No-op
    // when GRAPH_ENABLED=false; never throws (best-effort wrapper).
    // Failures are logged at warn level (with orgId/equipmentId) so
    // graph drift is observable, not silent.
    try {
      const { projectEquipment } = await import("../../graph/projector.js");
      if (!newEquipment.orgId) throw new Error("missing orgId");
      await projectEquipment(newEquipment.orgId, {
        id: newEquipment.id,
        name: newEquipment.name,
        type: newEquipment.type,
        vesselId: newEquipment.vesselId,
        systemType: newEquipment.systemType,
      });
    } catch (err) {
      logger.warn(`[Graph] projectEquipment(${newEquipment.id}) failed`, {
        orgId: newEquipment.orgId,
        details: err instanceof Error ? err.message : String(err),
      });
    }
    try {
      const { equipmentAnalyticsService } = await import("../../equipment-analytics-service.js");
      await (equipmentAnalyticsService as any).setupEquipmentAnalytics(newEquipment);
    } catch (error) {
      logger.error(`Failed to setup analytics for new equipment ${newEquipment.id}:`, undefined, error);
    }
    const ws = getWebSocketServer();
    ws?.broadcastEquipmentChange("create", newEquipment);
    return newEquipment;
  }

  async updateEquipment(
    id: string,
    equipmentData: Partial<InsertEquipment>,
    orgId?: string
  ): Promise<Equipment> {
    this.validateOrgId(orgId, "updateEquipment");
    const conditions = [eq(equipment.id, id)];
    if (orgId) {
      conditions.push(eq(equipment.orgId, orgId));
    }
    const updateData = { ...equipmentData };
    if (equipmentData.vesselId !== undefined) {
      if (equipmentData.vesselId && equipmentData.vesselId !== "unassigned") {
        try {
          const [vessel] = await db
            .select({ name: vessels.name })
            .from(vessels)
            .where(eq(vessels.id, equipmentData.vesselId))
            .limit(1);
          if (vessel) {
            updateData.vesselName = vessel.name;
          }
        } catch (error) {
          logger.warn(`Failed to lookup vessel name for ID ${equipmentData.vesselId}:`, { details: error });
        }
      } else {
        updateData.vesselName = undefined;
      }
    }
    const [updated] = await db
      .update(equipment)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    if (!updated) {
      throw new Error(`Equipment ${id} not found`);
    }
    const ws = getWebSocketServer();
    ws?.broadcastEquipmentChange("update", updated);
    return updated;
  }

  async deleteEquipment(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deleteEquipment");
    const conditions = [eq(equipment.id, id)];
    if (orgId) {
      conditions.push(eq(equipment.orgId, orgId));
    }
    await db.transaction(async (tx) => {
      const [equipmentToDelete] = await tx
        .select()
        .from(equipment)
        .where(and(...conditions))
        .limit(1);
      if (!equipmentToDelete) {
        throw new Error(`Equipment ${id} not found`);
      }
      await tx.delete(alertConfigurations).where(eq(alertConfigurations.equipmentId, id));
      await tx.delete(sensorConfigurations).where(eq(sensorConfigurations.equipmentId, id));
      await tx.delete(sensorStates).where(eq(sensorStates.equipmentId, id));
      await tx.delete(equipmentTelemetryTable).where(eq(equipmentTelemetryTable.equipmentId, id));
      await tx.delete(rawTelemetry).where(eq((rawTelemetry as any).equipmentId, id));
      await tx.delete(pdmScoreLogsTable).where(eq(pdmScoreLogsTable.equipmentId, id));
      await tx.delete(anomalyDetections).where(eq(anomalyDetections.equipmentId, id));
      await tx.delete(failurePredictions).where(eq(failurePredictions.equipmentId, id));
      await tx.delete(vibrationFeatures).where(eq(vibrationFeatures.equipmentId, id));
      await tx.delete(vibrationAnalysis).where(eq(vibrationAnalysis.equipmentId, id));
      await tx.delete(twinSimulations).where(eq((twinSimulations as any).equipmentId, id));
      await tx.delete(conditionMonitoring).where(eq(conditionMonitoring.equipmentId, id));
      await tx.delete(oilAnalysis).where(eq(oilAnalysis.equipmentId, id));
      await tx.delete(wearParticleAnalysis).where(eq(wearParticleAnalysis.equipmentId, id));
      await tx.delete(dtcFaults).where(eq(dtcFaults.equipmentId, id));
      await tx.delete(insightReports).where(eq((insightReports as any).equipmentId, id));
      await tx.delete(insightSnapshots).where(eq((insightSnapshots as any).equipmentId, id));
      const [deleted] = await tx
        .delete(equipment)
        .where(and(...conditions))
        .returning();
      const ws = getWebSocketServer();
      if (deleted) {
        ws?.broadcastEquipmentChange("delete", { id: deleted.id });
      }
    });
  }

  async getEquipmentByVessel(vesselId: string, orgId: string): Promise<Equipment[]> {
    this.validateOrgId(orgId, "getEquipmentByVessel");
    const [vessel] = await db
      .select({ name: vessels.name })
      .from(vessels)
      .where(eq(vessels.id, vesselId))
      .limit(1);
    const vesselName = vessel?.name;
    return db
      .select()
      .from(equipment)
      .where(
        and(
          eq(equipment.orgId, orgId),
          or(
            eq(equipment.vesselId, vesselId),
            vesselName ? eq(equipment.vesselName, vesselName) : sql`false`
          )
        )
      )
      .orderBy(equipment.name);
  }
  async associateEquipmentToVessel(
    equipmentId: string,
    vesselId: string,
    orgId: string
  ): Promise<Equipment> {
    this.validateOrgId(orgId, "associateEquipmentToVessel");
    const [existing] = await db
      .select()
      .from(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .limit(1);
    if (!existing) {
      throw new Error(`Equipment ${equipmentId} not found`);
    }
    const [vessel] = await db
      .select({ name: vessels.name })
      .from(vessels)
      .where(and(eq(vessels.id, vesselId), eq(vessels.orgId, orgId)))
      .limit(1);
    if (!vessel) {
      throw new Error(`Vessel ${vesselId} not found`);
    }
    const [updated] = await db
      .update(equipment)
      .set({ vesselId, vesselName: vessel.name, updatedAt: new Date() })
      .where(eq(equipment.id, equipmentId))
      .returning();
    return updated;
  }
  async disassociateEquipmentFromVessel(equipmentId: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "disassociateEquipmentFromVessel");
    const [result] = await db
      .update(equipment)
      .set({ vesselId: null, vesselName: null, updatedAt: new Date() })
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .returning();
    if (!result) {
      throw new Error(`Equipment ${equipmentId} not found`);
    }
  }

  async getEquipmentLifecycle(equipmentId?: string): Promise<EquipmentLifecycle[]> {
    if (equipmentId) {
      return db
        .select()
        .from(equipmentLifecycle)
        .where(eq(equipmentLifecycle.equipmentId, equipmentId));
    }
    return db.select().from(equipmentLifecycle);
  }
  async updateEquipmentLifecycle(
    id: string,
    data: Partial<InsertEquipmentLifecycle>
  ): Promise<EquipmentLifecycle> {
    const [updated] = await db
      .update(equipmentLifecycle)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(equipmentLifecycle.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Equipment lifecycle ${id} not found`);
    }
    return updated;
  }
  async upsertEquipmentLifecycle(
    equipmentId: string,
    data: Partial<InsertEquipmentLifecycle>
  ): Promise<EquipmentLifecycle> {
    const [existing] = await db
      .select()
      .from(equipmentLifecycle)
      .where(eq(equipmentLifecycle.equipmentId, equipmentId));
    if (existing) {
      return this.updateEquipmentLifecycle(existing.id, data);
    }
    const [n] = await db
      .insert(equipmentLifecycle)
      .values({
        id: randomUUID(),
        equipmentId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();
    return n;
  }
  async getReplacementRecommendations(): Promise<EquipmentLifecycle[]> {
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    return db
      .select()
      .from(equipmentLifecycle)
      .where(lte((equipmentLifecycle as any).estimatedEndOfLife, sixMonthsFromNow));
  }

  async getEquipmentSensorTypes(orgId: string, equipmentId: string): Promise<string[]> {
    this.validateOrgId(orgId, "getEquipmentSensorTypes");
    const configs = await db
      .select({ sensorType: sensorConfigurations.sensorType })
      .from(sensorConfigurations)
      .where(
        and(
          eq(sensorConfigurations.equipmentId, equipmentId),
          eq(sensorConfigurations.orgId, orgId)
        )
      );
    return [...new Set(configs.map((c) => c.sensorType))];
  }
  async getEquipmentHealth(
    orgId: string,
    filters?: EquipmentHealthFilters
  ): Promise<(EquipmentHealth & { healthIndex: number })[]> {
    this.validateOrgId(orgId, "getEquipmentHealth");
    const conditions = [eq(equipment.orgId, orgId)];
    if (filters?.vesselId) {
      conditions.push(eq(equipment.vesselId, filters.vesselId));
    }
    if (filters?.equipmentId) {
      conditions.push(eq(equipment.id, filters.equipmentId));
    }
    const results = await db
      .select()
      .from(equipment)
      .where(and(...conditions))
      .orderBy(equipment.name);
    return results.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      category: e.systemType || e.componentType || undefined,
      status: e.isActive ? "healthy" : "inactive",
      healthIndex: 100,
      vesselId: e.vesselId || undefined,
      vesselName: e.vesselName || undefined,
    })) as unknown as (EquipmentHealth & { healthIndex: number })[];
  }
  async getEquipmentForPart(partId: string, orgId: string): Promise<Equipment[]> {
    this.validateOrgId(orgId, "getEquipmentForPart");
    return db
      .select()
      .from(equipment)
      .where(and(eq(equipment.orgId, orgId), sql`${partId} = ANY(${(equipment as any).compatibleParts})`));
  }
  async getEquipmentWithSensorIssues(__orgId: string, _options?: any): Promise<any[]> {
    return [];
  }
}
