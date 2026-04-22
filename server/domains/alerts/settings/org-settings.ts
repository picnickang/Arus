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
  data: Partial<InsertAlertSettings>
): Promise<AlertSettings> {
  const existing = await getOrgSettings(orgId);
  if (existing) {
    const [updated] = await db
      .update(alertSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertSettings.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(alertSettings)
    .values({ ...data, orgId })
    .returning();
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
  data: Partial<InsertAlertSettingsVessel>
): Promise<AlertSettingsVessel> {
  const existing = await getVesselSettings(orgId, vesselId);
  if (existing) {
    const [updated] = await db
      .update(alertSettingsVessel)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(alertSettingsVessel.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(alertSettingsVessel)
    .values({ ...data, orgId, vesselId })
    .returning();
  return created;
}

export async function deleteVesselSettings(orgId: string, vesselId: string): Promise<void> {
  await db
    .delete(alertSettingsVessel)
    .where(and(eq(alertSettingsVessel.orgId, orgId), eq(alertSettingsVessel.vesselId, vesselId)));
}
