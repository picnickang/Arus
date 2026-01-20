/**
 * Diagnostics Routes - Backward Compatible Shim
 * Re-exports from modular implementation
 */

import router from "./diagnostics/index.js";
export type { HealthCheckResult, CheckResult, ServiceStatus, SystemMetrics, SmokeSuite } from "./diagnostics/index.js";
export default router;
