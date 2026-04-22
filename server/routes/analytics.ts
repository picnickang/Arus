/**
 * Analytics Routes with Redis Caching & DTO Validation
 * DEPRECATED: Use imports from './analytics/index.js' directly
 * This file re-exports for backward compatibility
 */

export {
  mountAnalyticsRoutes,
  getOrgId,
  sendValidatedResponse,
  handleError,
  toFailurePredictionUuid,
} from "./analytics/index.js";
