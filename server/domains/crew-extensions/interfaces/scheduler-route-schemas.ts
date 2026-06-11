import { z } from "zod";
import type { SimulationResult } from "../../../scheduler/scheduler-controller.js";

export const idParamSchema = z.object({ id: z.string().min(1) });
export const assignmentIdParamSchema = z.object({ assignmentId: z.string().min(1) });
export const runIdParamSchema = z.object({ runId: z.string().min(1) });

export const planBodySchema = z.object({
  from: z.string(),
  days: z.number().optional(),
  vessels: z.array(z.string()).optional(),
  mode: z.enum(["dry_run", "auto", "execute", "simulate"]).optional(),
});

export const runsQuerySchema = z.object({ limit: z.string().optional() });

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

export const previewComplianceBodySchema = z.object({
  scheduleRunId: z.string().optional(),
  assignments: z.array(scheduleAssignmentPreviewSchema).optional(),
});

export const simulateBodySchema = z.object({
  from: z.string(),
  days: z.number().optional(),
  vessels: z.array(z.string()).optional(),
  fillUnassignedOnly: z.boolean().optional(),
});

export const applyDraftBodySchema = z.object({
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

export const applySuggestionSchema = z.object({
  assignmentId: z.string().min(1),
  suggestedCrewId: z.string().min(1),
});

export const publishSchema = z.object({
  vesselId: z.string().optional(),
  from: z.string().min(1),
  to: z.string().min(1),
});

const assignmentProjectionSchema = z.object({
  id: z.string().optional(),
  crewId: z.string().min(1),
  crewName: z.string().optional(),
  vesselId: z.string().optional(),
  start: z.string().min(1),
  end: z.string().min(1),
  shiftName: z.string().optional(),
  position: z.string().optional(),
});

export const canAssignSchema = z.object({
  crewId: z.string().min(1),
  proposedAssignment: assignmentProjectionSchema,
  existingDrafts: z.array(assignmentProjectionSchema).optional(),
});

export const projectComplianceSchema = z.object({
  assignments: z.array(assignmentProjectionSchema),
});

export const plannerViewQuerySchema = z.object({
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

export const refreshRequestSchema = z.object({
  force: z.boolean().optional().default(false),
});

export const plannerSimulateSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  days: z.number().int().min(1).max(90).default(7),
  vessels: z.array(z.string()).optional(),
  crewIds: z.array(z.string()).optional(),
  strategy: z.enum(["balanced", "minimize_changes", "maximize_rest", "fill_gaps"]).optional(),
});

export const previewQuerySchema = z.object({
  previewId: z.string().optional(),
});

export const commitSchema = z.object({
  previewId: z.string().min(1),
  selectedAssignmentIds: z.array(z.string()).optional(),
});
