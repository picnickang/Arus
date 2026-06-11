import type { Express, Response } from "express";
import {
  checkAllConstraints,
  type ConstraintCheckContext,
} from "../../../domain/scheduling/constraints.js";
import {
  getTopSuggestions,
  rankCrewSuggestions,
  type ScoringContext,
} from "../../../domain/scheduling/scoring.js";
import {
  DEFAULT_SCHEDULING_PREFERENCES,
  type ConstraintViolation,
} from "../../../domain/scheduling/types.js";
import { dbCrewStorage } from "../../../db/crew/index.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { createLogger } from "../../../lib/structured-logger";
import { sendSchedulePublishedNotification } from "../../../services/scheduler-notifications/index.js";
import { vesselService } from "../../../services/domains/vessel-service.js";
import type { AuthenticatedRequest } from "./types.js";
import {
  applySuggestionSchema,
  assignmentIdParamSchema,
  publishSchema,
} from "./scheduler-route-schemas.js";

const logger = createLogger("Domains:CrewExtensions:Interfaces:SchedulerRoutes");

export function registerSchedulerSuggestionRoutes(app: Express): void {
  app.get(
    "/api/crew-extensions/scheduler/constraints/:assignmentId",
    withErrorHandling(
      "get assignment constraints",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const { assignmentId } = assignmentIdParamSchema.parse(req.params);

        const allAssignments = await dbCrewStorage.getCrewAssignments();
        const orgAssignments = allAssignments.filter((a) => !a.orgId || a.orgId === orgId);
        const assignment = orgAssignments.find((a) => a.id === assignmentId);

        if (!assignment) {
          return res.json([]);
        }

        const crewAssignments = orgAssignments.filter(
          (a) => a.crewId === assignment.crewId && a.id !== assignmentId
        );

        const allLeaves = await dbCrewStorage.getCrewLeave(undefined, orgId);
        const leaves = allLeaves.filter((l) => !l.orgId || l.orgId === orgId);
        const crewList = await dbCrewStorage.getCrew(orgId);
        const crewMember = crewList.find((c) => c.id === assignment.crewId);

        const shiftStart = new Date(assignment.start || assignment.date);
        const shiftEnd = new Date(assignment.end || assignment.date);
        const weekStart = new Date(shiftStart);
        weekStart.setDate(weekStart.getDate() - 7);

        const weeklyAssignments = crewAssignments.filter((a) => {
          const aStart = new Date(a.start || a.date);
          return aStart >= weekStart && aStart <= shiftEnd;
        });

        const weeklyHours = weeklyAssignments.reduce((sum: number, a) => {
          const start = new Date(a.start || a.date);
          const end = new Date(a.end || a.date);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }, 0);

        const previousAssignments = crewAssignments
          .filter((a) => new Date(a.end || a.date) < shiftStart)
          .sort(
            (a, b) => new Date(b.end || b.date).getTime() - new Date(a.end || a.date).getTime()
          );

        const lastShiftEnd = previousAssignments[0]
          ? new Date(previousAssignments[0].end || previousAssignments[0].date)
          : null;

        const shiftDuration = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);

        const context: ConstraintCheckContext = {
          crewId: assignment.crewId,
          crewName: crewMember?.name || "Unknown",
          date: assignment.date || shiftStart.toISOString().split("T")[0] || "",
          shiftStart,
          shiftEnd,
          existingAssignments: crewAssignments.map((a) => ({
            start: new Date(a.start || a.date),
            end: new Date(a.end || a.date),
            crewId: a.crewId,
          })),
          leaveRecords: leaves
            .filter((l) => l.crewId === assignment.crewId)
            .map((l) => ({
              crewId: l.crewId,
              start: l.start ?? new Date(0),
              end: l.end ?? new Date(0),
            })),
          certifications: [],
          preferences: DEFAULT_SCHEDULING_PREFERENCES,
        };

        const violations = checkAllConstraints(
          context,
          lastShiftEnd,
          weeklyHours,
          shiftDuration,
          assignment.role,
          77
        );

        const frontendViolations = violations.map((v) => ({
          severity: v.severity === "error" ? "HARD" : "SOFT",
          code: v.constraint.type.toUpperCase(),
          message: v.description,
          affectedIds: { crewId: v.crewId, assignmentId },
        }));

        return res.json(frontendViolations);
      }
    )
  );

  app.get(
    "/api/crew-extensions/scheduler/suggestions/:assignmentId",
    withErrorHandling("get crew suggestions", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { assignmentId } = assignmentIdParamSchema.parse(req.params);

      const allAssignments = await dbCrewStorage.getCrewAssignments();
      const orgAssignments = allAssignments.filter((a) => !a.orgId || a.orgId === orgId);
      const assignment = orgAssignments.find((a) => a.id === assignmentId);

      if (!assignment) {
        return res.json([]);
      }

      const crewList = await dbCrewStorage.getCrew(orgId);
      const allLeaves = await dbCrewStorage.getCrewLeave(undefined, orgId);
      const leaves = allLeaves.filter((l) => !l.orgId || l.orgId === orgId);

      const shiftStart = new Date(assignment.start || assignment.date);
      const shiftEnd = new Date(assignment.end || assignment.date);

      const scoringContexts: ScoringContext[] = crewList
        .filter((c) => c.active !== false)
        .map((crew) => {
          const crewAssignments = orgAssignments.filter((a) => a.crewId === crew.id);
          const avgCount = orgAssignments.length / Math.max(1, crewList.length);

          const previousAssignments = crewAssignments
            .filter((a) => new Date(a.end || a.date) < shiftStart)
            .sort(
              (a, b) => new Date(b.end || b.date).getTime() - new Date(a.end || a.date).getTime()
            );

          const lastShiftEnd = previousAssignments[0]
            ? new Date(previousAssignments[0].end || previousAssignments[0].date)
            : undefined;

          let consecutiveDays = 0;
          if (lastShiftEnd) {
            consecutiveDays = Math.floor(
              (shiftStart.getTime() - lastShiftEnd.getTime()) / (1000 * 60 * 60 * 24)
            );
            consecutiveDays = Math.max(0, 28 - consecutiveDays);
          }

          const crewLeaves = leaves.filter((l) => l.crewId === crew.id);
          const constraints: ConstraintViolation[] = [];

          for (const leave of crewLeaves) {
            const leaveStart = leave.start ?? new Date(0);
            const leaveEnd = leave.end ?? new Date(0);
            if (shiftStart < leaveEnd && shiftEnd > leaveStart) {
              constraints.push({
                constraint: { type: "leave", enforcement: "hard", description: "On leave" },
                crewId: crew.id,
                crewName: crew.name,
                date: shiftStart.toISOString().split("T")[0] ?? "",
                description: "On approved leave during this period",
                severity: "error",
              });
            }
          }

          let fatigueRisk: "low" | "medium" | "high" = "low";
          if (consecutiveDays > 21) {
            fatigueRisk = "high";
          } else if (consecutiveDays > 14) {
            fatigueRisk = "medium";
          }

          const ctx: ScoringContext = {
            crewId: crew.id,
            crewName: crew.name,
            rank: crew.rank ?? undefined,
            avatarUrl: undefined,
            vesselId: crew.vesselId ?? undefined,
            targetVesselId: assignment.vesselId ?? undefined,
            currentAssignmentCount: crewAssignments.length,
            avgAssignmentCount: avgCount,
            consecutiveDaysOnboard: consecutiveDays,
            lastShiftEnd,
            fatigueRisk,
            constraints,
          };
          return ctx;
        });

      const ranked = rankCrewSuggestions(scoringContexts, DEFAULT_SCHEDULING_PREFERENCES);
      const topSuggestions = getTopSuggestions(ranked, 5);

      const frontendSuggestions = topSuggestions.map((s, idx) => ({
        id: `suggestion-${idx}`,
        suggestedCrewId: s.crewId,
        suggestedCrewName: s.crewName,
        suggestedCrewRank: s.rank,
        reason: s.reasons.join(". ") || "Available for assignment",
        score: s.score,
        constraints: s.reasons,
        availability:
          s.availability === "available"
            ? "available"
            : s.availability === "on_leave"
              ? "leave"
              : "on_duty",
        certStatus: "valid" as const,
        badgeCode: s.availabilityTag,
      }));

      return res.json(frontendSuggestions);
    })
  );

  app.post(
    "/api/crew-extensions/scheduler/apply-suggestion",
    withErrorHandling("apply crew suggestion", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const validated = applySuggestionSchema.safeParse(req.body);

      if (!validated.success) {
        return res.status(400).json({ error: "assignmentId and suggestedCrewId are required" });
      }

      const { assignmentId, suggestedCrewId } = validated.data;
      const allAssignments = await dbCrewStorage.getCrewAssignments();
      const assignment = allAssignments.find((a) => a.id === assignmentId);

      if (!assignment || (assignment.orgId && assignment.orgId !== orgId)) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const crewList = await dbCrewStorage.getCrew(orgId);
      const crewMember = crewList.find((c) => c.id === suggestedCrewId);

      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }

      const updated = await dbCrewStorage.updateCrewAssignment(
        assignmentId,
        {
          crewId: suggestedCrewId,
          status: "scheduled",
        },
        orgId
      );

      return res.json({
        success: true,
        assignment: {
          id: updated.id,
          crewId: updated.crewId,
          crewName: crewMember?.name || "Unknown",
          status: "confirmed",
        },
      });
    })
  );

  app.post(
    "/api/crew-extensions/scheduler/publish",
    withErrorHandling("publish schedule", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const validated = publishSchema.safeParse(req.body);

      if (!validated.success) {
        return res.status(400).json({ error: "from and to date parameters are required" });
      }

      const { vesselId, from, to } = validated.data;
      const allAssignments = await dbCrewStorage.getCrewAssignments();
      const orgAssignments = allAssignments.filter((a) => !a.orgId || a.orgId === orgId);
      const fromDate = new Date(from);
      const toDate = new Date(to);

      const assignmentsToPublish = orgAssignments.filter((a) => {
        const aStart = new Date(a.start || a.date);
        const aEnd = new Date(a.end || a.date);
        const inRange = aStart <= toDate && aEnd >= fromDate;
        const matchesVessel = !vesselId || a.vesselId === vesselId;
        return inRange && matchesVessel && a.status !== "scheduled";
      });

      let publishedCount = 0;
      for (const assignment of assignmentsToPublish) {
        await dbCrewStorage.updateCrewAssignment(assignment.id, { status: "scheduled" }, orgId);
        publishedCount++;
      }

      if (publishedCount > 0) {
        try {
          const crewMembers = await dbCrewStorage.getCrew(orgId);
          const vessels = await vesselService.getVessels();

          type AssignmentInfoArg = Parameters<typeof sendSchedulePublishedNotification>[1][number];
          const assignmentInfos: AssignmentInfoArg[] = assignmentsToPublish.map((a) => {
            const crew = crewMembers.find((c) => c.id === a.crewId);
            const vessel = vessels.find((v) => v.id === a.vesselId);
            return {
              id: a.id,
              crewId: a.crewId,
              crewName: crew?.name || "Unknown Crew",
              vesselId: a.vesselId ?? "",
              vesselName: vessel?.name,
              startDate: String(a.start || a.date || ""),
              endDate: String(a.end || a.date || ""),
              role: a.role ?? undefined,
            };
          });

          sendSchedulePublishedNotification({ orgId, vesselId }, assignmentInfos, {
            from,
            to,
          }).catch((err) => logger.error("Failed to send publish notifications:", undefined, err));
        } catch (notifyErr) {
          logger.error("Failed to prepare publish notifications:", undefined, notifyErr);
        }
      }

      return res.json({
        success: true,
        publishedCount,
        message: `Published ${publishedCount} assignments`,
      });
    })
  );
}
