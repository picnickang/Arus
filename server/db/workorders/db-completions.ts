/**
 * Work Orders - Database Storage Completions
 */

import { randomUUID } from "node:crypto";
import { eq, and, type SQL } from "drizzle-orm";
import { db } from "../../db-config";
import { workOrderCompletions } from "@shared/schema-runtime";
import {
  partsUsedSchema,
  type PartsUsedEntry,
  type WorkOrderCompletion,
  type InsertWorkOrderCompletion,
} from "@shared/schema-runtime";
import { logger } from "../../utils/logger";

/**
 * P2 #33 — Validate the JSONB `partsUsed` column at the repository
 * boundary. The DB schema types it as `unknown` (drizzle's jsonb),
 * so unvalidated rows would leak into the application as `any`-
 * shaped data. We coerce here once so service-layer code can rely
 * on the contract from `@shared/schema`. A malformed row degrades
 * to `null` with a warning rather than throwing, preserving read
 * availability for historical data; new writes go through the
 * closeout wizard's Zod validation already (#22).
 */
function narrowPartsUsed(value: unknown): PartsUsedEntry[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = partsUsedSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn(
      "DbWorkOrderCompletions",
      "Discarding malformed work_order_completions.parts_used JSONB",
      { issues: parsed.error.issues.slice(0, 3) }
    );
    return null;
  }
  return parsed.data;
}

function narrowCompletion(row: WorkOrderCompletion): WorkOrderCompletion {
  return { ...row, partsUsed: narrowPartsUsed(row.partsUsed) };
}

export class DbWorkOrderCompletions {
  async createWorkOrderCompletion(
    completion: InsertWorkOrderCompletion
  ): Promise<WorkOrderCompletion> {
    const [newCompletion] = await db
      .insert(workOrderCompletions)
      .values({
        id: randomUUID(),
        ...completion,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
      .returning();
    if (!newCompletion) {
      throw new Error("Failed to create work order completion");
    }
    return narrowCompletion(newCompletion);
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
    const rows =
      conditions.length > 0
        ? await db
            .select()
            .from(workOrderCompletions)
            .where(and(...conditions))
        : await db.select().from(workOrderCompletions);
    return rows.map(narrowCompletion);
  }

  async getWorkOrderCompletion(id: string): Promise<WorkOrderCompletion | undefined> {
    const [result] = await db
      .select()
      .from(workOrderCompletions)
      .where(eq(workOrderCompletions.id, id));
    return result ? narrowCompletion(result) : undefined;
  }
  async getWorkOrderCompletionsByWorkOrder(workOrderId: string): Promise<WorkOrderCompletion[]> {
    const rows = await db
      .select()
      .from(workOrderCompletions)
      .where(eq(workOrderCompletions.workOrderId, workOrderId));
    return rows.map(narrowCompletion);
  }
}
