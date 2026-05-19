import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../structured-logger.js";
import type { EventSpineMessage, EventSpineSubscriber } from "./types.js";

const logger = createLogger("EventSpine:TelemetryAnalyticsSink");

/**
 * First Push B3 external consumer (B3.3). Streams telemetry-class events
 * (`telemetry.batch_ingested`, `telemetry.anomaly_detected`) into a
 * day-partitioned NDJSON file on local disk, partitioned by `orgId`:
 *   data/analytics/telemetry/<orgId>/YYYY-MM-DD.ndjson
 *
 * NDJSON in dev keeps the contract simple — DuckDB, Polars, and pandas can
 * all read NDJSON natively, so analytics queries can already cut over to
 * the new sink without hitting OLTP. Production deployment swaps the sink
 * implementation for the S3/warehouse Parquet writer (env-gated, tracked
 * as a follow-up). The consumer contract (`subscribe(fanout)`) is stable
 * across both implementations.
 */
export interface TelemetryAnalyticsSinkOptions {
  /** Base directory; defaults to data/analytics/telemetry under cwd. */
  baseDir?: string;
  /** Event types to capture; defaults to telemetry.*. */
  eventTypePrefixes?: string[];
}

const DEFAULT_PREFIXES = ["telemetry."];

function dayStamp(d: Date): string {
  const iso = d.toISOString();
  return iso.slice(0, 10);
}

function sanitizeOrgId(orgId: string): string {
  return orgId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export class TelemetryAnalyticsSink {
  private readonly baseDir: string;
  private readonly prefixes: string[];
  private writes = 0;

  constructor(opts: TelemetryAnalyticsSinkOptions = {}) {
    this.baseDir =
      opts.baseDir ?? path.resolve(process.cwd(), "data", "analytics", "telemetry");
    this.prefixes = opts.eventTypePrefixes ?? DEFAULT_PREFIXES;
  }

  matches(eventType: string): boolean {
    return this.prefixes.some((p) => eventType.startsWith(p));
  }

  /** Subscribe to a fanout-capable producer (in-process default). */
  subscribe(fanout: EventSpineSubscriber): void {
    fanout.onMessage(async (msg) => {
      if (!this.matches(msg.eventType)) return;
      await this.write(msg);
    });
    logger.info("Telemetry analytics sink subscribed", {
      baseDir: this.baseDir,
      prefixes: this.prefixes,
    });
  }

  async write(msg: EventSpineMessage): Promise<void> {
    try {
      const dir = path.join(this.baseDir, sanitizeOrgId(msg.orgId));
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${dayStamp(msg.occurredAt)}.ndjson`);
      const line =
        JSON.stringify({
          eventId: msg.eventId,
          eventType: msg.eventType,
          orgId: msg.orgId,
          aggregateId: msg.aggregateId,
          aggregateType: msg.aggregateType,
          occurredAt: msg.occurredAt.toISOString(),
          payload: msg.payload,
        }) + "\n";
      await appendFile(file, line, "utf8");
      this.writes += 1;
    } catch (err) {
      logger.warn("Failed to write telemetry analytics row", {
        eventId: msg.eventId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  getWriteCount(): number {
    return this.writes;
  }
}
