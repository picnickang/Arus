/**
 * Comprehensive Audit Middleware
 *
 * Express middleware that automatically logs all data-changing operations
 * (POST, PUT, PATCH, DELETE) to the immutable audit trail.
 *
 * Features:
 * - Automatic entity detection from request path
 * - Before/after state capture for modifications
 * - IP address and user agent tracking
 * - Request correlation via X-Request-Id header
 * - Configurable exclusion patterns
 */

import { createLogger } from "../lib/structured-logger";
import { authenticatedRequest } from "../middleware/auth";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Compliance:AuditMiddleware");
import { Request, Response, NextFunction } from "express";
import {
  auditService,
  type AuditEventCategory,
  type AuditEventType,
} from "./immutable-audit.service";

interface AuditMiddlewareConfig {
  enabled: boolean;
  excludePatterns: RegExp[];
  sensitiveFields: string[];
  logRequestBody: boolean;
  logResponseBody: boolean;
}

const defaultConfig: AuditMiddlewareConfig = {
  enabled: true,
  excludePatterns: [
    // Health and observability endpoints (both with and without /api prefix)
    /^\/api\/health/,
    /^\/api\/ready/,
    /^\/api\/metrics/,
    /^\/health/,
    /^\/ready/,
    /^\/metrics/,
    /^\/healthz/,
    /^\/readyz/,
    // Static assets and dev server
    /^\/@vite/,
    /^\/src\//,
    /^\/assets\//,
    /^\/node_modules\//,
    // High-volume telemetry excluded (both with and without /api prefix)
    /^\/api\/telemetry/,
    /^\/telemetry/,
    // Ping endpoints
    /^\/api\/ping/,
    /^\/ping/,
    // WebSocket and real-time endpoints
    /^\/ws/,
    /^\/socket/,
  ],
  sensitiveFields: [
    "password",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "sessionToken",
    "refreshToken",
    "hmacSecret",
  ],
  logRequestBody: true,
  logResponseBody: false,
};

let config = { ...defaultConfig };

const httpMethodToEventType: Record<string, AuditEventType> = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

/**
 * Map HTTP methods to audit event types
 */
function getEventType(method: string): AuditEventType {
  return httpMethodToEventType[method.toUpperCase()] ?? "read";
}

/**
 * Determine event category based on path
 */
function getEventCategory(path: string): AuditEventCategory {
  if (path.includes("/auth") || path.includes("/login") || path.includes("/session")) {
    return "authentication";
  }

  if (path.includes("/config") || path.includes("/settings")) {
    return "configuration_change";
  }

  if (path.includes("/ml") || path.includes("/prediction") || path.includes("/model")) {
    return "ml_prediction";
  }

  if (path.includes("/maintenance") || path.includes("/work-order")) {
    return "maintenance_action";
  }

  if (path.includes("/compliance") || path.includes("/audit")) {
    return "compliance_event";
  }

  if (path.includes("/security") || path.includes("/admin")) {
    return "security_event";
  }
  return "data_modification";
}

/**
 * Extract entity type and ID from request path
 */
function parseEntityFromPath(path: string): { entityType: string; entityId?: string } {
  // Common API path patterns:
  // /api/entity -> entityType = entity
  // /api/entity/:id -> entityType = entity, entityId = :id
  // /api/entity/:id/action -> entityType = entity, entityId = :id

  const segments = path.replace("/api/", "").split("/").filter(Boolean);

  if (segments.length === 0) {
    return { entityType: "api" };
  }

  const entityType = (segments[0] ?? "").replaceAll("-", "_");

  // Check if second segment looks like an ID (UUID or numeric)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const numericPattern = /^\d+$/;

  if (segments.length > 1) {
    const potentialId = segments[1] ?? "";
    if (uuidPattern.test(potentialId) || numericPattern.test(potentialId)) {
      return { entityType, entityId: potentialId };
    }
  }

  return { entityType };
}

/**
 * Redact sensitive fields from objects
 */
function redactSensitiveData(obj: unknown, sensitiveFields: string[]): unknown {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, sensitiveFields));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      redacted[key] = redactSensitiveData(value, sensitiveFields);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Get client IP from request
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return Array.isArray(forwarded) ? (forwarded[0] ?? "unknown") : (forwarded.split(",")[0] ?? "").trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Audit middleware factory
 */
