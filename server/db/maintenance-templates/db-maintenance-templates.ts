import type { WidenPartial } from "../../lib/widen-partial";
/**
 * Maintenance Templates - Database Storage
 *
 * WAVE 4 FIXES:
 * - Column renames to match actual PG schema of `maintenance_checklist_items`:
 *     sortOrder           → stepNumber
 *     isRequired          → required
 *     safetyPrecautions   → safetyWarning
 * - Removed references to columns that don't exist in the schema:
 *     tools, parts, instructions, measurementConfig
 *   These were referenced by applyTemplateToWorkOrder but never had backing
 *   columns in maintenance_checklist_items or workOrderChecklists.
 * - Removed updatedAt from inserts/updates on maintenance_checklist_items
 *   (the table doesn't have this column — only templates and completions do)
 * - EntityType cast fix: "checklist_item" → "maintenance_checklist_item"
 *   matches the canonical EntityType union member from sync-events.ts
 * - pdmScoreLogs column name: timestamp → ts
 * - workOrderChecklists methods REMOVED: the PG table has a different model
 *   (one row per checklist-on-work-order with JSON arrays), not one row per
 *   item. Per-item checklist operations should go through `dbChecklistsStorage`
 *   from server/db/checklists/db-checklists.ts (wave 1 delivery). Any caller
 *   of removed methods should be updated to use that repository instead.
 * - Reformatted from single-line-per-method style.
 *
 * REMOVED METHODS (migrate callers to dbChecklistsStorage):
 *   - getWorkOrderChecklists(workOrderId, orgId)
 *       → dbChecklistsStorage.getChecklistCompletions(workOrderId, orgId)
 *   - getWorkOrderChecklist(id, orgId)
 *       → no direct equivalent (by-id lookup on completions uses item id)
 *   - createWorkOrderChecklist(...)
 *       → dbChecklistsStorage.createChecklistCompletion(...)
 *   - updateWorkOrderChecklist(id, checklist, orgId)
 *       → dbChecklistsStorage.updateChecklistCompletion(id, updates)
 *   - deleteWorkOrderChecklist(id, orgId)
 *       → no direct equivalent; delete completions via raw db or add method
 *   - completeChecklistItem / uncompleteChecklistItem
 *       → dbChecklistsStorage.updateChecklistCompletion(id, { status: ... })
 *   - getChecklistProgress
 *       → dbChecklistsStorage.getChecklistCompletionProgress(workOrderId)
 *   - applyTemplateToWorkOrder
 *       → dbChecklistsStorage.initializeChecklistFromTemplate(workOrderId, templateId)
 *
 * DEPENDS ON:
 * - shared/schema-runtime.ts cast fix (wave 1) — for column type inference
 * - sync-events.ts EntityType union — already has "maintenance_checklist_item"
 *   (confirmed via wave4-prep/sync-events.ts.reference)
 */

import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db } from "../../db-config";
import { getWebSocketServer } from "../../websocket-server";
import { recordAndPublish, type EntityType } from "../../sync-events";
import {
  maintenanceTemplates,
  maintenanceChecklistItems,
  pdmScoreLogs,
  maintenanceSchedules,
} from "@shared/schema-runtime";
import type {
  MaintenanceTemplate,
  InsertMaintenanceTemplate,
  MaintenanceChecklistItem,
  InsertMaintenanceChecklistItem,
  PdmScoreLog,
  InsertPdmScoreLog,
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
} from "@shared/schema";

