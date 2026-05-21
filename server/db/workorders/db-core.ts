/**
 * Work Orders - Database Storage Core CRUD
 */

import { randomUUID } from "node:crypto";
import { eq, and, sql, type SQL } from "drizzle-orm";
import { db } from "../../db-config";
import { workOrders } from "@shared/schema-runtime";
import type { WorkOrder, InsertWorkOrder } from "@shared/schema";
import { broadcastChange, type WorkOrderFilters, type WorkOrderPaginationResult } from "./types.js";

export class DbWorkOrderCore {
  private validateOrgId(orgId: string | undefined, method: string): void {
    if (!orgId) {
      throw new Error(`[${method}] orgId is required`);
    }
  }

  async getWorkOrders(
    equipmentId?: string,
    orgId?: string,
    filters?: WorkOrderFilters
  ): Promise<WorkOrder[]> {
    const conditions: SQL[] = [];
    if (orgId) {
      conditions.push(eq(workOrders.orgId, orgId));
    }
    if (equipmentId) {
      conditions.push(eq(workOrders.equipmentId, equipmentId));
    }
    if (filters?.vesselId) {
      conditions.push(eq(workOrders.vesselId, filters.vesselId));
    }
    if (filters?.assignedCrewId) {
      conditions.push(eq(workOrders.assignedCrewId, filters.assignedCrewId));
    }
    return conditions.length > 0
      ? db
          .select()
          .from(workOrders)
          .where(and(...conditions))
          .orderBy(sql`created_at DESC`)
      : db
          .select()
          .from(workOrders)
          .orderBy(sql`created_at DESC`);
  }

  async getWorkOrdersPaginated(
    equipmentId: string | undefined,
    orgId: string | undefined,
    limit: number,
    offset: number,
    filters?: WorkOrderFilters
  ): Promise<WorkOrderPaginationResult> {
    const allOrders = await this.getWorkOrders(equipmentId, orgId, filters);
    return { items: allOrders.slice(offset, offset + limit), total: allOrders.length };
  }

  async getWorkOrder(orgId: string, workOrderId: string): Promise<WorkOrder | undefined> {
    this.validateOrgId(orgId, "getWorkOrder");
    const [result] = await db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, workOrderId), eq(workOrders.orgId, orgId)));
    return result;
  }

  async getWorkOrderById(id: string, orgId: string): Promise<WorkOrder | undefined> {
    return this.getWorkOrder(orgId, id);
  }

  async generateWorkOrderNumber(orgId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, orgId),
          sql`EXTRACT(YEAR FROM ${workOrders.createdAt}) = ${currentYear}`
        )
      );
    const nextNumber = (countResult?.count ?? 0) + 1;
    return `WO-${currentYear}-${String(nextNumber).padStart(4, "0")}-${randomUUID().split("-")[0]}`;
  }

  async createWorkOrder(
    order: InsertWorkOrder & { woNumber?: string },
    tx?: typeof db
  ): Promise<WorkOrder> {
    // Accept an optional drizzle transaction handle so callers can
    // wrap the insert + outbox enqueue in a single atomic transaction
    // (true transactional outbox). Defaults to the global db when no
    // tx is supplied so existing callers stay untouched.
    const client = tx ?? db;
    const [newOrder] = await client
      .insert(workOrders)
      .values({
        id: randomUUID(),
        ...order,
        status: order.status ?? "open",
        priority: order.priority ?? 3,
        woNumber: order.woNumber ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    broadcastChange("create", newOrder);
    return newOrder;
  }

  async updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    const [updated] = await db
      .update(workOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workOrders.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Work order ${id} not found`);
    }
    broadcastChange("update", updated);
    return updated;
  }

  async deleteWorkOrder(id: string): Promise<void> {
    await db.delete(workOrders).where(eq(workOrders.id, id));
    broadcastChange("delete", { id });
  }
}
