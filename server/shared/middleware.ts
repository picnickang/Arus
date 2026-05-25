import { createLogger } from "../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Shared:Middleware");
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { AuthorizationError, TenantIsolationError, handleRouteError } from "./error-handler";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isAdmin?: boolean;
    }
  }
}

export function createOrgIdMiddleware(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.orgId = DEFAULT_ORG_ID;
    logger.info(`[ORG_CONTEXT_SET] { timestamp: '${new Date().toISOString()}', domain: 'middleware', operation: 'setDefaultOrg', orgId: '${DEFAULT_ORG_ID}' }`);
    next();
  };
}

export function requireOrgIdMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.orgId) {
      handleRouteError(
        new AuthorizationError("Organization ID is required"),
        res,
        "requireOrgIdMiddleware"
      );
      return;
    }
    next();
  };
}

export function validateTenantAccess(resourceOrgId: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.orgId !== resourceOrgId && !req.isAdmin) {
      handleRouteError(
        new TenantIsolationError("Access to this resource is forbidden"),
        res,
        "validateTenantAccess"
      );
      return;
    }
    next();
  };
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
}

export interface RateLimitBundle {
  general: RateLimitConfig;
  write: RateLimitConfig;
  critical: RateLimitConfig;
  report: RateLimitConfig;
  crew: RateLimitConfig;
  telemetry: RateLimitConfig;
}

export function createRateLimitBundle(): RateLimitBundle {
  return {
    general: { windowMs: 60000, max: 100, message: "Too many requests" },
    write: { windowMs: 60000, max: 30, message: "Too many write operations" },
    critical: { windowMs: 60000, max: 10, message: "Too many critical operations" },
    report: { windowMs: 60000, max: 5, message: "Too many report requests" },
    crew: { windowMs: 60000, max: 20, message: "Too many crew operations" },
    telemetry: { windowMs: 1000, max: 1000, message: "Telemetry rate limit exceeded" },
  };
}

export function createLoggerMiddleware(domain: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || crypto.randomUUID().slice(0, 8);

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";

      logger.info(`[${requestId}] ${req.method} ${req.path} ${res.statusCode} in ${duration}ms :: ${logLevel}`);
    });

    next();
  };
}

export function createAuthorizationMiddleware(requiredRoles?: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      handleRouteError(
        new AuthorizationError("Authentication required"),
        res,
        "createAuthorizationMiddleware"
      );
      return;
    }

    next();
  };
}

export function createAdminMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAdmin) {
      handleRouteError(
        new AuthorizationError("Admin access required"),
        res,
        "createAdminMiddleware"
      );
      return;
    }
    next();
  };
}

export function composeMiddleware(...middlewares: RequestHandler[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const runMiddleware = (index: number) => {
      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index]!;
      middleware(req, res, (err?: unknown) => {
        if (err) {
          return next(err);
        }
        runMiddleware(index + 1);
      });
    };

    runMiddleware(0);
  };
}

export function createTenantMiddlewareChain(): RequestHandler {
  return composeMiddleware(createOrgIdMiddleware(), requireOrgIdMiddleware());
}

export function createProtectedMiddlewareChain(options?: {
  requireAdmin?: boolean;
  rateLimitConfig?: RateLimitConfig;
}): RequestHandler {
  const middlewares: RequestHandler[] = [createOrgIdMiddleware(), requireOrgIdMiddleware()];

  if (options?.requireAdmin) {
    middlewares.push(createAdminMiddleware());
  }

  return composeMiddleware(...middlewares);
}

export interface MiddlewareFactory {
  tenant: RequestHandler;
  protected: RequestHandler;
  admin: RequestHandler;
  logger: (domain: string) => RequestHandler;
}

export function createMiddlewareFactory(): MiddlewareFactory {
  return {
    tenant: createTenantMiddlewareChain(),
    protected: createProtectedMiddlewareChain(),
    admin: createProtectedMiddlewareChain({ requireAdmin: true }),
    logger: createLoggerMiddleware,
  };
}
