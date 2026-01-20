/**
 * Digital Twin - Database Storage
 */

import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { digitalTwins, twinSimulations, errorLogs, systemPerformanceMetrics, vessels, type DigitalTwin, type TwinSimulation, type ErrorLog, type InsertErrorLog, type SystemPerformanceMetric, type InsertSystemPerformanceMetric } from "@shared/schema-runtime";
import type { ErrorLogFilters, ErrorLogStats } from "./types.js";

export class DatabaseDigitalTwinStorage {
  async getDigitalTwins(orgId: string, vesselId?: string, twinType?: string): Promise<DigitalTwin[]> { const c = [eq(vessels.orgId, orgId)]; if (vesselId) {c.push(eq(digitalTwins.vesselId, vesselId));} if (twinType) {c.push(eq(digitalTwins.twinType, twinType));} const r = await db.select().from(digitalTwins).innerJoin(vessels, eq(digitalTwins.vesselId, vessels.id)).where(and(...c)).orderBy(sql`${digitalTwins.updatedAt} DESC`); return r.map(r => r.digital_twins); }
  async getDigitalTwin(id: string, orgId: string): Promise<DigitalTwin | undefined> { const r = await db.select().from(digitalTwins).innerJoin(vessels, eq(digitalTwins.vesselId, vessels.id)).where(and(eq(digitalTwins.id, id), eq(vessels.orgId, orgId))); return r[0]?.digital_twins; }

  async getTwinSimulations(digitalTwinId?: string, scenarioType?: string, status?: string): Promise<TwinSimulation[]> { const c = []; if (digitalTwinId) {c.push(eq(twinSimulations.digitalTwinId, digitalTwinId));} if (scenarioType) {c.push(eq(twinSimulations.scenarioType, scenarioType));} if (status) {c.push(eq(twinSimulations.status, status));} let q = db.select().from(twinSimulations); if (c.length > 0) {q = q.where(and(...c));} return q.orderBy(sql`${twinSimulations.startTime} DESC`); }
  async getTwinSimulation(id: string): Promise<TwinSimulation | undefined> { const r = await db.select().from(twinSimulations).where(eq(twinSimulations.id, id)); return r[0]; }

  async getErrorLogs(filters?: ErrorLogFilters): Promise<ErrorLog[]> { const c = []; if (filters?.orgId) {c.push(eq(errorLogs.orgId, filters.orgId));} if (filters?.severity) {c.push(eq(errorLogs.severity, filters.severity));} if (filters?.category) {c.push(eq(errorLogs.category, filters.category));} if (filters?.resolved !== undefined) {c.push(eq(errorLogs.resolved, filters.resolved));} if (filters?.fromDate) {c.push(gte(errorLogs.timestamp, filters.fromDate));} if (filters?.toDate) {c.push(lte(errorLogs.timestamp, filters.toDate));} let q = db.select().from(errorLogs); if (c.length > 0) {q = q.where(and(...c));} q = q.orderBy(sql`${errorLogs.timestamp} DESC`); if (filters?.limit) {q = q.limit(filters.limit);} return q; }
  async createErrorLog(log: InsertErrorLog): Promise<ErrorLog> { const [n] = await db.insert(errorLogs).values(log).returning(); return n; }
  async resolveErrorLog(id: string, resolvedBy: string): Promise<ErrorLog> { const [resolved] = await db.update(errorLogs).set({ resolved: true, resolvedAt: new Date(), resolvedBy }).where(eq(errorLogs.id, id)).returning(); if (!resolved) {throw new Error(`Error log ${id} not found`);} return resolved; }
  async getErrorLogStats(orgId: string, days: number = 7): Promise<ErrorLogStats> { const cutoffDate = new Date(); cutoffDate.setDate(cutoffDate.getDate() - days); const logs = await db.select().from(errorLogs).where(and(eq(errorLogs.orgId, orgId), gte(errorLogs.timestamp, cutoffDate))); const byCategory: Record<string, number> = {}; const bySeverity: Record<string, number> = {}; let resolved = 0, unresolved = 0; for (const log of logs) { byCategory[log.category] = (byCategory[log.category] || 0) + 1; bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1; if (log.resolved) {resolved++;} else {unresolved++;} } return { total: logs.length, byCategory, bySeverity, resolved, unresolved }; }

  async getSystemPerformanceMetrics(orgId?: string, category?: string, hours?: number): Promise<SystemPerformanceMetric[]> { const c: any[] = []; if (orgId) {c.push(eq(systemPerformanceMetrics.orgId, orgId));} if (category) {c.push(eq(systemPerformanceMetrics.category, category));} if (hours) { const cutoff = new Date(); cutoff.setHours(cutoff.getHours() - hours); c.push(gte(systemPerformanceMetrics.recordedAt, cutoff)); } let q = db.select().from(systemPerformanceMetrics); if (c.length > 0) {q = q.where(and(...c));} return q.orderBy(sql`${systemPerformanceMetrics.recordedAt} DESC`); }
  async createSystemPerformanceMetric(metric: InsertSystemPerformanceMetric): Promise<SystemPerformanceMetric> { const [n] = await db.insert(systemPerformanceMetrics).values(metric).returning(); return n; }
  async getLatestMetricsByCategory(orgId: string, category: string): Promise<SystemPerformanceMetric[]> { return db.select().from(systemPerformanceMetrics).where(and(eq(systemPerformanceMetrics.orgId, orgId), eq(systemPerformanceMetrics.category, category))).orderBy(sql`${systemPerformanceMetrics.recordedAt} DESC`).limit(10); }
}
