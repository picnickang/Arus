/**
 * Schedule Planner Read Model - CQRS Query Service
 * Implements optimized queries for the schedule planner board view using Drizzle ORM
 */

import type { ISchedulePlannerReadModel } from "../domain/ports";
import type {
  SchedulePlannerView,
  ScheduleDayCell,
  CrewMemberSummary,
  VesselSummary,
  UnfilledShiftSummary,
  SchedulePlannerFilter,
} from "../domain/read-models";
import { db } from "../../../db";
import {
  vessels,
  crew,
  scheduleAssignments,
  schedulerRuns,
  scheduleUnfilled,
  crewCertification,
  crewSkill,
  crewLeave,
  shiftTemplate,
  crewAssignment,
} from "@shared/schema";
import { eq, and, gte, lte, inArray, sql, count } from "drizzle-orm";
import { createLogger } from "../../../lib/structured-logger";
import {
  mapShift,
  mapStatus,
  formatDate,
  calculateComplianceRate,
  calculateUtilization,
  buildUnfilledShifts as buildUnfilledShiftsFn,
  buildRows as buildRowsFn,
  RefreshDebouncer,
} from "./schedule-planner-utils.js";
import {
  recordViewQuery,
  recordRefresh,
  recordDebounceSkip,
  updateViewStats,
} from "./schedule-planner-metrics.js";

const logger = createLogger("SchedulePlannerReadModel");

export class SchedulePlannerReadModelAdapter implements ISchedulePlannerReadModel {
  async getView(filter: SchedulePlannerFilter): Promise<SchedulePlannerView> {
    const startTime = Date.now();
    logger.info("Building schedule planner view", { filter });

    try {
      const [vesselList, crewMembers, assignments, unfilled, vesselCrewCounts, vesselRequirements] =
        await Promise.all([
          this.fetchVessels(filter.orgId, filter.vesselIds),
          this.fetchCrewMembersWithDetails(
            filter.orgId,
            filter.crewIds,
            filter.roles,
            filter.startDate,
            filter.endDate
          ),
          this.fetchAssignments(filter),
          filter.includeUnfilled !== false ? this.fetchUnfilled(filter) : [],
          this.fetchCurrentCrewPerVessel(filter.orgId),
          this.fetchRequiredCrewPerVessel(filter.orgId),
        ]);

      const vesselMap = new Map(vesselList.map((v) => [v.id, v]));

      for (const vc of vesselCrewCounts) {
        const vessel = vesselMap.get(vc.vesselId);
        if (vessel) {
          vessel.currentCrew = vc.count;
        }
      }

      for (const vr of vesselRequirements) {
        const vessel = vesselMap.get(vr.vesselId);
        if (vessel) {
          vessel.requiredCrew = vr.count;
        }
      }

      const rows = buildRowsFn(crewMembers, assignments, vesselMap);
      const unfilledShifts = buildUnfilledShiftsFn(unfilled, vesselMap, crewMembers);

      const totalAssignments = rows.reduce((sum, r) => sum + r.assignments.length, 0);
      const totalUnfilled = unfilledShifts.length;
      const complianceRate = calculateComplianceRate(rows);
      const crewUtilization = calculateUtilization(rows, filter.startDate, filter.endDate);

      const view: SchedulePlannerView = {
        dateRange: {
          start: filter.startDate,
          end: filter.endDate,
        },
        vessels: vesselList,
        rows,
        unfilledShifts,
        summary: {
          totalAssignments,
          totalUnfilled,
          complianceRate,
          crewUtilization,
        },
        lastRefreshedAt: new Date().toISOString(),
      };

      const durationMs = Date.now() - startTime;
      logger.info("Schedule planner view built", {
        durationMs,
        totalRows: rows.length,
        totalAssignments,
        totalUnfilled,
      });

      recordViewQuery(filter.orgId, "getView", durationMs);
      const allViolations = rows
        .flatMap((r) => r.violations || [])
        .map((v) => ({
          type: v.type,
          severity: v.severity,
        }));
      updateViewStats(filter.orgId, rows.length, complianceRate, crewUtilization, allViolations);

      return view;
    } catch (error) {
      logger.error("Failed to build schedule planner view", { error });
      throw error;
    }
  }

