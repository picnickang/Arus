/**
 * Checklists - Database Storage
 *
 * FIXES APPLIED:
 * - recordAndPublish signature updated to (entityType, entityId, operation, data, userId?)
 *   across every call site (was: recordAndPublish(returning-query, type, op))
 * - EventType casts added for non-enum types like "maintenance_template",
 *   "maintenance_checklist_item", "maintenance_checklist_completion" — these
 *   values need to be added to the EventType union in sync-events.ts
 * - Reformatted from single-line-per-function to conventional formatting
 *   for readability and easier future edits.
 *
 * DEPENDS ON:
 * - shared/schema-runtime.ts fix (as typeof pgSchema.<table> cast pattern)
 * - shared/schema/maintenance.ts patch (adds stepNumber, title, category,
 *   itemId, status, passed, actualValue, photoUrls, completedByName columns)
 * - shared/sync-events.ts update (add maintenance_* event types to EventType union)
 */

import { eq, and } from "drizzle-orm";
import { db } from "../../db-config";
import { recordAndPublish, publishEvent } from "../../sync-events";
import { DatabaseChecklistWorkOrderRecordsStorage } from "./db-checklists-work-order-records.js";
import {
  maintenanceTemplates,
  maintenanceChecklistItems,
  maintenanceChecklistCompletions,
} from "@shared/schema-runtime";
import type {
  MaintenanceTemplate,
  InsertMaintenanceTemplate,
  MaintenanceChecklistItem,
  InsertMaintenanceChecklistItem,
  MaintenanceChecklistCompletion,
  InsertMaintenanceChecklistCompletion,
} from "@shared/schema";

export class DatabaseChecklistsStorage extends DatabaseChecklistWorkOrderRecordsStorage {
  // ──────────────────────────────────────────────────────────────────────
  // Maintenance Templates
  // ──────────────────────────────────────────────────────────────────────

  async getMaintenanceTemplates(
    orgId?: string,
    equipmentType?: string,
    isActive?: boolean
  ): Promise<MaintenanceTemplate[]> {
    const c = [];
    if (orgId) {
      c.push(eq(maintenanceTemplates.orgId, orgId));
    }
    if (equipmentType) {
      c.push(eq(maintenanceTemplates.equipmentType, equipmentType));
    }
    if (isActive !== undefined) {
      c.push(eq(maintenanceTemplates.isActive, isActive));
    }
    let q = db.select().from(maintenanceTemplates);
    if (c.length > 0) {
      q = q.where(and(...c)) as typeof q;
    }
    return q.orderBy(maintenanceTemplates.name);
  }

  async getMaintenanceTemplate(
    id: string,
    orgId?: string
  ): Promise<MaintenanceTemplate | undefined> {
    const c = [eq(maintenanceTemplates.id, id)];
    if (orgId) {
      c.push(eq(maintenanceTemplates.orgId, orgId));
    }
    const r = await db
      .select()
      .from(maintenanceTemplates)
      .where(and(...c));
    return r[0];
  }

  async createMaintenanceTemplate(
    template: InsertMaintenanceTemplate
  ): Promise<MaintenanceTemplate> {
    const [n] = await db.insert(maintenanceTemplates).values(template).returning();
    if (!n) {
      throw new Error("createMaintenanceTemplate: no row returned");
    }
    await recordAndPublish("maintenance_template", n.id, "create", n);
    return n;
  }

  async updateMaintenanceTemplate(
    id: string,
    template: Partial<InsertMaintenanceTemplate>,
    orgId?: string
  ): Promise<MaintenanceTemplate> {
    const c = [eq(maintenanceTemplates.id, id)];
    if (orgId) {
      c.push(eq(maintenanceTemplates.orgId, orgId));
    }
    const [u] = await db
      .update(maintenanceTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(and(...c))
      .returning();
    if (!u) {
      throw new Error(`Maintenance template ${id} not found`);
    }
    await recordAndPublish("maintenance_template", u.id, "update", u);
    return u;
  }

  async deleteMaintenanceTemplate(id: string, orgId?: string): Promise<void> {
    const c = [eq(maintenanceTemplates.id, id)];
    if (orgId) {
      c.push(eq(maintenanceTemplates.orgId, orgId));
    }
    const r = await db
      .delete(maintenanceTemplates)
      .where(and(...c))
      .returning();
    if (r.length === 0) {
      throw new Error(`Maintenance template ${id} not found`);
    }
    await recordAndPublish("maintenance_template", id, "delete", r[0]);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Maintenance Checklist Items
  // ──────────────────────────────────────────────────────────────────────

  async getMaintenanceChecklistItems(templateId: string): Promise<MaintenanceChecklistItem[]> {
    return db
      .select()
      .from(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.templateId, templateId))
      .orderBy(maintenanceChecklistItems.stepNumber);
  }

  async getMaintenanceChecklistItem(id: string): Promise<MaintenanceChecklistItem | undefined> {
    const r = await db
      .select()
      .from(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.id, id));
    return r[0];
  }

