// @ts-nocheck
/**
 * Vessel Performance Routes - Enhanced Crew Scheduling
 */

import type { Express, Request, Response } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import type { RestDay } from "../../../stcw-compliance";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";
import { dbStcwStorage } from "../../../db/stcw/index.js";

export function registerSchedulingRoutes(
  app: Express,
  config: VesselPerformanceRoutesConfig
): void {
  const { crewOperationRateLimit } = config;

  app.post(
    "/api/crew/schedule/plan-enhanced",
    crewOperationRateLimit,
    withErrorHandling("run enhanced crew scheduling", async (req: Request, res: Response) => {
      const {
        engine = "greedy",
        days,
        shifts,
        crew,
        leaves = [],
        portCalls = [],
        drydocks = [],
        certifications = {},
        preferences = {},
        validate_stcw = false,
      } = req.body;

      if (!Array.isArray(days) || !Array.isArray(shifts) || !Array.isArray(crew)) {
        return res
          .status(400)
          .json({ error: "Invalid input: days, shifts, and crew must be arrays" });
      }

      let planWithEngine, ConstraintScheduleRequest, ENGINE_GREEDY, ENGINE_OR_TOOLS;
      try {
        const ortoolsModule = await import("../../../crew-scheduler-ortools");
        planWithEngine = ortoolsModule.planWithEngine;
        ConstraintScheduleRequest = ortoolsModule.ConstraintScheduleRequest;
        ENGINE_GREEDY = ortoolsModule.ENGINE_GREEDY;
        ENGINE_OR_TOOLS = ortoolsModule.ENGINE_OR_TOOLS;
      } catch (error) {
        logger.warn(
          "SchedulingRoutes",
          "OR-Tools crew scheduler not available (native bindings missing), falling back to greedy algorithm",
          error
        );
        return res
          .status(200)
          .json({
            scheduled: [],
            unfilled: [],
            warning:
              "OR-Tools optimizer not available in this environment. Use the basic crew scheduler endpoint instead.",
          });
      }

      const scheduleRequest: typeof ConstraintScheduleRequest = {
        engine,
        days,
        shifts,
        crew,
        leaves,
        portCalls,
        drydocks,
        certifications,
        preferences,
      };
      const { scheduled, unfilled } = planWithEngine(scheduleRequest);
      const compliance: {
        overall_ok: boolean;
        per_crew: any[];
        rows_by_crew: { [crewId: string]: RestDay[] };
      } = { overall_ok: true, per_crew: [], rows_by_crew: {} };

      if (validate_stcw) {
        try {
          const { mergeHistoryWithPlan, summarizeHoRContext } = await import(
            "../../../hor-plan-utils"
          );
          const { checkMonthCompliance } = await import("../../../stcw-compliance");

          const startDate = days[0],
            endDate = days[days.length - 1];

          const getHistoryRows = async (crewId: string): Promise<RestDay[]> => {
            try {
              const startPlanDate = new Date(startDate),
                results: RestDay[] = [];
              const historyStart = new Date(startPlanDate);
              historyStart.setMonth(historyStart.getMonth() - 1);
              const current = new Date(historyStart.getFullYear(), historyStart.getMonth(), 1);
              const endLimit = new Date(startPlanDate.getFullYear(), startPlanDate.getMonth(), 1);

              while (current <= endLimit) {
                const year = current.getFullYear(),
                  month = current.getMonth() + 1;
                try {
                  const restData = await dbStcwStorage.getCrewRestMonth(crewId, year, month);
                  if (restData.days && restData.days.length > 0) {
                    results.push(...restData.days);
                  }
                } catch {
                  /* month data not found */
                }
                current.setMonth(current.getMonth() + 1);
              }
              return results;
            } catch {
              /* history retrieval failed */ return [];
            }
          };

          for (const crewMember of crew) {
            const crewId = crewMember.id,
              historyRows = await getHistoryRows(crewId);
            const crewAssignments = scheduled
              .filter((a: any) => a.crewId === crewId)
              .map((a: any) => ({
                date: a.date,
                start: a.start,
                end: a.end,
                crewId: a.crewId,
                shiftId: a.shiftId,
                vesselId: a.vesselId,
              }));
            const mergedRows = mergeHistoryWithPlan(
              historyRows,
              crewAssignments,
              startDate,
              endDate
            );
            const crewCompliance = checkMonthCompliance(mergedRows),
              context = summarizeHoRContext(historyRows);
            compliance.rows_by_crew[crewId] = mergedRows;
            compliance.per_crew.push({
              crew_id: crewId,
              name: crewMember.name || crewId,
              ok: crewCompliance.ok,
              min_rest_24: context.min_rest_24,
              rest_7d: context.rest_7d,
              nights_this_week: context.nights_this_week,
              violations: crewCompliance.ok
                ? 0
                : crewCompliance.days.filter((d: any) => !d.day_ok).length,
            });
            if (!crewCompliance.ok) {
              compliance.overall_ok = false;
            }
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.error("SchedulingRoutes", "Failed to validate STCW compliance", error);
          compliance.overall_ok = false;
          compliance.per_crew.push({ error: "Failed to validate STCW compliance", details: msg });
        }
      }

      res.json({
        engine,
        scheduled,
        unfilled,
        compliance,
        summary: {
          totalShifts: shifts.length * days.length,
          scheduledAssignments: scheduled.length,
          unfilledPositions: unfilled.reduce((sum: number, u: any) => sum + u.need, 0),
          coverage: (scheduled.length / (shifts.length * days.length)) * 100,
        },
      });
    })
  );
}
