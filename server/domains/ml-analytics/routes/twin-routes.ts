/**
 * ML Analytics - Digital Twin Routes
 *
 * Routes for digital twins and twin simulations.
 */

import type { Express } from "express";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { dbDigitalTwinStorage } from "../../../db/digital-twin/index.js";

export function registerTwinRoutes(app: Express, _config: MlAnalyticsConfig) {
  app.get(
    "/api/analytics/digital-twins",
    withErrorHandling("fetch digital twins", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, vesselId, twinType } = req.query;
      const twins = await dbDigitalTwinStorage.getDigitalTwins(
        orgId as string,
        vesselId as string | undefined,
        twinType as string | undefined
      );
      const { normalizeDigitalTwins } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeDigitalTwins(twins));
    })
  );

  app.get(
    "/api/analytics/digital-twins/:id",
    withErrorHandling("fetch digital twin", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      const twin = await dbDigitalTwinStorage.getDigitalTwin(req.params['id'] ?? '', orgId as string);
      if (!twin) {
        return sendNotFound(res, "Digital twin");
      }
      const { normalizeDigitalTwin } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeDigitalTwin(twin));
    })
  );

  app.get(
    "/api/analytics/twin-simulations",
    withErrorHandling("fetch twin simulations", async (req, res) => {
      const { digitalTwinId, scenarioType, status } = req.query;
      const simulations = await dbDigitalTwinStorage.getTwinSimulations(
        digitalTwinId as string | undefined,
        scenarioType as string | undefined,
        status as string | undefined
      );
      res.json(simulations);
    })
  );

  app.get(
    "/api/analytics/twin-simulations/:id",
    withErrorHandling("fetch twin simulation", async (req, res) => {
      const simulation = await dbDigitalTwinStorage.getTwinSimulation(req.params['id'] ?? '');
      if (!simulation) {
        return sendNotFound(res, "Twin simulation");
      }
      res.json(simulation);
    })
  );
}
