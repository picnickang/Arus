/**
 * STCW Rest Range Routes
 *
 * Range queries, planning preparation, and advanced search endpoints.
 */

import { Express, Request, Response } from "express";
import { z } from "zod";
import { withErrorHandling, handleApiError } from "../../../lib/route-utils";
import { StcwRestDependencies, rangeQuerySchema } from "./types";
import { dbStcwStorage } from "../../../db/stcw/index.js";

const prepareForPlanSchema = z.object({
  crew: z.array(z.object({ id: z.string().min(1) })).min(1),
  range: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
  }),
});

export function registerRangeRoutes(app: Express, deps: StcwRestDependencies): void {
  const { incrementRangeQuery, recordRangeQueryDuration } = deps;

  app.post(
    "/api/crew/rest/prepare_for_plan",
    withErrorHandling("prepare HoR context for planning", async (req: Request, res: Response) => {
      const parsed = prepareForPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Missing crew or range parameters",
        });
        return;
      }
      const { crew, range } = parsed.data;
      const { prepareCrewHoRContext } = await import("../../../hor-plan-utils");

      const crewIds = crew.map((c) => c.id);
      const context = await prepareCrewHoRContext(
        crewIds,
        new Date(range.start),
        new Date(range.end)
      );

      res.json({
        ok: true,
        contexts: crewIds.map((crewId) => ({
          crew_id: crewId,
          context,
          history_available: context.history.length > 0,
        })),
      });
    })
  );

  app.get(
    "/api/stcw/rest/range/:crewId/:startDate/:endDate",
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

  app.get(
    "/api/stcw/rest/vessel/:vesselId/:year/:month",
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
      const { vesselId, startDate, endDate } = queryValidation;

      incrementRangeQuery("advanced_search", vesselId || "fleet");

      const result = await dbStcwStorage.getCrewRestRange(vesselId || "", startDate, endDate);

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
