/**
 * STCW Rest Fatigue Routes
 *
 * Fatigue risk assessment for crew, vessel, and fleet.
 */

import { Express, Request, Response } from "express";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies } from "./types";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerFatigueRoutes(app: Express, deps: StcwRestDependencies): void {
  const { storage } = deps;

  app.get("/api/hor/fatigue/:crewId",
    withErrorHandling("calculate fatigue risk", async (req: Request, res: Response) => {
      const { crewId } = req.params;
      const { days = "14" } = req.query;
      const lookbackDays = Number.parseInt(days as string) || 14;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const { days: restDays } = await storage.getCrewRestRange(
        crewId,
        startDateStr,
        endDateStr
      );

      const crewMember = await storage.getCrewMember(crewId);

      const { calculateFatigueRisk, normalizeRestDays: normalizeForFatigue } = await import("../../../stcw-compliance");
      const normalizedDays = normalizeForFatigue(restDays);
      const fatigueResult = calculateFatigueRisk(
        crewId,
        normalizedDays,
        crewMember?.name
      );

      res.json(fatigueResult);
    })
  );

  app.get("/api/hor/fatigue/vessel/:vesselId",
    withErrorHandling("calculate vessel fatigue summary", async (req: Request, res: Response) => {
      const { vesselId } = req.params;
      const { days = "14" } = req.query;
      const lookbackDays = Number.parseInt(days as string) || 14;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const crewMembers = await storage.getCrew(undefined, vesselId);

      const { calculateFatigueRisk, calculateVesselFatigueSummary, normalizeRestDays: normalizeForFatigue } = 
        await import("../../../stcw-compliance");

      const fatigueResults = await Promise.all(
        crewMembers.map(async (crew) => {
          const { days: restDays } = await storage.getCrewRestRange(
            crew.id,
            startDateStr,
            endDateStr
          );
          const normalizedDays = normalizeForFatigue(restDays);
          return calculateFatigueRisk(crew.id, normalizedDays, crew.name);
        })
      );

      const summary = calculateVesselFatigueSummary(fatigueResults);

      res.json({
        vesselId,
        lookbackDays,
        startDate: startDateStr,
        endDate: endDateStr,
        summary,
        crewFatigue: fatigueResults,
      });
    })
  );

  app.get("/api/hor/fatigue/fleet",
    withErrorHandling("calculate fleet fatigue overview", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { days = "14" } = req.query;
      const lookbackDays = Number.parseInt(days as string) || 14;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const vessels = await storage.getVessels(orgId);
      const { calculateFatigueRisk, calculateVesselFatigueSummary, normalizeRestDays: normalizeForFatigue } = 
        await import("../../../stcw-compliance");

      const vesselSummaries = await Promise.all(
        vessels.map(async (vessel) => {
          const crewMembers = await storage.getCrew(undefined, vessel.id);
          
          const fatigueResults = await Promise.all(
            crewMembers.map(async (crew) => {
              const { days: restDays } = await storage.getCrewRestRange(
                crew.id,
                startDateStr,
                endDateStr
              );
              const normalizedDays = normalizeForFatigue(restDays);
              return calculateFatigueRisk(crew.id, normalizedDays, crew.name);
            })
          );

          const summary = calculateVesselFatigueSummary(fatigueResults);
          return {
            vesselId: vessel.id,
            vesselName: vessel.name,
            ...summary,
          };
        })
      );

      const allCrew = vesselSummaries.flatMap((v: any) => v.highestRiskCrew ?? []);
      const fleetSummary = {
        totalVessels: vessels.length,
        totalCrew: vesselSummaries.reduce((sum, v: any) => sum + (v.totalCrew ?? 0), 0),
        criticalCount: vesselSummaries.reduce((sum, v: any) => sum + (v.criticalCount ?? 0), 0),
        highCount: vesselSummaries.reduce((sum, v: any) => sum + (v.highCount ?? 0), 0),
        mediumCount: vesselSummaries.reduce((sum, v: any) => sum + (v.mediumCount ?? 0), 0),
        lowCount: vesselSummaries.reduce((sum, v: any) => sum + (v.lowCount ?? 0), 0),
        highestRiskCrew: allCrew.sort((a: any, b: any) => b.score - a.score).slice(0, 10),
      };

      res.json({
        lookbackDays,
        startDate: startDateStr,
        endDate: endDateStr,
        fleetSummary,
        vesselSummaries,
      });
    })
  );
}
