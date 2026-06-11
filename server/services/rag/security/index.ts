/**
 * RAG Security Module
 * Centralized security configuration and services
 */

export * from "./types.js";
export * from "./input-sanitizer.js";
export * from "./streaming-token.js";
export * from "./file-validator.js";
export * from "./rate-limiter-enhanced.js";
export * from "./audit-logger.js";

import { logger } from "../../../utils/logger.js";
import { type RagSecurityConfig, DEFAULT_RAG_SECURITY_CONFIG, mergeWithDefaults } from "./types.js";
import { getInputSanitizer, updateSanitizerConfig } from "./input-sanitizer.js";
import { getStreamingTokenService, updateStreamingTokenConfig } from "./streaming-token.js";
import { getFileValidator, updateFileValidatorConfig } from "./file-validator.js";
import { getEnhancedRateLimiter, updateRateLimiterConfig } from "./rate-limiter-enhanced.js";
import { getRagAuditLogger, updateAuditLoggerConfig } from "./audit-logger.js";

// Cached configuration
let currentConfig: RagSecurityConfig = DEFAULT_RAG_SECURITY_CONFIG;

/**
 * Initialize all security services with configuration
 */
export function initializeRagSecurity(config?: Partial<RagSecurityConfig>): RagSecurityConfig {
  currentConfig = config ? mergeWithDefaults(config) : DEFAULT_RAG_SECURITY_CONFIG;

  // Allow header org ID in development
  if (process.env["NODE_ENV"] === "development") {
    currentConfig.auth.allowHeaderOrgId = true;
  }

  // Initialize all services
  getInputSanitizer(currentConfig.promptSecurity);
  getStreamingTokenService(currentConfig.auth);
  getFileValidator(currentConfig.ingestion);
  getEnhancedRateLimiter(currentConfig.rateLimiting);
  getRagAuditLogger(currentConfig.audit);

  logger.info("RagSecurity", "Security services initialized", {
    authRequired: currentConfig.auth.requireSession,
    rateLimitEnabled: currentConfig.rateLimiting.enabled,
    promptSecurityEnabled: currentConfig.promptSecurity.enabled,
    auditEnabled: currentConfig.audit.enabled,
  });

  return currentConfig;
}

/**
 * Update security configuration at runtime
 */
export function updateRagSecurityConfig(config: Partial<RagSecurityConfig>): RagSecurityConfig {
  currentConfig = mergeWithDefaults({ ...currentConfig, ...config });

  // Update all services
  updateSanitizerConfig(currentConfig.promptSecurity);
  updateStreamingTokenConfig(currentConfig.auth);
  updateFileValidatorConfig(currentConfig.ingestion);
  updateRateLimiterConfig(currentConfig.rateLimiting);
  updateAuditLoggerConfig(currentConfig.audit);

  logger.info("RagSecurity", "Security configuration updated");

  return currentConfig;
}

/**
 * Get current security configuration
 */
export function getRagSecurityConfig(): RagSecurityConfig {
  return currentConfig;
}

/**
 * Get all security service instances
 */
export function getRagSecurityServices() {
  return {
    config: currentConfig,
    sanitizer: getInputSanitizer(currentConfig.promptSecurity),
    tokenService: getStreamingTokenService(currentConfig.auth),
    fileValidator: getFileValidator(currentConfig.ingestion),
    rateLimiter: getEnhancedRateLimiter(currentConfig.rateLimiting),
    auditLogger: getRagAuditLogger(currentConfig.audit),
  };
}
