import type { WidenPartial } from "../../lib/widen-partial";
/**
 * Equipment - Database Storage
 */

import { randomUUID } from "node:crypto";
import { eq, and, sql, lte, or } from "drizzle-orm";
import { tableColumns } from "../_helpers/table-columns";
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
import { projectEquipment, retractInstalledOn } from "../../graph/projector";

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
        logger.warn(`Failed to lookup vessel name for ID ${equipmentData.vesselId}:`, {
          details: error,
        });
      }
    }
    const [newEquipment] = await db
      .insert(equipment)
      .values({
        ...equipmentData,
        vesselName,
        id: (equipmentData as { id?: string }).id || randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
      .returning();
    if (!newEquipment) {
      throw new Error("createEquipment: insert returned no row");
    }
    // Push A2 — project new equipment into the knowledge graph. No-op
    // when GRAPH_ENABLED=false; never throws (best-effort wrapper).
    // Failures are logged at warn level (with orgId/equipmentId) so
    // graph drift is observable, not silent.
    try {
      if (!newEquipment.orgId) {
        throw new Error("missing orgId");
      }
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
      const mod = await import("../../equipment-analytics-service.js");
      const svc = mod.equipmentAnalyticsService as {
        setupEquipmentAnalytics?: (e: Equipment) => Promise<void>;
      };
      if (typeof svc.setupEquipmentAnalytics === "function") {
        await svc.setupEquipmentAnalytics(newEquipment);
      }
    } catch (error) {
      logger.error(
        `Failed to setup analytics for new equipment ${newEquipment.id}:`,
        undefined,
        error
      );
    }
    const ws = getWebSocketServer();
    ws?.broadcastEquipmentChange("create", newEquipment);
    return newEquipment;
  }

  async updateEquipment(
    id: string,
    equipmentData: WidenPartial<InsertEquipment>,
    orgId?: string
  ): Promise<Equipment> {
    this.validateOrgId(orgId, "updateEquipment");
    const conditions = [eq(equipment.id, id)];
    if (orgId) {
      conditions.push(eq(equipment.orgId, orgId));
    }
    // Task #81 — Capture the prior vesselId so we can retract the
    // stale INSTALLED_ON edge if vessel assignment changes. Read
    // before the UPDATE so the comparison is against the row that
    // was actually in the graph at projection-time. Best-effort —
    // if this fails, we still attempt the (additive) re-projection.
    let priorVesselId: string | null = null;
    try {
      const [prior] = await db
        .select({ vesselId: equipment.vesselId })
        .from(equipment)
        .where(and(...conditions))
        .limit(1);
      priorVesselId = prior?.vesselId ?? null;
    } catch {
      priorVesselId = null;
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
          logger.warn(`Failed to lookup vessel name for ID ${equipmentData.vesselId}:`, {
            details: error,
          });
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
    // Task #81 — re-project on update so the graph stays in lockstep
    // with the live row. vesselId/type/name may have changed, which
    // would otherwise leave a stale INSTALLED_ON edge or label.
    // MERGE-keyed on id, so re-projection is idempotent. Best-effort
    // by contract; never blocks the relational write.
    //
    // If vesselId moved (reassigned or cleared), retract the stale
    // INSTALLED_ON edge first — projectEquipment only ADDS the new
    // edge, so without retraction the equipment would appear
    // simultaneously installed on both vessels (graph diverges from
    // relational truth, which only stores one vesselId).
    try {
      if (updated.orgId) {
        if (priorVesselId && priorVesselId !== updated.vesselId) {
          await retractInstalledOn(updated.orgId, updated.id, priorVesselId);
        }
        await projectEquipment(updated.orgId, {
          id: updated.id,
          name: updated.name,
          type: updated.type,
          vesselId: updated.vesselId,
          systemType: updated.systemType,
        });
      }
    } catch (err) {
      logger.warn(`[Graph] projectEquipment(${updated.id}) on update failed`, {
        orgId: updated.orgId,
        details: err instanceof Error ? err.message : String(err),
      });
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
      // SCHEMA GAP: rawTelemetry has no equipmentId column (only vessel/src/sig).
      // The cascade-delete path needs a real fix; until then, only run the
      // delete if a column with that name exists at runtime.
      {
        const col = tableColumns(rawTelemetry)["equipmentId"];
        if (col) {
          await tx.delete(rawTelemetry).where(eq(col, id));
        }
      }
      await tx.delete(pdmScoreLogsTable).where(eq(pdmScoreLogsTable.equipmentId, id));
      await tx.delete(anomalyDetections).where(eq(anomalyDetections.equipmentId, id));
      await tx.delete(failurePredictions).where(eq(failurePredictions.equipmentId, id));
      await tx.delete(vibrationFeatures).where(eq(vibrationFeatures.equipmentId, id));
      await tx.delete(vibrationAnalysis).where(eq(vibrationAnalysis.equipmentId, id));
      // SCHEMA GAP: twinSimulations has no equipmentId column (only digitalTwinId).
      // Cascade-delete path needs a real fix.
      {
        const col = tableColumns(twinSimulations)["equipmentId"];
        if (col) {
          await tx.delete(twinSimulations).where(eq(col, id));
        }
      }
      await tx.delete(conditionMonitoring).where(eq(conditionMonitoring.equipmentId, id));
      await tx.delete(oilAnalysis).where(eq(oilAnalysis.equipmentId, id));
      await tx.delete(wearParticleAnalysis).where(eq(wearParticleAnalysis.equipmentId, id));
      await tx.delete(dtcFaults).where(eq(dtcFaults.equipmentId, id));
      // SCHEMA GAP: insightReports/insightSnapshots have no equipmentId column
      // (org-scoped, not equipment-scoped). Cascade behavior needs a real fix —
      // probably this delete shouldn't exist at all. Guard at runtime.
      {
        const r = tableColumns(insightReports)["equipmentId"];
        if (r) {
          await tx.delete(insightReports).where(eq(r, id));
        }
        const s = tableColumns(insightSnapshots)["equipmentId"];
        if (s) {
          await tx.delete(insightSnapshots).where(eq(s, id));
        }
      }
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
    const priorVesselId = existing.vesselId;
    const [updated] = await db
      .update(equipment)
      .set({ vesselId, vesselName: vessel.name, updatedAt: new Date() })
      .where(eq(equipment.id, equipmentId))
      .returning();
    if (!updated) {
      throw new Error(`Equipment ${equipmentId} update returned no row`);
    }
    // Task #81 — keep graph INSTALLED_ON edge in lockstep. Retract
    // the old edge first (projectEquipment only ADDs), then re-project.
    // Best-effort; never blocks the relational write.
    try {
      if (priorVesselId && priorVesselId !== vesselId) {
        await retractInstalledOn(orgId, equipmentId, priorVesselId);
      }
      await projectEquipment(orgId, {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        vesselId: updated.vesselId,
        systemType: updated.systemType,
      });
    } catch (err) {
      logger.warn(`[Graph] projectEquipment(${equipmentId}) on associate failed`, {
        orgId,
        details: err instanceof Error ? err.message : String(err),
      });
    }
    return updated;
  }
  async disassociateEquipmentFromVessel(equipmentId: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "disassociateEquipmentFromVessel");
    // Read prior vesselId before clearing so we can retract the
    // INSTALLED_ON edge (the post-update row has vesselId=null and
    // would give the projector nothing to act on).
    let priorVesselId: string | null = null;
    try {
      const [prior] = await db
        .select({ vesselId: equipment.vesselId })
        .from(equipment)
        .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
        .limit(1);
      priorVesselId = prior?.vesselId ?? null;
    } catch {
      priorVesselId = null;
    }
    const [result] = await db
      .update(equipment)
      .set({ vesselId: null, vesselName: null, updatedAt: new Date() })
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .returning();
    if (!result) {
      throw new Error(`Equipment ${equipmentId} not found`);
    }
    // Task #81 — retract stale INSTALLED_ON edge. Best-effort.
    if (priorVesselId) {
      try {
        await retractInstalledOn(orgId, equipmentId, priorVesselId);
      } catch (err) {
        logger.warn(`[Graph] retractInstalledOn(${equipmentId}) on disassociate failed`, {
          orgId,
          details: err instanceof Error ? err.message : String(err),
        });
      }
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
    data: WidenPartial<InsertEquipmentLifecycle>
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
    data: WidenPartial<InsertEquipmentLifecycle>
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
      } as never)
      .returning();
    if (!n) {
      throw new Error("upsertEquipmentLifecycle: insert returned no row");
    }
    return n;
  }
  async getReplacementRecommendations(): Promise<EquipmentLifecycle[]> {
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    const col = tableColumns(equipmentLifecycle)["estimatedEndOfLife"];
    if (!col) {
      return [];
    }
    return db.select().from(equipmentLifecycle).where(lte(col, sixMonthsFromNow));
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
    return results.map(
      (e): EquipmentHealth & { healthIndex: number } =>
        ({
          id: e.id,
          name: e.name,
          type: e.type,
          category: e.systemType || e.componentType || undefined,
          status: e.isActive ? "healthy" : "inactive",
          healthIndex: 100,
          vesselId: e.vesselId || undefined,
          vesselName: e.vesselName || undefined,
        }) as EquipmentHealth & { healthIndex: number }
    );
  }
  async getEquipmentForPart(partId: string, orgId: string): Promise<Equipment[]> {
    this.validateOrgId(orgId, "getEquipmentForPart");
    const compatibleParts = tableColumns(equipment)["compatibleParts"];
    if (!compatibleParts) {
      return [];
    }
    return db
      .select()
      .from(equipment)
      .where(and(eq(equipment.orgId, orgId), sql`${partId} = ANY(${compatibleParts})`));
  }
  async getEquipmentWithSensorIssues(__orgId: string, _options?: unknown): Promise<Equipment[]> {
    return [];
  }
}