  private debouncer = new RefreshDebouncer(5000);

  async refresh(orgId: string, triggeredBy: string): Promise<void> {
    const startTime = Date.now();

    if (this.debouncer.shouldDebounce(orgId)) {
      logger.debug("Read model refresh debounced", {
        orgId,
        triggeredBy,
      });
      recordDebounceSkip(orgId);
      return;
    }

    this.debouncer.recordRefresh(orgId);
    logger.info("Read model refresh triggered", { orgId, triggeredBy });

    recordRefresh(orgId, triggeredBy, Date.now() - startTime);
  }

  private async fetchVessels(orgId: string, vesselIds?: string[]): Promise<VesselSummary[]> {
    try {
      const conditions = [eq(vessels.orgId, orgId)];
      if (vesselIds?.length) {
        conditions.push(inArray(vessels.id, vesselIds));
      }

      const result = await db
        .select({
          id: vessels.id,
          name: vessels.name,
          active: vessels.active,
          condition: vessels.condition,
        })
        .from(vessels)
        .where(and(...conditions))
        .orderBy(vessels.name);

      return result.map((row) => ({
        id: row.id,
        name: row.name || "Unknown Vessel",
        requiredCrew: 0,
        currentCrew: 0,
        operationalStatus: row.active ? "active" : "inactive",
      }));
    } catch (error) {
      logger.warn("Failed to fetch vessels, returning empty list", { error });
      return [];
    }
  }

  private async fetchCurrentCrewPerVessel(
    orgId: string
  ): Promise<{ vesselId: string; count: number }[]> {
    try {
      const result = await db
        .select({
          vesselId: crew.vesselId,
          count: count(),
        })
        .from(crew)
        .where(and(eq(crew.orgId, orgId), eq(crew.active, true)))
        .groupBy(crew.vesselId);

      return result
        .filter((r) => r.vesselId !== null)
        .map((r) => ({
          vesselId: r.vesselId!,
          count: Number(r.count),
        }));
    } catch (error) {
      logger.warn("Failed to fetch current crew per vessel", { error });
      return [];
    }
  }

  private async fetchRequiredCrewPerVessel(
    orgId: string
  ): Promise<{ vesselId: string; count: number }[]> {
    try {
      const result = await db
        .select({
          vesselId: shiftTemplate.vesselId,
          count: count(),
        })
        .from(shiftTemplate)
        .where(eq(shiftTemplate.orgId, orgId))
        .groupBy(shiftTemplate.vesselId);

      return result
        .filter((r) => r.vesselId !== null)
        .map((r) => ({
          vesselId: r.vesselId!,
          count: Number(r.count),
        }));
    } catch (error) {
      logger.warn("Failed to fetch required crew per vessel", { error });
      return [];
    }
  }

