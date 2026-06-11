/**
 * Engine Log Storage - Events group
 * Split from db-storage.ts (DbEngineLogStorage composes this class and
 * delegates, mirroring the server/db/workorders facade pattern).
 */

import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "../../../../db-config.js";
import { engineLogEvents } from "@shared/schema-runtime";
import type { EngineLogEvent, InsertEngineLogEvent } from "@shared/schema";
import type { EngineLogEventFilters } from "./types.js";

export class DbEngineLogEventsStorage {
  private validateOrgId(orgId: string, methodName: string): void {
    if (!orgId) {
      throw new Error(`${methodName}: orgId is required for tenant isolation`);
    }
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
    if (!created) {
      throw new Error("createEngineLogEvent: no row returned");
    }
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
