/**
 * Engine Log Storage - Database Implementation
 * PostgreSQL storage for engine log entries
 */

import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../../../../db-config.js";
import {
  engineLogDaily,
  engineLogHourly,
  engineLogGenerator,
  engineLogWatch,
  engineLogEvents,
} from "@shared/schema-runtime";
import type {
  EngineLogDaily,
  InsertEngineLogDaily,
  EngineLogHourly,
  InsertEngineLogHourly,
  EngineLogGenerator,
  InsertEngineLogGenerator,
  EngineLogWatch,
  InsertEngineLogWatch,
  EngineLogEvent,
  InsertEngineLogEvent,
} from "@shared/schema";
import type {
  EngineLogFilters,
  EngineLogEventFilters,
  SignData,
  LockData,
  EngineLogComplete,
} from "./types.js";

export class DbEngineLogStorage {
  private validateOrgId(orgId: string, methodName: string): void {
    if (!orgId) {
      throw new Error(`${methodName}: orgId is required for tenant isolation`);
    }
  }

  async getEngineLogDaily(orgId: string, filters?: EngineLogFilters): Promise<EngineLogDaily[]> {
    this.validateOrgId(orgId, "getEngineLogDaily");
    const conditions = [eq(engineLogDaily.orgId, orgId)];
    if (filters?.vesselId) {
      conditions.push(eq(engineLogDaily.vesselId, filters.vesselId));
    }
    if (filters?.startDate) {
      conditions.push(gte(engineLogDaily.logDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(engineLogDaily.logDate, filters.endDate));
    }
    if (filters?.status) {
      conditions.push(eq(engineLogDaily.status, filters.status));
    }
    return db
      .select()
      .from(engineLogDaily)
      .where(and(...conditions))
      .orderBy(sql`${engineLogDaily.logDate} DESC`);
  }

  async getEngineLogDailyById(id: string, orgId: string): Promise<EngineLogDaily | undefined> {
    this.validateOrgId(orgId, "getEngineLogDailyById");
    const [entry] = await db
      .select()
      .from(engineLogDaily)
      .where(and(eq(engineLogDaily.id, id), eq(engineLogDaily.orgId, orgId)));
    return entry;
  }

  async getEngineLogDailyByDate(
    vesselId: string,
    logDate: string,
    orgId: string
  ): Promise<EngineLogDaily | undefined> {
    this.validateOrgId(orgId, "getEngineLogDailyByDate");
    const [entry] = await db
      .select()
      .from(engineLogDaily)
      .where(
        and(
          eq(engineLogDaily.vesselId, vesselId),
          eq(engineLogDaily.logDate, logDate),
          eq(engineLogDaily.orgId, orgId)
        )
      );
    return entry;
  }

  async createEngineLogDaily(entry: InsertEngineLogDaily): Promise<EngineLogDaily> {
    this.validateOrgId(entry.orgId, "createEngineLogDaily");
    const [created] = await db.insert(engineLogDaily).values(entry).returning();
    if (!created) throw new Error("createEngineLogDaily: no row returned");
    return created;
  }

  async updateEngineLogDaily(
    id: string,
    entry: Partial<InsertEngineLogDaily>,
    orgId: string
  ): Promise<EngineLogDaily> {
    this.validateOrgId(orgId, "updateEngineLogDaily");
    const existing = await this.getEngineLogDailyById(id, orgId);
    if (!existing) {
      throw new Error("Engine log daily entry not found");
    }
    if (existing.status === "locked") {
      throw new Error("Cannot modify locked engine log");
    }
    const [updated] = await db
      .update(engineLogDaily)
      .set({ ...entry, updatedAt: new Date() })
      .where(and(eq(engineLogDaily.id, id), eq(engineLogDaily.orgId, orgId)))
      .returning();
    if (!updated) throw new Error("updateEngineLogDaily: no row returned");
    return updated;
  }

  async deleteEngineLogDaily(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deleteEngineLogDaily");
    const existing = await this.getEngineLogDailyById(id, orgId);
    if (!existing) {
      throw new Error("Engine log daily entry not found");
    }
    if (existing.status === "locked") {
      throw new Error("Cannot delete locked engine log");
    }
    await db
      .delete(engineLogDaily)
      .where(and(eq(engineLogDaily.id, id), eq(engineLogDaily.orgId, orgId)));
  }

  async signEngineLogDaily(id: string, signData: SignData, orgId: string): Promise<EngineLogDaily> {
    this.validateOrgId(orgId, "signEngineLogDaily");
    const existing = await this.getEngineLogDailyById(id, orgId);
    if (!existing) {
      throw new Error("Engine log daily entry not found");
    }
    if (existing.status === "locked") {
      throw new Error("Engine log is already locked");
    }
    const [updated] = await db
      .update(engineLogDaily)
      .set({
        signedByCrewId: signData.signedByCrewId,
        signedByName: signData.signedByName,
        signedByRank: signData.signedByRank,
        signedAt: new Date(),
        status: "signed",
        updatedAt: new Date(),
      })
      .where(and(eq(engineLogDaily.id, id), eq(engineLogDaily.orgId, orgId)))
      .returning();
    if (!updated) throw new Error("signEngineLogDaily: no row returned");
    return updated;
  }

  async lockEngineLogDaily(id: string, lockData: LockData, orgId: string): Promise<EngineLogDaily> {
    this.validateOrgId(orgId, "lockEngineLogDaily");
    const existing = await this.getEngineLogDailyById(id, orgId);
    if (!existing) {
      throw new Error("Engine log daily entry not found");
    }
    if (existing.status === "locked") {
      throw new Error("Engine log is already locked");
    }
    const [updated] = await db
      .update(engineLogDaily)
      .set({
        status: "locked",
        lockedAt: new Date(),
        lockedByUserId: lockData.lockedByUserId,
        lockedByUserName: lockData.lockedByUserName,
        updatedAt: new Date(),
      })
      .where(and(eq(engineLogDaily.id, id), eq(engineLogDaily.orgId, orgId)))
      .returning();
    if (!updated) throw new Error("lockEngineLogDaily: no row returned");
    return updated;
  }

  async unlockEngineLogDaily(id: string, orgId: string): Promise<EngineLogDaily> {
    this.validateOrgId(orgId, "unlockEngineLogDaily");
    const [updated] = await db
      .update(engineLogDaily)
      .set({
        status: "open",
        lockedAt: null,
        lockedByUserId: null,
        lockedByUserName: null,
        updatedAt: new Date(),
      })
      .where(and(eq(engineLogDaily.id, id), eq(engineLogDaily.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error("Engine log daily entry not found");
    }
    return updated;
  }

  async getEngineLogHourly(dailyLogId: string, orgId: string): Promise<EngineLogHourly[]> {
    this.validateOrgId(orgId, "getEngineLogHourly");
    return db
      .select()
      .from(engineLogHourly)
      .where(and(eq(engineLogHourly.dailyLogId, dailyLogId), eq(engineLogHourly.orgId, orgId)))
      .orderBy(engineLogHourly.hour);
  }

  async getEngineLogHourlyByHour(
    dailyLogId: string,
    hour: number,
    orgId: string
  ): Promise<EngineLogHourly | undefined> {
    this.validateOrgId(orgId, "getEngineLogHourlyByHour");
    const [entry] = await db
      .select()
      .from(engineLogHourly)
      .where(
        and(
          eq(engineLogHourly.dailyLogId, dailyLogId),
          eq(engineLogHourly.hour, hour),
          eq(engineLogHourly.orgId, orgId)
        )
      );
    return entry;
  }

  async upsertEngineLogHourly(entry: InsertEngineLogHourly): Promise<EngineLogHourly> {
    this.validateOrgId(entry.orgId, "upsertEngineLogHourly");
    const existing = await this.getEngineLogHourlyByHour(entry.dailyLogId, entry.hour, entry.orgId);
    if (existing) {
      const [updated] = await db
        .update(engineLogHourly)
        .set({ ...entry, updatedAt: new Date() })
        .where(eq(engineLogHourly.id, existing.id))
        .returning();
      if (!updated) throw new Error("upsertEngineLogHourly: update returned no row");
      return updated;
    }
    const [created] = await db.insert(engineLogHourly).values(entry).returning();
    if (!created) throw new Error("upsertEngineLogHourly: insert returned no row");
    return created;
  }

  async bulkUpsertEngineLogHourly(entries: InsertEngineLogHourly[]): Promise<EngineLogHourly[]> {
    const results: EngineLogHourly[] = [];
    for (const entry of entries) {
      results.push(await this.upsertEngineLogHourly(entry));
    }
    return results;
  }
  async deleteEngineLogHourly(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deleteEngineLogHourly");
    await db
      .delete(engineLogHourly)
      .where(and(eq(engineLogHourly.id, id), eq(engineLogHourly.orgId, orgId)));
  }

  async getEngineLogGenerator(dailyLogId: string, orgId: string): Promise<EngineLogGenerator[]> {
    this.validateOrgId(orgId, "getEngineLogGenerator");
    return db
      .select()
      .from(engineLogGenerator)
      .where(
        and(eq(engineLogGenerator.dailyLogId, dailyLogId), eq(engineLogGenerator.orgId, orgId))
      )
      .orderBy(engineLogGenerator.hour, engineLogGenerator.generatorNumber);
  }

  async getEngineLogGeneratorByHour(
    dailyLogId: string,
    hour: number,
    orgId: string
  ): Promise<EngineLogGenerator[]> {
    this.validateOrgId(orgId, "getEngineLogGeneratorByHour");
    return db
      .select()
      .from(engineLogGenerator)
      .where(
        and(
          eq(engineLogGenerator.dailyLogId, dailyLogId),
          eq(engineLogGenerator.hour, hour),
          eq(engineLogGenerator.orgId, orgId)
        )
      )
      .orderBy(engineLogGenerator.generatorNumber);
  }

  async upsertEngineLogGenerator(entry: InsertEngineLogGenerator): Promise<EngineLogGenerator> {
    this.validateOrgId(entry.orgId, "upsertEngineLogGenerator");
    const [existing] = await db
      .select()
      .from(engineLogGenerator)
      .where(
        and(
          eq(engineLogGenerator.dailyLogId, entry.dailyLogId),
          eq(engineLogGenerator.hour, entry.hour),
          eq(engineLogGenerator.generatorNumber, entry.generatorNumber),
          eq(engineLogGenerator.orgId, entry.orgId)
        )
      );
    if (existing) {
      const [updated] = await db
        .update(engineLogGenerator)
        .set({ ...entry, updatedAt: new Date() })
        .where(eq(engineLogGenerator.id, existing.id))
        .returning();
      if (!updated) throw new Error("upsertEngineLogGenerator: update returned no row");
      return updated;
    }
    const [created] = await db.insert(engineLogGenerator).values(entry).returning();
    if (!created) throw new Error("upsertEngineLogGenerator: insert returned no row");
    return created;
  }

  async bulkUpsertEngineLogGenerator(
    entries: InsertEngineLogGenerator[]
  ): Promise<EngineLogGenerator[]> {
    const results: EngineLogGenerator[] = [];
    for (const entry of entries) {
      results.push(await this.upsertEngineLogGenerator(entry));
    }
    return results;
  }
  async deleteEngineLogGenerator(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deleteEngineLogGenerator");
    await db
      .delete(engineLogGenerator)
      .where(and(eq(engineLogGenerator.id, id), eq(engineLogGenerator.orgId, orgId)));
  }

  async getEngineLogWatch(dailyLogId: string, orgId: string): Promise<EngineLogWatch[]> {
    this.validateOrgId(orgId, "getEngineLogWatch");
    return db
      .select()
      .from(engineLogWatch)
      .where(and(eq(engineLogWatch.dailyLogId, dailyLogId), eq(engineLogWatch.orgId, orgId)));
  }

  async getEngineLogWatchByPeriod(
    dailyLogId: string,
    watchPeriod: string,
    orgId: string
  ): Promise<EngineLogWatch | undefined> {
    this.validateOrgId(orgId, "getEngineLogWatchByPeriod");
    const [entry] = await db
      .select()
      .from(engineLogWatch)
      .where(
        and(
          eq(engineLogWatch.dailyLogId, dailyLogId),
          eq(engineLogWatch.watchPeriod, watchPeriod),
          eq(engineLogWatch.orgId, orgId)
        )
      );
    return entry;
  }

  async upsertEngineLogWatch(entry: InsertEngineLogWatch): Promise<EngineLogWatch> {
    this.validateOrgId(entry.orgId, "upsertEngineLogWatch");
    const existing = await this.getEngineLogWatchByPeriod(
      entry.dailyLogId,
      entry.watchPeriod,
      entry.orgId
    );
    if (existing) {
      const [updated] = await db
        .update(engineLogWatch)
        .set({ ...entry, updatedAt: new Date() })
        .where(eq(engineLogWatch.id, existing.id))
        .returning();
      if (!updated) throw new Error("upsertEngineLogWatch: update returned no row");
      return updated;
    }
    const [created] = await db.insert(engineLogWatch).values(entry).returning();
    if (!created) throw new Error("upsertEngineLogWatch: insert returned no row");
    return created;
  }

  async deleteEngineLogWatch(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deleteEngineLogWatch");
    await db
      .delete(engineLogWatch)
      .where(and(eq(engineLogWatch.id, id), eq(engineLogWatch.orgId, orgId)));
  }

  async getEngineLogComplete(
    dailyLogId: string,
    orgId: string
  ): Promise<EngineLogComplete | undefined> {
    this.validateOrgId(orgId, "getEngineLogComplete");
    const daily = await this.getEngineLogDailyById(dailyLogId, orgId);
    if (!daily) {
      return undefined;
    }
    const [hourly, generators, watches] = await Promise.all([
      this.getEngineLogHourly(dailyLogId, orgId),
      this.getEngineLogGenerator(dailyLogId, orgId),
      this.getEngineLogWatch(dailyLogId, orgId),
    ]);
    return { daily, hourly, generators, watches };
  }

  async getEngineLogEvents(
    dayId: string,
    orgId: string,
    filters?: EngineLogEventFilters
  ): Promise<EngineLogEvent[]> {
    this.validateOrgId(orgId, "getEngineLogEvents");
    const conditions = [eq(engineLogEvents.dayId, dayId), eq(engineLogEvents.orgId, orgId)];
    if (filters?.eventType) {
      conditions.push(eq(engineLogEvents.eventType, filters.eventType));
    }
    if (filters?.source) {
      conditions.push(eq(engineLogEvents.source, filters.source));
    }
    if (filters?.startTime) {
      conditions.push(gte(engineLogEvents.timestamp, filters.startTime));
    }
    if (filters?.endTime) {
      conditions.push(lte(engineLogEvents.timestamp, filters.endTime));
    }
    return db
      .select()
      .from(engineLogEvents)
      .where(and(...conditions))
      .orderBy(engineLogEvents.timestamp);
  }

  async getEngineLogEventById(id: string, orgId: string): Promise<EngineLogEvent | undefined> {
    this.validateOrgId(orgId, "getEngineLogEventById");
    const [event] = await db
      .select()
      .from(engineLogEvents)
      .where(and(eq(engineLogEvents.id, id), eq(engineLogEvents.orgId, orgId)));
    return event;
  }
  async getEngineLogEventByIdempotencyKey(
    key: string,
    orgId: string
  ): Promise<EngineLogEvent | undefined> {
    this.validateOrgId(orgId, "getEngineLogEventByIdempotencyKey");
    const [event] = await db
      .select()
      .from(engineLogEvents)
      .where(and(eq(engineLogEvents.idempotencyKey, key), eq(engineLogEvents.orgId, orgId)));
    return event;
  }

  async createEngineLogEvent(event: InsertEngineLogEvent): Promise<EngineLogEvent> {
    this.validateOrgId(event.orgId, "createEngineLogEvent");
    if (event.idempotencyKey) {
      const existing = await this.getEngineLogEventByIdempotencyKey(
        event.idempotencyKey,
        event.orgId
      );
      if (existing) {
        return existing;
      }
    }
    const [created] = await db.insert(engineLogEvents).values(event).returning();
    if (!created) throw new Error("createEngineLogEvent: no row returned");
    return created;
  }

  async updateEngineLogEvent(
    id: string,
    event: Partial<InsertEngineLogEvent>,
    orgId: string
  ): Promise<EngineLogEvent> {
    this.validateOrgId(orgId, "updateEngineLogEvent");
    const [updated] = await db
      .update(engineLogEvents)
      .set({ ...event, updatedAt: new Date() })
      .where(and(eq(engineLogEvents.id, id), eq(engineLogEvents.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error("Engine log event not found");
    }
    return updated;
  }

  async deleteEngineLogEvent(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deleteEngineLogEvent");
    await db
      .delete(engineLogEvents)
      .where(and(eq(engineLogEvents.id, id), eq(engineLogEvents.orgId, orgId)));
  }
}
