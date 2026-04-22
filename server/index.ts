/**
 * ARUS Server Entry Point
 * Modular initialization using server/bootstrap/ modules
 */

process.env.TF_CPP_MIN_LOG_LEVEL = "2";

import {
  setupErrorHandlers,
  markStartupComplete,
  validateEnvironment,
  configureMiddleware,
  configureAuthMiddleware,
  initializeLocalDatabase,
  initializeDatabase,
  seedDevelopmentUser,
  initializeJobQueue,
  initializeMLServices,
  applyTimescaleOptimizations,
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
      console.log("[ARUS] --init-db complete");
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error("[ARUS] --init-db failed:", err);
      process.exit(1);
    });
}

if (isHealthCheckMode) {
  console.log("[ARUS] Health check: testing native module loading...");
  (async () => {
    try {
      const { createClient } = await import("@libsql/client");
      const client = createClient({ url: ":memory:" });
      await client.execute("SELECT 1 AS ok");
      client.close();
      console.log("[ARUS] Health check: @libsql/client OK");

      const bcrypt = await import("bcryptjs");
      const hash = await (bcrypt as any).hash("test", 8);
      const ok = await (bcrypt as any).compare("test", hash);
      if (!ok) {
        throw new Error("bcryptjs hash/compare mismatch");
      }
      console.log("[ARUS] Health check: bcryptjs OK");

      console.log("[ARUS] Health check: PASSED");
      process.exit(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ARUS] Health check: FAILED —", msg);
      process.exit(1);
    }
  })();
}

console.log("→ Starting module imports...");

import express from "express";
import { registerRoutes } from "./routes";
import { setApiReady } from "./middleware/api-ready-gate";
import setupRouter from "./routes/setup.js";

console.log("✓ All module imports completed successfully");

const app = express();
let isApplicationReady = false;

app.use("/api/setup", setupRouter);

app.get("/livez", (_req, res) => res.status(200).json({ status: "alive" }));

app.get("/readyz", (_req, res) => {
  res.status(isApplicationReady ? 200 : 503).json({
    status: isApplicationReady ? "ready" : "initializing",
  });
});

export { app };

if (!isInitDbMode && !isHealthCheckMode) {
  (async () => {
    let server: ReturnType<typeof import("http").createServer> | null = null;

    try {
      console.log("→ IIFE started - beginning initialization...");

      const envConfig = validateEnvironment();
      console.log("→ Environment validated successfully");

      if (!envConfig.hasDatabase) {
        console.error("❌ FATAL: DATABASE_URL is required. Application cannot start.");
        process.exit(1);
      }

      console.log("→ Starting application initialization...");

      await initializeLocalDatabase();

      console.log("→ Setting up middleware...");
      configureMiddleware(app);
      await configureAuthMiddleware(app);
      console.log("✓ Middleware configured");

      console.log("→ Registering routes...");
      server = await registerRoutes(app);
      console.log("✓ Routes registered");

      const port = Number.parseInt(process.env.PORT || "5000", 10);
      server.listen(port, "0.0.0.0", () => {
        console.log(
          `✅ Server listening on port ${port} (initialization continuing in background...)`
        );
      });

      // Set up Vite/static serving FIRST so frontend loads while database initializes
      await configureStaticServing(app, server);
      console.log("✓ Frontend serving configured");

      // Database and services initialization (can take time with cold starts)
      // Run in background so frontend remains available even during DB issues
      try {
        await initializeDatabase();
        await seedDevelopmentUser();
      } catch (dbError: any) {
        console.error("⚠️ Database initialization failed (non-fatal):", dbError.message);
        console.log("   Frontend available, API will return 503 until database reconnects");
      }

      try {
        await initializeJobQueue();
      } catch (jobError: any) {
        console.warn("⚠️ Job queue initialization failed (non-fatal):", jobError.message);
      }

      await initializeMLServices();

      const localModeFlag = getLocalModeFlag();

      // These services depend on database - wrap in try/catch for resilience
      try {
        await applyTimescaleOptimizations(localModeFlag);
      } catch (e: any) {
        console.warn("⚠️ TimescaleDB optimizations skipped:", e.message);
      }

      try {
        await startSyncServices(localModeFlag);
      } catch (e: any) {
        console.warn("⚠️ Sync services initialization skipped:", e.message);
      }

      console.log("→ Initializing domain event bus...");
      try {
        const { initAllBridges } = await import("./lib/domain-event-bus/bridge.js");
        initAllBridges();
        console.log("✓ Domain event bus initialized");
      } catch (e: unknown) {
        console.warn(
          "⚠️ Domain event bus initialization skipped:",
          e instanceof Error ? e.message : String(e)
        );
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
        console.warn("⚠️ Background services partially initialized:", e.message);
      }

      try {
        const { startEmailWorker } = await import("./purchasing/email-worker");
        startEmailWorker();
      } catch (e: any) {
        console.warn("⚠️ Email worker initialization skipped:", e.message);
      }

      await configureFinalErrorHandlers(app);

      isApplicationReady = true;
      setApiReady(true);
      markStartupComplete();

      startEventLoopMonitoring();

      const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      console.log(`✅ ${formattedTime} [express] Application initialization complete`);
      console.log(`🚀 ARUS application is now live!`);
    } catch (error) {
      console.error("\n❌ FATAL ERROR during application initialization:");
      console.error(error);
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);
      }

      if (server) {
        console.log("→ Closing server due to initialization failure...");
        server.close();
      }

      if (process.env.EMBEDDED_MODE === "true" || process.env.LOCAL_MODE === "true") {
        console.error("⚠️ Embedded/local mode: Starting with degraded functionality");
        markStartupComplete();
      } else {
        process.exit(1);
      }
    }
  })();
}

setupShutdownHandlers();

export { trackConnection, isServerShuttingDown } from "./bootstrap/shutdown";
