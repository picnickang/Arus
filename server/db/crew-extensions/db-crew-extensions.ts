import type { WidenPartial } from "../../lib/widen-partial";
/**
 * Crew Extensions - Database Storage
 */

import { eq, and, lte, asc, isNull, count } from "drizzle-orm";
import { db } from "../../db";
import {
  crew,
  crewCertification,
  crewDocuments,
  crewNotificationSettings,
  crewAlerts,
  crewRoles,
  portCall,
  drydockWindow,
  type SelectCrewCertification,
  type InsertCrewCertification,
  type SelectCrewDocument,
  type InsertCrewDocument,
  type CrewNotificationSettings,
  type SelectCrewAlert,
  type InsertCrewAlert,
  type SelectCrewRole,
  type InsertCrewRole,
  type PortCall as SelectPortCall,
  type InsertPortCall,
  type DrydockWindow as SelectDrydockWindow,
  type InsertDrydockWindow,
} from "@shared/schema";
import type { AlertScanResult, NotificationSettingsData } from "./types.js";

/**
 * Default crew roles seeded (idempotently) for an org on first read. Mirrors the
 * legacy frontend MARITIME_RANKS list + its category mapping + group order so
 * existing crew group exactly as they did before roles became data-driven.
 */
export const DEFAULT_CREW_ROLES: { name: string; category: string }[] = [
  { name: "Captain", category: "Captains" },
  { name: "Chief Officer", category: "Officers" },
  { name: "Second Officer", category: "Officers" },
  { name: "Third Officer", category: "Officers" },
  { name: "Chief Engineer", category: "Engineering" },
  { name: "Second Engineer", category: "Engineering" },
  { name: "Third Engineer", category: "Engineering" },
  { name: "Fourth Engineer", category: "Engineering" },
  { name: "Bosun", category: "Deck Crew" },
  { name: "Able Seaman", category: "Deck Crew" },
  { name: "Ordinary Seaman", category: "Deck Crew" },
  { name: "Chief Cook", category: "Catering" },
  { name: "Engine Fitter", category: "Engineering" },
  { name: "Oiler", category: "Engineering" },
  { name: "Wiper", category: "Engineering" },
];

export class DbCrewExtensionsStorage {
  async getCrewCertifications(crewId?: string): Promise<SelectCrewCertification[]> {
    let q = db.select().from(crewCertification).$dynamic();
    if (crewId) {
      q = q.where(eq(crewCertification.crewId, crewId));
    }
    return q.orderBy(crewCertification.expiresAt);
  }
  async createCrewCertification(cert: InsertCrewCertification): Promise<SelectCrewCertification> {
    const [n] = await db.insert(crewCertification).values(cert).returning();
    if (!n) {throw new Error("createCrewCertification: insert returned no row");}
    return n;
  }
  async updateCrewCertification(
    id: string,
    cert: WidenPartial<InsertCrewCertification>
  ): Promise<SelectCrewCertification> {
    const [u] = await db
      .update(crewCertification)
      .set(cert)
      .where(eq(crewCertification.id, id))
      .returning();
    if (!u) {
      throw new Error(`Crew certification ${id} not found`);
    }
    return u;
  }
  async deleteCrewCertification(id: string): Promise<void> {
    const r = await db.delete(crewCertification).where(eq(crewCertification.id, id));
    if (r.rowCount === 0) {
      throw new Error(`Crew certification ${id} not found`);
    }
  }
  async getCertificationsExpiring(
    orgId: string,
    daysAhead: number = 90,
    includeAcknowledged: boolean = false
  ): Promise<SelectCrewCertification[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const c = [eq(crewCertification.orgId, orgId), lte(crewCertification.expiresAt, futureDate)];
    if (!includeAcknowledged) {
      c.push(isNull(crewCertification.alertAcknowledgedAt));
    }
    return db
      .select()
      .from(crewCertification)
      .where(and(...c))
      .orderBy(asc(crewCertification.expiresAt));
  }
  async acknowledgeCertificationAlert(
    certId: string,
    userId?: string,
    notes?: string
  ): Promise<SelectCrewCertification> {
    const [u] = await db
      .update(crewCertification)
      .set({
        alertAcknowledged: true,
        alertAcknowledgedAt: new Date(),
        alertAcknowledgedBy: userId || null,
        alertAcknowledgedNotes: notes || null,
      })
      .where(eq(crewCertification.id, certId))
      .returning();
    if (!u) {
      throw new Error(`Crew certification ${certId} not found`);
    }
    return u;
  }
  async updateCertificationAlertFlags(orgId: string): Promise<AlertScanResult> {
    const now = new Date();
    const date30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const date60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const date90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const allCerts = await db
      .select()
      .from(crewCertification)
      .where(and(eq(crewCertification.orgId, orgId), lte(crewCertification.expiresAt, date90)));
    let flagged = 0,
      critical = 0,
      warning = 0,
      notice = 0;
    for (const cert of allCerts) {
      const expiryDate = new Date(cert.expiresAt!);
      const needsUpdate: WidenPartial<InsertCrewCertification> = { alertLastScannedAt: now };
      let needsFlag = false;
      if (expiryDate <= date90 && !cert.alertSent90) {
        needsUpdate.alertSent = true;
        needsUpdate.alertSent90 = true;
        needsFlag = true;
        notice++;
      }
      if (expiryDate <= date60 && !cert.alertSent60) {
        needsUpdate.alertSent = true;
        needsUpdate.alertSent60 = true;
        needsFlag = true;
        warning++;
      }
      if (expiryDate <= date30 && !cert.alertSent30) {
        needsUpdate.alertSent = true;
        needsUpdate.alertSent30 = true;
        needsFlag = true;
        critical++;
      }
      if (needsFlag) {
        await db
          .update(crewCertification)
          .set(needsUpdate)
          .where(eq(crewCertification.id, cert.id));
        flagged++;
      }
    }
    return { scanned: allCerts.length, flagged, critical, warning, notice };
  }

