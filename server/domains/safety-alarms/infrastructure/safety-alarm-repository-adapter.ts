/**
 * Safety Alarms Infrastructure - Repository Adapter
 * Implements ISafetyAlarmRepository using Drizzle ORM (cloud/PostgreSQL).
 */

import type { ISafetyAlarmRepository } from "../domain/ports";
import type {
  SafetyAlarmTypeEntity,
  SafetyAlarmEntity,
  SafetyAlarmWithAcks,
  SafetyAlarmAckEntity,
  CreateAlarmTypeCommand,
  UpdateAlarmTypeCommand,
  TriggerAlarmCommand,
  ListAlarmsFilters,
  UserAlarmScope,
  AcknowledgeAlarmCommand,
} from "../domain/types";
import { db } from "../../../db";
import {
  safetyAlarmTypes,
  vesselSafetyAlarms,
  vesselSafetyAlarmAcknowledgements,
  type SafetyAlarmType,
  type VesselSafetyAlarm,
  type VesselSafetyAlarmAcknowledgement,
  type InsertSafetyAlarmType,
  type InsertVesselSafetyAlarm,
} from "@shared/schema";
import { PROTECTED_ALARM_TYPES } from "@shared/role-dashboard";
import { and, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";

export class SafetyAlarmRepositoryAdapter implements ISafetyAlarmRepository {
  async ensureProtectedTypes(orgId: string): Promise<void> {
    const existing = await db
      .select({ key: safetyAlarmTypes.key })
      .from(safetyAlarmTypes)
      .where(eq(safetyAlarmTypes.orgId, orgId));
    const existingKeys = new Set(existing.map((row) => row.key));

    const missing = PROTECTED_ALARM_TYPES.filter((seed) => !existingKeys.has(seed.key));
    if (missing.length === 0) {
      return;
    }

    const rows: InsertSafetyAlarmType[] = missing.map((seed) => ({
      orgId,
      key: seed.key,
      displayName: seed.displayName,
      defaultSeverity: seed.defaultSeverity,
      requiresAcknowledgement: seed.requiresAcknowledgement,
      isProtected: true,
      isActive: true,
    }));
    await db.insert(safetyAlarmTypes).values(rows).onConflictDoNothing();
  }

  async findTypes(orgId: string, includeInactive = false): Promise<SafetyAlarmTypeEntity[]> {
    const conditions: SQL[] = [eq(safetyAlarmTypes.orgId, orgId)];
    if (!includeInactive) {
      conditions.push(eq(safetyAlarmTypes.isActive, true));
    }
    const rows = await db
      .select()
      .from(safetyAlarmTypes)
      .where(and(...conditions))
      .orderBy(desc(safetyAlarmTypes.isProtected), safetyAlarmTypes.displayName);
    return rows.map((row) => this.mapType(row));
  }

  async findTypeById(orgId: string, id: string): Promise<SafetyAlarmTypeEntity | undefined> {
    const [row] = await db
      .select()
      .from(safetyAlarmTypes)
      .where(and(eq(safetyAlarmTypes.orgId, orgId), eq(safetyAlarmTypes.id, id)))
      .limit(1);
    return row ? this.mapType(row) : undefined;
  }

  async createType(command: CreateAlarmTypeCommand): Promise<SafetyAlarmTypeEntity> {
    const values: InsertSafetyAlarmType = {
      orgId: command.orgId,
      key: command.key,
      displayName: command.displayName,
      description: command.description ?? null,
      defaultSeverity: command.defaultSeverity ?? "critical",
      icon: command.icon ?? null,
      color: command.color ?? null,
      requiresAcknowledgement: command.requiresAcknowledgement ?? true,
      isProtected: false,
      isActive: true,
      createdBy: command.createdBy ?? null,
    };
    const [created] = await db.insert(safetyAlarmTypes).values(values).returning();
    if (!created) {
      throw new Error("SafetyAlarmRepository.createType: insert returned no row");
    }
    return this.mapType(created);
  }

  async updateType(
    orgId: string,
    id: string,
    patch: UpdateAlarmTypeCommand,
  ): Promise<SafetyAlarmTypeEntity | undefined> {
    const updateValues: Partial<InsertSafetyAlarmType> = {};
    if (patch.displayName !== undefined) updateValues.displayName = patch.displayName;
    if (patch.description !== undefined) updateValues.description = patch.description;
    if (patch.defaultSeverity !== undefined) updateValues.defaultSeverity = patch.defaultSeverity;
    if (patch.icon !== undefined) updateValues.icon = patch.icon;
    if (patch.color !== undefined) updateValues.color = patch.color;
    if (patch.requiresAcknowledgement !== undefined)
      updateValues.requiresAcknowledgement = patch.requiresAcknowledgement;
    if (patch.isActive !== undefined) updateValues.isActive = patch.isActive;

    const [updated] = await db
      .update(safetyAlarmTypes)
      .set(updateValues)
      .where(and(eq(safetyAlarmTypes.orgId, orgId), eq(safetyAlarmTypes.id, id)))
      .returning();
    return updated ? this.mapType(updated) : undefined;
  }

  async deactivateType(orgId: string, id: string): Promise<void> {
    await db
      .update(safetyAlarmTypes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(safetyAlarmTypes.orgId, orgId), eq(safetyAlarmTypes.id, id)));
  }

  async findAlarms(orgId: string, filters?: ListAlarmsFilters): Promise<SafetyAlarmWithAcks[]> {
    const conditions: SQL[] = [eq(vesselSafetyAlarms.orgId, orgId)];
    if (!filters?.includeCleared) {
      conditions.push(eq(vesselSafetyAlarms.status, "active"));
    }
    if (filters?.vesselId) {
      const vesselScope = or(
        eq(vesselSafetyAlarms.vesselId, filters.vesselId),
        isNull(vesselSafetyAlarms.vesselId),
      );
      if (vesselScope) {
        conditions.push(vesselScope);
      }
    }
    const rows = await db
      .select()
      .from(vesselSafetyAlarms)
      .where(and(...conditions))
      .orderBy(desc(vesselSafetyAlarms.triggeredAt));
    return this.attachAcks(rows);
  }

  async findActiveAlarmsForScope(
    orgId: string,
    scope: UserAlarmScope,
  ): Promise<SafetyAlarmWithAcks[]> {
    const conditions: SQL[] = [
      eq(vesselSafetyAlarms.orgId, orgId),
      eq(vesselSafetyAlarms.status, "active"),
    ];
    if (!scope.fleetWide) {
      // Fleet-wide alarms (null vesselId) are always visible; vessel alarms
      // only when the user is assigned to that vessel.
      const scoped = scope.vesselIds.length
        ? or(
            isNull(vesselSafetyAlarms.vesselId),
            inArray(vesselSafetyAlarms.vesselId, scope.vesselIds),
          )
        : isNull(vesselSafetyAlarms.vesselId);
      if (scoped) {
        conditions.push(scoped);
      }
    }
    const rows = await db
      .select()
      .from(vesselSafetyAlarms)
      .where(and(...conditions))
      .orderBy(desc(vesselSafetyAlarms.triggeredAt));
    return this.attachAcks(rows);
  }

  async findAlarmById(orgId: string, id: string): Promise<SafetyAlarmEntity | undefined> {
    const [row] = await db
      .select()
      .from(vesselSafetyAlarms)
      .where(and(eq(vesselSafetyAlarms.orgId, orgId), eq(vesselSafetyAlarms.id, id)))
      .limit(1);
    return row ? this.mapAlarm(row) : undefined;
  }

  async trigger(command: TriggerAlarmCommand): Promise<SafetyAlarmEntity> {
    const values: InsertVesselSafetyAlarm = {
      orgId: command.orgId,
      alarmTypeId: command.alarmTypeId,
      vesselId: command.vesselId ?? null,
      title: command.title ?? "Safety Alarm",
      message: command.message ?? null,
      severity: command.severity ?? "critical",
      mode: command.mode ?? "real",
      status: "active",
      requiresAcknowledgement: command.requiresAcknowledgement ?? true,
      triggeredBy: command.triggeredBy ?? null,
      triggeredByName: command.triggeredByName ?? null,
      triggeredAt: new Date(),
    };
    const [created] = await db.insert(vesselSafetyAlarms).values(values).returning();
    if (!created) {
      throw new Error("SafetyAlarmRepository.trigger: insert returned no row");
    }
    return this.mapAlarm(created);
  }

  async clear(
    orgId: string,
    id: string,
    clearedBy: string | undefined,
    clearedByName: string | undefined,
  ): Promise<SafetyAlarmEntity | undefined> {
    const [updated] = await db
      .update(vesselSafetyAlarms)
      .set({
        status: "cleared",
        clearedBy: clearedBy ?? null,
        clearedByName: clearedByName ?? null,
        clearedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vesselSafetyAlarms.orgId, orgId),
          eq(vesselSafetyAlarms.id, id),
          eq(vesselSafetyAlarms.status, "active"),
        ),
      )
      .returning();
    return updated ? this.mapAlarm(updated) : undefined;
  }

  async acknowledge(command: AcknowledgeAlarmCommand): Promise<SafetyAlarmAckEntity> {
    const [created] = await db
      .insert(vesselSafetyAlarmAcknowledgements)
      .values({
        orgId: command.orgId,
        alarmId: command.alarmId,
        userId: command.userId,
        userName: command.userName ?? null,
        source: command.source ?? null,
        comment: command.comment ?? null,
        acknowledgedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          vesselSafetyAlarmAcknowledgements.alarmId,
          vesselSafetyAlarmAcknowledgements.userId,
        ],
        set: {
          userName: command.userName ?? null,
          source: command.source ?? null,
          comment: command.comment ?? null,
          acknowledgedAt: new Date(),
        },
      })
      .returning();
    if (!created) {
      throw new Error("SafetyAlarmRepository.acknowledge: upsert returned no row");
    }
    return this.mapAck(created);
  }

  private async attachAcks(rows: VesselSafetyAlarm[]): Promise<SafetyAlarmWithAcks[]> {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const acks = await db
      .select()
      .from(vesselSafetyAlarmAcknowledgements)
      .where(inArray(vesselSafetyAlarmAcknowledgements.alarmId, ids));
    const byAlarm = new Map<string, SafetyAlarmAckEntity[]>();
    for (const ack of acks) {
      const list = byAlarm.get(ack.alarmId) ?? [];
      list.push(this.mapAck(ack));
      byAlarm.set(ack.alarmId, list);
    }
    return rows.map((row) => ({
      ...this.mapAlarm(row),
      acknowledgements: byAlarm.get(row.id) ?? [],
    }));
  }

  private mapType(row: SafetyAlarmType): SafetyAlarmTypeEntity {
    return {
      id: row.id,
      orgId: row.orgId,
      key: row.key,
      displayName: row.displayName,
      description: row.description,
      defaultSeverity: row.defaultSeverity,
      icon: row.icon,
      color: row.color,
      requiresAcknowledgement: row.requiresAcknowledgement,
      isProtected: row.isProtected,
      isActive: row.isActive,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapAlarm(row: VesselSafetyAlarm): SafetyAlarmEntity {
    return {
      id: row.id,
      orgId: row.orgId,
      alarmTypeId: row.alarmTypeId,
      vesselId: row.vesselId,
      title: row.title,
      message: row.message,
      severity: row.severity,
      mode: row.mode,
      status: row.status,
      requiresAcknowledgement: row.requiresAcknowledgement,
      triggeredBy: row.triggeredBy,
      triggeredByName: row.triggeredByName,
      triggeredAt: row.triggeredAt,
      clearedBy: row.clearedBy,
      clearedByName: row.clearedByName,
      clearedAt: row.clearedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapAck(row: VesselSafetyAlarmAcknowledgement): SafetyAlarmAckEntity {
    return {
      id: row.id,
      orgId: row.orgId,
      alarmId: row.alarmId,
      userId: row.userId,
      userName: row.userName,
      source: row.source,
      comment: row.comment,
      acknowledgedAt: row.acknowledgedAt,
    };
  }
}

export const safetyAlarmRepository = new SafetyAlarmRepositoryAdapter();
