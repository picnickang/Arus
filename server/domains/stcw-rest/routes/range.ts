/**
 * STCW Rest Range Routes
 *
 * Range queries, planning preparation, and advanced search endpoints.
 */

import { Express, Request, Response } from "express";
import { z } from "zod";
import { withErrorHandling, handleApiError } from "../../../lib/route-utils";
import { StcwRestDependencies, RestDay, rangeQuerySchema } from "./types";
import { logger } from "../../../utils/logger.js";
import { dbStcwStorage } from "../../../db/stcw/index.js";

export function registerRangeRoutes(app: Express, deps: StcwRestDependencies): void {
  const {
    incrementRangeQuery,
    recordRangeQueryDuration,
  } = deps;

  app.post("/api/crew/rest/prepare_for_plan",
    withErrorHandling("prepare HoR context for planning", async (req: Request, res: Response) => {
      const { crew, range } = req.body;

      if (!crew || !range || !range.start || !range.end) {
        res.status(400).json({
          ok: false,
          error: "Missing crew or range parameters",
        });
        return;
      }

      const { prepareCrewHoRContext } = await import("../../../hor-plan-utils");

      const crewIds = crew.map((c: { id: string }) => c.id);

      const getHistoryRows = async (
        crewId: string,
        start: string,
        end: string
      ): Promise<RestDay[]> => {
        try {
          const startDate = new Date(start);
          const endDate = new Date(end);

          const results: RestDay[] = [];

          const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const endLimit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

          while (current <= endLimit) {
            const year = current.getFullYear();
            const month = current.getMonth() + 1;

            try {
              const restData = await dbStcwStorage.getCrewRestMonth(crewId, year, month);
              if (restData.days && restData.days.length > 0) {
                const filteredDays = restData.days.filter((day: RestDay) => {
                  const dayDate = new Date(day.date);
                  return dayDate >= startDate && dayDate <= endDate;
                });
                results.push(...filteredDays);
              }
            } catch (_error) {
              logger.warn("STCWRestRange", `No rest data found for crew ${crewId} in ${year}-${month}`);
            }

            current.setMonth(current.getMonth() + 1);
          }

          return results;
        } catch (error) {
          logger.error("STCWRestRange", `Failed to get history for crew ${crewId}`, error);
          return [];
        }
      };

      const contexts = await prepareCrewHoRContext(crewIds, range.start, range.end, getHistoryRows);

      res.json({
        ok: true,
        contexts: contexts.map((ctx: any) => ({
          crew_id: ctx.crew_id,
          context: ctx.context,
          history_available: ctx.history_rows.length > 0,
        })),
      });
    })
  );

  app.get("/api/stcw/rest/range/:crewId/:startDate/:endDate",
    withErrorHandling("fetch crew rest range data", async (req: Request, res: Response) => {
      const startTime = Date.now();
      const { crewId, startDate, endDate } = req.params;

      if (!crewId || !startDate || !endDate) {
        res.status(400).json({
          error: "Missing required parameters: crewId, startDate, endDate",
        });
        return;
      }

      incrementRangeQuery("crew_range", crewId);

      const result = await dbStcwStorage.getCrewRestRange(crewId, startDate, endDate);

      recordRangeQueryDuration("crew_range", Date.now() - startTime);

      res.json(result);
    })
  );

  app.get("/api/stcw/rest/vessel/:vesselId/:year/:month",
    withErrorHandling("fetch vessel crew rest data", async (req: Request, res: Response) => {
      const startTime = Date.now();
      const { vesselId, year, month } = req.params;

      if (!vesselId || !year || !month) {
        res.status(400).json({
          error: "vesselId, year, and month are required",
        });
        return;
      }

      incrementRangeQuery("vessel_crew", vesselId);

      const result = await dbStcwStorage.getVesselCrewRest(vesselId, Number.parseInt(year), month);

      recordRangeQueryDuration("vessel_crew", Date.now() - startTime);

      res.json(result);
    })
  );

  app.get("/api/stcw/rest/search", async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const queryValidation = rangeQuerySchema.parse(req.query);
      const { vesselId, startDate, endDate, complianceFilter } = queryValidation;

      incrementRangeQuery("advanced_search", vesselId || "fleet");

      const result = await dbStcwStorage.getCrewRestRange(
        vesselId || "",
        startDate,
        endDate,
        complianceFilter
      );

      recordRangeQueryDuration("advanced_search", Date.now() - startTime);

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: "Invalid query parameters",
          errors: error.errors,
          code: "VALIDATION_ERROR",
        });
        return;
      }
      handleApiError(res, error, "search crew rest data");
    }
  });
}
