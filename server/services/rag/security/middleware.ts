/**
 * RAG Security Middleware
 * Authentication, rate limiting, and request validation for RAG endpoints
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../../../utils/logger.js";
import { getRagSecurityServices } from "./index.js";

// Extended request type with RAG security context
export interface RagSecuredRequest extends Request {
  ragContext?: {
    userId: string;
    orgId: string;
    authenticated: boolean;
    sanitizedQuery?: string;
    streamingToken?: string;
  };
}

/**
 * Middleware to authenticate RAG requests
 * Validates session or streaming token
 */
export function ragAuthMiddleware(req: RagSecuredRequest, res: Response, next: NextFunction): void {
  const { config, tokenService, auditLogger } = getRagSecurityServices();
  
  // For development mode, allow header-based org ID
  const isDev = process.env.NODE_ENV === 'development';
  
  // Try to get auth context from session first
  const session = (req as any).session;
  let userId = session?.userId || 'anonymous';
  let orgId = session?.orgId;
  let authenticated = !!session?.orgId;

  // Check for streaming token in query params (for EventSource)
  const streamingToken = req.query.token as string;
  if (streamingToken) {
    const tokenPayload = tokenService.validateToken(streamingToken);
    if (tokenPayload) {
      userId = tokenPayload.userId;
      orgId = tokenPayload.orgId;
      authenticated = true;
      logger.debug("RagAuth", "Authenticated via streaming token");
    } else if (config.auth.requireSession) {
      auditLogger.logAuthFailure({
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        reason: 'Invalid or expired streaming token',
      });
      res.status(401).json({ error: 'Invalid or expired streaming token' });
      return;
    }
  }

  // Fall back to header-based org ID (dev mode only)
  if (!orgId && config.auth.allowHeaderOrgId) {
    orgId = req.get('x-org-id') || 'default-org-id';
    if (isDev && !authenticated) {
      userId = 'dev-user-id';
      authenticated = false; // Mark as not fully authenticated
    }
  }

  // Enforce session requirement in production
  if (!orgId && config.auth.requireSession && !isDev) {
    auditLogger.logAuthFailure({
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      reason: 'No valid session or org context',
    });
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Default fallback for dev mode
  if (!orgId) {
    orgId = 'default-org-id';
  }

  req.ragContext = {
    userId,
    orgId,
    authenticated,
  };

  next();
}

/**
 * Middleware to enforce rate limiting on RAG requests
 */
export async function ragRateLimitMiddleware(
  req: RagSecuredRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { config, rateLimiter, auditLogger } = getRagSecurityServices();

  if (!config.rateLimiting.enabled) {
    next();
    return;
  }

  // Use user ID + org ID as rate limit key, falling back to IP
  const context = req.ragContext;
  const identifier = context?.authenticated 
    ? `user:${context.userId}:${context.orgId}`
    : `ip:${req.ip}`;

  try {
    const result = await rateLimiter.checkLimit(identifier);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', config.rateLimiting.requestsPerMinute.toString());
    res.set('X-RateLimit-Remaining', result.remaining.toString());
    res.set('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

    if (!result.allowed) {
      auditLogger.logRateLimitExceeded({
        userId: context?.userId,
        orgId: context?.orgId,
        ipAddress: req.ip,
        identifier,
        retryAfter: result.retryAfter || 60,
      });

      res.set('Retry-After', (result.retryAfter || 60).toString());
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: result.retryAfter,
        remaining: 0,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error("RagRateLimit", "Rate limit check failed", error);
    // Fail open - allow request if rate limiter has issues
    next();
  }
}

/**
 * Middleware to sanitize query input
 */
export function ragInputSanitizationMiddleware(
  req: RagSecuredRequest,
  res: Response,
  next: NextFunction
): void {
  const { config, sanitizer, auditLogger } = getRagSecurityServices();

  if (!config.promptSecurity.enabled) {
    next();
    return;
  }

  // Get query from body (POST) or query params (GET)
  const query = req.body?.query || req.query?.query;

  if (!query || typeof query !== 'string') {
    next();
    return;
  }

  const result = sanitizer.sanitize(query);

  if (result.blockedPatterns.length > 0) {
    auditLogger.logPromptInjectionAttempt({
      userId: req.ragContext?.userId,
      orgId: req.ragContext?.orgId,
      ipAddress: req.ip,
      blockedPatterns: result.blockedPatterns,
      queryPreview: query.slice(0, 200),
    });
  }

  // Log the query
  auditLogger.logQuery({
    userId: req.ragContext?.userId,
    orgId: req.ragContext?.orgId,
    ipAddress: req.ip,
    query: result.sanitized,
    sanitized: result.wasModified,
    blockedPatterns: result.blockedPatterns,
  });

  // Update the request with sanitized query
  if (req.body?.query) {
    req.body.query = result.sanitized;
  }
  if (req.ragContext) {
    req.ragContext.sanitizedQuery = result.sanitized;
  }

  next();
}

/**
 * Generate a streaming token for authenticated users
 */
export function generateStreamingToken(req: RagSecuredRequest, res: Response): void {
  const { tokenService } = getRagSecurityServices();
  const context = req.ragContext;

  if (!context?.orgId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = tokenService.generateToken(context.userId, context.orgId);

  res.json({ 
    token,
    expiresIn: getRagSecurityServices().config.auth.streamingTokenTTLSeconds,
  });
}

/**
 * Combined middleware for standard RAG routes
 */
export function ragSecurityMiddleware(
  req: RagSecuredRequest,
  res: Response,
  next: NextFunction
): void {
  ragAuthMiddleware(req, res, (err) => {
    if (err) {return next(err);}
    ragRateLimitMiddleware(req, res, (err) => {
      if (err) {return next(err);}
      ragInputSanitizationMiddleware(req, res, next);
    });
  });
}
