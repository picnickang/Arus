/**
 * Crew Assignments Routes
 * Assignment management and smart scheduling
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { insertCrewAssignmentSchema } from "@shared/schema";
import { planShifts } from "../../../crew-scheduler.js";
import type { CrewExtensionsRoutesConfig, AuthenticatedRequest } from "./types.js";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import { sendBadRequest } from "../../../lib/api-helpers.js";

// Schema for schedule planner assignment input
const createScheduleAssignmentSchema = z.object({
  vesselId: z.string().min(1),
  vesselName: z.string().optional(),
  crewId: z.string().min(1),
  crewName: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  role: z.string().optional(),
  status: z.enum(["draft", "confirmed", "published"]).optional().default("draft"),
  shiftPattern: z.string().optional(),
  notes: z.string().optional(),
});

const updateScheduleAssignmentSchema = z.object({
  status: z.enum(["draft", "confirmed", "published"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  role: z.string().optional(),
  crewId: z.string().optional(),
  vesselId: z.string().optional(),
});

export function registerAssignmentsRoutes(app: Express, config: CrewExtensionsRoutesConfig) {
  const { storage, crewOperationRateLimit } = config;

  // Schedule planner assignments endpoint - returns assignments in timeline format
  app.get("/api/crew-extensions/assignments",
    withErrorHandling("fetch schedule assignments", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { from, to, vesselId } = req.query;
      
      // Get assignments from storage with org isolation
      const allAssignments = await storage.getCrewAssignments(
        undefined, // date - we'll filter by range instead
        undefined, // crew_id
        vesselId as string | undefined
      );
      
      // Get crew and vessels for name lookups
      const [crewMembers, vessels] = await Promise.all([
        storage.getCrew(),
        storage.getVessels(),
      ]);
      
      // Create lookup maps
      const crewMap = new Map(crewMembers.map((c: any) => [c.id, c.name]));
      const vesselMap = new Map(vessels.map((v: any) => [v.id, v.name]));
      
      // Filter by org and date range
      const scheduleAssignments = allAssignments
        .filter((a: any) => {
          // Filter by org for multi-tenant isolation
          if (a.orgId && a.orgId !== orgId) return false;
          
          if (!from || !to) return true;
          const assignmentStart = new Date(a.start || a.date);
          const assignmentEnd = new Date(a.end || a.date);
          const rangeStart = new Date(from as string);
          const rangeEnd = new Date(to as string);
          // Check if assignment overlaps with the date range
          return assignmentStart <= rangeEnd && assignmentEnd >= rangeStart;
        })
        .map((a: any) => ({
          id: a.id,
          crewId: a.crewId,
          crewName: a.crewMember?.name || crewMap.get(a.crewId) || "Unknown",
          vesselId: a.vesselId || "",
          vesselName: a.vessel?.name || vesselMap.get(a.vesselId) || "Unknown",
          startDate: a.start instanceof Date ? a.start.toISOString() : 
                     (a.start || a.date || ""),
          endDate: a.end instanceof Date ? a.end.toISOString() : 
                   (a.end || a.date || ""),
          role: a.role || "Crew",
          status: a.status === "scheduled" ? "confirmed" : (a.status || "draft"),
          shiftPattern: a.shiftPattern,
          notes: a.notes,
        }));
      
      res.json(scheduleAssignments);
    })
  );

  // Create schedule planner assignment
  app.post("/api/crew-extensions/assignments",
    withErrorHandling("create schedule assignment", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const validated = createScheduleAssignmentSchema.parse(req.body);
      
      const assignment = await storage.createCrewAssignment({
        orgId,
        date: validated.startDate,
        crewId: validated.crewId,
        vesselId: validated.vesselId || null,
        start: new Date(validated.startDate),
        end: new Date(validated.endDate),
        role: validated.role || null,
        status: validated.status === "draft" ? "pending" : "scheduled",
        shiftId: null,
      });
      
      res.json({
        id: assignment.id,
        crewId: assignment.crewId,
        crewName: validated.crewName || "Unknown",
        vesselId: assignment.vesselId || "",
        vesselName: validated.vesselName || "Unknown",
        startDate: validated.startDate,
        endDate: validated.endDate,
        role: validated.role,
        status: validated.status,
        shiftPattern: validated.shiftPattern,
        notes: validated.notes,
      });
    })
  );

  // Update schedule planner assignment (UUID string id)
  app.patch("/api/crew-extensions/assignments/:id",
    withErrorHandling("update schedule assignment", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { id } = req.params; // Keep as string (UUID)
      const validated = updateScheduleAssignmentSchema.parse(req.body);
      
      // Map status back to storage format
      const storageUpdates: any = {};
      if (validated.status) {
        storageUpdates.status = validated.status === "confirmed" ? "scheduled" : 
                               validated.status === "published" ? "scheduled" : 
                               "pending";
      }
      if (validated.startDate) {
        storageUpdates.start = new Date(validated.startDate);
        storageUpdates.date = validated.startDate;
      }
      if (validated.endDate) {
        storageUpdates.end = new Date(validated.endDate);
      }
      if (validated.role) storageUpdates.role = validated.role;
      if (validated.crewId) storageUpdates.crewId = validated.crewId;
      if (validated.vesselId !== undefined) storageUpdates.vesselId = validated.vesselId;
      
      // Pass string id (UUID), not number
      const assignment = await storage.updateCrewAssignment(id, storageUpdates);
      
      res.json({
        id: assignment.id,
        crewId: assignment.crewId,
        vesselId: assignment.vesselId || "",
        startDate: assignment.start instanceof Date ? assignment.start.toISOString() : assignment.date,
        endDate: assignment.end instanceof Date ? assignment.end.toISOString() : assignment.date,
        role: assignment.role,
        status: assignment.status === "scheduled" ? "confirmed" : "draft",
      });
    })
  );

  // Delete schedule planner assignment
  app.delete("/api/crew-extensions/assignments/:id",
    withErrorHandling("delete schedule assignment", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { id } = req.params;
      
      await storage.deleteCrewAssignment(id);
      res.json({ success: true });
    })
  );

  app.get("/api/crew/assignments",
    withErrorHandling("fetch crew assignments", async (req: Request, res: Response) => {
      const { date, crew_id, vessel_id } = req.query;
      const assignments = await storage.getCrewAssignments(
        date as string | undefined,
        crew_id as string | undefined,
        vessel_id as string | undefined
      );
      res.json(assignments);
    })
  );

  app.post("/api/crew/assignments",
    withErrorHandling("create crew assignment", async (req: Request, res: Response) => {
      const assignmentData = insertCrewAssignmentSchema.parse(req.body);
      const assignment = await storage.createCrewAssignment(assignmentData);
      res.json(assignment);
    })
  );

  app.post("/api/crew/schedule/plan", crewOperationRateLimit,
    withErrorHandling("plan crew schedule", async (req: Request, res: Response) => {
      const { days, shifts, crew, leaves, existing = [] } = req.body;
      
      if (!Array.isArray(days) || !Array.isArray(shifts) || !Array.isArray(crew)) {
        return sendBadRequest(res, "Invalid input: days, shifts, and crew must be arrays");
      }
      
      const { scheduled, unfilled } = planShifts(days, shifts, crew, leaves ?? [], existing);
      
      if (scheduled.length > 0) {
        const assignments = scheduled.map((assignment) => ({
          date: assignment.date,
          shiftId: assignment.shiftId,
          crewId: assignment.crewId,
          vesselId: assignment.vesselId || null,
          start: new Date(assignment.start),
          end: new Date(assignment.end),
          role: assignment.role || null,
          status: "scheduled" as const
        }));
        await storage.createBulkCrewAssignments(assignments);
      }
      
      res.json({
        scheduled: scheduled.length,
        assignments: scheduled,
        unfilled,
        message: `Successfully scheduled ${scheduled.length} shifts${unfilled.length > 0 ? `, ${unfilled.length} positions remain unfilled` : ""}`
      });
    })
  );
}
