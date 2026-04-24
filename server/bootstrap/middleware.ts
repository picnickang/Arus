/**
 * Express Middleware Configuration
 * Security headers, CORS, body parsing, logging
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Bootstrap:Middleware");
import type { Express } from "express";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { additionalSecurityHeaders, sanitizeRequestData, detectAttackPatterns } from "../security";
import { originAllowed } from "../utils/corsWildcard";
import { safeStringify } from "../utils/redact-log";
import { correlationMiddleware, getCorrelationId } from "../utils/correlation-context";
import { performanceMiddleware } from "../middleware/performance";

export function configureMiddleware(app: Express): void {
  const isDevelopment = process.env.NODE_ENV === "development";

  const isVesselMode =
    process.env.DEPLOYMENT_MODE === "vessel" || process.env.DEPLOYMENT_MODE === "desktop";
  app.set("trust proxy", isVesselMode ? "loopback" : true);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: isDevelopment ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          // Security (S5332): http: protocol allowed in development only for local testing
          // Production enforces HTTPS-only connections
          connectSrc: isDevelopment
            ? ["'self'", "ws:", "wss:", "https:", "http:"] // NOSONAR: Development convenience
            : ["'self'", "wss:", "https://api.openai.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "data:", "blob:"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  const corsOriginFunction = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin) {
      return callback(null, true);
    }

    // NOSONAR: S5332 - http://localhost allowed for local development only
    // Production deployments use HTTPS exclusively via ALLOWED_ORIGINS env var
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").filter(Boolean) || [
      "https://*.replit.dev",
      "https://*.replit.dev:*",
      "https://*.replit.app",
      "https://*.replit.app:*",
      "https://*.replit.co",
      "https://*.replit.co:*",
      "http://localhost:*",
      "https://localhost:*",
      "http://127.0.0.1:*",
      "https://127.0.0.1:*",
      "tauri://localhost",
      "https://tauri.localhost",
    ];

    const allowed = originAllowed(origin, allowedOrigins);

    if (!allowed && isDevelopment) {
      logger.warn(`🚨 CORS: Blocked origin ${origin}`);
    }

    callback(null, allowed);
  };

  app.use(correlationMiddleware);

  app.use(
    cors({
      origin: corsOriginFunction,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Device-Id",
        "X-Equipment-Id",
        "X-HMAC-Signature",
        "x-org-id",
        "x-correlation-id",
      ],
      exposedHeaders: [
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "x-correlation-id",
      ],
    })
  );

  app.use(
    express.json({
      limit: "5mb",
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(
    express.urlencoded({
      extended: false,
      limit: "5mb",
    })
  );

  app.use(additionalSecurityHeaders);
  app.use(detectAttackPatterns);
  app.use(sanitizeRequestData);
  app.use(performanceMiddleware);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson: any, ...args: any[]) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      const loggable = path.startsWith("/api") && !path.startsWith("/api/auth");

      if (loggable) {
        const correlationId = getCorrelationId();
        const shortId = correlationId !== "no-context" ? `[${correlationId.slice(0, 8)}] ` : "";
        let line = `${shortId}${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          const jsonStr = safeStringify(capturedJsonResponse);
          line += ` :: ${jsonStr.length > 500 ? `${jsonStr.slice(0, 500)}...` : jsonStr}`;
        }
        logger.info(String(line));
      }
    });

    next();
  });
}

export async function configureAuthMiddleware(app: Express): Promise<void> {
  const { requireAuthentication } = await import("../security");
  const { requireOrgId } = await import("../middleware/auth");
  const { withDatabaseContext } = await import("../middleware/db-context");
  const { validateOrgIdHeader } = await import("../orgIdValidation");
  const { apiReadyGate } = await import("../middleware/api-ready-gate");

  const publicPaths = new Set(["/healthz", "/readyz", "/health", "/metrics"]);

  const skipPublicPaths = (middleware: any) => (req: any, res: any, next: any) => {
    if (publicPaths.has(req.path)) {
      return next();
    }
    return middleware(req, res, next);
  };

  app.use("/api", apiReadyGate);
  app.use("/api", skipPublicPaths(requireAuthentication));
  app.use("/api", skipPublicPaths(requireOrgId));
  app.use("/api", skipPublicPaths(validateOrgIdHeader));
  app.use("/api", skipPublicPaths(withDatabaseContext));
}
