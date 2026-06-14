import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  crewAlerts,
  crewNotificationSettings,
  type CrewNotificationSettings,
  type InsertCrewAlert,
  type SelectCrewAlert,
} from "@shared/schema-runtime";
import type { NotificationSettingsData } from "./types.js";

export async function getCrewNotificationSettings(
  crewId: string,
  orgId: string
): Promise<CrewNotificationSettings | undefined> {
  const [s] = await db
    .select()
    .from(crewNotificationSettings)
    .where(
      and(eq(crewNotificationSettings.crewId, crewId), eq(crewNotificationSettings.orgId, orgId))
    );
  return s;
}

export async function upsertCrewNotificationSettings(
  crewId: string,
  orgId: string,
  data: NotificationSettingsData
): Promise<CrewNotificationSettings> {
  const existing = await getCrewNotificationSettings(crewId, orgId);
  if (existing) {
    const [u] = await db
      .update(crewNotificationSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewNotificationSettings.id, existing.id))
      .returning();
    if (!u) {
      throw new Error("upsertCrewNotificationSettings: update returned no row");
    }
    return u;
  }
  const [c] = await db
    .insert(crewNotificationSettings)
    .values({
      crewId,
      orgId,
      emailAlertsEnabled: data.emailAlertsEnabled ?? true,
      certExpiryEmailEnabled: data.certExpiryEmailEnabled ?? true,
      documentExpiryEmailEnabled: data.documentExpiryEmailEnabled ?? true,
      complianceEmailEnabled: data.complianceEmailEnabled ?? true,
      overrideEmail: data.overrideEmail,
    })
    .returning();
  if (!c) {
    throw new Error("upsertCrewNotificationSettings: insert returned no row");
  }
  return c;
}

export async function getAllCrewNotificationSettings(
  orgId: string
): Promise<CrewNotificationSettings[]> {
  return db
    .select()
    .from(crewNotificationSettings)
    .where(eq(crewNotificationSettings.orgId, orgId));
}

export async function getCrewAlerts(crewId: string, orgId: string): Promise<SelectCrewAlert[]> {
  return db
    .select()
    .from(crewAlerts)
    .where(and(eq(crewAlerts.crewId, crewId), eq(crewAlerts.orgId, orgId)))
    .orderBy(asc(crewAlerts.acknowledged), asc(crewAlerts.createdAt));
}

export async function createCrewAlert(data: InsertCrewAlert): Promise<SelectCrewAlert> {
  const [n] = await db.insert(crewAlerts).values(data).returning();
  if (!n) {
    throw new Error("createCrewAlert: insert returned no row");
  }
  return n;
}

export async function acknowledgeCrewAlert(
  alertId: string,
  orgId: string,
  userId?: string,
  notes?: string
): Promise<SelectCrewAlert> {
  const [u] = await db
    .update(crewAlerts)
    .set({
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy: userId || null,
      acknowledgedNotes: notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(crewAlerts.id, alertId), eq(crewAlerts.orgId, orgId)))
    .returning();
  if (!u) {
    throw new Error(`Crew alert ${alertId} not found`);
  }
  return u;
}

export async function deleteCrewAlert(alertId: string, orgId: string): Promise<void> {
  const r = await db
    .delete(crewAlerts)
    .where(and(eq(crewAlerts.id, alertId), eq(crewAlerts.orgId, orgId)));
  if (r.rowCount === 0) {
    throw new Error(`Crew alert ${alertId} not found`);
  }
}
