/**
 * STCW Rest Fatigue Routes
 *
 * Fatigue risk assessment for crew, vessel, and fleet.
 */

import { Express, Request, Response } from "express";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies } from "./types";
import { authenticatedRequest } from "../../../middleware/auth";
import { dbStcwStorage } from "../../../db/stcw/index.js";
import { dbCrewStorage } from "../../../db/crew/index.js";
import { vesselService } from "../../../repositories.js";

export function registerFatigueRoutes(app: Express, deps: StcwRestDependencies): void {
  app.get(
    "/api/hor/fatigue/:crewId",
    withErrorHandling("calculate fatigue risk", async (req: Request, res: Response) => {
      const { crewId = "" } = req.params;
      const { days = "14" } = req.query;
      const lookbackDays = Number.parseInt(days as string) || 14;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const startDateStr = startDate.toISOString().split("T")[0] ?? "";
      const endDateStr = endDate.toISOString().split("T")[0] ?? "";

      const { days: restDays } = await dbStcwStorage.getCrewRestRange(
        crewId,
        startDateStr,
        endDateStr
      );

      const crewMember = await dbCrewStorage.getCrewMember(crewId);

      const { calculateFatigueRisk, normalizeRestDays: normalizeForFatigue } = await import(
        "../../../stcw-compliance"
      );
      const normalizedDays = normalizeForFatigue(restDays);
      const fatigueResult = calculateFatigueRisk(crewId, normalizedDays, crewMember?.name);

      res.json(fatigueResult);
    })
  );

  app.get(
    "/api/hor/fatigue/vessel/:vesselId",
    withErrorHandling("calculate vessel fatigue summary", async (req: Request, res: Response) => {
      const { vesselId = "" } = req.params;
      const { days = "14" } = req.query;
      const lookbackDays = Number.parseInt(days as string) || 14;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const startDateStr = startDate.toISOString().split("T")[0] ?? "";
      const endDateStr = endDate.toISOString().split("T")[0] ?? "";

      const crewMembers = await dbCrewStorage.getCrew(undefined, vesselId);

      const {
        calculateFatigueRisk,
        calculateVesselFatigueSummary,
        normalizeRestDays: normalizeForFatigue,
      } = await import("../../../stcw-compliance");

      const fatigueResults = await Promise.all(
        crewMembers.map(async (crew) => {
          const { days: restDays } = await dbStcwStorage.getCrewRestRange(
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

  app.get(
    "/api/hor/fatigue/fleet",
    withErrorHandling("calculate fleet fatigue overview", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { days = "14" } = req.query;
      const lookbackDays = Number.parseInt(days as string) || 14;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const startDateStr = startDate.toISOString().split("T")[0] ?? "";
      const endDateStr = endDate.toISOString().split("T")[0] ?? "";

      const vessels = await vesselService.getVessels(orgId);
      const {
        calculateFatigueRisk,
        calculateVesselFatigueSummary,
        normalizeRestDays: normalizeForFatigue,
      } = await import("../../../stcw-compliance");

      const vesselSummaries = await Promise.all(
        vessels.map(async (vessel) => {
          const crewMembers = await dbCrewStorage.getCrew(undefined, vessel.id);

          const fatigueResults = await Promise.all(
            crewMembers.map(async (crew) => {
              const { days: restDays } = await dbStcwStorage.getCrewRestRange(
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

      type VS = {
        highestRiskCrew?: Array<{ score: number; [k: string]: unknown }>;
        totalCrew?: number;
        criticalCount?: number;
        highCount?: number;
        mediumCount?: number;
        lowCount?: number;
      };
      const summaries = vesselSummaries as object as VS[];
      const allCrew = summaries.flatMap((v) => v.highestRiskCrew ?? []);
      const fleetSummary = {
        totalVessels: vessels.length,
        totalCrew: summaries.reduce((sum, v) => sum + (v.totalCrew ?? 0), 0),
        criticalCount: summaries.reduce((sum, v) => sum + (v.criticalCount ?? 0), 0),
        highCount: summaries.reduce((sum, v) => sum + (v.highCount ?? 0), 0),
        mediumCount: summaries.reduce((sum, v) => sum + (v.mediumCount ?? 0), 0),
        lowCount: summaries.reduce((sum, v) => sum + (v.lowCount ?? 0), 0),
        highestRiskCrew: allCrew.sort((a, b) => b.score - a.score).slice(0, 10),
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
