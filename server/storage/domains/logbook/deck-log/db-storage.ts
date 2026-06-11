/**
 * Deck Log Storage - Database Implementation
 */

import { eq, and, gte, lte, asc, sql } from "drizzle-orm";
import { db } from "../../../../db-config";
import { deckLogDaily, deckLogHourly, deckLogWatch, deckLogEvents } from "@shared/schema-runtime";
import type {
  DeckLogDaily,
  InsertDeckLogDaily,
  DeckLogHourly,
  InsertDeckLogHourly,
  DeckLogWatch,
  InsertDeckLogWatch,
  DeckLogEvent,
  InsertDeckLogEvent,
} from "@shared/schema";
import type {
  DeckLogFilters,
  DeckLogEventFilters,
  SignData,
  LockData,
  DeckLogComplete,
} from "./types.js";

export class DbDeckLogStorage {
  private validateOrgId(orgId: string, methodName: string): void {
    if (!orgId) {
      throw new Error(`${methodName}: orgId is required for tenant isolation`);
    }
  }

  async getDeckLogDaily(orgId: string, filters?: DeckLogFilters): Promise<DeckLogDaily[]> {
    this.validateOrgId(orgId, "getDeckLogDaily");
    const conditions = [eq(deckLogDaily.orgId, orgId)];
    if (filters?.vesselId) {
      conditions.push(eq(deckLogDaily.vesselId, filters.vesselId));
    }
    if (filters?.startDate) {
      conditions.push(gte(deckLogDaily.logDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(deckLogDaily.logDate, filters.endDate));
    }
    if (filters?.status) {
      conditions.push(eq(deckLogDaily.status, filters.status));
    }
    return db
      .select()
      .from(deckLogDaily)
      .where(and(...conditions))
      .orderBy(sql`${deckLogDaily.logDate} DESC`);
  }

  async getDeckLogDailyById(id: string, orgId: string): Promise<DeckLogDaily | undefined> {
    this.validateOrgId(orgId, "getDeckLogDailyById");
    const [result] = await db
      .select()
      .from(deckLogDaily)
      .where(and(eq(deckLogDaily.id, id), eq(deckLogDaily.orgId, orgId)));
    return result;
  }

  async getDeckLogDailyByDate(
    vesselId: string,
    logDate: string,
    orgId: string
  ): Promise<DeckLogDaily | undefined> {
    this.validateOrgId(orgId, "getDeckLogDailyByDate");
    const [result] = await db
      .select()
      .from(deckLogDaily)
      .where(
        and(
          eq(deckLogDaily.vesselId, vesselId),
          eq(deckLogDaily.logDate, logDate),
          eq(deckLogDaily.orgId, orgId)
        )
      );
    return result;
  }

  async createDeckLogDaily(entry: InsertDeckLogDaily): Promise<DeckLogDaily> {
    this.validateOrgId(entry.orgId, "createDeckLogDaily");
    const [created] = await db
      .insert(deckLogDaily)
      .values({ ...entry, status: entry.status || "draft" })
      .returning();
    if (!created) {
      throw new Error("Failed to create deck log daily");
    }
    return created;
  }

  async updateDeckLogDaily(
    id: string,
    entry: Partial<InsertDeckLogDaily>,
    orgId: string
  ): Promise<DeckLogDaily> {
    this.validateOrgId(orgId, "updateDeckLogDaily");
    const [updated] = await db
      .update(deckLogDaily)
      .set({ ...entry, updatedAt: new Date() })
      .where(and(eq(deckLogDaily.id, id), eq(deckLogDaily.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error("Deck log daily entry not found");
    }
    return updated;
  }

  async deleteDeckLogDaily(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deleteDeckLogDaily");
    await db
      .delete(deckLogDaily)
      .where(and(eq(deckLogDaily.id, id), eq(deckLogDaily.orgId, orgId)));
  }

  async signDeckLogDaily(id: string, signData: SignData, orgId: string): Promise<DeckLogDaily> {
    this.validateOrgId(orgId, "signDeckLogDaily");
    const [updated] = await db
      .update(deckLogDaily)
      .set({
        signedByCrewId: signData.signedByCrewId,
        signedByName: signData.signedByName,
        signedByRank: signData.signedByRank,
        signedAt: new Date(),
        status: "signed",
        updatedAt: new Date(),
      })
      .where(and(eq(deckLogDaily.id, id), eq(deckLogDaily.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error("Deck log daily entry not found");
    }
    return updated;
  }

  async lockDeckLogDaily(id: string, lockData: LockData, orgId: string): Promise<DeckLogDaily> {
    this.validateOrgId(orgId, "lockDeckLogDaily");
    const existing = await this.getDeckLogDailyById(id, orgId);
    if (!existing) {
      throw new Error("Deck log daily entry not found");
    }
    if (existing.status === "locked") {
      throw new Error("Deck log is already locked");
    }
    const [updated] = await db
      .update(deckLogDaily)
      .set({
        status: "locked",
        lockedAt: new Date(),
        lockedByUserId: lockData.lockedByUserId,
        lockedByUserName: lockData.lockedByUserName,
        updatedAt: new Date(),
      })
      .where(and(eq(deckLogDaily.id, id), eq(deckLogDaily.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error("lockDeckLogDaily: update returned no row");
    }
    return updated;
  }

  async unlockDeckLogDaily(id: string, orgId: string): Promise<DeckLogDaily> {
    this.validateOrgId(orgId, "unlockDeckLogDaily");
    const [updated] = await db
      .update(deckLogDaily)
      .set({
        status: "open",
        lockedAt: null,
        lockedByUserId: null,
        lockedByUserName: null,
        updatedAt: new Date(),
      })
      .where(and(eq(deckLogDaily.id, id), eq(deckLogDaily.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error("Deck log daily entry not found");
    }
    return updated;
  }

  async getDeckLogHourly(dailyLogId: string, orgId: string): Promise<DeckLogHourly[]> {
    this.validateOrgId(orgId, "getDeckLogHourly");
    return db
      .select()
      .from(deckLogHourly)
      .where(and(eq(deckLogHourly.dailyLogId, dailyLogId), eq(deckLogHourly.orgId, orgId)))
      .orderBy(asc(deckLogHourly.hour));
  }

  async getDeckLogHourlyByHour(
    dailyLogId: string,
    hour: number,
    orgId: string
  ): Promise<DeckLogHourly | undefined> {
    this.validateOrgId(orgId, "getDeckLogHourlyByHour");
    const [result] = await db
      .select()
      .from(deckLogHourly)
      .where(
        and(
          eq(deckLogHourly.dailyLogId, dailyLogId),
          eq(deckLogHourly.hour, hour),
          eq(deckLogHourly.orgId, orgId)
        )
      );
    return result;
  }

  async upsertDeckLogHourly(entry: InsertDeckLogHourly): Promise<DeckLogHourly> {
    this.validateOrgId(entry.orgId, "upsertDeckLogHourly");
    const existing = await this.getDeckLogHourlyByHour(entry.dailyLogId, entry.hour, entry.orgId);
    if (existing) {
      const [updated] = await db
        .update(deckLogHourly)
        .set({ ...entry, updatedAt: new Date() })
        .where(eq(deckLogHourly.id, existing.id))
        .returning();
      if (!updated) {
        throw new Error("upsertDeckLogHourly: update returned no row");
      }
      return updated;
    }
    const [created] = await db.insert(deckLogHourly).values(entry).returning();
    if (!created) {
      throw new Error("upsertDeckLogHourly: insert returned no row");
    }
    return created;
  }

  async bulkUpsertDeckLogHourly(entries: InsertDeckLogHourly[]): Promise<DeckLogHourly[]> {
    if (entries.length === 0) {
      return [];
    }
    const firstEntry = entries[0];
    if (!firstEntry) {
      return [];
    }
    this.validateOrgId(firstEntry.orgId, "bulkUpsertDeckLogHourly");
    const results: DeckLogHourly[] = [];
    for (const entry of entries) {
      results.push(await this.upsertDeckLogHourly(entry));
    }
    return results;
  }

  async deleteDeckLogHourly(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deleteDeckLogHourly");
    await db
      .delete(deckLogHourly)
      .where(and(eq(deckLogHourly.id, id), eq(deckLogHourly.orgId, orgId)));
  }

  async getDeckLogWatch(dailyLogId: string, orgId: string): Promise<DeckLogWatch[]> {
    this.validateOrgId(orgId, "getDeckLogWatch");
    return db
      .select()
      .from(deckLogWatch)
      .where(and(eq(deckLogWatch.dailyLogId, dailyLogId), eq(deckLogWatch.orgId, orgId)));
  }

  async getDeckLogWatchByPeriod(
    dailyLogId: string,
    watchPeriod: string,
    orgId: string
  ): Promise<DeckLogWatch | undefined> {
    this.validateOrgId(orgId, "getDeckLogWatchByPeriod");
    const [result] = await db
      .select()
      .from(deckLogWatch)
      .where(
        and(
          eq(deckLogWatch.dailyLogId, dailyLogId),
          eq(deckLogWatch.watchPeriod, watchPeriod),
          eq(deckLogWatch.orgId, orgId)
        )
      );
    return result;
  }

  async upsertDeckLogWatch(entry: InsertDeckLogWatch): Promise<DeckLogWatch> {
    this.validateOrgId(entry.orgId, "upsertDeckLogWatch");
    const existing = await this.getDeckLogWatchByPeriod(
      entry.dailyLogId,
      entry.watchPeriod,
      entry.orgId
    );
    if (existing) {
      const [updated] = await db
        .update(deckLogWatch)
        .set({ ...entry, updatedAt: new Date() })
        .where(eq(deckLogWatch.id, existing.id))
        .returning();
      if (!updated) {
        throw new Error("upsertDeckLogWatch: update returned no row");
      }
      return updated;
    }
    const [created] = await db.insert(deckLogWatch).values(entry).returning();
    if (!created) {
      throw new Error("upsertDeckLogWatch: insert returned no row");
    }
    return created;
  }

  async deleteDeckLogWatch(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deleteDeckLogWatch");
    await db
      .delete(deckLogWatch)
      .where(and(eq(deckLogWatch.id, id), eq(deckLogWatch.orgId, orgId)));
  }

  async getDeckLogComplete(
    dailyLogId: string,
    orgId: string
  ): Promise<DeckLogComplete | undefined> {
    this.validateOrgId(orgId, "getDeckLogComplete");
    const daily = await this.getDeckLogDailyById(dailyLogId, orgId);
    if (!daily) {
      return undefined;
    }
    return {
      daily,
      hourly: await this.getDeckLogHourly(dailyLogId, orgId),
      watches: await this.getDeckLogWatch(dailyLogId, orgId),
    };
  }

  async getDeckLogEvents(
    dayId: string,
    orgId: string,
    filters?: DeckLogEventFilters
  ): Promise<DeckLogEvent[]> {
    this.validateOrgId(orgId, "getDeckLogEvents");
    const conditions = [eq(deckLogEvents.dayId, dayId), eq(deckLogEvents.orgId, orgId)];
    if (filters?.eventType) {
      conditions.push(eq(deckLogEvents.eventType, filters.eventType));
    }
    if (filters?.source) {
      conditions.push(eq(deckLogEvents.source, filters.source));
    }
    if (filters?.startTime) {
      conditions.push(gte(deckLogEvents.timestamp, filters.startTime));
    }
    if (filters?.endTime) {
      conditions.push(lte(deckLogEvents.timestamp, filters.endTime));
    }
    return db
      .select()
      .from(deckLogEvents)
      .where(and(...conditions))
      .orderBy(deckLogEvents.timestamp);
  }

  async getDeckLogEventById(id: string, orgId: string): Promise<DeckLogEvent | undefined> {
    this.validateOrgId(orgId, "getDeckLogEventById");
    const [result] = await db
      .select()
      .from(deckLogEvents)
      .where(and(eq(deckLogEvents.id, id), eq(deckLogEvents.orgId, orgId)));
    return result;
  }

  async getDeckLogEventByIdempotencyKey(
    key: string,
    orgId: string
  ): Promise<DeckLogEvent | undefined> {
    this.validateOrgId(orgId, "getDeckLogEventByIdempotencyKey");
    const [result] = await db
      .select()
      .from(deckLogEvents)
      .where(and(eq(deckLogEvents.idempotencyKey, key), eq(deckLogEvents.orgId, orgId)));
    return result;
  }

  async createDeckLogEvent(event: InsertDeckLogEvent): Promise<DeckLogEvent> {
    this.validateOrgId(event.orgId, "createDeckLogEvent");
    if (event.idempotencyKey) {
      const existing = await this.getDeckLogEventByIdempotencyKey(
        event.idempotencyKey,
        event.orgId
      );
      if (existing) {
        return existing;
      }
    }
    const [created] = await db.insert(deckLogEvents).values(event).returning();
    if (!created) {
      throw new Error("createDeckLogEvent: insert returned no row");
    }
    return created;
  }

  async updateDeckLogEvent(
    id: string,
    event: Partial<InsertDeckLogEvent>,
    orgId: string
  ): Promise<DeckLogEvent> {
    this.validateOrgId(orgId, "updateDeckLogEvent");
    const [updated] = await db
      .update(deckLogEvents)
      .set({ ...event, updatedAt: new Date() })
      .where(and(eq(deckLogEvents.id, id), eq(deckLogEvents.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error("Deck log event not found");
    }
    return updated;
  }

  async deleteDeckLogEvent(id: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "deleteDeckLogEvent");
    await db
      .delete(deckLogEvents)
      .where(and(eq(deckLogEvents.id, id), eq(deckLogEvents.orgId, orgId)));
  }
}
