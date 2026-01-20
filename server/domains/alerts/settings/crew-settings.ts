/**
 * Alert Settings - Crew Settings
 * Crew-specific alert configuration
 */

import { db } from '../../../db.js';
import { crewAlertSettings, type CrewAlertSettings, type InsertCrewAlertSettings } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function getCrewAlertSettings(orgId: string, vesselId?: string): Promise<CrewAlertSettings | undefined> {
  const conditions = [eq(crewAlertSettings.orgId, orgId)];
  if (vesselId) { conditions.push(eq(crewAlertSettings.vesselId, vesselId)); }
  else { conditions.push(sql`${crewAlertSettings.vesselId} IS NULL`); }

  const [result] = await db.select().from(crewAlertSettings).where(and(...conditions)).limit(1);
  return result;
}

export async function getAllCrewAlertSettings(orgId: string): Promise<CrewAlertSettings[]> {
  return db.select().from(crewAlertSettings).where(eq(crewAlertSettings.orgId, orgId));
}

export async function upsertCrewAlertSettings(orgId: string, vesselId: string | null, data: Partial<InsertCrewAlertSettings>): Promise<CrewAlertSettings> {
  const existing = await getCrewAlertSettings(orgId, vesselId || undefined);
  if (existing) {
    const [updated] = await db.update(crewAlertSettings).set({ ...data, updatedAt: new Date() }).where(eq(crewAlertSettings.id, existing.id)).returning();
    return updated;
  } 
    const [created] = await db.insert(crewAlertSettings).values({ ...data, orgId, vesselId }).returning();
    return created;
  
}

export async function deleteCrewAlertSettings(orgId: string, vesselId?: string): Promise<void> {
  const conditions = [eq(crewAlertSettings.orgId, orgId)];
  if (vesselId) { conditions.push(eq(crewAlertSettings.vesselId, vesselId)); }
  else { conditions.push(sql`${crewAlertSettings.vesselId} IS NULL`); }
  await db.delete(crewAlertSettings).where(and(...conditions));
}
