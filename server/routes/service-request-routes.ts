import type { Express } from "express";
import { db } from "../db";
import { registerServiceRequestEditRoutes } from "./service-request-edit-routes";
import { registerServiceRequestReadRoutes } from "./service-request-read-routes";
import { registerServiceRequestReviewRoutes } from "./service-request-review-routes";
import type { ServiceRequestRouteRateLimiters } from "./service-request-route-utils";

export function registerServiceRequestRoutes(
  app: Express,
  rateLimiters: ServiceRequestRouteRateLimiters
) {
  registerServiceRequestReadRoutes(
    app,
    {
      generalApiRateLimit: rateLimiters.generalApiRateLimit,
    },
    db
  );
  registerServiceRequestEditRoutes(
    app,
    {
      writeOperationRateLimit: rateLimiters.writeOperationRateLimit,
    },
    db
  );
  registerServiceRequestReviewRoutes(
    app,
    {
      writeOperationRateLimit: rateLimiters.writeOperationRateLimit,
    },
    db
  );
}
