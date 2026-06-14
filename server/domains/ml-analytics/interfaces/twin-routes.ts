/**
 * ML Analytics - Digital Twin Routes
 *
 * Routes for digital twins and twin simulations. Data access lives in the
 * application service; this layer only handles HTTP concerns.
 */

import type { Express } from "express";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import { authenticatedRequest } from "../../../middleware/auth";
import { mlAnalyticsService } from "../application/index.js";

export function registerTwinRoutes(app: Express, _config: MlAnalyticsConfig) {
  app.get(
    "/api/analytics/digital-twins",
    withErrorHandling("fetch digital twins", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId, vesselId, twinType } = req.query;
      res.json(
        await mlAnalyticsService.listDigitalTwins(
          orgId as string,
          vesselId as string | undefined,
          twinType as string | undefined
        )
      );
    })
  );

  app.get(
    "/api/analytics/digital-twins/:id",
    withErrorHandling("fetch digital twin", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId } = req.query;
      const twin = await mlAnalyticsService.getDigitalTwin(
        req.params["id"] ?? "",
        orgId as string
      );
      if (!twin) {
        return sendNotFound(res, "Digital twin");
      }
      res.json(twin);
    })
  );

  app.get(
    "/api/analytics/twin-simulations",
    withErrorHandling("fetch twin simulations", async (req, res) => {
      const { digitalTwinId, scenarioType, status } = req.query;
      res.json(
        await mlAnalyticsService.listTwinSimulations(
          digitalTwinId as string | undefined,
          scenarioType as string | undefined,
          status as string | undefined
        )
      );
    })
  );

  app.get(
    "/api/analytics/twin-simulations/:id",
    withErrorHandling("fetch twin simulation", async (req, res) => {
      const simulation = await mlAnalyticsService.getTwinSimulation(req.params["id"] ?? "");
      if (!simulation) {
        return sendNotFound(res, "Twin simulation");
      }
      res.json(simulation);
    })
  );
}
