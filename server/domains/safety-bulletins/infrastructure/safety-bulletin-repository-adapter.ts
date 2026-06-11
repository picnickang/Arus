/**
 * Safety Bulletin Infrastructure - Repository Adapter
 * Implements ISafetyBulletinRepository using Drizzle ORM (cloud/PostgreSQL).
 */

import type { ISafetyBulletinRepository } from "../domain/ports";
import type {
  SafetyBulletinEntity,
  CreateSafetyBulletinCommand,
  ListSafetyBulletinsFilters,
} from "../domain/types";
import { db } from "../../../db";
import {
  safetyBulletins,
  type SafetyBulletin,
  type InsertSafetyBulletin,
} from "@shared/schema-runtime";
import { and, desc, eq, gt, isNull, lte, or, type SQL } from "drizzle-orm";

export class SafetyBulletinRepositoryAdapter implements ISafetyBulletinRepository {
  async findAll(
    orgId: string,
    filters?: ListSafetyBulletinsFilters
  ): Promise<SafetyBulletinEntity[]> {
    const conditions: SQL[] = [eq(safetyBulletins.orgId, orgId)];

    if (filters?.activeOnly) {
      const now = new Date();
      conditions.push(eq(safetyBulletins.active, true));
      // Hide future-dated notices and ones that have already expired.
      conditions.push(lte(safetyBulletins.effectiveDate, now));
      const notExpired = or(isNull(safetyBulletins.expiresAt), gt(safetyBulletins.expiresAt, now));
      if (notExpired) {
        conditions.push(notExpired);
      }
    }

    // Vessel-scoped reads also include fleet-wide bulletins (null vesselId).
    if (filters?.vesselId) {
      const vesselScope = or(
        eq(safetyBulletins.vesselId, filters.vesselId),
        isNull(safetyBulletins.vesselId)
      );
      if (vesselScope) {
        conditions.push(vesselScope);
      }
    }

    const rows = await db
      .select()
      .from(safetyBulletins)
      .where(and(...conditions))
      .orderBy(desc(safetyBulletins.effectiveDate));

    return rows.map((row) => this.mapToEntity(row));
  }

  async create(command: CreateSafetyBulletinCommand): Promise<SafetyBulletinEntity> {
    const insertValues: InsertSafetyBulletin = {
      orgId: command.orgId,
      vesselId: command.vesselId ?? null,
      title: command.title,
      body: command.body ?? null,
      severity: command.severity ?? "info",
      category: command.category ?? "general",
      reference: command.reference ?? null,
      effectiveDate: command.effectiveDate ? new Date(command.effectiveDate) : new Date(),
      expiresAt: command.expiresAt ? new Date(command.expiresAt) : null,
      createdBy: command.createdBy ?? null,
    };

    const [created] = await db.insert(safetyBulletins).values(insertValues).returning();
    if (!created) {
      throw new Error("SafetyBulletinRepository.create: insert returned no row");
    }
    return this.mapToEntity(created);
  }

  private mapToEntity(row: SafetyBulletin): SafetyBulletinEntity {
    return {
      id: row.id,
      orgId: row.orgId,
      vesselId: row.vesselId,
      title: row.title,
      body: row.body,
      severity: row.severity,
      category: row.category,
      reference: row.reference,
      active: row.active,
      effectiveDate: row.effectiveDate,
      expiresAt: row.expiresAt,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const safetyBulletinRepository = new SafetyBulletinRepositoryAdapter();
