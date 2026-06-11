/**
 * Crew Scheduler Routes
 * Scheduling and planning endpoints
 */

import type { Express, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest, CrewExtensionsRoutesConfig } from "./types.js";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import { sendBadRequest } from "../../../lib/api-helpers.js";
import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Domains:CrewExtensions:Interfaces:SchedulerRoutes");
import {
  checkAllConstraints,
  type ConstraintCheckContext,
} from "../../../domain/scheduling/constraints.js";
import {
  rankCrewSuggestions,
  getTopSuggestions,
  type ScoringContext,
} from "../../../domain/scheduling/scoring.js";
import {
  DEFAULT_SCHEDULING_PREFERENCES,
  type ConstraintViolation,
} from "../../../domain/scheduling/types.js";
import { dbSchedulerStorage } from "../../../db/scheduler/index.js";
import { dbCrewStorage } from "../../../db/crew/index.js";
import { vesselService } from "../../../services/domains/vessel-service.js";
import {
  planAndMaybeExecute,
  applySchedule,
  cancelScheduleRun,
  clearSchedulerRunHistory,
  simulateSchedule,
  applySimulatedSchedule,
  revertGeneratedSchedule,
  type SimulationResult,
} from "../../../scheduler/scheduler-controller.js";
import { previewScheduleCompliance } from "../../../scheduler/compliance-preview.js";
import { generateHoRFromSchedule } from "../../../scheduler/hor-generator.js";
import { sendSchedulePublishedNotification } from "../../../services/scheduler-notifications/index.js";
import { canAssignCrew } from "../../../services/hor-projector/constraint-checker.js";
import { projectComplianceFromAssignments } from "../../../services/hor-projector/projector.js";
import { crewExtensionsAppService, scheduleSimulationService } from "../application/index.js";

const idParamSchema = z.object({ id: z.string().min(1) });
const assignmentIdParamSchema = z.object({ assignmentId: z.string().min(1) });
const runIdParamSchema = z.object({ runId: z.string().min(1) });
const planBodySchema = z.object({
  from: z.string(),
  days: z.number().optional(),
  vessels: z.array(z.string()).optional(),
  mode: z.enum(["dry_run", "auto", "execute", "simulate"]).optional(),
});
const runsQuerySchema = z.object({ limit: z.string().optional() });
const scheduleAssignmentPreviewSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  orgId: z.string().min(1),
  crewId: z.string().min(1),
  shiftId: z.string().min(1),
  date: z.string().min(1),
  vesselId: z.string().nullable().optional().default(null),
  start: z.coerce.date(),
  end: z.coerce.date(),
  role: z.string().nullable().optional().default(null),
  executed: z.boolean().nullable().optional().default(null),
  createdAt: z.coerce.date().nullable().optional().default(null),
});
const previewComplianceBodySchema = z.object({
  scheduleRunId: z.string().optional(),
  assignments: z.array(scheduleAssignmentPreviewSchema).optional(),
});
const simulateBodySchema = z.object({
  from: z.string(),
  days: z.number().optional(),
  vessels: z.array(z.string()).optional(),
  fillUnassignedOnly: z.boolean().optional(),
});
const applyDraftBodySchema = z.object({
  simulationResult: z
    .custom<SimulationResult>(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        "proposed" in v &&
        Array.isArray((v as { proposed: unknown }).proposed),
      { message: "simulationResult must include a proposed assignments array" }
    )
    .optional(),
  skipCollisions: z.boolean().optional(),
  vesselIds: z.array(z.string()).optional(),
});

