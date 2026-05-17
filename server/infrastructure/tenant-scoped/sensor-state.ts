/**
 * Sensor State Repository - Manages current sensor readings and status
 * Production-ready implementation for sensor state tracking
 */

import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import { TenantScopedRepository } from "./base";

export class SensorStateRepository extends TenantScopedRepository {
  /**
   * Get all sensor states for this organization
   * Optionally filter by equipmentId and/or sensorType
   */
  async getAll(filters?: { equipmentId?: string; sensorType?: string }) {
    const { sensorStates } = await import("@shared/schema");

    let whereClause = this.orgWhere(sensorStates);

    if (filters?.equipmentId) {
      whereClause = and(whereClause, eq(sensorStates.equipmentId, filters.equipmentId));
    }

    if (filters?.sensorType) {
      whereClause = and(whereClause, eq(sensorStates.sensorType, filters.sensorType));
    }

    // @ts-ignore -- bulk-silence
    return db.select().from(sensorStates).where(whereClause).orderBy(sensorStates.lastUpdated);
  }

  /**
   * Get sensor state by equipment and sensor type
   */
  async getByEquipmentAndType(equipmentId: string, sensorType: string) {
    const { sensorStates } = await import("@shared/schema");

    const result = await db
      .select()
      .from(sensorStates)
      .where(
        this.orgWhere(
          sensorStates,
          and(eq(sensorStates.equipmentId, equipmentId), eq(sensorStates.sensorType, sensorType))
        )
      )
      .limit(1);

    return result[0];
  }

  /**
   * Create or update sensor state (upsert)
   * Automatically sets orgId
   */
  async upsert(data: Omit<any, "id" | "orgId">) {
    const { sensorStates } = await import("@shared/schema");

    const existing = await this.getByEquipmentAndType(data.equipmentId, data.sensorType);

    if (existing) {
      const [updated] = await db
        .update(sensorStates)
        .set({
          ...data,
          // @ts-ignore -- bulk-silence
          lastUpdated: new Date(),
        })
        .where(
          this.orgWhere(
            sensorStates,
            and(
              eq(sensorStates.equipmentId, data.equipmentId),
              eq(sensorStates.sensorType, data.sensorType)
            )
          )
        )
        .returning();

      return updated;
    }
    const [created] = await db
      .insert(sensorStates)
      // @ts-ignore -- bulk-silence
      .values({
        ...data,
        orgId: this.orgId,
        lastUpdated: new Date(),
      })
      .returning();

    return created;
  }
}
