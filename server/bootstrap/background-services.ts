import type { createLogger } from "../lib/structured-logger";
import { initWorkOrderAssignmentNotifier } from "../composition/work-order-assignment-notifier.js";
import {
  applyGraphBootstrap,
  applyTimescaleOptimizations,
  getLocalModeFlag,
  initializeAutoReplanPolicy,
  initializeBackgroundJobs,
  initializeFmccPolling,
  initializeJobQueue,
  initializeMLServices,
  initializePatchingSystem,
  initializeSchedulers,
  initializeTelemetryBatchWriter,
  startSyncServices,
} from "./index";

type StartupLogger = ReturnType<typeof createLogger>;

function errorDetails(error: unknown): { details: string } {
  return { details: error instanceof Error ? error.message : String(error) };
}

export async function initializePostDatabaseServices(logger: StartupLogger): Promise<void> {
  try {
    await initializeJobQueue();
  } catch (jobError: unknown) {
    logger.warn("⚠️ Job queue initialization failed (non-fatal):", errorDetails(jobError));
  }

  await initializeMLServices();

  const localModeFlag = getLocalModeFlag();

  // These services depend on database - wrap in try/catch for resilience
  try {
    await applyTimescaleOptimizations(localModeFlag);
  } catch (e: unknown) {
    logger.warn("⚠️ TimescaleDB optimizations skipped:", errorDetails(e));
  }

  // Push A2 — Knowledge graph bootstrap runs independently of
  // the Timescale gate (reviewer's sixth-pass comment) so local
  // PG + AGE testing works without Timescale being enabled.
  try {
    await applyGraphBootstrap();
  } catch (e: unknown) {
    logger.warn("⚠️ Knowledge graph bootstrap skipped:", errorDetails(e));
  }

  try {
    await startSyncServices(localModeFlag);
  } catch (e: unknown) {
    logger.warn("⚠️ Sync services initialization skipped:", errorDetails(e));
  }

  logger.info("→ Initializing domain event bus...");
  try {
    const { initAllBridges } = await import("../lib/domain-event-bus/bridge.js");
    initAllBridges();
    initWorkOrderAssignmentNotifier();
    logger.info("✓ Domain event bus initialized");
  } catch (e: unknown) {
    logger.warn("⚠️ Domain event bus initialization skipped:", errorDetails(e));
  }

  // Push B3 — Event-streaming spine. Outbox bridge + worker + analytics
  // sink default-on; env-gated off for read-only / CLI processes.
  try {
    const { startEventSpine } = await import("../lib/event-spine/index.js");
    startEventSpine();
    logger.info("✓ Event-streaming spine initialized");
  } catch (e: unknown) {
    logger.warn("⚠️ Event-streaming spine initialization skipped:", errorDetails(e));
  }

  const isEmbedded = process.env["EMBEDDED_MODE"] === "true";

  try {
    await initializeBackgroundJobs(isEmbedded);
    await initializeTelemetryBatchWriter();
    await initializeSchedulers(isEmbedded);
    await initializeAutoReplanPolicy();
    await initializeFmccPolling();
    await initializePatchingSystem(isEmbedded);
  } catch (e: unknown) {
    logger.warn("⚠️ Background services partially initialized:", errorDetails(e));
  }

  try {
    const { startEmailWorker } = await import("../purchasing/email-worker");
    startEmailWorker();
  } catch (e: unknown) {
    logger.warn("⚠️ Email worker initialization skipped:", errorDetails(e));
  }
}
