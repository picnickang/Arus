/**
 * Work Orders - Database Storage Completions
 */

import { randomUUID } from "node:crypto";
import { eq, and, type SQL } from "drizzle-orm";
import { db } from "../../db-config";
import { workOrderCompletions } from "@shared/schema-runtime";
import type { WorkOrderCompletion, InsertWorkOrderCompletion } from "@shared/schema";

export class DbWorkOrderCompletions {
  async createWorkOrderCompletion(
    completion: InsertWorkOrderCompletion
  ): Promise<WorkOrderCompletion> {
    const [newCompletion] = await db
      .insert(workOrderCompletions)
      .values({ id: randomUUID(), ...completion, createdAt: new Date(), updatedAt: new Date() } as never)
      .returning();
    if (!newCompletion) {
      throw new Error("Failed to create work order completion");
    }
    return newCompletion;
  }

  async getWorkOrderCompletions(filters?: {
    workOrderId?: string | undefined;
    equipmentId?: string | undefined;
    orgId?: string | undefined;
  }): Promise<WorkOrderCompletion[]> {
    const conditions: SQL[] = [];
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
