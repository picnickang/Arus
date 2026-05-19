import { randomUUID } from "node:crypto";
import { createLogger } from "../structured-logger.js";
import { enqueueOutbox } from "./outbox-repository.js";
import type { EnqueueOutboxInput } from "./types.js";

const logger = createLogger("EventSpine:CDC:WAL");

/**
 * Postgres WAL-based CDC bridge — consumes a logical replication slot
 * (pgoutput plugin) so every committed change to the registered tables
 * lands in the outbox **without depending on application-level triggers**.
 *
 * This is the canonical "rebuildable CDC stream" path the architecture
 * task calls for: schema/DDL changes propagate as WAL Relation messages,
 * and downstream consumers can rebuild views from the slot's start LSN.
 *
 * The implementation uses `pg-logical-replication` (a thin Node binding
 * over the streaming-replication protocol) so we do not need to run
 * Debezium + Kafka Connect alongside the app. The slot is persistent —
 * Postgres holds the LSN until we acknowledge — so a crash/restart of
 * the consumer resumes exactly where it left off (the actual "no
 * messages lost" guarantee Debezium offers).
 *
 * Operational requirements:
 *   * `wal_level = logical` on the Postgres cluster.
 *   * A user with `REPLICATION` attribute.
 *   * A free logical replication slot.
 * If any of those are missing (Neon free tier, managed-PG limitations)
 * the bridge logs a single warning and falls back to the trigger+NOTIFY
 * adapter — both adapters write into the same outbox so consumers do
 * not care which one is live.
 */

export interface WalCdcTableConfig {
  /** Postgres table name (unqualified). */
  table: string;
  /** DomainEventName prefix; final type = `${eventTypePrefix}.${op}`. */
  eventTypePrefix: string;
  /** Column that holds the orgId (defaults to `org_id`). */
  orgIdColumn?: string;
  /** Column to use as aggregateId (defaults to `id`). */
  aggregateIdColumn?: string;
  /** Aggregate type string for the envelope (defaults to table name). */
  aggregateType?: string;
}

export interface WalCdcOptions {
  /** Postgres connection string with replication privileges. */
  connectionString: string;
  /** Logical replication slot name (created if missing). */
  slotName?: string;
  /** Publication name (created if missing). */
  publicationName?: string;
  tables: WalCdcTableConfig[];
}

type PgChange = {
  kind: "insert" | "update" | "delete" | "truncate" | "message" | "relation";
  schema?: string;
  table?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
  key?: Record<string, unknown>;
};

type PgWalMessage = {
  change?: PgChange[];
};

interface LogicalReplicationServiceLike {
  on(event: "data", cb: (lsn: string, log: PgWalMessage) => void): this;
  on(event: "error", cb: (err: Error) => void): this;
  on(event: string, cb: (...args: unknown[]) => void): this;
  subscribe(plugin: unknown, slotName: string): Promise<void>;
  stop(): Promise<void>;
  acknowledge(lsn: string): Promise<boolean>;
}

export class PgWalCdcBridge {
  private service: LogicalReplicationServiceLike | null = null;
  private readonly slotName: string;
  private readonly publicationName: string;
  private readonly tableMap: Map<string, WalCdcTableConfig>;
  private started = false;
  private stopping = false;

  constructor(private readonly opts: WalCdcOptions) {
    this.slotName = opts.slotName ?? "event_spine_slot";
    this.publicationName = opts.publicationName ?? "event_spine_pub";
    this.tableMap = new Map(opts.tables.map((t) => [t.table, t]));
  }

