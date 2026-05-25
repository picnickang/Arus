import type { WidenPartial } from "../../../lib/widen-partial";
/**
 * Alert Settings - Organization Settings
 * CRUD operations for organization-level alert settings
 */

import { db } from "../../../db.js";
import {
  alertSettings,
  alertSettingsVessel,
  type AlertSettings,
  type InsertAlertSettings,
  type AlertSettingsVessel,
  type InsertAlertSettingsVessel,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function getOrgSettings(orgId: string): Promise<AlertSettings | undefined> {
  const [result] = await db
    .select()
    .from(alertSettings)
    .where(eq(alertSettings.orgId, orgId))
    .limit(1);
  return result;
}

export async function upsertOrgSettings(
  orgId: string,
  data: WidenPartial<InsertAlertSettings>
): Promise<AlertSettings> {
  const existing = await getOrgSettings(orgId);
  if (existing) {
    const [updated] = await db
      .update(alertSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertSettings.id, existing.id))
      .returning();
    if (!updated) throw new Error("Failed to update alert settings");
    return updated;
  }
  const [created] = await db
    .insert(alertSettings)
    .values({ ...data, orgId })
    .returning();
  if (!created) throw new Error("Failed to create alert settings");
  return created;
}

export async function getVesselSettings(
  orgId: string,
  vesselId: string
): Promise<AlertSettingsVessel | undefined> {
  const [result] = await db
    .select()
    .from(alertSettingsVessel)
    .where(and(eq(alertSettingsVessel.orgId, orgId), eq(alertSettingsVessel.vesselId, vesselId)))
    .limit(1);
  return result;
}

export async function getAllVesselSettings(orgId: string): Promise<AlertSettingsVessel[]> {
  return db.select().from(alertSettingsVessel).where(eq(alertSettingsVessel.orgId, orgId));
}

export async function upsertVesselSettings(
  orgId: string,
  vesselId: string,
  data: WidenPartial<InsertAlertSettingsVessel>
): Promise<AlertSettingsVessel> {
  const existing = await getVesselSettings(orgId, vesselId);
  if (existing) {
    const [updated] = await db
      .update(alertSettingsVessel)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertSettingsVessel.id, existing.id))
      .returning();
    if (!updated) throw new Error("Failed to update vessel alert settings");
    return updated;
  }
  const [created] = await db
    .insert(alertSettingsVessel)
    .values({ ...data, orgId, vesselId })
    .returning();
  if (!created) throw new Error("Failed to create vessel alert settings");
  return created;
}

export async function deleteVesselSettings(orgId: string, vesselId: string): Promise<void> {
  await db
    .delete(alertSettingsVessel)
    .where(and(eq(alertSettingsVessel.orgId, orgId), eq(alertSettingsVessel.vesselId, vesselId)));
}
