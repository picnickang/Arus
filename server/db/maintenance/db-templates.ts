/**
 * Maintenance - Database Storage Templates
 */

import { randomUUID } from "node:crypto";
import { eq, and, type SQL } from "drizzle-orm";
import { db } from "../../db-config";
import { maintenanceTemplates } from "@shared/schema-runtime";
import type { MaintenanceTemplate, InsertMaintenanceTemplate } from "@shared/schema";

export class DbMaintenanceTemplates {
  private validateOrgId(orgId: string | undefined, method: string): void {
    if (!orgId) {
      throw new Error(`[${method}] orgId is required`);
    }
  }

  async getMaintenanceTemplates(
    orgId?: string,
    equipmentType?: string
  ): Promise<MaintenanceTemplate[]> {
    const conditions: SQL[] = [];
    if (orgId) {
      conditions.push(eq(maintenanceTemplates.orgId, orgId));
    }
    if (equipmentType) {
      conditions.push(eq(maintenanceTemplates.equipmentType, equipmentType));
    }
    if (conditions.length > 0) {
      return db
        .select()
        .from(maintenanceTemplates)
        .where(and(...conditions))
        .orderBy(maintenanceTemplates.name);
    }
    return db.select().from(maintenanceTemplates).orderBy(maintenanceTemplates.name);
  }
  async getMaintenanceTemplate(
    id: string,
    orgId?: string
  ): Promise<MaintenanceTemplate | undefined> {
    const conditions = orgId
      ? and(eq(maintenanceTemplates.id, id), eq(maintenanceTemplates.orgId, orgId))
      : eq(maintenanceTemplates.id, id);
    const [result] = await db.select().from(maintenanceTemplates).where(conditions);
    return result;
  }
  async createMaintenanceTemplate(
    template: InsertMaintenanceTemplate
  ): Promise<MaintenanceTemplate> {
    const [n] = await db
      .insert(maintenanceTemplates)
      .values({ id: randomUUID(), ...template, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    if (!n) {
      throw new Error("Failed to create maintenance template");
    }
    return n;
  }
  async updateMaintenanceTemplate(
    id: string,
    updates: Partial<InsertMaintenanceTemplate>,
    orgId?: string
  ): Promise<MaintenanceTemplate> {
    this.validateOrgId(orgId, "updateMaintenanceTemplate");
    const conditions = orgId
      ? and(eq(maintenanceTemplates.id, id), eq(maintenanceTemplates.orgId, orgId))
      : eq(maintenanceTemplates.id, id);
    const [updated] = await db
      .update(maintenanceTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(conditions)
      .returning();
    if (!updated) {
      throw new Error(`Maintenance template ${id} not found`);
    }
    return updated;
  }
  async deleteMaintenanceTemplate(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deleteMaintenanceTemplate");
    const conditions = orgId
      ? and(eq(maintenanceTemplates.id, id), eq(maintenanceTemplates.orgId, orgId))
      : eq(maintenanceTemplates.id, id);
    await db.delete(maintenanceTemplates).where(conditions);
  }
  async cloneMaintenanceTemplate(id: string, orgId: string): Promise<MaintenanceTemplate> {
    this.validateOrgId(orgId, "cloneMaintenanceTemplate");
    const [original] = await db
      .select()
      .from(maintenanceTemplates)
      .where(and(eq(maintenanceTemplates.id, id), eq(maintenanceTemplates.orgId, orgId)));
    if (!original) {
      throw new Error(`Maintenance template ${id} not found`);
    }
    const [cloned] = await db
      .insert(maintenanceTemplates)
      .values({
        ...original,
        id: randomUUID(),
        name: `${original.name} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    if (!cloned) {
      throw new Error("Failed to clone template");
    }
    return cloned;
  }
}