  async getCrewDocuments(crewId: string): Promise<SelectCrewDocument[]> {
    return db.select().from(crewDocuments).where(eq(crewDocuments.crewId, crewId));
  }
  async getCrewDocumentById(id: string): Promise<SelectCrewDocument | undefined> {
    const [doc] = await db.select().from(crewDocuments).where(eq(crewDocuments.id, id));
    return doc;
  }
  async createCrewDocument(doc: InsertCrewDocument): Promise<SelectCrewDocument> {
    const [n] = await db.insert(crewDocuments).values(doc).returning();
    if (!n) {throw new Error("createCrewDocument: insert returned no row");}
    return n;
  }
  async updateCrewDocument(
    id: string,
    doc: WidenPartial<InsertCrewDocument>
  ): Promise<SelectCrewDocument> {
    const [u] = await db
      .update(crewDocuments)
      .set({ ...doc, updatedAt: new Date() })
      .where(eq(crewDocuments.id, id))
      .returning();
    if (!u) {
      throw new Error(`Crew document ${id} not found`);
    }
    return u;
  }
  async deleteCrewDocument(id: string): Promise<void> {
    const r = await db.delete(crewDocuments).where(eq(crewDocuments.id, id));
    if (r.rowCount === 0) {
      throw new Error(`Crew document ${id} not found`);
    }
  }
  async getDocumentsExpiring(
    orgId: string,
    daysAhead: number = 90,
    includeAcknowledged: boolean = false
  ): Promise<SelectCrewDocument[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const c = [eq(crewDocuments.orgId, orgId), lte(crewDocuments.expiresAt, futureDate)];
    if (!includeAcknowledged) {
      c.push(isNull(crewDocuments.alertAcknowledgedAt));
    }
    return db
      .select()
      .from(crewDocuments)
      .where(and(...c))
      .orderBy(asc(crewDocuments.expiresAt));
  }
  async getCrewDocumentTypesByOrg(
    orgId: string
  ): Promise<{ crewId: string; documentType: string; expiresAt: Date | null }[]> {
    return db
      .select({
        crewId: crewDocuments.crewId,
        documentType: crewDocuments.documentType,
        expiresAt: crewDocuments.expiresAt,
      })
      .from(crewDocuments)
      .where(eq(crewDocuments.orgId, orgId));
  }
  async acknowledgeDocumentAlert(
    docId: string,
    userId?: string,
    notes?: string
  ): Promise<SelectCrewDocument> {
    const [u] = await db
      .update(crewDocuments)
      .set({
        alertAcknowledged: true,
        alertAcknowledgedAt: new Date(),
        alertAcknowledgedBy: userId || null,
        alertAcknowledgedNotes: notes || null,
      })
      .where(eq(crewDocuments.id, docId))
      .returning();
    if (!u) {
      throw new Error(`Crew document ${docId} not found`);
    }
    return u;
  }
  async updateDocumentAlertFlags(orgId: string): Promise<AlertScanResult> {
    const now = new Date();
    const date30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const date60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const date90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const allDocs = await db
      .select()
      .from(crewDocuments)
      .where(and(eq(crewDocuments.orgId, orgId), lte(crewDocuments.expiresAt, date90)));
    let flagged = 0,
      critical = 0,
      warning = 0,
      notice = 0;
    for (const doc of allDocs) {
      if (!doc.expiresAt) {
        continue;
      }
      const expiryDate = new Date(doc.expiresAt);
      const needsUpdate: WidenPartial<InsertCrewDocument> = { alertLastScannedAt: now };
      let needsFlag = false;
      if (expiryDate <= date90 && !doc.alertSent90) {
        needsUpdate.alertSent = true;
        needsUpdate.alertSent90 = true;
        needsFlag = true;
        notice++;
      }
      if (expiryDate <= date60 && !doc.alertSent60) {
        needsUpdate.alertSent = true;
        needsUpdate.alertSent60 = true;
        needsFlag = true;
        warning++;
      }
      if (expiryDate <= date30 && !doc.alertSent30) {
        needsUpdate.alertSent = true;
        needsUpdate.alertSent30 = true;
        needsFlag = true;
        critical++;
      }
      if (needsFlag) {
        await db.update(crewDocuments).set(needsUpdate).where(eq(crewDocuments.id, doc.id));
        flagged++;
      }
    }
    return { scanned: allDocs.length, flagged, critical, warning, notice };
  }

