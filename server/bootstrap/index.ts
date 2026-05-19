/**
 * Bootstrap Index - Main Application Orchestrator
 * Coordinates all initialization modules for a modular server startup
 */

export { setupErrorHandlers, markStartupComplete, isStartupComplete } from "./error-handlers";
export { validateEnvironment, type EnvironmentConfig } from "./environment";
export { configureMiddleware, configureAuthMiddleware } from "./middleware";
export {
  initializeLocalDatabase,
  initializeDatabase,
  seedDevelopmentUser,
  initializeJobQueue,
  initializeMLServices,
  applyTimescaleOptimizations,
  applyGraphBootstrap,
  startSyncServices,
  initializeTelemetryBatchWriter,
  initializeAutoReplanPolicy,
  initializeFmccPolling,
  initializePatchingSystem,
  startEventLoopMonitoring,
} from "./services";
export { initializeSchedulers, initializeBackgroundJobs } from "./schedulers";
export { configureStaticServing, configureFinalErrorHandlers } from "./static-serving";
export { setupShutdownHandlers, trackConnection, isServerShuttingDown } from "./shutdown";

import { isLocalMode as isLocalModeMaybeFn } from "../db-config";

export function getLocalModeFlag(): boolean {
  const v = isLocalModeMaybeFn as unknown;
  return typeof v === "function" ? !!(v as () => unknown)() : !!v;
}