export function createAuditMiddleware(customConfig?: Partial<AuditMiddlewareConfig>) {
  if (customConfig) {
    config = { ...defaultConfig, ...customConfig };
  }

  return async function auditMiddleware(req: Request, res: Response, next: NextFunction) {
    // Skip if disabled
    if (!config.enabled) {
      return next();
    }

    // Skip non-mutation requests
    const mutationMethods = ["POST", "PUT", "PATCH", "DELETE"];
    if (!mutationMethods.includes(req.method.toUpperCase())) {
      return next();
    }

    // Check exclusion patterns
    const path = req.path;
    if (config.excludePatterns.some((pattern) => pattern.test(path))) {
      return next();
    }

    // Extract org ID from headers (single-tenant mode: default-org-id)
    const orgId = DEFAULT_ORG_ID;

    // Parse entity from path
    const { entityType, entityId } = parseEntityFromPath(path);

    // Extract user information
    const userId = (req.headers["x-user-id"] as string) || authenticatedRequest(req).user?.id || "anonymous";
    const userName =
      (req.headers["x-user-name"] as string) || authenticatedRequest(req).user?.name || "Anonymous User";

    // Get request metadata
    const requestId =
      (req.headers["x-request-id"] as string) ||
      `req_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`;
    const ipAddress = getClientIP(req);
    const userAgent = req.headers["user-agent"] || "unknown";

    // Prepare request body (redacted)
    const requestBody =
      config.logRequestBody && req.body
        ? redactSensitiveData(req.body, config.sensitiveFields)
        : undefined;

    // Store original json method to capture response
    const originalJson = res.json;
    let responseBody: unknown;

    if (config.logResponseBody) {
      res.json = function (body: unknown) {
        responseBody = body;
        return originalJson.call(this, body);
      };
    }

    // Track start time
    const startTime = Date.now();

    // Capture response status on finish
    res.on("finish", async () => {
      try {
        const duration = Date.now() - startTime;
        const wasSuccessful = res.statusCode >= 200 && res.statusCode < 400;

        // Log to audit trail
        await auditService.logEvent({
          orgId,
          eventCategory: getEventCategory(path),
          eventType: getEventType(req.method),
          entityType,
          entityId:
            entityId ||
            req.body?.id ||
            (responseBody as { id?: string; data?: { id?: string } } | undefined)?.id ||
            (responseBody as { data?: { id?: string } } | undefined)?.data?.id ||
            "new",
          newState: requestBody as Record<string, unknown> | undefined,
          changedFields: requestBody ? Object.keys(requestBody as Record<string, unknown>) : undefined,
          performedBy: userId,
          performedByType: "user",
          performedByName: userName,
          ipAddress,
          metadata: {
            requestId,
            method: req.method,
            path,
            statusCode: res.statusCode,
            duration,
            userAgent,
            successful: wasSuccessful,
          },
        });

        logger.info(`[Audit] ${req.method} ${path} -> ${res.statusCode} (${duration}ms) [${orgId}/${userId}]`);
      } catch (error) {
        // Log error but don't fail the request
        logger.error("[Audit] Failed to log audit event:", undefined, error);
      }
    });

    next();
  };
}

/**
 * Express middleware for auditing - uses default config
 */
export const auditMiddleware = createAuditMiddleware();

/**
 * High-priority audit middleware for sensitive operations
 * Logs both before and after states
 */
export function sensitiveOperationAudit(entityType: string) {
  return async function (req: Request, res: Response, next: NextFunction) {
    const orgId = DEFAULT_ORG_ID;
    const userId = (req.headers["x-user-id"] as string) || "anonymous";
    const userName = (req.headers["x-user-name"] as string) || "Anonymous User";
    const ipAddress = getClientIP(req);

    // Log the attempt
    await auditService.logEvent({
      orgId,
      eventCategory: "security_event",
      eventType: getEventType(req.method),
      entityType,
      entityId: req.params['id'] || "unknown",
      newState: redactSensitiveData(req.body, config.sensitiveFields) as
        | Record<string, unknown>
        | undefined,
      performedBy: userId,
      performedByType: "user",
      performedByName: userName,
      ipAddress,
      metadata: {
        action: "sensitive_operation_attempt",
        method: req.method,
        path: req.path,
      },
    });

    next();
  };
}

/**
 * Configure the audit middleware
 */
export function configureAuditMiddleware(customConfig: Partial<AuditMiddlewareConfig>) {
  config = { ...config, ...customConfig };
}

/**
 * Add exclusion pattern
 */
export function addExclusionPattern(pattern: RegExp) {
  config.excludePatterns.push(pattern);
}

/**
 * Check if audit is enabled
 */
export function isAuditEnabled(): boolean {
  return config.enabled;
}

/**
 * Enable/disable audit middleware
 */
export function setAuditEnabled(enabled: boolean) {
  config.enabled = enabled;
}
