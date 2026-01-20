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

export interface AppOptions {
  skipDatabase?: boolean;
  skipAuth?: boolean;
}

export async function createApp(options: AppOptions = {}): Promise<Express> {
  const app = express();

  validateEnvironment();

  if (!options.skipDatabase) {
    await initializeLocalDatabase();
  }

  configureMiddleware(app);

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
  });
}
