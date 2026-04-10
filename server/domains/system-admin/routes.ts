/**
 * System Administration Domain Routes
 * 
 * BACKWARD COMPATIBILITY SHIM
 * This file re-exports from the modular routes/ directory.
 * New code should import directly from './routes/index.js'
 * 
 * Modularized into 8 files:
 * - types.ts (65 lines): Shared interfaces and dependencies
 * - auth-routes.ts (159 lines): Admin authentication
 * - audit-routes.ts (98 lines): Audit event management
 * - settings-routes.ts (220 lines): System settings and ML calibration
 * - simulation-routes.ts (145 lines): Telemetry simulation and stress testing
 * - integrations-routes.ts (136 lines): Integration config management
 * - windows-routes.ts (135 lines): Maintenance window management
 * - metrics-routes.ts (99 lines): Performance metrics
 */

export type { SystemAdminDependencies, ThresholdCalibrator } from "./routes/index.js";

export {
  registerSystemAdminRoutes,
  registerAuthRoutes,
  registerAuditRoutes,
  registerSettingsRoutes,
  registerSimulationRoutes,
  registerIntegrationsRoutes,
  registerWindowsRoutes,
  registerMetricsRoutes,
} from "./routes/index.js";
