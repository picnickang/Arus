/**
 * System Admin - Database Storage Audit & Sessions
 */

import { eq, and, lt, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { adminAuditEvents, adminSessions } from "@shared/schema-runtime";
import type {
  AdminAuditEvent,
  InsertAdminAuditEvent,
  AdminSession,
  InsertAdminSession,
} from "@shared/schema";

/**
 * P2 #34 — Bounded pagination for admin audit reads. Every audit
 * read endpoint historically returned `SELECT * ORDER BY createdAt
 * DESC` with no defensive cap; an orgId with many years of audit
 * history could blow the API response, the WAL, and the JSON
 * serializer in one request. We enforce a hard ceiling on `limit`
 * (DEFAULT_AUDIT_PAGE_SIZE if unset, MAX_AUDIT_PAGE_SIZE otherwise)
 * and accept an offset for cursor-style paging.
 */
const DEFAULT_AUDIT_PAGE_SIZE = 100;
const MAX_AUDIT_PAGE_SIZE = 1000;

export interface AuditPagination {
  limit?: number | undefined;
  offset?: number | undefined;
}

function normalizePagination(p: AuditPagination | undefined): {
  limit: number;
  offset: number;
} {
  const rawLimit = p?.limit;
  const rawOffset = p?.offset;
  const limit =
    typeof rawLimit === "number" && Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_AUDIT_PAGE_SIZE)
      : DEFAULT_AUDIT_PAGE_SIZE;
  const offset =
    typeof rawOffset === "number" && Number.isFinite(rawOffset) && rawOffset >= 0
      ? Math.floor(rawOffset)
      : 0;
  return { limit, offset };
}

export class DbAuditStorage {
  /** Exposed for tests and route input validation. */
  static readonly DEFAULT_PAGE_SIZE = DEFAULT_AUDIT_PAGE_SIZE;
  static readonly MAX_PAGE_SIZE = MAX_AUDIT_PAGE_SIZE;

  async getAdminAuditEvents(
    orgId?: string,
    action?: string,
    limit?: number,
    offset?: number
  ): Promise<AdminAuditEvent[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(adminAuditEvents.orgId, orgId));
    }
    if (action) {
      conditions.push(eq(adminAuditEvents.action, action));
    }
    let query = db.select().from(adminAuditEvents).$dynamic();
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    query = query.orderBy(sql`${adminAuditEvents.createdAt} DESC`);
    const page = normalizePagination({ limit, offset });
    query = query.limit(page.limit).offset(page.offset);
    return query;
  }
  async createAdminAuditEvent(event: InsertAdminAuditEvent): Promise<AdminAuditEvent> {
    const [n] = await db
      .insert(adminAuditEvents)
      .values({ ...event, createdAt: new Date() })
      .returning();
    if (!n) {
      throw new Error("Failed to create admin audit event");
    }
    return n;
  }
  async updateAdminAuditEvent(
    id: string,
    updates: Partial<Pick<AdminAuditEvent, "outcome" | "severity" | "details">>
  ): Promise<AdminAuditEvent> {
    const [updated] = await db
      .update(adminAuditEvents)
      .set(updates)
      .where(eq(adminAuditEvents.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Admin audit event ${id} not found`);
    }
    return updated;
  }
  async getAuditEventsByUser(
    userId: string,
    orgId?: string,
    pagination?: AuditPagination
  ): Promise<AdminAuditEvent[]> {
    const conditions = [eq(adminAuditEvents.userId, userId)];
    if (orgId) {
      conditions.push(eq(adminAuditEvents.orgId, orgId));
    }
    const page = normalizePagination(pagination);
    return db
      .select()
      .from(adminAuditEvents)
      .where(and(...conditions))
      .orderBy(sql`${adminAuditEvents.createdAt} DESC`)
      .limit(page.limit)
      .offset(page.offset);
  }
  async getAuditEventsByResource(
    resourceType: string,
    resourceId: string,
    orgId?: string,
    pagination?: AuditPagination
  ): Promise<AdminAuditEvent[]> {
    const conditions = [
      eq(adminAuditEvents.resourceType, resourceType),
      eq(adminAuditEvents.resourceId, resourceId),
    ];
    if (orgId) {
      conditions.push(eq(adminAuditEvents.orgId, orgId));
    }
    const page = normalizePagination(pagination);
    return db
      .select()
      .from(adminAuditEvents)
      .where(and(...conditions))
      .orderBy(sql`${adminAuditEvents.createdAt} DESC`)
      .limit(page.limit)
      .offset(page.offset);
  }

  async createAdminSession(session: InsertAdminSession): Promise<AdminSession> {
    const [n] = await db.insert(adminSessions).values(session).returning();
    if (!n) {
      throw new Error("Failed to create admin session");
    }
    return n;
  }
  async getAdminSession(sessionToken: string): Promise<AdminSession | undefined> {
    const [result] = await db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.sessionToken, sessionToken));
    return result;
  }
  async getAdminSessionByToken(tokenHash: string): Promise<AdminSession | undefined> {
    const [result] = await db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.sessionToken, tokenHash));
    return result;
  }
  async updateAdminSessionActivity(sessionId: string): Promise<void> {
    await db
      .update(adminSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(adminSessions.id, sessionId));
  }
  async invalidateAllAdminSessions(): Promise<void> {
    await db.delete(adminSessions);
  }
  async cleanupExpiredSessions(): Promise<number> {
    const result = await db
      .delete(adminSessions)
      .where(lt(adminSessions.expiresAt, new Date()))
      .returning();
    return result.length;
  }
}
