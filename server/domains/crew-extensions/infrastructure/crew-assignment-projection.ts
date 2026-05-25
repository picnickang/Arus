/**
 * Crew Assignment Projection
 * CQRS read model that maintains a denormalized view of crew assignments
 * Updated via domain events for optimal query performance
 */

import type { CrewAssignmentProjection, SchedulePlannerFilter } from "../domain/read-models";
import { db } from "../../../db";
import { scheduleAssignments, schedulerRuns, crew, vessels } from "@shared/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { createLogger } from "../../../lib/structured-logger";
import type { CrewAssignmentCreatedEvent } from "../../../lib/domain-events/types.js";
import { domainEventBus } from "../../../lib/domain-event-bus/index.js";
import { formatDate, mapShift, mapStatus } from "./schedule-planner-utils.js";
import { recordCacheHit, recordCacheMiss, recordViewQuery } from "./schedule-planner-metrics.js";

const logger = createLogger("CrewAssignmentProjection");

interface ICrewAssignmentProjectionRepository {
  getByFilter(filter: SchedulePlannerFilter): Promise<CrewAssignmentProjection[]>;
  getByCrewId(
    crewId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CrewAssignmentProjection[]>;
  getByVesselId(
    vesselId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CrewAssignmentProjection[]>;
  refresh(orgId: string): Promise<void>;
}

export class CrewAssignmentProjectionAdapter implements ICrewAssignmentProjectionRepository {
  private cache: Map<string, CrewAssignmentProjection[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private cacheTTL = 60000;

  async getByFilter(filter: SchedulePlannerFilter): Promise<CrewAssignmentProjection[]> {
    const cacheKey = this.buildCacheKey(filter);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      logger.debug("Cache hit for projection query", { cacheKey });
      recordCacheHit(filter.orgId);
      return cached;
    }

    recordCacheMiss(filter.orgId);
    logger.info("Building crew assignment projection", { filter });
    const startTime = Date.now();

    try {
      const startDate = filter.startDate;
      const endDate = filter.endDate;

      const conditions = [
        eq(schedulerRuns.orgId, filter.orgId),
        gte(scheduleAssignments.date, startDate),
        lte(scheduleAssignments.date, endDate),
      ];

      if (filter.vesselIds?.length) {
        conditions.push(inArray(scheduleAssignments.vesselId, filter.vesselIds));
      }
      if (filter.crewIds?.length) {
        conditions.push(inArray(scheduleAssignments.crewId, filter.crewIds));
      }
      if (filter.roles?.length) {
        conditions.push(inArray(scheduleAssignments.role, filter.roles));
      }

      const result = await db
        .select({
          assignmentId: scheduleAssignments.id,
          crewId: scheduleAssignments.crewId,
          crewName: crew.name,
          vesselId: scheduleAssignments.vesselId,
          vesselName: vessels.name,
          date: scheduleAssignments.date,
          shift: scheduleAssignments.shiftId,
          role: scheduleAssignments.role,
          executed: scheduleAssignments.executed,
          runId: scheduleAssignments.runId,
        })
        .from(scheduleAssignments)
        .innerJoin(schedulerRuns, eq(scheduleAssignments.runId, schedulerRuns.id))
        .innerJoin(crew, eq(scheduleAssignments.crewId, crew.id))
        .leftJoin(vessels, eq(scheduleAssignments.vesselId, vessels.id))
        .where(and(...conditions))
        .orderBy(scheduleAssignments.date);

      const projections: CrewAssignmentProjection[] = result.map((row) => ({
        assignmentId: row.assignmentId,
        crewId: row.crewId,
        crewName: row.crewName || "Unknown",
        vesselId: row.vesselId || "",
        vesselName: row.vesselName || "Unknown Vessel",
        date: formatDate(row.date),
        shift: mapShift(row.shift),
        role: row.role,
        status: mapStatus(row.executed ? "applied" : "proposed"),
        runId: row.runId,
        projectedAt: new Date().toISOString(),
      }));

      this.setCache(cacheKey, projections);

      const durationMs = Date.now() - startTime;
      logger.info("Crew assignment projection built", {
        durationMs,
        count: projections.length,
      });
      recordViewQuery(filter.orgId, "crewAssignmentProjection", durationMs);

      return projections;
    } catch (error) {
      logger.error("Failed to build crew assignment projection", { error });
      throw error;
    }
  }

  async getByCrewId(
    crewId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CrewAssignmentProjection[]> {
    const now = new Date();
    const defaultStart =
      startDate || (new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "");
    const defaultEnd =
      endDate || (new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "");

    try {
      const result = await db
        .select({
          assignmentId: scheduleAssignments.id,
          crewId: scheduleAssignments.crewId,
          crewName: crew.name,
          vesselId: scheduleAssignments.vesselId,
          vesselName: vessels.name,
          date: scheduleAssignments.date,
          shift: scheduleAssignments.shiftId,
          role: scheduleAssignments.role,
          executed: scheduleAssignments.executed,
          runId: scheduleAssignments.runId,
        })
        .from(scheduleAssignments)
        .innerJoin(crew, eq(scheduleAssignments.crewId, crew.id))
        .leftJoin(vessels, eq(scheduleAssignments.vesselId, vessels.id))
        .where(
          and(
            eq(scheduleAssignments.crewId, crewId),
            gte(scheduleAssignments.date, defaultStart),
            lte(scheduleAssignments.date, defaultEnd)
          )
        )
        .orderBy(scheduleAssignments.date);

      return result.map((row) => ({
        assignmentId: row.assignmentId,
        crewId: row.crewId,
        crewName: row.crewName || "Unknown",
        vesselId: row.vesselId || "",
        vesselName: row.vesselName || "Unknown Vessel",
        date: formatDate(row.date),
        shift: mapShift(row.shift),
        role: row.role,
        status: mapStatus(row.executed ? "applied" : "proposed"),
        runId: row.runId,
        projectedAt: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error("Failed to get assignments by crew", { crewId, error });
      return [];
    }
  }

  async getByVesselId(
    vesselId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CrewAssignmentProjection[]> {
    const now = new Date();
    const defaultStart =
      startDate || (new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "");
    const defaultEnd =
      endDate || (new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "");

    try {
      const result = await db
        .select({
          assignmentId: scheduleAssignments.id,
          crewId: scheduleAssignments.crewId,
          crewName: crew.name,
          vesselId: scheduleAssignments.vesselId,
          vesselName: vessels.name,
          date: scheduleAssignments.date,
          shift: scheduleAssignments.shiftId,
          role: scheduleAssignments.role,
          executed: scheduleAssignments.executed,
          runId: scheduleAssignments.runId,
        })
        .from(scheduleAssignments)
        .innerJoin(crew, eq(scheduleAssignments.crewId, crew.id))
        .leftJoin(vessels, eq(scheduleAssignments.vesselId, vessels.id))
        .where(
          and(
            eq(scheduleAssignments.vesselId, vesselId),
            gte(scheduleAssignments.date, defaultStart),
            lte(scheduleAssignments.date, defaultEnd)
          )
        )
        .orderBy(scheduleAssignments.date);

      return result.map((row) => ({
        assignmentId: row.assignmentId,
        crewId: row.crewId,
        crewName: row.crewName || "Unknown",
        vesselId: row.vesselId || "",
        vesselName: row.vesselName || "Unknown Vessel",
        date: formatDate(row.date),
        shift: mapShift(row.shift),
        role: row.role,
        status: mapStatus(row.executed ? "applied" : "proposed"),
        runId: row.runId,
        projectedAt: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error("Failed to get assignments by vessel", { vesselId, error });
      return [];
    }
  }

  async refresh(orgId: string): Promise<void> {
    logger.info("Refreshing crew assignment projection", { orgId });
    this.invalidateCache(orgId);
  }

  handleCrewAssignmentCreated(event: CrewAssignmentCreatedEvent): void {
    logger.debug("Handling CrewAssignmentCreated event", {
      eventId: event.eventId,
      crewId: event.payload.crewId,
      vesselId: event.payload.vesselId,
    });
    this.invalidateCache(event.orgId);
  }

  private buildCacheKey(filter: SchedulePlannerFilter): string {
    return `${filter.orgId}:${filter.startDate}:${filter.endDate}:${filter.vesselIds?.join(",") || ""}:${filter.crewIds?.join(",") || ""}:${filter.roles?.join(",") || ""}:${filter.status?.join(",") || ""}`;
  }

  private getFromCache(key: string): CrewAssignmentProjection[] | null {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && expiry > Date.now()) {
      return this.cache.get(key) || null;
    }
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
    return null;
  }

  private setCache(key: string, projections: CrewAssignmentProjection[]): void {
    this.cache.set(key, projections);
    this.cacheExpiry.set(key, Date.now() + this.cacheTTL);
  }

  private invalidateCache(orgId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${orgId}:`)) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }
}

export const crewAssignmentProjection = new CrewAssignmentProjectionAdapter();

export function initCrewAssignmentProjectionEventHandler(): void {
  domainEventBus.on("scheduler.run.completed", (event) => {
    const { runId } = event.payload;
    logger.debug("Scheduler run completed, invalidating projection cache", {
      orgId: event.orgId,
      runId,
    });
    crewAssignmentProjection.refresh(event.orgId);
  });

  logger.info("CrewAssignmentProjection event handler initialized");
}
