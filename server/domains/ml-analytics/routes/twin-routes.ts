/**
 * ML Analytics - Digital Twin Routes
 *
 * Routes for digital twins and twin simulations.
 */

import type { Express } from "express";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { dbMlAnalyticsStorage } from "../../../repositories.js";

export function registerTwinRoutes(app: Express, _config: MlAnalyticsConfig) {
  app.get(
    "/api/analytics/digital-twins",
    withErrorHandling("fetch digital twins", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, vesselId, twinType } = req.query;
      const twins = await (dbMlAnalyticsStorage as any).getDigitalTwins(
        orgId as string,
        vesselId as string,
        twinType as string
      );
      const { normalizeDigitalTwins } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeDigitalTwins(twins));
    })
  );

  app.get(
    "/api/analytics/digital-twins/:id",
    withErrorHandling("fetch digital twin", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      const twin = await (dbMlAnalyticsStorage as any).getDigitalTwin(req.params.id, orgId as string);
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
      const {
        orgId = (req as AuthenticatedRequest).orgId,
        digitalTwinId,
        scenarioType,
        status,
      } = req.query;
      const simulations = await (dbMlAnalyticsStorage as any).getTwinSimulations(
        orgId as string,
        digitalTwinId as string,
        scenarioType as string,
        status as string
      );
      res.json(simulations);
    })
  );

  app.get(
    "/api/analytics/twin-simulations/:id",
    withErrorHandling("fetch twin simulation", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      const simulation = await (dbMlAnalyticsStorage as any).getTwinSimulation(
        req.params.id,
        orgId as string
      );
      if (!simulation) {
        return sendNotFound(res, "Twin simulation");
      }
      res.json(simulation);
    })
  );
}
