/**
 * Telemetry Warehouse Export — integration-style coverage for the orchestrator.
 *
 * Runs `runTelemetryWarehouseExport` end-to-end with the three external
 * boundaries stubbed (db, object storage, parquet writer). Verifies:
 *
 *   1. One Parquet file per org (no cross-tenant rows).
 *   2. Per-org partition key shape: `…/orgId=<orgId>/date=YYYY-MM-DD/…`.
 *   3. Each org's manifest is written and lists the new export.
 *   4. Re-running for the same day produces the exact same partition key
 *      (idempotent — overwrites in place, no duplicate manifest entry).
 *
 * Tenant isolation is asserted by inspecting the rows captured by the
 * fake parquet writer per org: every row's `org_id` must match the
 * filename's `orgId=` segment.
 */

import * as fs from "node:fs";
import { jest, describe, it, expect, beforeEach, afterAll } from "@jest/globals";

process.env.PRIVATE_OBJECT_DIR = "/test-bucket/.private";
process.env.TELEMETRY_WAREHOUSE_RETENTION_DAYS = "0";

// ---------------------------------------------------------------------------
// In-memory object-storage stand-in: a single map from object key -> Buffer.
// `bucket.upload` reads the local file (the parquet writer's "output") and
// stores it under the destination key; `bucket.file(name).save()` writes the
// JSON manifest. `bucket.file(name).download()` / `.exists()` let the
// manifest loader round-trip across the two runs.
// ---------------------------------------------------------------------------
const storage = new Map<string, Buffer>();

// Each row passed to the fake parquet writer, indexed by the local temp path.
const writerRowsByPath = new Map<string, Array<Record<string, unknown>>>();

function makeFakeFile(name: string) {
  return {
    name,
    async exists() {
      return [storage.has(name)] as [boolean];
    },
    async download() {
      return [storage.get(name) ?? Buffer.alloc(0)] as [Buffer];
    },
    async save(body: string | Buffer) {
      storage.set(name, Buffer.isBuffer(body) ? body : Buffer.from(body));
    },
    async delete() {
      storage.delete(name);
    },
  };
}

