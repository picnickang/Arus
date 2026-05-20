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
import { isPublicApiPath, isSensitiveApiPath } from "./public-api-paths";

export function configureMiddleware(app: Express): void {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";
  const isReplit = !!process.env.REPL_ID || !!process.env.REPL_SLUG;

  const isVesselMode =
    process.env.DEPLOYMENT_MODE === "vessel" || process.env.DEPLOYMENT_MODE === "desktop";
  const configuredTrustProxy = process.env.TRUST_PROXY_HOPS;
  const trustProxy = configuredTrustProxy
    ? Number.parseInt(configuredTrustProxy, 10)
    : isVesselMode
      ? "loopback"
      : isReplit
        ? 1
        : false;
  app.set("trust proxy", trustProxy);

  // Wave 5.11: Tightened CSP/HSTS/security headers.
  // Production removes the `https:` wildcard from imgSrc (data: + self only
  // — we serve our own icons; explicit allow-list a CDN if one is added),
  // pins script-src to 'self' (no inline, no eval), and adds frame-ancestors
  // 'none' / base-uri 'self' / form-action 'self' / upgrade-insecure-requests
  // which Helmet's defaults omit but every security review asks for.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // styleSrc keeps 'unsafe-inline' because Tailwind + shadcn inject
          // runtime styles for animations / dynamic CSS variables. Nonce-
          // based styles would require a server-render pass we don't have.
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: isDevelopment ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'"],
          imgSrc: isDevelopment
            ? ["'self'", "data:", "https:", "blob:"] // NOSONAR: dev-only
            : ["'self'", "data:", "blob:"],
          // Security (S5332): http: protocol allowed in development only for local testing
          // Production enforces HTTPS-only connections
          connectSrc: isDevelopment
            ? ["'self'", "ws:", "wss:", "https:", "http:"] // NOSONAR: Development convenience
            : ["'self'", "wss:", "https://api.openai.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "data:", "blob:"],
          frameSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          workerSrc: ["'self'", "blob:"],
          manifestSrc: ["'self'"],
          ...(isDevelopment ? {} : { upgradeInsecureRequests: [] }),
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
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
    // Production deployments should set ALLOWED_ORIGINS explicitly. Replit keeps
    // its own hosted origins as a safe default so uploaded projects still boot.
    const defaultDevelopmentOrigins = [
      "http://localhost:*",
      "https://localhost:*",
      "http://127.0.0.1:*",
      "https://127.0.0.1:*",
      "tauri://localhost",
      "https://tauri.localhost",
    ];
    const defaultReplitOrigins = [
      "https://*.replit.dev",
      "https://*.replit.dev:*",
      "https://*.replit.app",
      "https://*.replit.app:*",
      "https://*.replit.co",
      "https://*.replit.co:*",
    ];
    const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
    const allowedOrigins = configuredOrigins?.length
      ? configuredOrigins
      : isProduction
        ? isReplit
          ? defaultReplitOrigins
          : []
        : [...defaultDevelopmentOrigins, ...defaultReplitOrigins];

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
      return (originalResJson as (...a: unknown[]) => unknown).apply(res, [bodyJson, ...args]) as ReturnType<typeof res.json>;
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      const loggable = path.startsWith("/api");
      const includeResponseBody = loggable && !isSensitiveApiPath(req);

      if (loggable) {
        const correlationId = getCorrelationId();
        const shortId = correlationId !== "no-context" ? `[${correlationId.slice(0, 8)}] ` : "";
        let line = `${shortId}${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse && includeResponseBody) {
          const jsonStr = safeStringify(capturedJsonResponse);
          line += ` :: ${jsonStr.length > 500 ? `${jsonStr.slice(0, 500)}...` : jsonStr}`;
        } else if (capturedJsonResponse && !includeResponseBody) {
          line += " :: [sensitive response omitted]";
        }
        logger.info(String(line));
      }
    });

    next();
  });
}

export async function configureAuthMiddleware(app: Express): Promise<void> {
  // Dynamic imports here are intentional: this is the auth boot ordering
  // seam. `../security`, `../middleware/auth`, and `../middleware/db-context`
  // each transitively touch the DB / session store / Redis circuit breaker
  // at module-eval time, so they MUST resolve AFTER configureMiddleware()
  // and the DB pool have initialized. Statically importing them would pull
  // their side-effect initialization into server/app.ts's import graph and
  // re-introduce the boot races we hit in Wave 5. Do not convert to static.
  const { requireAuthentication } = await import("../security");
  const { requireOrgId } = await import("../middleware/auth");
  const { withDatabaseContext } = await import("../middleware/db-context");
  const { validateOrgIdHeader } = await import("../orgIdValidation");
  const { apiReadyGate } = await import("../middleware/api-ready-gate");
  const { applyApiVersioning } = await import("../middleware/api-versioning");

  // Mount /api/v1 rewrite BEFORE the /api auth chain so versioned requests
  // re-enter the stack at /api with a single auth pass (the rewrite calls
  // app.handle to re-dispatch with the unversioned URL). Also stamps
  // Deprecation / Sunset / Link headers on legacy unversioned /api/* calls.
  applyApiVersioning(app);

  const skipPublicPaths = (middleware: any) => (req: any, res: any, next: any) => {
    if (isPublicApiPath(req)) {
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
