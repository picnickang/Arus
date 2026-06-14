import type { Express } from "express";
import { db } from "../db";
import { registerServiceRequestEditRoutes } from "./service-request-edit-routes";
import { registerServiceRequestReadRoutes } from "./service-request-read-routes";
import { registerServiceRequestReviewRoutes } from "./service-request-review-routes";
import type { ServiceRequestRouteRateLimiters } from "./service-request-route-utils";

// This registrar is the single owner of the db import for the service-request
// route group; it injects the handle into each split route module so those
// modules stay off the db barrel (hexagonal storage boundary).
export function registerServiceRequestRoutes(
  app: Express,
  rateLimiters: ServiceRequestRouteRateLimiters
) {
  registerServiceRequestReadRoutes(app, db, {
    generalApiRateLimit: rateLimiters.generalApiRateLimit,
  });
  registerServiceRequestEditRoutes(app, db, {
    writeOperationRateLimit: rateLimiters.writeOperationRateLimit,
  });
  registerServiceRequestReviewRoutes(app, db, {
    writeOperationRateLimit: rateLimiters.writeOperationRateLimit,
  });
}
