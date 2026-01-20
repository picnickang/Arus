/**
 * Telemetry Library Exports
 * 
 * Centralized exports for telemetry infrastructure modules.
 */

export { TelemetryBufferManager, telemetryBufferManager } from "./buffer-manager";
export type { BufferedReading, VesselBufferStats, BufferManagerConfig } from "./buffer-manager";

export { TelemetryRateLimiter, telemetryRateLimiter } from "./rate-limiter";
export type { SensorRateConfig, RateLimitResult, RateLimiterConfig } from "./rate-limiter";

export { 
  telemetryHealthController, 
  registerTelemetryHealthRoutes 
} from "./health-controller";