export class DatabaseMaintenanceTemplatesStorage {
  // ──────────────────────────────────────────────────────────────────
  // Maintenance Templates
  // ──────────────────────────────────────────────────────────────────

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
    if (!n) {throw new Error("createMaintenanceTemplate: no row returned");}
    await recordAndPublish("maintenance_template" as EntityType, n.id, "create", n);
    return n;
  }

  async updateMaintenanceTemplate(
    id: string,
    template: WidenPartial<InsertMaintenanceTemplate>,
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
    await recordAndPublish("maintenance_template" as EntityType, u.id, "update", u);
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
    await recordAndPublish("maintenance_template" as EntityType, id, "delete", r[0]);
  }

  async cloneMaintenanceTemplate(
    id: string,
    newName: string,
    orgId?: string
  ): Promise<MaintenanceTemplate> {
    return db.transaction(async (tx) => {
      const c = [eq(maintenanceTemplates.id, id)];
      if (orgId) {
        c.push(eq(maintenanceTemplates.orgId, orgId));
      }
      const [original] = await tx
        .select()
        .from(maintenanceTemplates)
        .where(and(...c));
      if (!original) {
        throw new Error(`Maintenance template ${id} not found`);
      }

      // Clone the template row. Strip id so a new one is generated.
      // Drop createdAt/updatedAt from the spread and set fresh timestamps.
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = original;
      const [cloned] = await tx
        .insert(maintenanceTemplates)
        .values({
          ...rest,
          name: newName,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as InsertMaintenanceTemplate)
        .returning();
      if (!cloned) {throw new Error("cloneMaintenanceTemplate: clone insert returned no row");}

      // Clone all checklist items, ordered by stepNumber (not sortOrder).
      // Strip id so new ones are generated; re-point templateId to the clone.
      // maintenance_checklist_items does NOT have createdAt/updatedAt columns,
      // so don't set them.
      const originalItems = await tx
        .select()
        .from(maintenanceChecklistItems)
        .where(eq(maintenanceChecklistItems.templateId, id))
        .orderBy(maintenanceChecklistItems.stepNumber);

      if (originalItems.length > 0) {
        await tx.insert(maintenanceChecklistItems).values(
          originalItems.map((item: MaintenanceChecklistItem) => {
            const { id: _itemId, ...itemRest } = item;
            return {
              ...itemRest,
              templateId: cloned.id,
            };
          })
        );
      }

      return cloned;
    });
  }

  async searchMaintenanceTemplates(
    orgId: string,
    searchTerm: string
  ): Promise<MaintenanceTemplate[]> {
    const all = await db
      .select()
      .from(maintenanceTemplates)
      .where(eq(maintenanceTemplates.orgId, orgId));
    const term = searchTerm.toLowerCase();
    return all.filter(
      (t: MaintenanceTemplate) =>
        t.name.toLowerCase().includes(term) ||
        (!!t.description && t.description.toLowerCase().includes(term))
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // Maintenance Checklist Items (template-side, per template)
  // ──────────────────────────────────────────────────────────────────

  async getChecklistItems(
    templateId: string,
    _orgId?: string
  ): Promise<MaintenanceChecklistItem[]> {
    return db
      .select()
      .from(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.templateId, templateId))
      .orderBy(maintenanceChecklistItems.stepNumber);
  }

  async getChecklistItem(
    id: string,
    _orgId?: string
  ): Promise<MaintenanceChecklistItem | undefined> {
    const [r] = await db
      .select()
      .from(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.id, id));
    return r;
  }

  async createChecklistItem(
    item: InsertMaintenanceChecklistItem
  ): Promise<MaintenanceChecklistItem> {
    const [n] = await db.insert(maintenanceChecklistItems).values(item).returning();
    if (!n) {throw new Error("createChecklistItem: no row returned");}
    await recordAndPublish("maintenance_checklist_item" as EntityType, n.id, "create", n);
    return n;
  }

  async updateChecklistItem(
    id: string,
    item: WidenPartial<InsertMaintenanceChecklistItem>,
    _orgId?: string
  ): Promise<MaintenanceChecklistItem> {
    const [u] = await db
      .update(maintenanceChecklistItems)
      .set(item)
      .where(eq(maintenanceChecklistItems.id, id))
      .returning();
    if (!u) {
      throw new Error(`Checklist item ${id} not found`);
    }
    await recordAndPublish("maintenance_checklist_item" as EntityType, u.id, "update", u);
    return u;
  }

  async deleteChecklistItem(id: string, _orgId?: string): Promise<void> {
    const r = await db
      .delete(maintenanceChecklistItems)
      .where(eq(maintenanceChecklistItems.id, id))
      .returning();
    if (r.length === 0) {
      throw new Error(`Checklist item ${id} not found`);
    }
    await recordAndPublish("maintenance_checklist_item" as EntityType, id, "delete", r[0]);
  }

  async reorderChecklistItems(
    templateId: string,
    itemIds: string[]
  ): Promise<MaintenanceChecklistItem[]> {
    return db.transaction(async (tx) => {
      for (let i = 0; i < itemIds.length; i++) {
        const itemId = itemIds[i];
        if (!itemId) {continue;}
        await tx
          .update(maintenanceChecklistItems)
          .set({ stepNumber: i })
          .where(eq(maintenanceChecklistItems.id, itemId));
      }
      return tx
        .select()
        .from(maintenanceChecklistItems)
        .where(eq(maintenanceChecklistItems.templateId, templateId))
        .orderBy(maintenanceChecklistItems.stepNumber);
    });
  }

  async bulkCreateChecklistItems(
    items: InsertMaintenanceChecklistItem[]
  ): Promise<MaintenanceChecklistItem[]> {
    if (items.length === 0) {
      return [];
    }
    return db.insert(maintenanceChecklistItems).values(items).returning();
  }

  async bulkUpdateChecklistItems(
    updates: { id: string; data: WidenPartial<InsertMaintenanceChecklistItem> }[]
  ): Promise<MaintenanceChecklistItem[]> {
    const u: MaintenanceChecklistItem[] = [];
    for (const { id, data } of updates) {
      const [item] = await db
        .update(maintenanceChecklistItems)
        .set(data)
        .where(eq(maintenanceChecklistItems.id, id))
        .returning();
      if (item) {
        u.push(item);
      }
    }
    return u;
  }

  // ──────────────────────────────────────────────────────────────────
  // Work Order Checklist methods REMOVED.
  // ──────────────────────────────────────────────────────────────────
  // The `work_order_checklists` PG table has a different model (one row
  // per checklist-on-work-order, with JSON arrays for items/completions).
  // Per-item checklist operations should go through dbChecklistsStorage
  // from server/db/checklists/db-checklists.ts (wave 1 delivery), which
  // correctly uses maintenance_checklist_completions.
  //
  // Callers of the removed methods should migrate per the header comment.
  // ──────────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────────
  // PDM Score Logs (column `ts`, not `timestamp`)
  // ──────────────────────────────────────────────────────────────────

  async getPdmScoreLogs(
    equipmentId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PdmScoreLog[]> {
    const c = [eq(pdmScoreLogs.equipmentId, equipmentId)];
    if (startDate) {
      c.push(gte(pdmScoreLogs.ts, startDate));
    }
    if (endDate) {
      c.push(lte(pdmScoreLogs.ts, endDate));
    }
    return db
      .select()
      .from(pdmScoreLogs)
      .where(and(...c))
      .orderBy(desc(pdmScoreLogs.ts));
  }

  async createPdmScoreLog(log: InsertPdmScoreLog): Promise<PdmScoreLog> {
    const [n] = await db.insert(pdmScoreLogs).values(log).returning();
    if (!n) {throw new Error("createPdmScoreLog: no row returned");}
    return n;
  }

  async getLatestPdmScore(equipmentId: string): Promise<PdmScoreLog | undefined> {
    const [r] = await db
      .select()
      .from(pdmScoreLogs)
      .where(eq(pdmScoreLogs.equipmentId, equipmentId))
      .orderBy(desc(pdmScoreLogs.ts))
      .limit(1);
    return r;
  }

  async getFleetPdmScores(orgId: string): Promise<PdmScoreLog[]> {
    return db
      .select()
      .from(pdmScoreLogs)
      .where(eq(pdmScoreLogs.orgId, orgId))
      .orderBy(desc(pdmScoreLogs.ts));
  }

  // ──────────────────────────────────────────────────────────────────
  // Maintenance Schedules
  // ──────────────────────────────────────────────────────────────────

  async getMaintenanceSchedules(
    equipmentId?: string,
    status?: string
  ): Promise<MaintenanceSchedule[]> {
    const c = [];
    if (equipmentId) {
      c.push(eq(maintenanceSchedules.equipmentId, equipmentId));
    }
    if (status) {
      c.push(eq(maintenanceSchedules.status, status));
    }
    let q = db.select().from(maintenanceSchedules);
    if (c.length > 0) {
      q = q.where(and(...c)) as typeof q;
    }
    return q.orderBy(maintenanceSchedules.scheduledDate);
  }

  async createMaintenanceSchedule(
    schedule: InsertMaintenanceSchedule
  ): Promise<MaintenanceSchedule> {
    const [n] = await db.insert(maintenanceSchedules).values(schedule).returning();
    if (!n) {throw new Error("createMaintenanceSchedule: no row returned");}
    const ws = getWebSocketServer();
    ws?.broadcastMaintenanceScheduleChange("create", n);
    return n;
  }

  async updateMaintenanceSchedule(
    id: string,
    updates: WidenPartial<InsertMaintenanceSchedule>
  ): Promise<MaintenanceSchedule> {
    const [u] = await db
      .update(maintenanceSchedules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(maintenanceSchedules.id, id))
      .returning();
    if (!u) {
      throw new Error(`Maintenance schedule ${id} not found`);
    }
    const ws = getWebSocketServer();
    ws?.broadcastMaintenanceScheduleChange("update", u);
    return u;
  }

  async deleteMaintenanceSchedule(id: string): Promise<void> {
    const toDelete = await db
      .select()
      .from(maintenanceSchedules)
      .where(eq(maintenanceSchedules.id, id))
      .limit(1);
    const r = await db.delete(maintenanceSchedules).where(eq(maintenanceSchedules.id, id));
    if ((r as { rowCount?: number }).rowCount === 0) {
      throw new Error(`Maintenance schedule ${id} not found`);
    }
    const ws = getWebSocketServer();
    if (toDelete.length > 0) {
      ws?.broadcastMaintenanceScheduleChange("delete", { id: toDelete[0]!.id });
    }
  }

  async getUpcomingSchedules(days: number = 30): Promise<MaintenanceSchedule[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return db
      .select()
      .from(maintenanceSchedules)
      .where(
        and(
          gte(maintenanceSchedules.scheduledDate, new Date()),
          lte(maintenanceSchedules.scheduledDate, cutoff),
          eq(maintenanceSchedules.status, "scheduled")
        )
      )
      .orderBy(maintenanceSchedules.scheduledDate);
  }
}