  async start(): Promise<void> {
    if (this.started) return;
    let mod: typeof import("pg-logical-replication");
    try {
      // dynamic import keeps the dependency optional at boot time
      mod = (await import("pg-logical-replication")) as typeof import("pg-logical-replication");
    } catch (err) {
      logger.warn("pg-logical-replication not available — WAL CDC disabled", {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    const { LogicalReplicationService, PgoutputPlugin } = mod;

    // Ensure the publication includes all registered tables. CREATE
    // PUBLICATION + ALTER are idempotent via DO blocks.
    await this.ensurePublication();

    const plugin = new PgoutputPlugin({
      protoVersion: 2,
      publicationNames: [this.publicationName],
    });
    const service = new LogicalReplicationService(
      { connectionString: this.opts.connectionString },
      { acknowledge: { auto: false, timeoutSeconds: 10 } }
    ) as unknown as LogicalReplicationServiceLike;
    this.service = service;

    service.on("data", (lsn, log) => {
      void this.handle(lsn, log).catch((err: unknown) => {
        logger.error("WAL CDC handle failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });
    service.on("error", (err) => {
      logger.error("WAL CDC stream error", { error: err.message });
    });

    // subscribe is long-running — fire-and-forget; reconnect is handled
    // internally by the library.
    void service.subscribe(plugin, this.slotName).catch((err: unknown) => {
      if (this.stopping) return;
      logger.warn("WAL CDC subscribe failed", {
        error: err instanceof Error ? err.message : String(err),
        hint: "wal_level=logical and a REPLICATION-role user are required",
      });
    });
    this.started = true;
    logger.info("WAL CDC bridge started", {
      slot: this.slotName,
      publication: this.publicationName,
      tables: [...this.tableMap.keys()],
    });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.service) {
      await this.service.stop().catch(() => {});
      this.service = null;
    }
    this.started = false;
  }

  private async ensurePublication(): Promise<void> {
    // Use a short-lived client through the standard pg pool to install
    // the publication and the replication slot if they do not exist.
    const { pool } = (await import("../../db.js")) as unknown as {
      pool: { query: (sql: string) => Promise<{ rows: unknown[] }> };
    };
    const tables = [...this.tableMap.keys()];
    if (tables.length === 0) return;

    const tableList = tables.map((t) => `"${t.replace(/"/g, '""')}"`).join(", ");
    const slot = this.slotName.replace(/[^a-zA-Z0-9_]/g, "_");
    const pub = this.publicationName.replace(/[^a-zA-Z0-9_]/g, "_");

    const stmt = `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication WHERE pubname = '${pub}'
        ) THEN
          EXECUTE 'CREATE PUBLICATION ${pub} FOR TABLE ${tableList}';
        ELSE
          BEGIN
            EXECUTE 'ALTER PUBLICATION ${pub} SET TABLE ${tableList}';
          EXCEPTION WHEN others THEN
            -- ignore: publication exists with overlapping table set
            NULL;
          END;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_replication_slots WHERE slot_name = '${slot}'
        ) THEN
          BEGIN
            PERFORM pg_create_logical_replication_slot('${slot}', 'pgoutput');
          EXCEPTION WHEN others THEN
            -- ignore: slot creation may fail on managed PG without REPLICATION
            NULL;
          END;
        END IF;
      END $$;
    `;
    try {
      await pool.query(stmt);
    } catch (err) {
      logger.warn("Could not ensure publication/slot — WAL CDC may be inert", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async handle(lsn: string, log: PgWalMessage): Promise<void> {
    if (!log?.change?.length) {
      if (this.service) await this.service.acknowledge(lsn).catch(() => {});
      return;
    }
    for (const change of log.change) {
      const tableName = change.table;
      if (!tableName) continue;
      const cfg = this.tableMap.get(tableName);
      if (!cfg) continue;
      const op = change.kind;
      if (op !== "insert" && op !== "update" && op !== "delete") continue;

      const row = (op === "delete" ? change.old : change.new) ?? {};
      const orgColumn = cfg.orgIdColumn ?? "org_id";
      const idColumn = cfg.aggregateIdColumn ?? "id";
      const rawOrg = row[orgColumn];
      if (rawOrg == null || rawOrg === "") {
        // Per-tenant ordering depends on a real orgId partition key.
        // Synthesising "unknown" would silently break the contract for
        // every downstream consumer, so we drop + warn instead. The LSN
        // is still acknowledged at the end so the slot does not stall
        // on a malformed row (operator must fix the table).
        logger.warn("WAL CDC: dropping row with missing orgId", {
          table: tableName,
          op,
          aggregateId: row[idColumn] ?? null,
        });
        continue;
      }
      const orgId = String(rawOrg);
      const aggregateId = row[idColumn] != null ? String(row[idColumn]) : null;
      const eventType = `${cfg.eventTypePrefix}.${op}`;

      const input: EnqueueOutboxInput = {
        eventId: randomUUID(),
        eventType,
        orgId,
        aggregateId,
        aggregateType: cfg.aggregateType ?? tableName,
        payload: {
          source: "cdc:wal",
          table: tableName,
          op,
          lsn,
          row,
          previous: op === "update" ? change.old ?? null : null,
        },
        occurredAt: new Date(),
      };
      try {
        await enqueueOutbox(input);
      } catch (err) {
        logger.error("Failed to enqueue WAL CDC event into outbox", {
          error: err instanceof Error ? err.message : String(err),
          table: tableName,
          op,
          orgId,
        });
        // Do NOT acknowledge — the slot will replay this LSN until we
        // succeed. That is precisely the "rebuildable stream" property.
        return;
      }
    }
    if (this.service) {
      await this.service.acknowledge(lsn).catch(() => {});
    }
  }
}