  private async fetchCrewMembersWithDetails(
    orgId: string,
    crewIds?: string[],
    roles?: string[],
    startDate?: string,
    endDate?: string
  ): Promise<CrewMemberSummary[]> {
    try {
      const conditions = [eq(crew.orgId, orgId)];
      if (crewIds?.length) {
        conditions.push(inArray(crew.id, crewIds));
      }
      if (roles?.length) {
        conditions.push(inArray(crew.rank, roles));
      }

      const result = await db
        .select({
          id: crew.id,
          name: crew.name,
          rank: crew.rank,
          active: crew.active,
          onDuty: crew.onDuty,
        })
        .from(crew)
        .where(and(...conditions))
        .orderBy(crew.name);

      const crewIdList = result.map((r) => r.id);
      if (crewIdList.length === 0) {
        return [];
      }

      const [certifications, skills, leaves, weeklyHours] = await Promise.all([
        this.fetchCrewCertifications(crewIdList),
        this.fetchCrewSkills(crewIdList),
        this.fetchCrewLeaves(crewIdList, startDate, endDate),
        this.fetchCrewWeeklyHours(orgId, crewIdList),
      ]);

      const certMap = new Map(certifications.map((c) => [c.crewId, c]));
      const skillsMap = new Map<string, string[]>();
      for (const s of skills) {
        const list = skillsMap.get(s.crewId) || [];
        list.push(s.skill);
        skillsMap.set(s.crewId, list);
      }
      const leaveSet = new Set(leaves.map((l) => l.crewId));
      const hoursMap = new Map(weeklyHours.map((h) => [h.crewId, h.hours]));

      return result.map((row) => {
        const cert = certMap.get(row.id);
        const qualifications = skillsMap.get(row.id) || [];
        const isOnLeave = leaveSet.has(row.id);
        const hoursWorkedThisWeek = hoursMap.get(row.id) || 0;

        let certificationStatus: "valid" | "expiring" | "expired" = "valid";
        if (cert) {
          const now = new Date();
          const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          if (cert.earliestExpiry && cert.earliestExpiry < now) {
            certificationStatus = "expired";
          } else if (cert.earliestExpiry && cert.earliestExpiry < thirtyDaysFromNow) {
            certificationStatus = "expiring";
          }
        }

        let availability: "available" | "limited" | "unavailable" = "unavailable";
        if (isOnLeave) {
          availability = "unavailable";
        } else if (row.active && row.onDuty) {
          availability = "available";
        } else if (row.active && !row.onDuty) {
          availability = "limited";
        }

        return {
          id: row.id,
          name: row.name || "Unknown",
          role: row.rank || "",
          qualifications,
          certificationStatus,
          hoursWorkedThisWeek,
          hoursWorkedThisMonth: hoursWorkedThisWeek * 4,
          isOnLeave,
          availability,
        };
      });
    } catch (error) {
      logger.warn("Failed to fetch crew members, returning empty list", { error });
      return [];
    }
  }

  private async fetchCrewCertifications(
    crewIds: string[]
  ): Promise<{ crewId: string; earliestExpiry: Date | null }[]> {
    try {
      const result = await db
        .select({
          crewId: crewCertification.crewId,
          expiresAt: sql<Date>`MIN(${crewCertification.expiresAt})`.as("earliest_expiry"),
        })
        .from(crewCertification)
        .where(inArray(crewCertification.crewId, crewIds))
        .groupBy(crewCertification.crewId);

      return result.map((r) => ({
        crewId: r.crewId,
        earliestExpiry: r.expiresAt,
      }));
    } catch (error) {
      logger.warn("Failed to fetch crew certifications", { error });
      return [];
    }
  }

  private async fetchCrewSkills(crewIds: string[]): Promise<{ crewId: string; skill: string }[]> {
    try {
      return await db
        .select({
          crewId: crewSkill.crewId,
          skill: crewSkill.skill,
        })
        .from(crewSkill)
        .where(inArray(crewSkill.crewId, crewIds));
    } catch (error) {
      logger.warn("Failed to fetch crew skills", { error });
      return [];
    }
  }

  private async fetchCrewLeaves(
    crewIds: string[],
    startDate?: string,
    endDate?: string
  ): Promise<{ crewId: string }[]> {
    try {
      const now = new Date();
      const start = startDate ? new Date(startDate) : now;
      const end = endDate ? new Date(endDate) : now;

      return await db
        .select({
          crewId: crewLeave.crewId,
        })
        .from(crewLeave)
        .where(
          and(
            inArray(crewLeave.crewId, crewIds),
            lte(crewLeave.start, end),
            gte(crewLeave.end, start)
          )
        );
    } catch (error) {
      logger.warn("Failed to fetch crew leaves", { error });
      return [];
    }
  }

