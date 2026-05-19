import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { createLogger } from "../structured-logger.js";
import { enqueueOutbox } from "./outbox-repository.js";
import type { EnqueueOutboxInput } from "./types.js";

const logger = createLogger("EventSpine:CDC");

const NOTIFY_CHANNEL = "event_spine_cdc";

/**
 * Postgres CDC bridge — uses native PG `LISTEN/NOTIFY` (no Debezium /
 * Kafka Connect required). For each registered table we install a row
 * trigger that calls `pg_notify(channel, payload)` on INSERT/UPDATE/DELETE.
 * A dedicated client listens on the channel and turns each notification
 * into an outbox row, so the spine captures every committed write — even
 * if the writing application process crashes before the in-process bus
 * could publish (closing the commit→enqueue loss window the bridge has).
 *
 * `pg_notify` payloads are bounded to 8000 bytes, so we keep the notify
 * payload to identifiers + operation; downstream consumers read the full
 * row from the outbox/source as needed. Notifications are *only* sent
 * after the transaction commits (Postgres native behaviour), so we never
 * publish phantom rows.
 *
 * This adapter does not require any external infrastructure; it runs
 * inside the same Postgres the application already uses.
 */

export interface PgNotifyCdcTableConfig {
  /** Postgres table name (unqualified). */
  table: string;
  /** DomainEventName prefix to emit; final type = `${eventTypePrefix}.${op}`. */
  eventTypePrefix: string;
  /** Column that holds the orgId (defaults to `org_id`). */
  orgIdColumn?: string;
  /** Column to use as aggregateId (defaults to `id`). */
  aggregateIdColumn?: string;
  /** Aggregate type string for the envelope (defaults to table name). */
  aggregateType?: string;
}

export interface PgNotifyCdcOptions {
  pool: Pool;
  tables: PgNotifyCdcTableConfig[];
  /** If true, (re-)installs the trigger + function on startup (idempotent). */
  installTriggers?: boolean;
}

type CdcNotifyPayload = {
  table: string;
  op: "insert" | "update" | "delete";
  orgId: string | null;
  aggregateId: string | null;
};

export class PgNotifyCdcBridge {
  private client: PoolClient | null = null;
  private stopped = false;
  private readonly tableConfig = new Map<string, PgNotifyCdcTableConfig>();

  constructor(private readonly opts: PgNotifyCdcOptions) {
    for (const t of opts.tables) this.tableConfig.set(t.table, t);
  }

  async start(): Promise<void> {
    if (this.opts.installTriggers !== false) {
      await this.installFunctionAndTriggers();
    }
    this.client = await this.opts.pool.connect();
    this.client.on("notification", (msg) => {
      if (msg.channel !== NOTIFY_CHANNEL || !msg.payload) return;
      void this.handleNotify(msg.payload);
    });
    this.client.on("error", (err) => {
      logger.error("CDC listen client error", { error: err.message });
    });
    await this.client.query(`LISTEN ${NOTIFY_CHANNEL}`);
    logger.info("PG-notify CDC bridge started", {
      tables: Array.from(this.tableConfig.keys()),
    });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.client) {
      try {
        await this.client.query(`UNLISTEN ${NOTIFY_CHANNEL}`);
      } catch {
        /* ignore */
      }
      this.client.release();
      this.client = null;
    }
  }

  private async handleNotify(raw: string): Promise<void> {
    if (this.stopped) return;
    let parsed: CdcNotifyPayload;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      logger.warn("CDC notify payload not JSON", { raw: raw.slice(0, 200) });
      return;
    }
    const cfg = this.tableConfig.get(parsed.table);
    if (!cfg) return;
    if (!parsed.orgId) {
      // CDC events without orgId would violate the partition contract.
      logger.warn("CDC event without orgId — dropping", {
        table: parsed.table,
        op: parsed.op,
      });
      return;
    }
    const input: EnqueueOutboxInput = {
      eventId: randomUUID(),
      eventType: `${cfg.eventTypePrefix}.${parsed.op}`,
      orgId: parsed.orgId,
      aggregateId: parsed.aggregateId,
      aggregateType: cfg.aggregateType ?? cfg.table,
      occurredAt: new Date(),
      payload: { source: "pg-cdc", ...parsed },
    };
    try {
      await enqueueOutbox(input);
    } catch (err) {
      logger.warn("Failed to enqueue CDC event", {
        table: parsed.table,
        op: parsed.op,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async installFunctionAndTriggers(): Promise<void> {
    const client = await this.opts.pool.connect();
    try {
      // Idempotent: function created if missing, triggers re-installed.
      await client.query(`
        CREATE OR REPLACE FUNCTION event_spine_cdc_notify() RETURNS trigger AS $$
        DECLARE
          rec record;
          org_col text := TG_ARGV[0];
          agg_col text := TG_ARGV[1];
          payload jsonb;
        BEGIN
          IF (TG_OP = 'DELETE') THEN
            rec := OLD;
          ELSE
            rec := NEW;
          END IF;
          payload := jsonb_build_object(
            'table', TG_TABLE_NAME,
            'op', lower(TG_OP),
            'orgId', (to_jsonb(rec) ->> org_col),
            'aggregateId', (to_jsonb(rec) ->> agg_col)
          );
          PERFORM pg_notify('${NOTIFY_CHANNEL}', payload::text);
          RETURN rec;
        END;
        $$ LANGUAGE plpgsql;
      `);

      for (const cfg of this.opts.tables) {
        const triggerName = `event_spine_cdc_${cfg.table}`;
        const orgCol = cfg.orgIdColumn ?? "org_id";
        const aggCol = cfg.aggregateIdColumn ?? "id";
        await client.query(
          `DROP TRIGGER IF EXISTS ${triggerName} ON ${cfg.table}`
        );
        await client.query(`
          CREATE TRIGGER ${triggerName}
          AFTER INSERT OR UPDATE OR DELETE ON ${cfg.table}
          FOR EACH ROW EXECUTE FUNCTION event_spine_cdc_notify('${orgCol}', '${aggCol}');
        `);
      }
      logger.info("CDC triggers installed", { tables: this.opts.tables.map((t) => t.table) });
    } finally {
      client.release();
    }
  }
}
