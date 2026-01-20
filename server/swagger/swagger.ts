/**
 * OpenAPI/Swagger Specification for ARUS Marine API
 * 
 * Main module that assembles the OpenAPI spec from domain-specific modules.
 */

import { Express, Request, Response } from "express";
import { specInfo } from "./spec-info.js";
import { schemas } from "./schemas.js";
import { securitySchemes, parameters, responses } from "./parameters-responses.js";
import { healthPaths, dashboardPaths } from "./paths-health.js";
import { equipmentPaths } from "./paths-equipment.js";
import { vesselsPaths } from "./paths-vessels.js";
import { telemetryPaths } from "./paths-telemetry.js";
import { pdmPaths } from "./paths-pdm.js";
import { workOrdersPaths } from "./paths-workorders.js";
import { partsPaths, mlPaths, analyticsPaths, syncPaths, organizationsPaths, adminPaths } from "./paths-misc.js";
import { generateSwaggerUI } from "./ui-generator.js";

/**
 * Assembled OpenAPI Specification
 */
export const openApiSpec = {
  ...specInfo,
  components: {
    securitySchemes,
    schemas,
    parameters,
    responses
  },
  security: [{ orgId: [] }],
  paths: {
    ...healthPaths,
    ...dashboardPaths,
    ...equipmentPaths,
    ...vesselsPaths,
    ...telemetryPaths,
    ...pdmPaths,
    ...workOrdersPaths,
    ...partsPaths,
    ...mlPaths,
    ...analyticsPaths,
    ...syncPaths,
    ...organizationsPaths,
    ...adminPaths
  }
};

/**
 * Register OpenAPI routes
 */
export function registerSwaggerRoutes(app: Express): void {
  app.get("/api/openapi.json", (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  app.get("/api/docs", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(generateSwaggerUI());
  });

  console.log("[Swagger] OpenAPI documentation registered at /api/docs");
}
