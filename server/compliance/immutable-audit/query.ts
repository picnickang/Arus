/**
 * Audit Query Operations
 *
 * Query and filter audit records from the immutable trail.
 */

import { db } from "../../db";
import { immutableAuditTrail } from "@shared/schema-runtime";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { parseJsonField, parseChangedFields } from "./hashing";
import type {
  AuditRecord,
  AuditQueryOptions,
  AuditEventCategory,
  AuditEventType,
  PerformerType,
} from "./types";

/**
 * Query audit records with filtering options
 */
export async function queryAuditEvents(options: AuditQueryOptions): Promise<AuditRecord[]> {
  const conditions = [eq(immutableAuditTrail.orgId, options.orgId)];

  if (options.startDate) {
    conditions.push(gte(immutableAuditTrail.eventTimestamp, options.startDate));
  }

  if (options.endDate) {
    conditions.push(lte(immutableAuditTrail.eventTimestamp, options.endDate));
  }

  if (options.entityType) {
    conditions.push(eq(immutableAuditTrail.entityType, options.entityType));
  }

  if (options.entityId) {
    conditions.push(eq(immutableAuditTrail.entityId, options.entityId));
  }

  if (options.eventCategory) {
    conditions.push(eq(immutableAuditTrail.eventCategory, options.eventCategory));
  }

  if (options.eventType) {
    conditions.push(eq(immutableAuditTrail.eventType, options.eventType));
  }

  if (options.performedBy) {
    conditions.push(eq(immutableAuditTrail.performedBy, options.performedBy));
  }

  if (options.vesselId) {
    conditions.push(eq(immutableAuditTrail.vesselId, options.vesselId));
  }

  const query = db
    .select()
    .from(immutableAuditTrail)
    .where(and(...conditions))
    .orderBy(sql`${immutableAuditTrail.eventTimestamp} DESC`)
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0);

  const results = await query;

  return ((results as unknown[]).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      ...r,
      eventCategory: r.eventCategory as AuditEventCategory,
      eventType: r.eventType as AuditEventType,
      performedByType: (r.performedByType ?? "user") as PerformerType,
      previousState: parseJsonField(r.previousState),
      newState: parseJsonField(r.newState),
      changedFields: parseChangedFields(r.changedFields),
      metadata: parseJsonField(r.metadata),
      retentionRequired: r.retentionRequired ?? true,
    };
  })) as object as AuditRecord[];
}
