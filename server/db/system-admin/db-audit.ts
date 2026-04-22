/**
 * System Admin - Database Storage Audit & Sessions
 */

import { eq, and, lt, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { adminAuditEvents, adminSessions } from "@shared/schema-runtime";
import type { AdminAuditEvent, InsertAdminAuditEvent, AdminSession, InsertAdminSession } from "@shared/schema";

export class DbAuditStorage {
  async getAdminAuditEvents(orgId?: string, action?: string, limit?: number): Promise<AdminAuditEvent[]> { const conditions = []; if (orgId) {conditions.push(eq(adminAuditEvents.orgId, orgId));} if (action) {conditions.push(eq(adminAuditEvents.action, action));} let query = db.select().from(adminAuditEvents); if (conditions.length > 0) {query = query.where(and(...conditions));} query = query.orderBy(sql`${adminAuditEvents.timestamp} DESC`); if (limit) {query = query.limit(limit);} return query; }
  async createAdminAuditEvent(event: InsertAdminAuditEvent): Promise<AdminAuditEvent> { const [n] = await db.insert(adminAuditEvents).values({ ...event, timestamp: new Date() }).returning(); return n; }
  async updateAdminAuditEvent(id: string, updates: Partial<Pick<AdminAuditEvent, "outcome" | "severity" | "details">>): Promise<AdminAuditEvent> { const [updated] = await db.update(adminAuditEvents).set(updates).where(eq(adminAuditEvents.id, id)).returning(); if (!updated) {throw new Error(`Admin audit event ${id} not found`);} return updated; }
  async getAuditEventsByUser(userId: string, orgId?: string): Promise<AdminAuditEvent[]> { const conditions = [eq(adminAuditEvents.userId, userId)]; if (orgId) {conditions.push(eq(adminAuditEvents.orgId, orgId));} return db.select().from(adminAuditEvents).where(and(...conditions)).orderBy(sql`${adminAuditEvents.timestamp} DESC`); }
  async getAuditEventsByResource(resourceType: string, resourceId: string, orgId?: string): Promise<AdminAuditEvent[]> { const conditions = [eq(adminAuditEvents.resourceType, resourceType), eq(adminAuditEvents.resourceId, resourceId)]; if (orgId) {conditions.push(eq(adminAuditEvents.orgId, orgId));} return db.select().from(adminAuditEvents).where(and(...conditions)).orderBy(sql`${adminAuditEvents.timestamp} DESC`); }

  async createAdminSession(session: InsertAdminSession): Promise<AdminSession> { const [n] = await db.insert(adminSessions).values(session).returning(); return n; }
  async getAdminSession(sessionToken: string): Promise<AdminSession | undefined> { const [result] = await db.select().from(adminSessions).where(eq(adminSessions.sessionToken, sessionToken)); return result; }
  async getAdminSessionByToken(tokenHash: string): Promise<AdminSession | undefined> { const [result] = await db.select().from(adminSessions).where(eq(adminSessions.sessionToken, tokenHash)); return result; }
  async updateAdminSessionActivity(sessionId: string): Promise<void> { await db.update(adminSessions).set({ lastActivityAt: new Date() }).where(eq(adminSessions.id, sessionId)); }
  async invalidateAllAdminSessions(): Promise<void> { await db.delete(adminSessions); }
  async cleanupExpiredSessions(): Promise<number> { const result = await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date())).returning(); return result.length; }
}