  async getCrewNotificationSettings(
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
  async upsertCrewNotificationSettings(
    crewId: string,
    orgId: string,
    data: NotificationSettingsData
  ): Promise<CrewNotificationSettings> {
    const existing = await this.getCrewNotificationSettings(crewId, orgId);
    if (existing) {
      const [u] = await db
        .update(crewNotificationSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(crewNotificationSettings.id, existing.id))
        .returning();
      if (!u) {throw new Error("upsertCrewNotificationSettings: update returned no row");}
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
    if (!c) {throw new Error("upsertCrewNotificationSettings: insert returned no row");}
    return c;
  }
  async getAllCrewNotificationSettings(orgId: string): Promise<CrewNotificationSettings[]> {
    return db
      .select()
      .from(crewNotificationSettings)
      .where(eq(crewNotificationSettings.orgId, orgId));
  }

  // Manager-raised custom crew alerts
  async getCrewAlerts(crewId: string, orgId: string): Promise<SelectCrewAlert[]> {
    return db
      .select()
      .from(crewAlerts)
      .where(and(eq(crewAlerts.crewId, crewId), eq(crewAlerts.orgId, orgId)))
      .orderBy(asc(crewAlerts.acknowledged), asc(crewAlerts.createdAt));
  }
  async createCrewAlert(data: InsertCrewAlert): Promise<SelectCrewAlert> {
    const [n] = await db.insert(crewAlerts).values(data).returning();
    if (!n) {throw new Error("createCrewAlert: insert returned no row");}
    return n;
  }
  async acknowledgeCrewAlert(
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
  async deleteCrewAlert(alertId: string, orgId: string): Promise<void> {
    const r = await db
      .delete(crewAlerts)
      .where(and(eq(crewAlerts.id, alertId), eq(crewAlerts.orgId, orgId)));
    if (r.rowCount === 0) {
      throw new Error(`Crew alert ${alertId} not found`);
    }
  }

  // ---- Crew Roles (manageable positions backing crew.rank) ------------------
  private async ensureDefaultCrewRoles(orgId: string): Promise<void> {
    const existing = await db
      .select({ id: crewRoles.id })
      .from(crewRoles)
      .where(eq(crewRoles.orgId, orgId))
      .limit(1);
    if (existing.length > 0) {return;}
    const rows = DEFAULT_CREW_ROLES.map((r, i) => ({
      orgId,
      name: r.name,
      category: r.category,
      sortOrder: (i + 1) * 10,
      active: true,
    }));
    await db.insert(crewRoles).values(rows).onConflictDoNothing();
  }

  async getCrewRoles(orgId: string): Promise<SelectCrewRole[]> {
    await this.ensureDefaultCrewRoles(orgId);
    return db
      .select()
      .from(crewRoles)
      .where(eq(crewRoles.orgId, orgId))
      .orderBy(asc(crewRoles.sortOrder), asc(crewRoles.name));
  }

  async getCrewRoleById(id: string, orgId: string): Promise<SelectCrewRole | undefined> {
    const [row] = await db
      .select()
      .from(crewRoles)
      .where(and(eq(crewRoles.id, id), eq(crewRoles.orgId, orgId)));
    return row;
  }

  async createCrewRole(data: InsertCrewRole): Promise<SelectCrewRole> {
    const [n] = await db.insert(crewRoles).values(data).returning();
    if (!n) {throw new Error("createCrewRole: insert returned no row");}
    return n;
  }

  async updateCrewRole(
    id: string,
    orgId: string,
    data: Partial<InsertCrewRole>
  ): Promise<SelectCrewRole> {
    // crew.rank stores the role NAME (not an id), so a rename must propagate
    // to every crew row currently on the old name — otherwise existing crew
    // detach into uncategorized legacy text and the in-use delete guard
    // (which counts by name) stops seeing them. Do both writes atomically.
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(crewRoles)
        .where(and(eq(crewRoles.id, id), eq(crewRoles.orgId, orgId)));
      if (!current) {
        throw new Error(`Crew role ${id} not found`);
      }
      const [u] = await tx
        .update(crewRoles)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(crewRoles.id, id), eq(crewRoles.orgId, orgId)))
        .returning();
      if (!u) {
        throw new Error(`Crew role ${id} not found`);
      }
      if (data.name !== undefined && data.name !== current.name) {
        await tx
          .update(crew)
          .set({ rank: data.name })
          .where(and(eq(crew.orgId, orgId), eq(crew.rank, current.name)));
      }
      return u;
    });
  }

  async deleteCrewRole(id: string, orgId: string): Promise<void> {
    const r = await db
      .delete(crewRoles)
      .where(and(eq(crewRoles.id, id), eq(crewRoles.orgId, orgId)));
    if (r.rowCount === 0) {
      throw new Error(`Crew role ${id} not found`);
    }
  }

  async reorderCrewRoles(orgId: string, orderedIds: string[]): Promise<SelectCrewRole[]> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(crewRoles)
          .set({ sortOrder: (i + 1) * 10, updatedAt: new Date() })
          .where(and(eq(crewRoles.id, orderedIds[i]!), eq(crewRoles.orgId, orgId)));
      }
    });
    return db
      .select()
      .from(crewRoles)
      .where(eq(crewRoles.orgId, orgId))
      .orderBy(asc(crewRoles.sortOrder), asc(crewRoles.name));
  }

  async countCrewByRoleName(orgId: string, name: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(crew)
      .where(and(eq(crew.orgId, orgId), eq(crew.rank, name)));
    return Number(row?.value ?? 0);
  }

  async getPortCalls(vesselId?: string): Promise<SelectPortCall[]> {
    let q = db.select().from(portCall).$dynamic();
    if (vesselId) {
      q = q.where(eq(portCall.vesselId, vesselId));
    }
    return q.orderBy(portCall.start);
  }
  async createPortCall(portCallData: InsertPortCall): Promise<SelectPortCall> {
    const [n] = await db.insert(portCall).values(portCallData).returning();
    if (!n) {throw new Error("createPortCall: insert returned no row");}
    return n;
  }
  async updatePortCall(id: string, portCallData: WidenPartial<InsertPortCall>): Promise<SelectPortCall> {
    const [u] = await db.update(portCall).set(portCallData).where(eq(portCall.id, id)).returning();
    if (!u) {
      throw new Error(`Port call ${id} not found`);
    }
    return u;
  }
  async deletePortCall(id: string): Promise<void> {
    const r = await db.delete(portCall).where(eq(portCall.id, id));
    if (r.rowCount === 0) {
      throw new Error(`Port call ${id} not found`);
    }
  }

  async getDrydockWindows(vesselId?: string): Promise<SelectDrydockWindow[]> {
    let q = db.select().from(drydockWindow).$dynamic();
    if (vesselId) {
      q = q.where(eq(drydockWindow.vesselId, vesselId));
    }
    return q.orderBy(drydockWindow.start);
  }
  async createDrydockWindow(drydockData: InsertDrydockWindow): Promise<SelectDrydockWindow> {
    const [n] = await db.insert(drydockWindow).values(drydockData).returning();
    if (!n) {throw new Error("createDrydockWindow: insert returned no row");}
    return n;
  }
  async updateDrydockWindow(
    id: string,
    drydockData: WidenPartial<InsertDrydockWindow>
  ): Promise<SelectDrydockWindow> {
    const [u] = await db
      .update(drydockWindow)
      .set(drydockData)
      .where(eq(drydockWindow.id, id))
      .returning();
    if (!u) {
      throw new Error(`Drydock window ${id} not found`);
    }
    return u;
  }
  async deleteDrydockWindow(id: string): Promise<void> {
    const r = await db.delete(drydockWindow).where(eq(drydockWindow.id, id));
    if (r.rowCount === 0) {
      throw new Error(`Drydock window ${id} not found`);
    }
  }
}
