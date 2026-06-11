import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../structured-logger.js";

const logger = createLogger("EventSpine:AnalyticsSinkReader");

/**
 * Read side of the telemetry NDJSON analytics sink. Lets analytics
 * queries cut over off the OLTP `equipment_telemetry` table to the
 * day-partitioned files produced by `TelemetryAnalyticsSink`.
 *
 * The reader is intentionally simple — it scans the per-org per-day
 * NDJSON files for rows matching `equipmentId` (and optional
 * `sensorType`). It is meant for the dev/local-disk sink contract;
 * the production sink (S3/Parquet) ships with its own reader that
 * pushes the same predicate down to the warehouse engine.
 */
export interface SinkTelemetryRow {
  id?: string | undefined;
  equipmentId: string;
  sensorType: string;
  value: number | null;
  ts: string;
  orgId: string;
}

export interface ReadSinkOptions {
  baseDir?: string;
  orgId: string;
  equipmentId: string;
  sensorType?: string;
  /** Maximum rows returned (most recent first). */
  limit?: number;
  /** Number of days back to scan (default 7). */
  daysBack?: number;
}

function sanitizeOrgId(orgId: string): string {
  return orgId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function dayStamp(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultBaseDir(): string {
  return path.resolve(process.cwd(), "data", "analytics", "telemetry");
}

export async function readTelemetryFromSink(opts: ReadSinkOptions): Promise<SinkTelemetryRow[]> {
  const base = opts.baseDir ?? defaultBaseDir();
  const orgDir = path.join(base, sanitizeOrgId(opts.orgId));
  const daysBack = Math.max(1, opts.daysBack ?? 7);
  const limit = Math.max(1, opts.limit ?? 1000);

  let files: string[] = [];
  try {
    files = await readdir(orgDir);
  } catch {
    return [];
  }

  // Pre-compute the allowed day window so we ignore older files quickly.
  const today = new Date();
  const window = new Set<string>();
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    window.add(`${dayStamp(d)}.ndjson`);
  }
  const candidateFiles = files
    .filter((f) => window.has(f))
    .sort()
    .reverse(); // newest first

  const rows: SinkTelemetryRow[] = [];
  for (const f of candidateFiles) {
    if (rows.length >= limit) {
      break;
    }
    const full = path.join(orgDir, f);
    let body = "";
    try {
      body = await readFile(full, "utf-8");
    } catch (err) {
      logger.warn("Failed to read sink file", {
        file: full,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    const lines = body.split("\n");
    // newest first within file
    for (let i = lines.length - 1; i >= 0 && rows.length < limit; i--) {
      const line = lines[i];
      if (!line) {
        continue;
      }
      let parsed: { eventType?: string; payload?: Record<string, unknown> } | null = null;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const payload = parsed?.payload ?? {};
      // Telemetry envelopes published by the ingestion path put
      // readings under `payload.readings: [{ equipmentId, sensorType, value, ts }]`
      const readings = Array.isArray((payload as { readings?: unknown[] }).readings)
        ? ((payload as { readings: unknown[] }).readings as Record<string, unknown>[])
        : [payload as Record<string, unknown>];
      for (const r of readings) {
        const equipmentId = String(r["equipmentId"] ?? "");
        if (equipmentId !== opts.equipmentId) {
          continue;
        }
        const sensorType = String(r["sensorType"] ?? "");
        if (opts.sensorType && sensorType !== opts.sensorType) {
          continue;
        }
        rows.push({
          id: r["id"] != null ? String(r["id"]) : undefined,
          equipmentId,
          sensorType,
          value:
            typeof r["value"] === "number"
              ? r["value"]
              : r["value"] != null
                ? Number(r["value"])
                : null,
          ts: String(r["ts"] ?? r["occurredAt"] ?? new Date().toISOString()),
          orgId: opts.orgId,
        });
        if (rows.length >= limit) {
          break;
        }
      }
    }
  }
  return rows;
}

export function analyticsReadMode(): "sink" | "oltp" {
  return process.env["EVENT_SPINE_ANALYTICS_READ"] === "sink" ? "sink" : "oltp";
}
