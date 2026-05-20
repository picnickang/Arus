/**
 * ARUS Server Entry Point
 * Modular initialization using server/bootstrap/ modules
 */

process.env.TF_CPP_MIN_LOG_LEVEL = "2";

// Wave 2.1: OpenTelemetry MUST init before any other app module so its
// auto-instrumentation hooks Node's module loader (Express, http, pg,
// pg-boss) before they're first required. No-op when
// OTEL_EXPORTER_OTLP_ENDPOINT is absent.
import "./otel";

// Wave 0.4: Sentry inits next, also before any domain code. Sentry v10
// integrates with the OTel tracer provider when both are enabled.
// No-op if SENTRY_DSN is absent.
import "./instrument";

import { createLogger } from "./lib/structured-logger";
const logger = createLogger("Index");
import {
  setupErrorHandlers,
  markStartupComplete,
  validateEnvironment,
  configureMiddleware,
  configureAuthMiddleware,
  initializeLocalDatabase,
  initializeDatabase,
  runMigrationsOnBoot,
  seedDevelopmentUser,
  initializeJobQueue,
  initializeMLServices,
  applyTimescaleOptimizations,
  applyGraphBootstrap,
  startSyncServices,
  initializeTelemetryBatchWriter,
  initializeAutoReplanPolicy,
  initializeFmccPolling,
  initializePatchingSystem,
  initializeSchedulers,
  initializeBackgroundJobs,
  configureStaticServing,
  configureFinalErrorHandlers,
  setupShutdownHandlers,
  startEventLoopMonitoring,
  getLocalModeFlag,
} from "./bootstrap";

setupErrorHandlers();

const isInitDbMode = process.argv.includes("--init-db");
const isHealthCheckMode = process.argv.includes("--health-check");

if (isInitDbMode) {
  import("./init-db-entry.js")
    .then((m: any) => m.initDb())
    .then(() => {
      logger.info("[ARUS] --init-db complete");
      process.exit(0);
    })
    .catch((err: unknown) => {
      logger.error("[ARUS] --init-db failed:", undefined, err);
      process.exit(1);
    });
}

if (isHealthCheckMode) {
  logger.info("[ARUS] Health check: testing native module loading...");
  (async () => {
    try {
      const { createClient } = await import("@libsql/client");
      const client = createClient({ url: ":memory:" });
      await client.execute("SELECT 1 AS ok");
      client.close();
      logger.info("[ARUS] Health check: @libsql/client OK");

      const bcrypt = await import("bcryptjs");
      const hash = await (bcrypt as any).hash("test", 8);
      const ok = await (bcrypt as any).compare("test", hash);
      if (!ok) {
        throw new Error("bcryptjs hash/compare mismatch");
      }
      logger.info("[ARUS] Health check: bcryptjs OK");

      logger.info("[ARUS] Health check: PASSED");
      process.exit(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("[ARUS] Health check: FAILED —", undefined, msg);
      process.exit(1);
    }
  })();
}

logger.info("→ Starting module imports...");

import express from "express";
import { registerRoutes } from "./routes";
import { setApiReady } from "./middleware/api-ready-gate";
import setupRouter from "./routes/setup.js";

logger.info("✓ All module imports completed successfully");

const app = express();
let isApplicationReady = false;
let isDatabaseReady = false;
let databaseStatus = "initializing";

app.use("/api/setup", setupRouter);

app.get("/livez", (_req, res) => res.status(200).json({ status: "alive" }));

app.get("/readyz", (_req, res) => {
  const ready = isApplicationReady && isDatabaseReady;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "initializing",
    application: isApplicationReady ? "ready" : "initializing",
    database: databaseStatus,
  });
});

export { app };

