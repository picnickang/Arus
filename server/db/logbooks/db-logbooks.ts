/**
 * Logbooks - Database Storage
 */

import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { recordAndPublish } from "../../sync-events";
import { deckLogEntries, engineRoomLogEntries, complianceRules, complianceFindings, type DeckLogEntry, type InsertDeckLogEntry, type EngineRoomLogEntry, type InsertEngineRoomLogEntry } from "@shared/schema-runtime";
import type { ComplianceRule, InsertComplianceRule, ComplianceFinding, InsertComplianceFinding } from "@shared/schema";

export class DatabaseLogbooksStorage {
  async getDeckLogEntries(vesselId?: string, fromDate?: Date, toDate?: Date, category?: string): Promise<DeckLogEntry[]> { const c = []; if (vesselId) {c.push(eq(deckLogEntries.vesselId, vesselId));} if (fromDate) {c.push(gte(deckLogEntries.timestamp, fromDate));} if (toDate) {c.push(lte(deckLogEntries.timestamp, toDate));} if (category) {c.push(eq(deckLogEntries.category, category));} let q = db.select().from(deckLogEntries); if (c.length > 0) {q = q.where(and(...c));} return q.orderBy(sql`${deckLogEntries.timestamp} DESC`); }
  async getDeckLogEntry(id: string): Promise<DeckLogEntry | undefined> { const [r] = await db.select().from(deckLogEntries).where(eq(deckLogEntries.id, id)); return r; }
  async createDeckLogEntry(entry: InsertDeckLogEntry): Promise<DeckLogEntry> { const [n] = await recordAndPublish(db.insert(deckLogEntries).values(entry).returning(), "deck_log_entry", "create"); return n; }
  async updateDeckLogEntry(id: string, updates: Partial<InsertDeckLogEntry>): Promise<DeckLogEntry> { const [u] = await recordAndPublish(db.update(deckLogEntries).set({ ...updates, updatedAt: new Date() }).where(eq(deckLogEntries.id, id)).returning(), "deck_log_entry", "update"); if (!u) {throw new Error(`Deck log entry ${id} not found`);} return u; }
  async deleteDeckLogEntry(id: string): Promise<void> { await recordAndPublish(db.delete(deckLogEntries).where(eq(deckLogEntries.id, id)).returning(), "deck_log_entry", "delete"); }
  async getDeckLogsByVoyage(voyageId: string): Promise<DeckLogEntry[]> { return db.select().from(deckLogEntries).where(eq(deckLogEntries.voyageId, voyageId)).orderBy(deckLogEntries.timestamp); }

  async getEngineRoomLogEntries(vesselId?: string, fromDate?: Date, toDate?: Date, category?: string): Promise<EngineRoomLogEntry[]> { const c = []; if (vesselId) {c.push(eq(engineRoomLogEntries.vesselId, vesselId));} if (fromDate) {c.push(gte(engineRoomLogEntries.timestamp, fromDate));} if (toDate) {c.push(lte(engineRoomLogEntries.timestamp, toDate));} if (category) {c.push(eq(engineRoomLogEntries.category, category));} let q = db.select().from(engineRoomLogEntries); if (c.length > 0) {q = q.where(and(...c));} return q.orderBy(sql`${engineRoomLogEntries.timestamp} DESC`); }
  async getEngineRoomLogEntry(id: string): Promise<EngineRoomLogEntry | undefined> { const [r] = await db.select().from(engineRoomLogEntries).where(eq(engineRoomLogEntries.id, id)); return r; }
  async createEngineRoomLogEntry(entry: InsertEngineRoomLogEntry): Promise<EngineRoomLogEntry> { const [n] = await recordAndPublish(db.insert(engineRoomLogEntries).values(entry).returning(), "engine_room_log_entry", "create"); return n; }
  async updateEngineRoomLogEntry(id: string, updates: Partial<InsertEngineRoomLogEntry>): Promise<EngineRoomLogEntry> { const [u] = await recordAndPublish(db.update(engineRoomLogEntries).set({ ...updates, updatedAt: new Date() }).where(eq(engineRoomLogEntries.id, id)).returning(), "engine_room_log_entry", "update"); if (!u) {throw new Error(`Engine room log entry ${id} not found`);} return u; }
  async deleteEngineRoomLogEntry(id: string): Promise<void> { await recordAndPublish(db.delete(engineRoomLogEntries).where(eq(engineRoomLogEntries.id, id)).returning(), "engine_room_log_entry", "delete"); }

  async getComplianceRuleDefinitions(category?: string, enabled?: boolean): Promise<ComplianceRule[]> { const c = []; if (category) {c.push(eq(complianceRules.category, category));} if (enabled !== undefined) {c.push(eq(complianceRules.enabled, enabled));} let q = db.select().from(complianceRules); if (c.length > 0) {q = q.where(and(...c));} return q.orderBy(complianceRules.name); }
  async getComplianceRuleDefinition(id: string): Promise<ComplianceRule | undefined> { const [r] = await db.select().from(complianceRules).where(eq(complianceRules.id, id)); return r; }
  async createComplianceRuleDefinition(rule: InsertComplianceRule): Promise<ComplianceRule> { const [n] = await db.insert(complianceRules).values(rule).returning(); return n; }
  async updateComplianceRuleDefinition(id: string, updates: Partial<InsertComplianceRule>): Promise<ComplianceRule> { const [u] = await db.update(complianceRules).set({ ...updates, updatedAt: new Date() }).where(eq(complianceRules.id, id)).returning(); if (!u) {throw new Error(`Compliance rule ${id} not found`);} return u; }
  async deleteComplianceRuleDefinition(id: string): Promise<void> { await db.delete(complianceRules).where(eq(complianceRules.id, id)); }

  async getComplianceFindings(vesselId?: string, ruleId?: string, status?: string): Promise<ComplianceFinding[]> { const c = []; if (vesselId) {c.push(eq(complianceFindings.vesselId, vesselId));} if (ruleId) {c.push(eq(complianceFindings.ruleId, ruleId));} if (status) {c.push(eq(complianceFindings.status, status));} let q = db.select().from(complianceFindings); if (c.length > 0) {q = q.where(and(...c));} return q.orderBy(sql`${complianceFindings.detectedAt} DESC`); }
  async getComplianceFinding(id: string): Promise<ComplianceFinding | undefined> { const [r] = await db.select().from(complianceFindings).where(eq(complianceFindings.id, id)); return r; }
  async createComplianceFinding(finding: InsertComplianceFinding): Promise<ComplianceFinding> { const [n] = await db.insert(complianceFindings).values(finding).returning(); return n; }
  async updateComplianceFinding(id: string, updates: Partial<InsertComplianceFinding>): Promise<ComplianceFinding> { const [u] = await db.update(complianceFindings).set({ ...updates, updatedAt: new Date() }).where(eq(complianceFindings.id, id)).returning(); if (!u) {throw new Error(`Compliance finding ${id} not found`);} return u; }
  async resolveFinding(id: string, resolvedBy: string, resolution: string): Promise<ComplianceFinding> { const [u] = await db.update(complianceFindings).set({ status: 'resolved', resolvedBy, resolution, resolvedAt: new Date(), updatedAt: new Date() }).where(eq(complianceFindings.id, id)).returning(); if (!u) {throw new Error(`Compliance finding ${id} not found`);} return u; }
}
