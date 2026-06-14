/**
 * Express App Factory
 *
 * Creates and configures the Express application for testing and production use.
 * Separates app creation from server startup for testability.
 */

import express, { Express } from "express";
import {
  validateEnvironment,
  configureMiddleware,
  configureAuthMiddleware,
  initializeLocalDatabase,
} from "./bootstrap/index.js";

interface AppOptions {
  skipDatabase?: boolean;
  skipAuth?: boolean;
  testAuth?: boolean;
}

export async function createApp(options: AppOptions = {}): Promise<Express> {
  const app = express();

  validateEnvironment();

  if (!options.skipDatabase) {
    await initializeLocalDatabase();
  }

  configureMiddleware(app);

  if (options.testAuth) {
    const { getIntegrationTestOrgIdFromRequest } = await import("./orgIdValidation.js");

    app.use("/api", (req, _res, next) => {
      let orgId: string;
      try {
        orgId = getIntegrationTestOrgIdFromRequest(req);
      } catch (error) {
        next(error);
        return;
      }
      const role =
        (Array.isArray(req.headers["x-user-role"])
          ? req.headers["x-user-role"][0]
          : req.headers["x-user-role"]) ?? "admin";
      const userId =
        (Array.isArray(req.headers["x-user-id"])
          ? req.headers["x-user-id"][0]
          : req.headers["x-user-id"]) ?? "integration-test-user";

      req.user = {
        id: userId,
        email: `${userId}@integration.test`,
        role,
        name: "Integration Test User",
        isActive: true,
        orgId,
      };
      next();
    });
  }

  if (!options.skipAuth) {
    await configureAuthMiddleware(app);
  }

  const { registerRoutes } = await import("./routes.js");
  await registerRoutes(app);

  return app;
}

export async function createTestApp(): Promise<Express> {
  return createApp({
    skipDatabase: false,
    skipAuth: true,
    testAuth: true,
  });
}
