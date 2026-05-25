/**
 * Static File Serving & SPA Fallback
 * Handles production and embedded mode static file serving
 */

import type { Express } from "express";
import type { Server } from "node:http";
import express from "express";
import path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Bootstrap:StaticServing");

export async function configureStaticServing(app: Express, server: Server): Promise<void> {
  const isEmbeddedMode = process.env['EMBEDDED_MODE'] === "true";
  const isDevelopmentEnv = app.get("env") === "development";

  if (!isEmbeddedMode && isDevelopmentEnv) {
    logger.info("→ Setting up Vite dev server...");
    const { setupVite } = await import("../vite");
    await setupVite(app, server);
    logger.info("✓ Vite dev server configured");
    return;
  }

  if (isEmbeddedMode) {
    logger.info("→ Setting up static file serving (embedded mode - HMR disabled)...");
  } else {
    logger.info("→ Setting up production static file serving...");
  }

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(__dirname, "../..");

    const candidateStaticRoots = [
      path.join(projectRoot, "dist"),
      path.join(projectRoot, "dist", "public"),
      path.join(projectRoot, "client", "dist"),
    ];

    logger.info("[Static] Candidate roots:", { details: candidateStaticRoots });

    let staticRoot: string | null = null;
    for (const candidate of candidateStaticRoots) {
      if (fs.existsSync(candidate)) {
        const hasIndexHtml = fs.existsSync(path.join(candidate, "index.html"));
        logger.info(`[Static] Checking: ${candidate}`);
        logger.info(`[Static]   - Directory exists: YES`);
        logger.info(`[Static]   - Has index.html: ${hasIndexHtml ? "YES" : "NO"}`);

        if (hasIndexHtml) {
          staticRoot = candidate;
          logger.info(`[Static] ✓ Selected frontend build from: ${candidate}`);

          try {
            const contents = fs.readdirSync(candidate);
            logger.info(`[Static] Contents of staticRoot (${contents.length} items):`, { details: contents.slice(0, 10).join(", ") + (contents.length > 10 ? "..." : "") });
          } catch (e) {
            logger.error("[Static] Failed to read staticRoot contents:", undefined, e);
          }
          break;
        } else {
          logger.warn(`[Static] ⚠️  Found directory ${candidate} but no index.html inside`);
        }
      } else {
        logger.info(`[Static] Checking: ${candidate} - NOT FOUND`);
      }
    }

    if (!staticRoot) {
      logger.warn("[Static] ❌ No valid frontend build directory found - SPA UI will not be served");
      logger.warn("[Static] To fix: Run 'npm run build' or 'vite build' to build the frontend");
      return;
    }

    app.get("/__debug-root", (_req, res) => {
      res.json({
        ok: true,
        note: "Root route working",
        time: new Date().toISOString(),
        staticRoot,
        indexHtmlExists: fs.existsSync(path.join(staticRoot!, "index.html")),
      });
    });

    app.use(
      express.static(staticRoot, {
        index: "index.html",
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".css")) {
            res.type("text/css");
          } else if (filePath.endsWith(".js")) {
            res.type("application/javascript");
          } else if (filePath.endsWith(".json")) {
            res.type("application/json");
          } else if (filePath.endsWith(".png")) {
            res.type("image/png");
          } else if (filePath.endsWith(".svg")) {
            res.type("image/svg+xml");
          } else if (filePath.endsWith(".ico")) {
            res.type("image/x-icon");
          }
        },
      })
    );
    logger.info(`[Static] ✓ express.static() configured for: ${staticRoot}`);

    app.get("/", (_req, res) => {
      logger.info("[Static] Explicit root route hit: /");
      res.sendFile(path.join(staticRoot!, "index.html"));
    });
    logger.info("[Static] ✓ Explicit root route (GET /) configured");

    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || path.extname(req.path)) {
        return next();
      }
      logger.info(`[Static] SPA fallback for: ${req.path}`);
      res.sendFile(path.join(staticRoot!, "index.html"));
    });
    logger.info("[Static] ✓ SPA fallback route (GET *) configured");
    logger.info(`✓ Static file serving fully configured from: ${staticRoot}`);
  } catch (error) {
    logger.error(`❌ Failed to set up static file serving:`, undefined, error);
    logger.warn(`⚠️  Continuing in API-only mode (frontend may not load)`);
  }
}

export async function configureFinalErrorHandlers(app: Express): Promise<void> {
  app.use((req, res, _next) => {
    res.status(404).json({
      error: "Not Found",
      path: req.path,
      timestamp: new Date().toISOString(),
    });
  });
  logger.info("[Static] ✓ Final 404 handler registered");

  const { enhancedErrorHandler } = await import("../error-handling");
  app.use(enhancedErrorHandler);
  logger.info("[Static] ✓ Error handler registered (after SPA fallback)");
}
