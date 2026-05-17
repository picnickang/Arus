/**
 * Sensors - Database Storage
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  sensorConfigurations,
  sensorStates,
  j1939Configurations,
  type SensorConfiguration,
  type InsertSensorConfiguration,
  type SensorState,
  type InsertSensorState,
  type J1939Configuration,
  type InsertJ1939Configuration,
} from "@shared/schema";
import { publishEvent } from "../../sync-events";

export class DbSensorsStorage {
  async getSensorConfigurations(
    orgId?: string,
    equipmentId?: string,
    sensorType?: string
  ): Promise<SensorConfiguration[]> {
    const c = [];
    if (orgId) {
      c.push(eq(sensorConfigurations.orgId, orgId));
    }
    if (equipmentId) {
      c.push(eq(sensorConfigurations.equipmentId, equipmentId));
    }
    if (sensorType) {
      c.push(eq(sensorConfigurations.sensorType, sensorType));
    }
    const base = db.select().from(sensorConfigurations);
    const q = c.length > 0 ? base.where(and(...c)) : base;
    return q.orderBy(sql`${sensorConfigurations.updatedAt} DESC`);
  }
  async getSensorConfiguration(
    equipmentId: string,
    sensorType: string,
    orgId?: string
  ): Promise<SensorConfiguration | undefined> {
    const c = [
      eq(sensorConfigurations.equipmentId, equipmentId),
      eq(sensorConfigurations.sensorType, sensorType),
    ];
    if (orgId) {
      c.push(eq(sensorConfigurations.orgId, orgId));
    }
    const [r] = await db
      .select()
      .from(sensorConfigurations)
      .where(and(...c))
      .limit(1);
    return r;
  }
  async createSensorConfiguration(config: InsertSensorConfiguration): Promise<SensorConfiguration> {
    const [r] = await db
      .insert(sensorConfigurations)
      .values({
        ...config,
        orgId: (config as any).orgId || "default-org-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();
    return r;
  }
  async bulkCreateSensorConfigurations(
    configs: InsertSensorConfiguration[],
    overwriteExisting: boolean = false
  ): Promise<SensorConfiguration[]> {
    if (configs.length === 0) {
      return [];
    }
    return db.transaction(async (tx) => {
      const created: SensorConfiguration[] = [];
      for (const config of configs) {
        const orgId = (config as any).orgId || "default-org-id";
        const equipmentId = config.equipmentId;
        const sensorType = config.sensorType;
        const existing = await tx
          .select()
          .from(sensorConfigurations)
          .where(
            and(
              eq(sensorConfigurations.equipmentId, equipmentId),
              eq(sensorConfigurations.sensorType, sensorType),
              eq(sensorConfigurations.orgId, orgId)
            )
          )
          .limit(1);
        if (existing.length > 0) {
          if (overwriteExisting) {
            const updated = await tx
              .update(sensorConfigurations)
              .set({ ...config, orgId, updatedAt: new Date() })
              .where(
                and(
                  eq(sensorConfigurations.equipmentId, equipmentId),
                  eq(sensorConfigurations.sensorType, sensorType),
                  eq(sensorConfigurations.orgId, orgId)
                )
              )
              .returning();
            if (updated.length > 0) {
              created.push(updated[0]);
              await publishEvent("sensor_configuration" as any, "update", updated[0] as any);
            }
          }
        } else {
          const result = await tx
            .insert(sensorConfigurations)
            .values({ ...config, orgId, createdAt: new Date(), updatedAt: new Date() })
            .returning();
          if (result.length > 0) {
            created.push(result[0]);
            await publishEvent("sensor_configuration" as any, "create", result[0] as any);
          }
        }
      }
      return created;
    });
  }
  async updateSensorConfiguration(
    equipmentId: string,
    sensorType: string,
    config: Partial<InsertSensorConfiguration>,
    orgId?: string
  ): Promise<SensorConfiguration> {
    const c = [
      eq(sensorConfigurations.equipmentId, equipmentId),
      eq(sensorConfigurations.sensorType, sensorType),
    ];
    if (orgId) {
      c.push(eq(sensorConfigurations.orgId, orgId));
    }
    const [r] = await db
      .update(sensorConfigurations)
      .set({ ...config, updatedAt: new Date() })
      .where(and(...c))
      .returning();
    if (!r) {
      throw new Error(`Sensor configuration not found for ${equipmentId}:${sensorType}`);
    }
    return r;
  }
  async deleteSensorConfiguration(
    equipmentId: string,
    sensorType: string,
    orgId?: string
  ): Promise<void> {
    const c = [
      eq(sensorConfigurations.equipmentId, equipmentId),
      eq(sensorConfigurations.sensorType, sensorType),
    ];
    if (orgId) {
      c.push(eq(sensorConfigurations.orgId, orgId));
    }
    await db.delete(sensorConfigurations).where(and(...c));
  }
  async updateSensorConfigurationById(
    id: string,
    config: Partial<InsertSensorConfiguration>,
    orgId?: string
  ): Promise<SensorConfiguration> {
    const c = [eq(sensorConfigurations.id, id)];
    if (orgId) {
      c.push(eq(sensorConfigurations.orgId, orgId));
    }
    const [r] = await db
      .update(sensorConfigurations)
      .set({ ...config, updatedAt: new Date() })
      .where(and(...c))
      .returning();
    if (!r) {
      throw new Error("Sensor configuration not found");
    }
    return r;
  }
  async deleteSensorConfigurationById(id: string, orgId?: string): Promise<void> {
    const c = [eq(sensorConfigurations.id, id)];
    if (orgId) {
      c.push(eq(sensorConfigurations.orgId, orgId));
    }
    await db.delete(sensorConfigurations).where(and(...c));
  }
  async getSensorState(
    equipmentId: string,
    sensorType: string,
    orgId?: string
  ): Promise<SensorState | undefined> {
    const c = [eq(sensorStates.equipmentId, equipmentId), eq(sensorStates.sensorType, sensorType)];
    if (orgId) {
      c.push(eq(sensorStates.orgId, orgId));
    }
    const [r] = await db
      .select()
      .from(sensorStates)
      .where(and(...c))
      .limit(1);
    return r;
  }
  async upsertSensorState(state: InsertSensorState): Promise<SensorState> {
    const [r] = await db
      .insert(sensorStates)
      .values({ ...state, orgId: (state as any).orgId || "default-org-id", updatedAt: new Date() } as any)
      .onConflictDoUpdate({
        target: [sensorStates.equipmentId, sensorStates.sensorType, sensorStates.orgId],
        set: {
          lastValue: state.lastValue,
          ema: state.ema,
          lastTs: state.lastTs,
          updatedAt: new Date(),
        },
      })
      .returning();
    return r;
  }

  async getJ1939Configurations(orgId: string, deviceId?: string): Promise<J1939Configuration[]> {
    const c: any[] = [eq(j1939Configurations.orgId, orgId)];
    if (deviceId) {
      c.push(eq(j1939Configurations.deviceId, deviceId));
    }
    return db
      .select()
      .from(j1939Configurations)
      .where(and(...c))
      .orderBy(sql`${j1939Configurations.createdAt} DESC`);
  }
  async getJ1939Configuration(id: string, orgId: string): Promise<J1939Configuration | undefined> {
    const [r] = await db
      .select()
      .from(j1939Configurations)
      .where(and(eq(j1939Configurations.id, id), eq(j1939Configurations.orgId, orgId)))
      .limit(1);
    return r;
  }
  async createJ1939Configuration(config: InsertJ1939Configuration): Promise<J1939Configuration> {
    const [r] = await db
      .insert(j1939Configurations)
      .values({
        ...config,
        orgId: config.orgId || "default-org-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return r;
  }
  async updateJ1939Configuration(
    id: string,
    config: Partial<InsertJ1939Configuration>,
    orgId: string
  ): Promise<J1939Configuration> {
    const [r] = await db
      .update(j1939Configurations)
      .set({ ...config, updatedAt: new Date() })
      .where(and(eq(j1939Configurations.id, id), eq(j1939Configurations.orgId, orgId)))
      .returning();
    if (!r) {
      throw new Error(`J1939 configuration ${id} not found`);
    }
    return r;
  }
  async deleteJ1939Configuration(id: string, orgId: string): Promise<void> {
    await db
      .delete(j1939Configurations)
      .where(and(eq(j1939Configurations.id, id), eq(j1939Configurations.orgId, orgId)));
  }
}