if (!isInitDbMode && !isHealthCheckMode) {
  (async () => {
    let server: ReturnType<typeof import("http").createServer> | null = null;

    try {
      logger.info("→ IIFE started - beginning initialization...");

      const envConfig = validateEnvironment();
      logger.info("→ Environment validated successfully");

      if (!envConfig.hasDatabase) {
        logger.error("❌ FATAL: DATABASE_URL is required. Application cannot start.");
        process.exit(1);
      }

      logger.info("→ Starting application initialization...");

      await initializeLocalDatabase();

      logger.info("→ Setting up middleware...");
      configureMiddleware(app);
      await configureAuthMiddleware(app);
      logger.info("✓ Middleware configured");

      logger.info("→ Registering routes...");
      server = await registerRoutes(app);
      logger.info("✓ Routes registered");

      const port = Number.parseInt(process.env.PORT || "5000", 10);
      server.listen(port, "0.0.0.0", () => {
        logger.info(`✅ Server listening on port ${port} (initialization continuing in background...)`);
      });

      // Set up Vite/static serving FIRST so frontend loads while database initializes
      await configureStaticServing(app, server);
      logger.info("✓ Frontend serving configured");

      // Database and services initialization (can take time with cold starts)
      // Run in background so frontend remains available even during DB issues
      try {
        // Prod-hardening: opt-in pre-boot migration (MIGRATE_ON_BOOT=true).
        // No-op when the flag isn't set, so existing manual-migrate deploys
        // are unaffected. Runs BEFORE initializeDatabase so the schema-
        // dependent setup (views, indexes, seed) sees the fresh schema.
        await runMigrationsOnBoot();
        await initializeDatabase();
        await seedDevelopmentUser();
        isDatabaseReady = true;
        databaseStatus = "ready";
      } catch (dbError: any) {
        isDatabaseReady = false;
        databaseStatus = "failed";
        logger.error("⚠️ Database initialization failed:", undefined, dbError.message);
        logger.info("   Frontend available, API will return 503 until database reconnects");

        if (process.env.EMBEDDED_MODE !== "true" && process.env.LOCAL_MODE !== "true") {
          throw dbError;
        }
      }

      try {
        await initializeJobQueue();
      } catch (jobError: any) {
        logger.warn("⚠️ Job queue initialization failed (non-fatal):", { details: jobError.message });
      }

      await initializeMLServices();

      const localModeFlag = getLocalModeFlag();

      // These services depend on database - wrap in try/catch for resilience
      try {
        await applyTimescaleOptimizations(localModeFlag);
      } catch (e: any) {
        logger.warn("⚠️ TimescaleDB optimizations skipped:", { details: e.message });
      }

      // Push A2 — Knowledge graph bootstrap runs independently of
      // the Timescale gate (reviewer's sixth-pass comment) so local
      // PG + AGE testing works without Timescale being enabled.
      try {
        await applyGraphBootstrap();
      } catch (e: any) {
        logger.warn("⚠️ Knowledge graph bootstrap skipped:", { details: e.message });
      }

      try {
        await startSyncServices(localModeFlag);
      } catch (e: any) {
        logger.warn("⚠️ Sync services initialization skipped:", { details: e.message });
      }

      logger.info("→ Initializing domain event bus...");
      try {
        const { initAllBridges } = await import("./lib/domain-event-bus/bridge.js");
        initAllBridges();
        logger.info("✓ Domain event bus initialized");
      } catch (e: unknown) {
        logger.warn("⚠️ Domain event bus initialization skipped:", { details: e instanceof Error ? e.message : String(e) });
      }

      // Push B3 — Event-streaming spine. Outbox bridge + worker + analytics
      // sink default-on; env-gated off for read-only / CLI processes.
      try {
        const { startEventSpine } = await import("./lib/event-spine/index.js");
        startEventSpine();
        logger.info("✓ Event-streaming spine initialized");
      } catch (e: unknown) {
        logger.warn("⚠️ Event-streaming spine initialization skipped:", {
          details: e instanceof Error ? e.message : String(e),
        });
      }

      const isEmbedded = process.env.EMBEDDED_MODE === "true";

      try {
        await initializeBackgroundJobs(isEmbedded);
        await initializeTelemetryBatchWriter();
        await initializeSchedulers(isEmbedded);
        await initializeAutoReplanPolicy();
        await initializeFmccPolling();
        await initializePatchingSystem(isEmbedded);
      } catch (e: any) {
        logger.warn("⚠️ Background services partially initialized:", { details: e.message });
      }

      try {
        const { startEmailWorker } = await import("./purchasing/email-worker");
        startEmailWorker();
      } catch (e: any) {
        logger.warn("⚠️ Email worker initialization skipped:", { details: e.message });
      }

      await configureFinalErrorHandlers(app);

      isApplicationReady = true;
      setApiReady(isDatabaseReady);
      markStartupComplete();

      startEventLoopMonitoring();

      const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      logger.info(`✅ ${formattedTime} [express] Application initialization complete`);
      logger.info(`🚀 ARUS application is now live!`);
    } catch (error) {
      logger.error("\n❌ FATAL ERROR during application initialization:");
      logger.error(String(error));
      if (error instanceof Error) {
        logger.error("Error name:", undefined, error.name);
        logger.error("Error message:", undefined, error.message);
        logger.error("Stack trace:", undefined, error.stack);
      }

      if (server) {
        logger.info("→ Closing server due to initialization failure...");
        server.close();
      }

      if (process.env.EMBEDDED_MODE === "true" || process.env.LOCAL_MODE === "true") {
        logger.error("⚠️ Embedded/local mode: Starting with degraded functionality");
        markStartupComplete();
      } else {
        process.exit(1);
      }
    }
  })();
}

setupShutdownHandlers();

export { trackConnection, isServerShuttingDown } from "./bootstrap/shutdown";
