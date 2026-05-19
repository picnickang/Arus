import { createLogger } from "../structured-logger.js";
import { initEventSpineOutboxBridge } from "./bridge.js";
import { KafkaEventSpineProducer } from "./kafka-producer.js";
import { InMemoryFanoutProducer, NoopProducer } from "./producers.js";
import { TelemetryAnalyticsSink } from "./telemetry-analytics-sink.js";
import type { EventSpineProducer, EventSpineFanout } from "./types.js";
import { EventSpineWorker } from "./worker.js";
import { PgNotifyCdcBridge, type PgNotifyCdcTableConfig } from "./cdc-pg-notify.js";

const logger = createLogger("EventSpine");

export { enqueueOutbox, enqueueOutboxFromEnvelope } from "./outbox-repository.js";
export type { EventSpineMessage, EventSpineProducer, EventSpineFanout } from "./types.js";
export { NoopProducer, InMemoryFanoutProducer } from "./producers.js";
export { KafkaEventSpineProducer } from "./kafka-producer.js";
export { TelemetryAnalyticsSink } from "./telemetry-analytics-sink.js";
export { EventSpineWorker } from "./worker.js";
export { initEventSpineOutboxBridge } from "./bridge.js";
export { PgNotifyCdcBridge } from "./cdc-pg-notify.js";
export type { PgNotifyCdcTableConfig } from "./cdc-pg-notify.js";

export interface EventSpineHandle {
  producer: EventSpineProducer;
  worker: EventSpineWorker | null;
  analyticsSink: TelemetryAnalyticsSink | null;
  cdc: PgNotifyCdcBridge | null;
  stop(): Promise<void>;
}

export interface StartEventSpineOptions {
  /** Override producer (tests, future kafkajs adapter). */
  producer?: EventSpineProducer | EventSpineFanout;
  /** Skip starting the worker (e.g. read-only/CLI processes). */
  workerEnabled?: boolean;
  /** Skip enabling the analytics sink consumer. */
  analyticsSinkEnabled?: boolean;
  /** Skip bridging the in-process domain bus into the outbox. */
  bridgeEnabled?: boolean;
}

let handle: EventSpineHandle | null = null as EventSpineHandle | null;

function attachCdc(bridge: PgNotifyCdcBridge): void {
  if (handle) handle.cdc = bridge;
}

/**
 * Boot wiring for the event-streaming spine. Safe to call multiple times
 * (idempotent — returns the existing handle). Defaults pick the lowest-
 * risk configuration: in-memory fanout producer + analytics sink + bridge
 * + worker, behind env gates so production behaviour can be tuned without
 * code change.
 *
 * Env gates:
 *   EVENT_SPINE_DISABLED=1      → no-op, returns null
 *   EVENT_SPINE_WORKER=0        → outbox writes occur, no worker dispatches
 *   EVENT_SPINE_ANALYTICS=0     → analytics sink disabled
 *   EVENT_SPINE_BROKERS=...     → reserved for Kafka/Redpanda adapter (follow-up)
 */
export function startEventSpine(opts: StartEventSpineOptions = {}): EventSpineHandle | null {
  if (process.env.EVENT_SPINE_DISABLED === "1") {
    logger.info("Event spine disabled by EVENT_SPINE_DISABLED=1");
    return null;
  }
  if (handle) return handle;

  const provided = opts.producer;
  const brokers = process.env.EVENT_SPINE_BROKERS;
  let producer: EventSpineProducer | EventSpineFanout;
  if (provided) {
    producer = provided;
  } else if (brokers) {
    producer = new KafkaEventSpineProducer({
      brokers,
      topicPrefix: process.env.EVENT_SPINE_TOPIC_PREFIX ?? "arus.",
      clientId: process.env.EVENT_SPINE_CLIENT_ID,
      sasl:
        process.env.EVENT_SPINE_SASL_USERNAME && process.env.EVENT_SPINE_SASL_PASSWORD
          ? {
              mechanism:
                (process.env.EVENT_SPINE_SASL_MECHANISM as
                  | "plain"
                  | "scram-sha-256"
                  | "scram-sha-512") ?? "plain",
              username: process.env.EVENT_SPINE_SASL_USERNAME,
              password: process.env.EVENT_SPINE_SASL_PASSWORD,
            }
          : undefined,
    });
    logger.info("Event spine producer = Kafka", { brokers });
  } else {
    producer = new InMemoryFanoutProducer();
  }
  const fanout = "onMessage" in producer ? (producer as EventSpineFanout) : null;

  const workerEnabled = opts.workerEnabled ?? process.env.EVENT_SPINE_WORKER !== "0";
  const analyticsEnabled =
    opts.analyticsSinkEnabled ?? process.env.EVENT_SPINE_ANALYTICS !== "0";
  const bridgeEnabled = opts.bridgeEnabled ?? true;

  if (bridgeEnabled) initEventSpineOutboxBridge();

  let analyticsSink: TelemetryAnalyticsSink | null = null;
  if (analyticsEnabled && fanout) {
    analyticsSink = new TelemetryAnalyticsSink();
    analyticsSink.subscribe(fanout);
  } else if (analyticsEnabled && !fanout) {
    logger.warn(
      "Analytics sink requested but configured producer does not support in-process subscription; skipping"
    );
  }

  let worker: EventSpineWorker | null = null;
  if (workerEnabled) {
    worker = new EventSpineWorker({ producer });
    worker.start();
  } else {
    logger.info("Event spine worker disabled (outbox-only mode)");
  }

  let cdc: PgNotifyCdcBridge | null = null;
  const cdcEnabled = process.env.EVENT_SPINE_CDC === "1";
  if (cdcEnabled) {
    // CDC is opt-in: only starts when explicitly enabled because it
    // installs PG triggers on the listed tables and holds a dedicated
    // LISTEN connection. Table set kept narrow on purpose — capturing
    // every table without curation would flood the outbox.
    void (async () => {
      try {
        const { pool } = await import("../../db.js");
        const tables: PgNotifyCdcTableConfig[] = [
          { table: "work_orders", eventTypePrefix: "cdc.work_order", aggregateType: "WorkOrder" },
          {
            table: "maintenance_schedules",
            eventTypePrefix: "cdc.maintenance",
            aggregateType: "MaintenanceSchedule",
          },
          { table: "inventory_items", eventTypePrefix: "cdc.inventory", aggregateType: "InventoryItem" },
        ];
        const bridge = new PgNotifyCdcBridge({ pool: pool as unknown as import("pg").Pool, tables });
        await bridge.start();
        cdc = bridge;
        attachCdc(bridge);
      } catch (err) {
        logger.error("CDC bridge failed to start", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }

  handle = {
    producer,
    worker,
    analyticsSink,
    cdc,
    async stop() {
      if (cdc) await cdc.stop().catch(() => {});
      if (worker) await worker.stop();
      else await producer.close().catch(() => {});
      handle = null;
    },
  };

  if (worker || analyticsSink || bridgeEnabled) {
    logger.info("Event spine started", {
      worker: !!worker,
      analyticsSink: !!analyticsSink,
      bridge: bridgeEnabled,
      cdc: process.env.EVENT_SPINE_CDC === "1",
      producer: producer.constructor.name,
    });
  }

  return handle;
}

export function getEventSpine(): EventSpineHandle | null {
  return handle;
}

/** Test-only: tear down the singleton between tests. */
export async function __resetEventSpineForTests(): Promise<void> {
  if (handle) await handle.stop();
  handle = null;
}

/** Default no-op producer (e.g. when a non-fanout producer is needed in CLI). */
export function createDefaultProducer(): EventSpineProducer {
  return new NoopProducer();
}