  private async fetchCrewWeeklyHours(
    orgId: string,
    crewIds: string[]
  ): Promise<{ crewId: string; hours: number }[]> {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await db
        .select({
          crewId: crewAssignment.crewId,
          count: count(),
        })
        .from(crewAssignment)
        .where(
          and(
            eq(crewAssignment.orgId, orgId),
            inArray(crewAssignment.crewId, crewIds),
            gte(crewAssignment.start, weekAgo),
            lte(crewAssignment.start, now)
          )
        )
        .groupBy(crewAssignment.crewId);

      return result.map((r) => ({
        crewId: r.crewId,
        hours: Number(r.count) * 8,
      }));
    } catch (error) {
      logger.warn("Failed to fetch crew weekly hours", { error });
      return [];
    }
  }

  private async fetchAssignments(filter: SchedulePlannerFilter): Promise<ScheduleDayCell[]> {
    try {
      const startDate = new Date(filter.startDate);
      const endDate = new Date(filter.endDate);

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

      const result = await db
        .select({
          assignmentId: scheduleAssignments.id,
          runId: scheduleAssignments.runId,
          crewId: scheduleAssignments.crewId,
          vesselId: scheduleAssignments.vesselId,
          date: scheduleAssignments.date,
          shift: scheduleAssignments.shift,
          role: scheduleAssignments.role,
          status: scheduleAssignments.status,
          crewName: crew.name,
          vesselName: vessels.name,
        })
        .from(scheduleAssignments)
        .innerJoin(schedulerRuns, eq(scheduleAssignments.runId, schedulerRuns.id))
        .innerJoin(crew, eq(scheduleAssignments.crewId, crew.id))
        .leftJoin(vessels, eq(scheduleAssignments.vesselId, vessels.id))
        .where(and(...conditions))
        .orderBy(scheduleAssignments.date);

      return result.map((row) => ({
        date: formatDate(row.date),
        shift: mapShift(row.shift),
        crewId: row.crewId,
        crewName: row.crewName || "Unknown",
        vesselId: row.vesselId || "",
        vesselName: row.vesselName || "Unknown Vessel",
        role: row.role,
        status: mapStatus(row.status),
        assignmentId: row.assignmentId,
        runId: row.runId,
        hasViolation: false,
      }));
    } catch (error) {
      logger.warn("Failed to fetch assignments, returning empty list", { error });
      return [];
    }
  }

  private async fetchUnfilled(filter: SchedulePlannerFilter): Promise<UnfilledShiftSummary[]> {
    try {
      const startDate = new Date(filter.startDate);
      const endDate = new Date(filter.endDate);

      const conditions = [
        eq(schedulerRuns.orgId, filter.orgId),
        gte(scheduleUnfilled.date, startDate),
        lte(scheduleUnfilled.date, endDate),
      ];

      if (filter.vesselIds?.length) {
        conditions.push(inArray(scheduleUnfilled.vesselId, filter.vesselIds));
      }

      const result = await db
        .select({
          vesselId: scheduleUnfilled.vesselId,
          date: scheduleUnfilled.date,
          shift: scheduleUnfilled.shift,
          role: scheduleUnfilled.role,
          reason: scheduleUnfilled.reason,
          vesselName: vessels.name,
        })
        .from(scheduleUnfilled)
        .innerJoin(schedulerRuns, eq(scheduleUnfilled.runId, schedulerRuns.id))
        .leftJoin(vessels, eq(scheduleUnfilled.vesselId, vessels.id))
        .where(and(...conditions))
        .orderBy(scheduleUnfilled.date);

      return result.map((row) => ({
        date: formatDate(row.date),
        shift: mapShift(row.shift),
        vesselId: row.vesselId || "",
        vesselName: row.vesselName || "Unknown Vessel",
        role: row.role,
        reason: row.reason,
        candidateCrew: [],
      }));
    } catch (error) {
      logger.warn("Failed to fetch unfilled shifts, returning empty list", { error });
      return [];
    }
  }
}

export const schedulePlannerReadModel = new SchedulePlannerReadModelAdapter();
