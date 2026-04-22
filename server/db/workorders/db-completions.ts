/**
 * Work Orders - Database Storage Completions
 */

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../../db-config";
import { workOrderCompletions } from "@shared/schema-runtime";
import type { WorkOrderCompletion, InsertWorkOrderCompletion } from "@shared/schema";

export class DbWorkOrderCompletions {
  async createWorkOrderCompletion(
    completion: InsertWorkOrderCompletion
  ): Promise<WorkOrderCompletion> {
    const [newCompletion] = await db
      .insert(workOrderCompletions)
      .values({ id: randomUUID(), ...completion, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return newCompletion;
  }

  async getWorkOrderCompletions(filters?: {
    workOrderId?: string;
    equipmentId?: string;
    orgId?: string;
  }): Promise<WorkOrderCompletion[]> {
    const conditions: any[] = [];
    if (filters?.workOrderId) {
      conditions.push(eq(workOrderCompletions.workOrderId, filters.workOrderId));
    }
    if (filters?.equipmentId) {
      conditions.push(eq(workOrderCompletions.equipmentId, filters.equipmentId));
    }
    if (filters?.orgId) {
      conditions.push(eq(workOrderCompletions.orgId, filters.orgId));
    }
    if (conditions.length > 0) {
      return db
        .select()
        .from(workOrderCompletions)
        .where(and(...conditions));
    }
    return db.select().from(workOrderCompletions);
  }

  async getWorkOrderCompletion(id: string): Promise<WorkOrderCompletion | undefined> {
    const [result] = await db
      .select()
      .from(workOrderCompletions)
      .where(eq(workOrderCompletions.id, id));
    return result;
  }
  async getWorkOrderCompletionsByWorkOrder(workOrderId: string): Promise<WorkOrderCompletion[]> {
    return db
      .select()
      .from(workOrderCompletions)
      .where(eq(workOrderCompletions.workOrderId, workOrderId));
  }
}
