/**
 * Alert Settings - Thresholds
 * Threshold configuration and management
 */

import { db } from "../../../db.js";
import { alertThresholds, type AlertThreshold, type InsertAlertThreshold } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function getThresholds(orgId: string, category?: string): Promise<AlertThreshold[]> {
  const conditions = [eq(alertThresholds.orgId, orgId)];
  if (category) {
    conditions.push(eq(alertThresholds.category, category));
  }
  return db
    .select()
    .from(alertThresholds)
    .where(and(...conditions));
}

export async function getThresholdByKey(
  orgId: string,
  key: string
): Promise<AlertThreshold | undefined> {
  const [result] = await db
    .select()
    .from(alertThresholds)
    .where(and(eq(alertThresholds.orgId, orgId), eq(alertThresholds.key, key)))
    .limit(1);
  return result;
}

export async function upsertThreshold(
  orgId: string,
  key: string,
  data: Partial<InsertAlertThreshold>
): Promise<AlertThreshold> {
  const existing = await getThresholdByKey(orgId, key);
  if (existing) {
    const [updated] = await db
      .update(alertThresholds)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertThresholds.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(alertThresholds)
    .values({ ...data, orgId, key, name: data.name || key } as InsertAlertThreshold)
    .returning();
  return created;
}

export async function deleteThreshold(orgId: string, key: string): Promise<void> {
  await db
    .delete(alertThresholds)
    .where(and(eq(alertThresholds.orgId, orgId), eq(alertThresholds.key, key)));
}