export function registerSchedulerRoutes(app: Express, config: CrewExtensionsRoutesConfig) {
  const { crewOperationRateLimit } = config;

  app.post(
    "/api/schedule/plan",
    crewOperationRateLimit,
    withErrorHandling("plan schedule", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { from, days, vessels, mode } = planBodySchema.parse(req.body ?? {});
      const result = await planAndMaybeExecute({
        orgId,
        from,
        days: days || 7,
        vessels,
        mode: mode || "dry_run",
      });
      return res.json(result);
    })
  );

  app.get(
    "/api/schedule/runs",
    withErrorHandling("fetch scheduler runs", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { limit } = runsQuerySchema.parse(req.query);
      const runs = await dbSchedulerStorage.getSchedulerRuns(
        orgId,
        undefined,
        limit ? Number.parseInt(limit) : 50
      );
      const transformed = runs.map((run) => {
        const bag = run as Record<string, unknown>;
        const completedAt = bag["completedAt"] as string | Date | null | undefined;
        return {
          id: run.id,
          orgId: run.orgId,
          status: run.status,
          fromDate: run.startDate ? new Date(run.startDate).toISOString() : null,
          toDate: run.endDate ? new Date(run.endDate).toISOString() : null,
          createdAt: run.createdAt ? new Date(run.createdAt).toISOString() : null,
          appliedAt: completedAt ? new Date(completedAt).toISOString() : null,
          generatedByRunId: (bag["generatedByRunId"] as string | null | undefined) ?? null,
          stats: {
            proposed: (bag["totalAssignments"] as number | undefined) ?? 0,
            unfilled: (bag["unfilledCount"] as number | undefined) ?? 0,
            collisions: 0,
          },
        };
      });
      return res.json(transformed);
    })
  );

  app.get(
    "/api/schedule/runs/:id",
    withErrorHandling("fetch scheduler run", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { id } = idParamSchema.parse(req.params);
      const run = await dbSchedulerStorage.getSchedulerRun(id);
      if (!run || run.orgId !== orgId) {
        return sendNotFound(res, "Scheduler run");
      }
      const assignments = await dbSchedulerStorage.getScheduleAssignmentsByRun(id);
      return res.json({ ...run, assignments });
    })
  );

  app.post(
    "/api/schedule/runs/:id/apply",
    crewOperationRateLimit,
    withErrorHandling("apply scheduler run", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { id } = idParamSchema.parse(req.params);
      const result = await applySchedule(id, orgId);
      return res.json(result);
    })
  );

  app.post(
    "/api/schedule/runs/:id/cancel",
    crewOperationRateLimit,
    withErrorHandling("cancel scheduler run", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { id } = idParamSchema.parse(req.params);
      const result = await cancelScheduleRun(id, orgId);
      return res.json(result);
    })
  );

  app.delete(
    "/api/schedule/runs",
    crewOperationRateLimit,
    withErrorHandling(
      "clear scheduler run history",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const result = await clearSchedulerRunHistory(orgId);
        return res.json(result);
      }
    )
  );

  app.post(
    "/api/schedule/preview-compliance",
    crewOperationRateLimit,
    withErrorHandling("preview compliance", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { scheduleRunId, assignments: draftAssignments } = previewComplianceBodySchema.parse(
        req.body ?? {}
      );
      let assignments: Awaited<ReturnType<typeof dbSchedulerStorage.getScheduleAssignmentsByRun>> =
        [];

      if (scheduleRunId) {
        const existing = await dbSchedulerStorage.getSchedulerRun(scheduleRunId);
        if (!existing || existing.orgId !== orgId) {
          return sendNotFound(res, "Scheduler run");
        }
        assignments = await dbSchedulerStorage.getScheduleAssignmentsByRun(scheduleRunId);
      } else if (draftAssignments && Array.isArray(draftAssignments)) {
        assignments = draftAssignments;
      } else {
        return sendBadRequest(res, "Either scheduleRunId or assignments array is required");
      }

      if (assignments.length === 0) {
        return res.json({
          isCompliant: true,
          violations: [],
          summary: { totalCrew: 0, compliantCrew: 0, violationCount: 0, warningCount: 0 },
        });
      }
      const result = await previewScheduleCompliance(orgId, assignments);
      return res.json(result);
    })
  );

  app.post(
    "/api/schedule/runs/:id/generate-hor",
    crewOperationRateLimit,
    withErrorHandling(
      "generate Hours of Rest",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const { id } = idParamSchema.parse(req.params);
        const existing = await dbSchedulerStorage.getSchedulerRun(id);

        if (!existing || existing.orgId !== orgId) {
          return sendNotFound(res, "Scheduler run");
        }
        const result = await generateHoRFromSchedule(id);

        if (result.success) {
          return res.json({
            ...result,
            success: true,
            message: `Generated ${result.sheetsCreated} rest sheets with ${result.daysCreated} days`,
          });
        }
        return res.status(400).json({ ...result, success: false, errors: result.errors });
      }
    )
  );

  // Get constraint violations for a specific assignment
  app.get(
    "/api/crew-extensions/scheduler/constraints/:assignmentId",
    withErrorHandling(
      "get assignment constraints",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const { assignmentId } = assignmentIdParamSchema.parse(req.params);

        // Get assignments with org scoping
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

        // Calculate weekly hours from existing assignments
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

        // Find last shift end for rest calculation
        const previousAssignments = crewAssignments
          .filter((a) => new Date(a.end || a.date) < shiftStart)
          .sort(
            (a, b) => new Date(b.end || b.date).getTime() - new Date(a.end || a.date).getTime()
          );

        const lastShiftEnd = previousAssignments[0]
          ? new Date(previousAssignments[0].end || previousAssignments[0].date)
          : null;

        const shiftDuration = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);

        // Build constraint check context
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
          77 // STCW max weekly hours
        );

        // Map to frontend format
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

  // Get AI suggestions for an assignment slot
  app.get(
    "/api/crew-extensions/scheduler/suggestions/:assignmentId",
    withErrorHandling("get crew suggestions", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { assignmentId } = assignmentIdParamSchema.parse(req.params);

      // Get assignments with org scoping
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

      // Build scoring contexts for all crew
      const scoringContexts: ScoringContext[] = crewList
        .filter((c) => c.active !== false)
        .map((crew) => {
          // Count assignments for this crew (org scoped)
          const crewAssignments = orgAssignments.filter((a) => a.crewId === crew.id);
          const avgCount = orgAssignments.length / Math.max(1, crewList.length);

          // Find last shift end
          const previousAssignments = crewAssignments
            .filter((a) => new Date(a.end || a.date) < shiftStart)
            .sort(
              (a, b) => new Date(b.end || b.date).getTime() - new Date(a.end || a.date).getTime()
            );

          const lastShiftEnd = previousAssignments[0]
            ? new Date(previousAssignments[0].end || previousAssignments[0].date)
            : undefined;

          // Calculate consecutive days on board
          let consecutiveDays = 0;
          if (lastShiftEnd) {
            consecutiveDays = Math.floor(
              (shiftStart.getTime() - lastShiftEnd.getTime()) / (1000 * 60 * 60 * 24)
            );
            consecutiveDays = Math.max(0, 28 - consecutiveDays);
          }

          // Check for leave conflicts
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

          // Calculate fatigue risk based on consecutive days
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

      // Rank and filter suggestions
      const ranked = rankCrewSuggestions(scoringContexts, DEFAULT_SCHEDULING_PREFERENCES);
      const topSuggestions = getTopSuggestions(ranked, 5);

      // Map to frontend format
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

  // Zod schema for apply suggestion
  const applySuggestionSchema = z.object({
    assignmentId: z.string().min(1),
    suggestedCrewId: z.string().min(1),
  });

  // Apply AI suggestion to assignment
  app.post(
    "/api/crew-extensions/scheduler/apply-suggestion",
    withErrorHandling("apply crew suggestion", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const validated = applySuggestionSchema.safeParse(req.body);

      if (!validated.success) {
        return res.status(400).json({ error: "assignmentId and suggestedCrewId are required" });
      }

      const { assignmentId, suggestedCrewId } = validated.data;

      // Load and verify assignment belongs to this org
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

  // Zod schema for publish
  const publishSchema = z.object({
    vesselId: z.string().optional(),
    from: z.string().min(1),
    to: z.string().min(1),
  });

  // Publish schedule
  app.post(
    "/api/crew-extensions/scheduler/publish",
    withErrorHandling("publish schedule", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const validated = publishSchema.safeParse(req.body);

      if (!validated.success) {
        return res.status(400).json({ error: "from and to date parameters are required" });
      }

      const { vesselId, from, to } = validated.data;

      // Get assignments with org scoping
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

      // Update all matching assignments to published status
      let publishedCount = 0;
      for (const assignment of assignmentsToPublish) {
        await dbCrewStorage.updateCrewAssignment(assignment.id, { status: "scheduled" }, orgId);
        publishedCount++;
      }

      // Send notifications (async, don't block response)
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

  // Schedule Generator: Simulate (no DB writes)
  app.post(
    "/api/schedule/simulate",
    crewOperationRateLimit,
    withErrorHandling("simulate schedule", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { from, days, vessels, fillUnassignedOnly } = simulateBodySchema.parse(req.body ?? {});
      const result = await simulateSchedule({
        orgId,
        from,
        days: days || 7,
        vessels,
        fillUnassignedOnly: fillUnassignedOnly !== false,
      });
      return res.json(result);
    })
  );

  // Schedule Generator: Apply simulated schedule as drafts
  app.post(
    "/api/schedule/apply-draft",
    crewOperationRateLimit,
    withErrorHandling(
      "apply simulated schedule",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const { simulationResult, skipCollisions, vesselIds } = applyDraftBodySchema.parse(
          req.body ?? {}
        );

        if (!simulationResult || !simulationResult.proposed) {
          return res
            .status(400)
            .json({ error: "simulationResult with proposed assignments is required" });
        }

        const result = await applySimulatedSchedule({
          orgId,
          simulationResult,
          skipCollisions: skipCollisions !== false,
          vesselIds: vesselIds && Array.isArray(vesselIds) ? vesselIds : undefined,
        });
        return res.json(result);
      }
    )
  );

  // Schedule Generator: Revert generated schedule (deletes only drafts)
  app.post(
    "/api/schedule/revert/:runId",
    crewOperationRateLimit,
    withErrorHandling(
      "revert generated schedule",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const { runId } = runIdParamSchema.parse(req.params);

        if (!runId) {
          return res.status(400).json({ error: "runId is required" });
        }

        const result = await revertGeneratedSchedule({ orgId, runId });
        return res.json(result);
      }
    )
  );

  // Real-time HoR projection: Check if crew can be assigned
  const canAssignSchema = z.object({
    crewId: z.string().min(1),
    proposedAssignment: z.object({
      id: z.string().optional(),
      crewId: z.string().min(1),
      crewName: z.string().optional(),
      vesselId: z.string().optional(),
      start: z.string().min(1),
      end: z.string().min(1),
      shiftName: z.string().optional(),
      position: z.string().optional(),
    }),
    existingDrafts: z
      .array(
        z.object({
          id: z.string().optional(),
          crewId: z.string().min(1),
          crewName: z.string().optional(),
          vesselId: z.string().optional(),
          start: z.string().min(1),
          end: z.string().min(1),
          shiftName: z.string().optional(),
          position: z.string().optional(),
        })
      )
      .optional(),
  });

  app.post(
    "/api/crew-extensions/scheduler/can-assign",
    crewOperationRateLimit,
    withErrorHandling(
      "check assignment compliance",
      async (req: AuthenticatedRequest, res: Response) => {
        const validated = canAssignSchema.safeParse(req.body);

        if (!validated.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: validated.error.issues,
          });
        }

        const { crewId, proposedAssignment, existingDrafts } = validated.data;

        try {
          const result = await canAssignCrew(crewId, proposedAssignment, existingDrafts);
          return res.json(result);
        } catch (error) {
          logger.error("Failed to check assignment compliance:", undefined, error);
          return res.json({
            canAssign: true,
            violations: [],
            projectedRestHours: 24,
            projectedWeeklyWork: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    )
  );

  // Bulk project compliance for multiple assignments
  const projectComplianceSchema = z.object({
    assignments: z.array(
      z.object({
        id: z.string().optional(),
        crewId: z.string().min(1),
        crewName: z.string().optional(),
        vesselId: z.string().optional(),
        start: z.string().min(1),
        end: z.string().min(1),
        shiftName: z.string().optional(),
        position: z.string().optional(),
      })
    ),
  });

  app.post(
    "/api/crew-extensions/scheduler/project-compliance",
    crewOperationRateLimit,
    withErrorHandling(
      "project bulk compliance",
      async (req: AuthenticatedRequest, res: Response) => {
        const validated = projectComplianceSchema.safeParse(req.body);

        if (!validated.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: validated.error.issues,
          });
        }

        const { assignments } = validated.data;

        if (assignments.length === 0) {
          return res.json({
            isCompliant: true,
            violations: [],
            summary: {
              totalCrew: 0,
              compliantCrew: 0,
              warningCount: 0,
              errorCount: 0,
            },
          });
        }

        try {
          const result = projectComplianceFromAssignments(assignments);
          return res.json({
            isCompliant: result.isCompliant,
            violations: result.violations,
            summary: result.summary,
          });
        } catch (error) {
          logger.error("Failed to project bulk compliance:", undefined, error);
          return res.json({
            isCompliant: true,
            violations: [],
            summary: {
              totalCrew: 0,
              compliantCrew: 0,
              warningCount: 0,
              errorCount: 0,
            },
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    )
  );

  const plannerViewQuerySchema = z.object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
      .optional(),
    vesselIds: z.string().optional(),
    crewIds: z.string().optional(),
    roles: z.string().optional(),
    status: z.string().optional(),
    includeUnfilled: z.enum(["true", "false"]).optional(),
  });

  const refreshRequestSchema = z.object({
    force: z.boolean().optional().default(false),
  });

  app.get(
    "/api/crew-extensions/scheduler/planner-view",
    withErrorHandling(
      "get schedule planner view",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;

        const parseResult = plannerViewQuerySchema.safeParse(req.query);
        if (!parseResult.success) {
          return res.status(400).json({
            error: "Invalid query parameters",
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          });
        }

        const { startDate, endDate, vesselIds, crewIds, roles, status, includeUnfilled } =
          parseResult.data;

        const filter = {
          orgId,
          startDate: startDate || new Date().toISOString().split("T")[0],
          endDate:
            endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          vesselIds: vesselIds ? vesselIds.split(",").filter(Boolean) : undefined,
          crewIds: crewIds ? crewIds.split(",").filter(Boolean) : undefined,
          roles: roles ? roles.split(",").filter(Boolean) : undefined,
          status: status ? status.split(",").filter(Boolean) : undefined,
          includeUnfilled: includeUnfilled !== "false",
        };
        const view = await crewExtensionsAppService.getSchedulePlannerView(
          filter as Parameters<typeof crewExtensionsAppService.getSchedulePlannerView>[0]
        );
        return res.json(view);
      }
    )
  );

  app.post(
    "/api/crew-extensions/scheduler/planner-view/refresh",
    crewOperationRateLimit,
    withErrorHandling(
      "refresh schedule planner view",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const userId = req.session?.user?.id || "system";

        const parseResult = refreshRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          });
        }
        await crewExtensionsAppService.refreshSchedulePlannerView(orgId, userId);
        return res.json({ success: true, refreshedAt: new Date().toISOString() });
      }
    )
  );

  const simulateSchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
    days: z.number().int().min(1).max(90).default(7),
    vessels: z.array(z.string()).optional(),
    crewIds: z.array(z.string()).optional(),
    strategy: z.enum(["balanced", "minimize_changes", "maximize_rest", "fill_gaps"]).optional(),
  });

  app.post(
    "/api/crew-extensions/scheduler/simulate",
    crewOperationRateLimit,
    withErrorHandling(
      "simulate schedule generation",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const userId = req.session?.user?.id;

        const parseResult = simulateSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          });
        }

        const { from, days, vessels, crewIds, strategy } = parseResult.data;
        const preview = await scheduleSimulationService.simulate(
          {
            orgId,
            from,
            days,
            vessels,
            crewIds,
            strategy,
          },
          userId
        );

        return res.json({
          previewId: preview.previewId,
          expiresAt: preview.expiresAt.toISOString(),
          proposedAssignments: preview.proposedAssignments,
          unfilledShifts: preview.unfilledShifts,
          compliance: preview.compliance,
          diff: preview.diff,
          summary: preview.summary,
        });
      }
    )
  );

  app.get(
    "/api/crew-extensions/scheduler/preview",
    withErrorHandling(
      "get simulation preview",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const { previewId } = z.object({ previewId: z.string().optional() }).parse(req.query);
        let preview;
        if (previewId && typeof previewId === "string") {
          preview = await scheduleSimulationService.getPreview(previewId, orgId);
        } else {
          preview = await scheduleSimulationService.getLatestPreview(orgId);
        }

        if (!preview) {
          return res.status(404).json({
            error: "No simulation preview found",
            message: previewId ? "Preview may have expired" : "No active simulation",
          });
        }

        return res.json({
          previewId: preview.previewId,
          createdAt: preview.createdAt.toISOString(),
          expiresAt: preview.expiresAt.toISOString(),
          command: preview.command,
          proposedAssignments: preview.proposedAssignments,
          unfilledShifts: preview.unfilledShifts,
          compliance: preview.compliance,
          diff: preview.diff,
          summary: preview.summary,
        });
      }
    )
  );

  const commitSchema = z.object({
    previewId: z.string().min(1),
    selectedAssignmentIds: z.array(z.string()).optional(),
  });

  app.post(
    "/api/crew-extensions/scheduler/preview/commit",
    crewOperationRateLimit,
    withErrorHandling(
      "commit simulation preview",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const userId = req.session?.user?.id;

        const parseResult = commitSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          });
        }

        const { previewId, selectedAssignmentIds } = parseResult.data;
        const result = await scheduleSimulationService.commit(
          {
            previewId,
            orgId,
            userId,
            selectedAssignmentIds,
          },
          userId
        );

        return res.json({
          success: true,
          runId: result.runId,
          assignmentsCreated: result.assignmentsCreated,
          message: `Committed ${result.assignmentsCreated} assignments to scheduler run ${result.runId}`,
        });
      }
    )
  );

  app.post(
    "/api/crew-extensions/scheduler/preview/discard",
    crewOperationRateLimit,
    withErrorHandling(
      "discard simulation preview",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const userId = req.session?.user?.id;
        const { previewId } = z.object({ previewId: z.string().optional() }).parse(req.body ?? {});

        if (!previewId || typeof previewId !== "string") {
          return res.status(400).json({ error: "previewId is required" });
        }
        const deleted = await scheduleSimulationService.discard(previewId, orgId, "manual", userId);

        return res.json({
          success: deleted,
          message: deleted
            ? "Simulation preview discarded"
            : "Preview not found or already expired",
        });
      }
    )
  );
}
