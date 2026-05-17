// @ts-nocheck
/**
 * RAG Security Settings Routes
 * API endpoints for managing RAG security configuration
 *
 * SECURITY: All config modification routes require admin authentication
 */

import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { withErrorHandling } from "../lib/route-utils.js";
import {
  getRagSecurityConfig,
  updateRagSecurityConfig,
  getRagSecurityServices,
} from "../services/rag/security/index.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

/**
 * Strict Zod schema for config updates - only allow safe, whitelisted fields
 */
const ragSecurityConfigUpdateSchema = z
  .object({
    auth: z
      .object({
        requireSession: z.boolean().optional(),
        allowHeaderOrgId: z.boolean().optional(),
        streamingTokenTTLSeconds: z.number().min(60).max(3600).optional(),
      })
      .optional(),
    rateLimiting: z
      .object({
        enabled: z.boolean().optional(),
        requestsPerMinute: z.number().min(1).max(1000).optional(),
        burstLimit: z.number().min(1).max(100).optional(),
        windowSizeSeconds: z.number().min(10).max(3600).optional(),
        useRedis: z.boolean().optional(),
      })
      .optional(),
    ingestion: z
      .object({
        maxFileSizeMB: z.number().min(1).max(500).optional(),
        quarantineOnSuspicious: z.boolean().optional(),
        enableMalwareScan: z.boolean().optional(),
      })
      .optional(),
    promptSecurity: z
      .object({
        enabled: z.boolean().optional(),
        sanitizeUserInput: z.boolean().optional(),
        useBoundaryMarkers: z.boolean().optional(),
        filterOutputPatterns: z.boolean().optional(),
        maxQueryLength: z.number().min(100).max(50000).optional(),
        // blockedPatterns intentionally excluded - use dedicated endpoint
      })
      .strict()
      .optional(),
    audit: z
      .object({
        enabled: z.boolean().optional(),
        logQueries: z.boolean().optional(),
        logResponses: z.boolean().optional(),
        logDocumentAccess: z.boolean().optional(),
        retentionDays: z.number().min(7).max(365).optional(),
      })
      .optional(),
  })
  .strict();

/**
 * Admin-only middleware for RAG security routes
 * Requires valid session with admin privileges
 */
function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const session = (req as any).session;

  // In development, allow with dev user
  if (process.env.NODE_ENV === "development") {
    if (session?.userId === "dev-user-id" || DEFAULT_ORG_ID) {
      return next();
    }
  }

  // Check for valid session
  if (!session?.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Check for admin role (using existing RBAC)
  const userRoles = session.roles || [];
  const isAdmin = userRoles.some(
    (role: any) =>
      role.name === "admin" || role.name === "system_admin" || role.name === "developer"
  );

  if (!isAdmin) {
    logger.warn("RagSecurityRoutes", "Unauthorized access attempt to security config", {
      userId: session.userId,
      roles: userRoles.map((r: any) => r.name),
    });
    res.status(403).json({ error: "Admin privileges required" });
    return;
  }

  next();
}