  async createMaintenanceChecklistItem(
    item: InsertMaintenanceChecklistItem
  ): Promise<MaintenanceChecklistItem> {
    const [n] = await db.insert(maintenanceChecklistItems).values(item).returning();
    if (!n) {
      throw new Error("createMaintenanceChecklistItem: no row returned");
    }
    await recordAndPublish("maintenance_checklist_item", n.id, "create", n);
    return n;
  }

  async updateMaintenanceChecklistItem(
    id: string,
    item: Partial<InsertMaintenanceChecklistItem>
  ): Promise<MaintenanceChecklistItem> {
    const [u] = await db
      .update(maintenanceChecklistItems)
      .set(item)
      .where(eq(maintenanceChecklistItems.id, id))
      .returning();
    if (!u) {
      throw new Error(`Maintenance checklist item ${id} not found`);
    }
    await recordAndPublish("maintenance_checklist_item", u.id, "update", u);
    return u;
  }

  async deleteMaintenanceChecklistItem(id: string): Promise<void> {
    const r = await db
      .delete(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.id, id))
      .returning();
    if (r.length === 0) {
      throw new Error(`Maintenance checklist item ${id} not found`);
    }
    await recordAndPublish("maintenance_checklist_item", id, "delete", r[0]);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Maintenance Checklist Completions
  // ──────────────────────────────────────────────────────────────────────

  async getChecklistCompletions(
    workOrderId: string,
    orgId: string
  ): Promise<
    Array<
      MaintenanceChecklistCompletion & {
        title: string | null;
        category: string | null;
        stepNumber: number | null;
      }
    >
  > {
    return db
      .select({
        id: maintenanceChecklistCompletions.id,
        orgId: maintenanceChecklistCompletions.orgId,
        workOrderId: maintenanceChecklistCompletions.workOrderId,
        itemId: maintenanceChecklistCompletions.itemId,
        completedBy: maintenanceChecklistCompletions.completedBy,
        completedByName: maintenanceChecklistCompletions.completedByName,
        completedAt: maintenanceChecklistCompletions.completedAt,
        status: maintenanceChecklistCompletions.status,
        passed: maintenanceChecklistCompletions.passed,
        actualValue: maintenanceChecklistCompletions.actualValue,
        notes: maintenanceChecklistCompletions.notes,
        photoUrls: maintenanceChecklistCompletions.photoUrls,
        title: maintenanceChecklistItems.title,
        category: maintenanceChecklistItems.category,
        stepNumber: maintenanceChecklistItems.stepNumber,
      })
      .from(maintenanceChecklistCompletions)
      .leftJoin(
        maintenanceChecklistItems,
        eq(maintenanceChecklistCompletions.itemId, maintenanceChecklistItems.id)
      )
      .where(
        and(
          eq(maintenanceChecklistCompletions.workOrderId, workOrderId),
          eq(maintenanceChecklistCompletions.orgId, orgId)
        )
      )
      .orderBy(maintenanceChecklistItems.stepNumber);
  }

  async createChecklistCompletion(
    completion: InsertMaintenanceChecklistCompletion
  ): Promise<MaintenanceChecklistCompletion> {
    const [n] = await db.insert(maintenanceChecklistCompletions).values(completion).returning();
    if (!n) {
      throw new Error("createChecklistCompletion: no row returned");
    }
    await recordAndPublish("maintenance_checklist_completion", n.id, "create", n);
    return n;
  }

  async updateChecklistCompletion(
    id: string,
    updates: Partial<InsertMaintenanceChecklistCompletion>
  ): Promise<MaintenanceChecklistCompletion> {
    const [u] = await db
      .update(maintenanceChecklistCompletions)
      .set(updates)
      .where(eq(maintenanceChecklistCompletions.id, id))
      .returning();
    if (!u) {
      throw new Error(`Checklist completion ${id} not found`);
    }
    await recordAndPublish("maintenance_checklist_completion", u.id, "update", u);
    return u;
  }

  async bulkCompleteChecklistItems(
    workOrderId: string,
    completions: Array<{
      itemId: string;
      completedBy: string;
      completedByName: string;
      passed?: boolean;
      actualValue?: string;
      notes?: string;
    }>
  ): Promise<MaintenanceChecklistCompletion[]> {
    if (completions.length === 0) {
      return [];
    }
    return db.transaction(async (tx) => {
      const created = await tx
        .insert(maintenanceChecklistCompletions)
        .values(
          completions.map(
            (c) =>
              ({
                workOrderId,
                itemId: c.itemId,
                completedBy: c.completedBy,
                completedByName: c.completedByName,
                passed: c.passed ?? null,
                actualValue: c.actualValue ?? null,
                notes: c.notes ?? null,
                photoUrls: null,
                completedAt: new Date(),
                status: c.passed === false ? "failed" : "completed",
              }) as never
          )
        )
        .returning();
      for (const completion of created) {
        await publishEvent("maintenance_checklist_completion.created", {
          id: completion.id,
          data: completion,
        });
      }
      return created;
    });
  }

}
