import { createLogger } from "../structured-logger.js";
import { initEventSpineOutboxBridge } from "./bridge.js";
import { KafkaEventSpineProducer } from "./kafka-producer.js";
import { InMemoryFanoutProducer, NoopProducer } from "./producers.js";
import { TelemetryAnalyticsSink } from "./telemetry-analytics-sink.js";
import type { EventSpineProducer, EventSpineFanout } from "./types.js";
import { EventSpineWorker } from "./worker.js";
import { PgNotifyCdcBridge, type PgNotifyCdcTableConfig } from "./cdc-pg-notify.js";
import { PgWalCdcBridge, type WalCdcTableConfig } from "./cdc-pg-wal.js";

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
export { PgWalCdcBridge } from "./cdc-pg-wal.js";
export type { WalCdcTableConfig } from "./cdc-pg-wal.js";
export { readTelemetryFromSink, analyticsReadMode } from "./analytics-sink-reader.js";

export interface EventSpineHandle {
  producer: EventSpineProducer;
  worker: EventSpineWorker | null;
  analyticsSink: TelemetryAnalyticsSink | null;
  cdc: PgNotifyCdcBridge | PgWalCdcBridge | null;
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

function attachCdc(bridge: PgNotifyCdcBridge | PgWalCdcBridge): void {
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
    const saslUser = process.env.EVENT_SPINE_SASL_USERNAME;
    const saslPass = process.env.EVENT_SPINE_SASL_PASSWORD;
    const saslMech = (process.env.EVENT_SPINE_SASL_MECHANISM ?? "plain") as
      | "plain"
      | "scram-sha-256"
      | "scram-sha-512";
    let sasl: import("./kafka-producer.js").KafkaSaslConfig | undefined;
    if (saslUser && saslPass) {
      if (saslMech === "plain") {
        sasl = { mechanism: "plain", username: saslUser, password: saslPass };
      } else if (saslMech === "scram-sha-256") {
        sasl = { mechanism: "scram-sha-256", username: saslUser, password: saslPass };
      } else {
        sasl = { mechanism: "scram-sha-512", username: saslUser, password: saslPass };
      }
    }
    producer = new KafkaEventSpineProducer({
      brokers,
      topicPrefix: process.env.EVENT_SPINE_TOPIC_PREFIX ?? "arus.",
      clientId: process.env.EVENT_SPINE_CLIENT_ID,
      sasl,
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

  let cdc: PgNotifyCdcBridge | PgWalCdcBridge | null = null;
  let cdcModeActive: "wal" | "notify" | "off" = "off";
  const cdcEnabled = process.env.EVENT_SPINE_CDC === "1";
  // Default to the WAL/logical-replication adapter (true rebuildable
  // CDC stream); fall back to trigger+NOTIFY only when explicitly asked
  // for via EVENT_SPINE_CDC_MODE=notify (e.g. managed PG without
  // REPLICATION privilege). Both adapters land into the same outbox so
  // downstream consumers are mode-agnostic.
  const cdcMode = (process.env.EVENT_SPINE_CDC_MODE ?? "wal").toLowerCase();
  // Strict policy: with EVENT_SPINE_CDC_STRICT=1 a WAL-start failure is
  // treated as a hard error rather than auto-falling-back to NOTIFY.
  // Useful in environments where silent degradation would mask the
  // missing rebuildable-stream guarantee.
  const cdcStrict = process.env.EVENT_SPINE_CDC_STRICT === "1";
  if (cdcEnabled) {
    const tableDefs = [
      { table: "work_orders", eventTypePrefix: "cdc.work_order", aggregateType: "WorkOrder" },
      {
        table: "maintenance_schedules",
        eventTypePrefix: "cdc.maintenance",
        aggregateType: "MaintenanceSchedule",
      },
      { table: "inventory_items", eventTypePrefix: "cdc.inventory", aggregateType: "InventoryItem" },
    ];
    const startNotify = async (): Promise<PgNotifyCdcBridge> => {
      const { pool } = await import("../../db.js");
      const notifyTables: PgNotifyCdcTableConfig[] = tableDefs;
      const bridge = new PgNotifyCdcBridge({
        pool: pool as never as import("pg").Pool,
        tables: notifyTables,
      });
      await bridge.start();
      return bridge;
    };
    void (async () => {
      try {
        if (cdcMode === "wal" && process.env.DATABASE_URL) {
          const walTables: WalCdcTableConfig[] = tableDefs;
          const bridge = new PgWalCdcBridge({
            connectionString: process.env.DATABASE_URL,
            tables: walTables,
            slotName: process.env.EVENT_SPINE_CDC_SLOT,
            publicationName: process.env.EVENT_SPINE_CDC_PUBLICATION,
          });
          try {
            await bridge.start();
            cdc = bridge;
            cdcModeActive = "wal";
            attachCdc(bridge);
            logger.info("Event spine CDC = WAL (logical replication)");
          } catch (walErr) {
            if (cdcStrict) {
              logger.error(
                "WAL CDC failed to start and EVENT_SPINE_CDC_STRICT=1 — refusing to fall back",
                { error: walErr instanceof Error ? walErr.message : String(walErr) }
              );
              throw walErr;
            }
            logger.warn("WAL CDC failed to start — falling back to NOTIFY", {
              error: walErr instanceof Error ? walErr.message : String(walErr),
            });
            const nbridge = await startNotify();
            cdc = nbridge;
            cdcModeActive = "notify";
            attachCdc(nbridge);
            logger.info("Event spine CDC = NOTIFY (WAL fallback)");
          }
        } else {
          const nbridge = await startNotify();
          cdc = nbridge;
          cdcModeActive = "notify";
          attachCdc(nbridge);
          logger.info("Event spine CDC = NOTIFY (trigger fallback)");
        }
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
      // cdcModeActive reflects what actually came up (set by the async
      // CDC starter above); the env-requested mode may differ if WAL
      // failed and we fell back.
      cdcRequested: cdcEnabled ? cdcMode : "off",
      cdcActive: () => cdcModeActive,
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