export function registerRagSecurityRoutes(app: Express): void {
  /**
   * Get current RAG security configuration (read-only, safe for non-admins)
   */
  app.get(
    "/api/rag/security/config",
    withErrorHandling("get RAG security config", async (req: Request, res: Response) => {
      const config = getRagSecurityConfig();

      // Return config with pattern count only (not actual patterns)
      const safeConfig = {
        ...config,
        promptSecurity: {
          ...config.promptSecurity,
          blockedPatterns: config.promptSecurity.blockedPatterns.length,
        },
      };

      res.json(safeConfig);
    })
  );

  /**
   * Get full RAG security configuration (admin only)
   * Includes blocked patterns list
   */
  app.get(
    "/api/rag/security/config/full",
    requireAdminAuth,
    withErrorHandling("get full RAG security config", async (req: Request, res: Response) => {
      const config = getRagSecurityConfig();
      res.json(config);
    })
  );

  /**
   * Update RAG security configuration (admin only)
   * Uses strict Zod validation with whitelisted fields only
   */
  app.put(
    "/api/rag/security/config",
    requireAdminAuth,
    withErrorHandling("update RAG security config", async (req: Request, res: Response) => {
      // Parse and validate with strict schema
      const parseResult = ragSecurityConfigUpdateSchema.safeParse(req.body);

      if (!parseResult.success) {
        logger.warn("RagSecurityRoutes", "Invalid config update rejected", {
          errors: parseResult.error.issues,
        });
        res.status(400).json({
          error: "Invalid configuration",
          details: parseResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
        return;
      }

      const updates = parseResult.data;
      const newConfig = updateRagSecurityConfig(updates);

      const { auditLogger } = getRagSecurityServices();
      const session = (req as any).session;

      auditLogger.log({
        eventType: "config_change",
        userId: session?.userId || "unknown",
        orgId: DEFAULT_ORG_ID,
        details: {
          action: "security_config_update",
          changedSections: Object.keys(updates),
        },
        success: true,
      });

      logger.info("RagSecurityRoutes", "Security configuration updated by admin", {
        userId: session?.userId,
        changes: Object.keys(updates),
      });

      res.json({
        success: true,
        config: {
          ...newConfig,
          promptSecurity: {
            ...newConfig.promptSecurity,
            blockedPatterns: newConfig.promptSecurity.blockedPatterns.length,
          },
        },
      });
    })
  );

  /**
   * Get streaming token for EventSource connections
   */
  app.post(
    "/api/rag/security/streaming-token",
    withErrorHandling("generate streaming token", async (req: Request, res: Response) => {
      const { tokenService, config } = getRagSecurityServices();

      // Get org context from session or header
      const session = (req as any).session;
      const userId = session?.userId || req.body?.userId || "anonymous";
      const orgId = DEFAULT_ORG_ID;

      if (!orgId) {
        res.status(400).json({ error: "Organization context required" });
        return;
      }

      const token = tokenService.generateToken(userId, orgId);

      res.json({
        token,
        expiresIn: config.auth.streamingTokenTTLSeconds,
      });
    })
  );

  /**
   * Get audit log events (admin only)
   */
  app.get(
    "/api/rag/security/audit",
    requireAdminAuth,
    withErrorHandling("get RAG audit logs", async (req: Request, res: Response) => {
      const { auditLogger } = getRagSecurityServices();

      const limit = parseInt(req.query.limit as string) || 100;
      const eventType = req.query.eventType as string;
      const orgId = DEFAULT_ORG_ID;

      const events = auditLogger.getEvents({
        limit,
        eventType: eventType as any,
        orgId,
      });

      res.json({ events });
    })
  );

  /**
   * Get audit statistics (admin only)
   */
  app.get(
    "/api/rag/security/audit/stats",
    requireAdminAuth,
    withErrorHandling("get RAG audit stats", async (req: Request, res: Response) => {
      const { auditLogger } = getRagSecurityServices();
      const orgId = DEFAULT_ORG_ID;

      const stats = auditLogger.getStats(orgId);
      res.json(stats);
    })
  );

  /**
   * Get rate limit status for current user
   */
  app.get(
    "/api/rag/security/rate-limit/status",
    withErrorHandling("get rate limit status", async (req: Request, res: Response) => {
      const { rateLimiter, config } = getRagSecurityServices();

      const session = (req as any).session;
      const userId = session?.userId || "anonymous";
      const orgId = DEFAULT_ORG_ID;

      const identifier = session?.orgId ? `user:${userId}:${orgId}` : `ip:${req.ip}`;

      const status = await rateLimiter.getStatus(identifier);

      res.json({
        ...status,
        limit: config.rateLimiting.requestsPerMinute,
        windowSeconds: config.rateLimiting.windowSizeSeconds,
      });
    })
  );

  /**
   * Test input sanitization (admin only - for debugging)
   */
  app.post(
    "/api/rag/security/test/sanitize",
    requireAdminAuth,
    withErrorHandling("test input sanitization", async (req: Request, res: Response) => {
      const { sanitizer } = getRagSecurityServices();
      const { input } = req.body;

      if (!input || typeof input !== "string") {
        res.status(400).json({ error: "Input string required" });
        return;
      }

      const result = sanitizer.sanitize(input);
      res.json(result);
    })
  );

  /**
   * Test file validation (admin only - for debugging)
   */
  app.post(
    "/api/rag/security/test/validate-file",
    requireAdminAuth,
    withErrorHandling("test file validation", async (req: Request, res: Response) => {
      const { fileValidator } = getRagSecurityServices();
      const { filename, mimeType, sizeBytes } = req.body;

      if (!filename) {
        res.status(400).json({ error: "Filename required" });
        return;
      }

      // Create a dummy buffer for size checking
      const dummyBuffer = Buffer.alloc(sizeBytes || 1024);
      const result = await fileValidator.validate(filename, dummyBuffer, mimeType);

      res.json(result);
    })
  );

  logger.info("RagSecurityRoutes", "RAG security routes registered");
}