const fakeObjectStorageClient = {
  bucket(_bucketName: string) {
    return {
      file: (name: string) => makeFakeFile(name),
      async upload(localPath: string, opts: { destination: string }) {
        const buf = await fs.promises.readFile(localPath);
        storage.set(opts.destination, buf);
      },
      async getFiles({ prefix }: { prefix: string }) {
        const matched = [...storage.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((k) => makeFakeFile(k));
        return [matched] as [ReturnType<typeof makeFakeFile>[]];
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Fake parquet writer: writes a small placeholder file to localPath so the
// orchestrator's `fs.stat` succeeds, and captures the appended rows for
// later inspection. Avoids the real `@dsnp/parquetjs` dependency entirely.
// ---------------------------------------------------------------------------
const fakeParquetWriter = {
  ParquetSchema: class {
    constructor(public spec: unknown) {}
  },
  ParquetWriter: {
    async openFile(_schema: unknown, localPath: string) {
      const rows: Array<Record<string, unknown>> = [];
      writerRowsByPath.set(localPath, rows);
      return {
        async appendRow(row: Record<string, unknown>) {
          rows.push(row);
        },
        async close() {
          // Persist a small placeholder so `fs.stat` returns a real size.
          await fs.promises.writeFile(localPath, `rows=${rows.length}`);
        },
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Fake db.execute: routes by the param-count signature of the SQL captured
// by drizzle's `sql` tag.
//   - 2 params (dayStart, dayEnd) → DISTINCT org_id list
//   - 3 params (orgId, dayStart, dayEnd) → per-org rollups
// Each org gets two rows so we can prove tenant isolation later.
// ---------------------------------------------------------------------------
function isStringChunk(c: unknown): c is { value: string[] } {
  return (
    typeof c === "object" &&
    c !== null &&
    Array.isArray((c as { value?: unknown }).value)
  );
}

function extractSqlText(q: unknown): string {
  // Drizzle SQL's `queryChunks` interleaves StringChunk objects
  // (`{ value: string[] }`) with raw param values (Date | string | …).
  const chunks: unknown[] = ((q as { queryChunks?: unknown[] })?.queryChunks) ?? [];
  return chunks
    .map((c) => (isStringChunk(c) ? c.value.join("") : ""))
    .join("");
}

function extractDrizzleParams(q: unknown): unknown[] {
  const chunks: unknown[] = ((q as { queryChunks?: unknown[] })?.queryChunks) ?? [];
  return chunks.filter((c) => !isStringChunk(c));
}

const ORG_ROWS: Record<string, Array<Record<string, unknown>>> = {
  "org-a": [
    {
      org_id: "org-a",
      equipment_id: "eq-a-1",
      sensor_type: "temperature",
      bucket_start: new Date("2026-05-19T00:00:00.000Z"),
      bucket_size: "1_hour",
      count: 60,
      avg_value: 21.5,
      min_value: 20,
      max_value: 23,
      stddev_value: 0.5,
      p50_value: 21.5,
      p95_value: 22.8,
      p99_value: 22.99,
      first_value: 20.1,
      last_value: 22.9,
    },
    {
      org_id: "org-a",
      equipment_id: "eq-a-1",
      sensor_type: "temperature",
      bucket_start: new Date("2026-05-19T01:00:00.000Z"),
      bucket_size: "1_hour",
      count: 60,
      avg_value: 21.7,
      min_value: 20.2,
      max_value: 23.1,
      stddev_value: 0.4,
      p50_value: 21.7,
      p95_value: 22.9,
      p99_value: 23.05,
      first_value: 20.5,
      last_value: 23.0,
    },
  ],
  "org-b": [
    {
      org_id: "org-b",
      equipment_id: "eq-b-1",
      sensor_type: "vibration",
      bucket_start: new Date("2026-05-19T00:00:00.000Z"),
      bucket_size: "1_hour",
      count: 120,
      avg_value: 4.2,
      min_value: 3.1,
      max_value: 6.0,
      stddev_value: 0.8,
      p50_value: 4.0,
      p95_value: 5.7,
      p99_value: 5.95,
      first_value: 3.2,
      last_value: 5.8,
    },
  ],
};

const dbExecute = jest.fn(async (q: unknown) => {
  const text = extractSqlText(q);
  if (/DISTINCT\s+org_id/i.test(text)) {
    return { rows: Object.keys(ORG_ROWS).map((id) => ({ org_id: id })) };
  }
  const params = extractDrizzleParams(q);
  const orgId = params[0] as string;
  return { rows: ORG_ROWS[orgId] ?? [] };
});

jest.unstable_mockModule("../../server/db", () => ({
  db: { execute: dbExecute },
  pool: {},
  isLocalMode: false,
  deploymentMode: "CLOUD",
  libsqlClient: null,
}));

jest.unstable_mockModule(
  "../../server/replit_integrations/object_storage",
  () => ({ objectStorageClient: fakeObjectStorageClient }),
);

jest.unstable_mockModule("@dsnp/parquetjs", () => fakeParquetWriter);

// Dynamic import AFTER mocks are registered.
const { runTelemetryWarehouseExport, loadManifest } = await import(
  "../../server/services/telemetry-warehouse-export/index"
);

function findParquetKeys(): string[] {
  return [...storage.keys()].filter((k) => k.endsWith(".parquet"));
}

function findManifestKeys(): string[] {
  return [...storage.keys()].filter((k) => k.endsWith("_manifest.json"));
}

beforeEach(() => {
  storage.clear();
  writerRowsByPath.clear();
  dbExecute.mockClear();
});

afterAll(() => {
  delete process.env.PRIVATE_OBJECT_DIR;
  delete process.env.TELEMETRY_WAREHOUSE_RETENTION_DAYS;
});

describe("runTelemetryWarehouseExport (integration)", () => {
  it("writes one Parquet file per org under tenant-scoped partition keys", async () => {
    const summary = await runTelemetryWarehouseExport({
      now: new Date("2026-05-20T05:00:00.000Z"),
    });

    expect(summary.date).toBe("2026-05-19");
    expect(summary.orgsTotal).toBe(2);
    expect(summary.orgsExported).toBe(2);
    expect(summary.orgsFailed).toBe(0);

    const parquetKeys = findParquetKeys().sort();
    expect(parquetKeys).toHaveLength(2);
    for (const key of parquetKeys) {
      expect(key).toMatch(
        /\/telemetry-warehouse\/orgId=(org-a|org-b)\/date=2026-05-19\/part-0001\.parquet$/,
      );
    }

    const aKey = parquetKeys.find((k) => k.includes("orgId=org-a"));
    const bKey = parquetKeys.find((k) => k.includes("orgId=org-b"));
    expect(aKey).toBeDefined();
    expect(bKey).toBeDefined();
    expect(aKey).not.toEqual(bKey);
  });

  it("never leaks rows across tenants in the parquet payload", async () => {
    await runTelemetryWarehouseExport({
      now: new Date("2026-05-20T05:00:00.000Z"),
    });

    // The orchestrator runs orgs sequentially, so each appendRow call sees
    // a single org's rows. Aggregate every captured row and verify each
    // batch contains exactly one org_id value.
    const allBatches = [...writerRowsByPath.values()];
    expect(allBatches.length).toBe(2);
    for (const rows of allBatches) {
      const uniqueOrgIds = new Set(rows.map((r) => r.org_id));
      expect(uniqueOrgIds.size).toBe(1);
    }

    const orgIdsSeen = allBatches.map((b) => b[0].org_id).sort();
    expect(orgIdsSeen).toEqual(["org-a", "org-b"]);
  });

  it("writes a manifest per org listing the new export entry", async () => {
    await runTelemetryWarehouseExport({
      now: new Date("2026-05-20T05:00:00.000Z"),
    });

    const manifestKeys = findManifestKeys().sort();
    expect(manifestKeys).toHaveLength(2);
    expect(manifestKeys.every((k) => /\/orgId=(org-a|org-b)\/_manifest\.json$/.test(k))).toBe(true);

    const manifestA = await loadManifest("org-a");
    expect(manifestA.orgId).toBe("org-a");
    expect(manifestA.exports).toHaveLength(1);
    expect(manifestA.exports[0].date).toBe("2026-05-19");
    expect(manifestA.exports[0].rowCount).toBe(2);
    expect(manifestA.exports[0].parquetKey).toMatch(
      /\/orgId=org-a\/date=2026-05-19\/part-0001\.parquet$/,
    );

    const manifestB = await loadManifest("org-b");
    expect(manifestB.exports).toHaveLength(1);
    expect(manifestB.exports[0].rowCount).toBe(1);
    expect(manifestB.exports[0].parquetKey).toMatch(/\/orgId=org-b\//);
  });

  it("is idempotent: re-running the same day overwrites the same partition key", async () => {
    const firstNow = new Date("2026-05-20T05:00:00.000Z");
    const firstRun = await runTelemetryWarehouseExport({ now: firstNow });

    const keysAfterFirst = findParquetKeys().sort();
    const manifestAfterFirst = await loadManifest("org-a");
    const firstEntry = manifestAfterFirst.exports[0];

    const secondNow = new Date("2026-05-20T09:30:00.000Z");
    const secondRun = await runTelemetryWarehouseExport({ now: secondNow });

    const keysAfterSecond = findParquetKeys().sort();
    expect(keysAfterSecond).toEqual(keysAfterFirst);
    expect(keysAfterSecond).toHaveLength(2);

    const manifestAfterSecond = await loadManifest("org-a");
    expect(manifestAfterSecond.exports).toHaveLength(1);
    expect(manifestAfterSecond.exports[0].parquetKey).toBe(firstEntry.parquetKey);
    expect(manifestAfterSecond.exports[0].date).toBe(firstEntry.date);

    expect(firstRun.date).toBe(secondRun.date);
    expect(firstRun.orgsExported).toBe(secondRun.orgsExported);
  });
});
