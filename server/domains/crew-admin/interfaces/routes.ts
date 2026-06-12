/**
 * Crew Admin Routes (Interfaces Layer)
 * Admin-gated "Crew Management": roles, dashboard configs, user vessel
 * assignments, and login credential admin.
 */

import type { Express } from "express";
import { registerCrewAdminCredentialRoutes } from "./routes/credential-routes";
import { registerCrewAdminDashboardRoutes } from "./routes/dashboard-routes";
import { registerCrewAdminRoleRoutes } from "./routes/role-routes";
import { registerCrewAdminUserRoutes } from "./routes/user-routes";

export function registerCrewAdminRoutes(
  app: Express,
  rateLimit: {
    generalApiRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    writeOperationRateLimit?: import("../../../lib/rate-limit-factory").RateLimit;
  }
) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimit;
  const context = {
    generalApiRateLimit,
    writeLimit: writeOperationRateLimit || generalApiRateLimit,
  };

  registerCrewAdminRoleRoutes(app, context);
  registerCrewAdminDashboardRoutes(app, context);
  registerCrewAdminUserRoutes(app, context);
  registerCrewAdminCredentialRoutes(app, context);
}
