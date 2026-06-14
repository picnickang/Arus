/**
 * Certificate Infrastructure - Repository Adapter
 * Implements ICertificateRepository using Drizzle ORM
 */

import type { ICertificateRepository, ICertificateEventRepository } from "../domain/ports";
import type {
  CertificateEntity,
  CreateCertificateCommand,
  UpdateCertificateCommand,
  CertificateEventEntity,
  CertificateSummary,
  ConditionOfClass,
  FlagStateEndorsement,
} from "../domain/types";
import { db } from "../../../db";
import {
  vesselCertificates,
  certificateEvents,
  vessels,
  type VesselCertificate,
  type InsertVesselCertificate,
} from "@shared/schema";
import { eq, and, lte, gte, desc } from "drizzle-orm";

export class CertificateRepositoryAdapter implements ICertificateRepository {
  async findAll(
    orgId: string,
    filters?: {
      vesselId?: string;
      type?: string;
      status?: string;
    }
  ) {
    const conditions = [eq(vesselCertificates.orgId, orgId)];
    if (filters?.vesselId) {
      conditions.push(eq(vesselCertificates.vesselId, filters.vesselId));
    }
    if (filters?.type) {
      conditions.push(eq(vesselCertificates.certificateType, filters.type));
    }
    if (filters?.status) {
      conditions.push(eq(vesselCertificates.status, filters.status));
    }

    const rows = await db
      .select({
        cert: vesselCertificates,
        vesselName: vessels.name,
      })
      .from(vesselCertificates)
      .leftJoin(vessels, eq(vesselCertificates.vesselId, vessels.id))
      .where(and(...conditions))
      .orderBy(vesselCertificates.expiryDate);

    return rows.map(({ cert, vesselName }) => ({
      ...this.mapToEntity(cert),
      vesselName: vesselName ?? undefined,
    }));
  }

  async findById(id: string, orgId: string) {
    const [row] = await db
      .select({
        cert: vesselCertificates,
        vesselName: vessels.name,
      })
      .from(vesselCertificates)
      .leftJoin(vessels, eq(vesselCertificates.vesselId, vessels.id))
      .where(and(eq(vesselCertificates.id, id), eq(vesselCertificates.orgId, orgId)))
      .limit(1);

    if (!row) {
      return undefined;
    }

    return {
      ...this.mapToEntity(row.cert),
      vesselName: row.vesselName ?? undefined,
    };
  }

