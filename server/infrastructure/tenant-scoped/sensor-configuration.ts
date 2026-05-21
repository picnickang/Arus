/**
 * Sensor Configuration Repository - Manages sensor setup and thresholds
 * Production-ready implementation for sensor-related operations
 */

import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import { TenantScopedRepository } from "./base";

export class SensorConfigurationRepository extends TenantScopedRepository {
  /**
   * Get all sensor configurations for this organization
   * Optionally filter by equipmentId and/or sensorType
   */
  async getAll(filters?: { equipmentId?: string; sensorType?: string }) {
    const { sensorConfigurations } = await import("@shared/schema");

    let whereClause = this.orgWhere(sensorConfigurations);

    if (filters?.equipmentId) {
      whereClause = and(whereClause, eq(sensorConfigurations.equipmentId, filters.equipmentId));
    }

    if (filters?.sensorType) {
      whereClause = and(whereClause, eq(sensorConfigurations.sensorType, filters.sensorType));
    }

    return db
      .select()
      .from(sensorConfigurations)
      .where(whereClause)
      .orderBy(sensorConfigurations.equipmentId, sensorConfigurations.sensorType);
  }

  /**
   * Get sensor configuration by equipment and sensor type
   */
  async getByEquipmentAndType(equipmentId: string, sensorType: string) {
    const { sensorConfigurations } = await import("@shared/schema");

    const result = await db
      .select()
      .from(sensorConfigurations)
      .where(
        this.orgWhere(
          sensorConfigurations,
          and(
            eq(sensorConfigurations.equipmentId, equipmentId),
            eq(sensorConfigurations.sensorType, sensorType)
          )
        )
      )
      .limit(1);

    return result[0];
  }

  /**
   * Create sensor configuration
   * Automatically sets orgId
   */
  async create(data: Record<string, unknown>) {
    const { sensorConfigurations } = await import("@shared/schema");
    type SensorConfigInsert = typeof sensorConfigurations.$inferInsert;

    const [created] = (await db
      .insert(sensorConfigurations)
      .values({
        ...(data as SensorConfigInsert),
        orgId: this.orgId,
      })
      .returning()) as Array<Record<string, unknown>>;

    return created;
  }

  /**
   * Update sensor configuration
   * Validates ownership before update
   */
  async update(equipmentId: string, sensorType: string, data: Partial<any>) {
    const { sensorConfigurations } = await import("@shared/schema");

    const existing = await this.getByEquipmentAndType(equipmentId, sensorType);
    if (!existing) {
      throw new Error("Sensor configuration not found");
    }

    const [updated] = await db
      .update(sensorConfigurations)
      .set(data)
      .where(
        this.orgWhere(
          sensorConfigurations,
          and(
            eq(sensorConfigurations.equipmentId, equipmentId),
            eq(sensorConfigurations.sensorType, sensorType)
          )
        )
      )
      .returning();

    return updated;
  }

  /**
   * Delete sensor configuration
   * Validates ownership before deletion
   */
  async delete(equipmentId: string, sensorType: string) {
    const { sensorConfigurations } = await import("@shared/schema");

    const existing = await this.getByEquipmentAndType(equipmentId, sensorType);
    if (!existing) {
      throw new Error("Sensor configuration not found");
    }

    await db
      .delete(sensorConfigurations)
      .where(
        this.orgWhere(
          sensorConfigurations,
          and(
            eq(sensorConfigurations.equipmentId, equipmentId),
            eq(sensorConfigurations.sensorType, sensorType)
          )
        )
      );

    return true;
  }
}