  async findExpiring(orgId: string, days: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    const rows = await db
      .select({
        cert: vesselCertificates,
        vesselName: vessels.name,
      })
      .from(vesselCertificates)
      .leftJoin(vessels, eq(vesselCertificates.vesselId, vessels.id))
      .where(
        and(
          eq(vesselCertificates.orgId, orgId),
          eq(vesselCertificates.status, "valid"),
          gte(vesselCertificates.expiryDate, new Date()),
          lte(vesselCertificates.expiryDate, cutoffDate)
        )
      )
      .orderBy(vesselCertificates.expiryDate);

    return rows.map(({ cert, vesselName }) => ({
      ...this.mapToEntity(cert),
      vesselName: vesselName ?? undefined,
      daysUntilExpiry: cert.expiryDate
        ? Math.ceil((new Date(cert.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : null,
    }));
  }

  async getSummary(orgId: string, vesselId?: string): Promise<CertificateSummary> {
    const conditions = [eq(vesselCertificates.orgId, orgId)];
    if (vesselId) {
      conditions.push(eq(vesselCertificates.vesselId, vesselId));
    }

    const certs = await db
      .select()
      .from(vesselCertificates)
      .where(and(...conditions));

    const now = new Date();
    // Compare against start-of-day, not the current instant. expiryDate is a
    // DATE (stored at midnight), so a cert expiring TODAY would otherwise read
    // as already-expired (midnight < now) AND be excluded from "expiring soon"
    // (midnight >= now is false) — a cert valid through today got
    // double-misclassified. It is expired only once today has passed it.
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const thirtyDays = new Date(startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDays = new Date(startOfToday.getTime() + 90 * 24 * 60 * 60 * 1000);

    const expired = certs.filter(
      (c) =>
        c.status === "expired" ||
        (c.expiryDate && new Date(c.expiryDate) < startOfToday && c.status === "valid")
    );
    const expiringIn30 = certs.filter(
      (c) =>
        c.status === "valid" &&
        c.expiryDate &&
        new Date(c.expiryDate) >= startOfToday &&
        new Date(c.expiryDate) <= thirtyDays
    );
    const expiringIn90 = certs.filter(
      (c) =>
        c.status === "valid" &&
        c.expiryDate &&
        new Date(c.expiryDate) >= startOfToday &&
        new Date(c.expiryDate) <= ninetyDays
    );
    const surveysDue = certs.filter(
      (c) => c.nextSurveyDue && new Date(c.nextSurveyDue) <= ninetyDays && c.status === "valid"
    );

    let openConditions = 0;
    for (const cert of certs) {
      const coc = Array.isArray(cert.conditionsOfClass)
        ? (cert.conditionsOfClass as ConditionOfClass[])
        : [];
      openConditions += coc.filter((c) => c.status === "open" || c.status === "overdue").length;
    }

    return {
      totalCertificates: certs.length,
      valid: certs.filter((c) => c.status === "valid").length,
      expired: expired.length,
      suspended: certs.filter((c) => c.status === "suspended").length,
      pendingRenewal: certs.filter((c) => c.status === "pending_renewal").length,
      expiringIn30Days: expiringIn30.length,
      expiringIn90Days: expiringIn90.length,
      surveysDueIn90Days: surveysDue.length,
      openConditionsOfClass: openConditions,
      expiredCertificates: expired.map((c) => ({
        id: c.id,
        certificateName: c.certificateName,
        certificateType: c.certificateType,
        expiryDate: c.expiryDate,
        vesselId: c.vesselId,
      })),
    };
  }

  async create(command: CreateCertificateCommand): Promise<CertificateEntity> {
    const insertValues: InsertVesselCertificate = {
      orgId: command.orgId,
      vesselId: command.vesselId,
      certificateType: command.certificateType,
      certificateName: command.certificateName,
      certificateNumber: command.certificateNumber ?? null,
      issuingAuthority: command.issuingAuthority,
      issuingAuthorityType: command.issuingAuthorityType ?? "class_society",
      issueDate: new Date(command.issueDate),
      expiryDate: command.expiryDate ? new Date(command.expiryDate) : null,
      nextSurveyDue: command.nextSurveyDue ? new Date(command.nextSurveyDue) : null,
      surveyWindowStart: command.surveyWindowStart ? new Date(command.surveyWindowStart) : null,
      surveyWindowEnd: command.surveyWindowEnd ? new Date(command.surveyWindowEnd) : null,
      equipmentId: command.equipmentId ?? null,
      surveyId: command.surveyId ?? null,
      notes: command.notes ?? null,
      documentUrl: command.documentUrl ?? null,
      status: "valid",
    };

    const [cert] = await db.insert(vesselCertificates).values(insertValues).returning();
    if (!cert) {
      throw new Error("CertificateRepository.create: insert returned no row");
    }
    return this.mapToEntity(cert);
  }

  async update(id: string, orgId: string, updates: UpdateCertificateCommand, updatedBy?: string) {
    const updateValues: Partial<VesselCertificate> = {
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    };

    if (updates.status !== undefined) {
      updateValues.status = updates.status;
    }
    if (updates.certificateNumber !== undefined) {
      updateValues.certificateNumber = updates.certificateNumber;
    }
    if (updates.expiryDate !== undefined) {
      updateValues.expiryDate = updates.expiryDate ? new Date(updates.expiryDate) : null;
    }
    if (updates.nextSurveyDue !== undefined) {
      updateValues.nextSurveyDue = updates.nextSurveyDue ? new Date(updates.nextSurveyDue) : null;
    }
    if (updates.lastSurveyDate !== undefined) {
      updateValues.lastSurveyDate = new Date(updates.lastSurveyDate);
    }
    if (updates.surveyWindowStart !== undefined) {
      updateValues.surveyWindowStart = updates.surveyWindowStart
        ? new Date(updates.surveyWindowStart)
        : null;
    }
    if (updates.surveyWindowEnd !== undefined) {
      updateValues.surveyWindowEnd = updates.surveyWindowEnd
        ? new Date(updates.surveyWindowEnd)
        : null;
    }
    if (updates.surveyId !== undefined) {
      updateValues.surveyId = updates.surveyId;
    }
    if (updates.notes !== undefined) {
      updateValues.notes = updates.notes;
    }
    if (updates.documentUrl !== undefined) {
      updateValues.documentUrl = updates.documentUrl;
    }

    const [updated] = await db
      .update(vesselCertificates)
      .set(updateValues)
      .where(and(eq(vesselCertificates.id, id), eq(vesselCertificates.orgId, orgId)))
      .returning();

    return updated ? this.mapToEntity(updated) : undefined;
  }

  async delete(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(vesselCertificates)
      .where(and(eq(vesselCertificates.id, id), eq(vesselCertificates.orgId, orgId)))
      .returning({ id: vesselCertificates.id });

    return result.length > 0;
  }

  async updateConditions(id: string, orgId: string, conditions: ConditionOfClass[]) {
    const [updated] = await db
      .update(vesselCertificates)
      .set({ conditionsOfClass: conditions, updatedAt: new Date() })
      .where(and(eq(vesselCertificates.id, id), eq(vesselCertificates.orgId, orgId)))
      .returning();

    return updated ? this.mapToEntity(updated) : undefined;
  }

  async updateEndorsements(id: string, orgId: string, endorsements: FlagStateEndorsement[]) {
    const [updated] = await db
      .update(vesselCertificates)
      .set({ endorsements, updatedAt: new Date() })
      .where(and(eq(vesselCertificates.id, id), eq(vesselCertificates.orgId, orgId)))
      .returning();

    return updated ? this.mapToEntity(updated) : undefined;
  }

  private mapToEntity(row: VesselCertificate): CertificateEntity {
    return {
      id: row.id,
      orgId: row.orgId,
      vesselId: row.vesselId,
      certificateType: row.certificateType,
      certificateNumber: row.certificateNumber,
      certificateName: row.certificateName,
      issuingAuthority: row.issuingAuthority,
      issuingAuthorityType: row.issuingAuthorityType,
      issueDate: row.issueDate,
      expiryDate: row.expiryDate,
      lastSurveyDate: row.lastSurveyDate,
      nextSurveyDue: row.nextSurveyDue,
      surveyWindowStart: row.surveyWindowStart,
      surveyWindowEnd: row.surveyWindowEnd,
      status: row.status as CertificateEntity["status"],
      conditionsOfClass: Array.isArray(row.conditionsOfClass)
        ? (row.conditionsOfClass as ConditionOfClass[])
        : [],
      endorsements: Array.isArray(row.endorsements)
        ? (row.endorsements as FlagStateEndorsement[])
        : [],
      surveyId: row.surveyId,
      equipmentId: row.equipmentId,
      documentUrl: row.documentUrl,
      notes: row.notes,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export class CertificateEventRepositoryAdapter implements ICertificateEventRepository {
  async findByCertificateId(
    certificateId: string,
    orgId?: string
  ): Promise<CertificateEventEntity[]> {
    const conditions = [eq(certificateEvents.certificateId, certificateId)];
    if (orgId) {
      conditions.push(eq(certificateEvents.orgId, orgId));
    }

    const events = await db
      .select()
      .from(certificateEvents)
      .where(and(...conditions))
      .orderBy(desc(certificateEvents.createdAt));

    return events.map((e) => ({
      id: e.id,
      orgId: e.orgId,
      certificateId: e.certificateId,
      eventType: e.eventType,
      userId: e.userId,
      details: e.details,
      createdAt: e.createdAt,
    }));
  }

  async create(event: {
    orgId: string;
    certificateId: string;
    eventType: string;
    userId?: string;
    details?: unknown;
  }): Promise<CertificateEventEntity> {
    const [created] = await db
      .insert(certificateEvents)
      .values({
        orgId: event.orgId,
        certificateId: event.certificateId,
        eventType: event.eventType,
        userId: event.userId ?? null,
        details: event.details ?? null,
      })
      .returning();
    if (!created) {
      throw new Error("CertificateEventRepository.create: insert returned no row");
    }
    return {
      id: created.id,
      orgId: created.orgId,
      certificateId: created.certificateId,
      eventType: created.eventType,
      userId: created.userId,
      details: created.details,
      createdAt: created.createdAt,
    };
  }
}

export const certificateRepository = new CertificateRepositoryAdapter();
export const certificateEventRepository = new CertificateEventRepositoryAdapter();
