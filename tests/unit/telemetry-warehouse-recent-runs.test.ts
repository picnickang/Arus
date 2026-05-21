/**
 * Telemetry Warehouse Export — persistent "Recent runs" log coverage.
 *
 * Exercises `recordRun` / `getRecentRuns` / `__resetRecentRunsForTests` in
 * `server/services/telemetry-warehouse-export/last-run.ts`:
 *
 *   (a) recordRun writes a capped, ordered JSON object to the expected key.
 *   (b) getRecentRuns hydrates from the persisted file on first call after
 *       a simulated restart and returns runs newest-first.
 *   (c) dedupe between in-memory and persisted runs is correct.
 *   (d) the in-memory ring buffer still works when object storage throws.
 */

import { jest, describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import type { WarehouseExportJobSummary } from "../../server/services/telemetry-warehouse-export/types";

process.env.PRIVATE_OBJECT_DIR = "/test-bucket/.private";

// ---------------------------------------------------------------------------
// In-memory object-storage stand-in (same shape as the integration test).
// `failMode` lets a single test force every operation to throw to exercise
// the best-effort failure path.
// ---------------------------------------------------------------------------
const storage = new Map<string, Buffer>();
const savedMetadata = new Map<string, unknown>();
let failMode: "none" | "all" = "none";

function maybeFail() {
  if (failMode === "all") throw new Error("object storage unavailable");
}

function makeFakeFile(name: string) {
  return {
    name,
    async exists() {
      maybeFail();
      return [storage.has(name)] as [boolean];
    },
    async download() {
      maybeFail();
      return [storage.get(name) ?? Buffer.alloc(0)] as [Buffer];
    },
    async save(body: string | Buffer, opts?: unknown) {
      maybeFail();
      storage.set(name, Buffer.isBuffer(body) ? body : Buffer.from(body));
      if (opts !== undefined) savedMetadata.set(name, opts);
    },
    async delete() {
      maybeFail();
      storage.delete(name);
    },
  };
}

const fakeObjectStorageClient = {
  bucket(_bucketName: string) {
    return {
      file: (name: string) => makeFakeFile(name),
    };
  },
};

jest.unstable_mockModule(
  "../../server/replit_integrations/object_storage",
  () => ({ objectStorageClient: fakeObjectStorageClient }),
);

const { recordRun, getRecentRuns, __resetRecentRunsForTests } = await import(
  "../../server/services/telemetry-warehouse-export/last-run"
);

const RECENT_RUNS_KEY = ".private/telemetry-warehouse/_recent-runs.json";

function makeSummary(
  overrides: Partial<WarehouseExportJobSummary> = {},
): WarehouseExportJobSummary {
  return {
    date: "2026-05-19",
    orgsTotal: 2,
    orgsExported: 2,
    orgsSkipped: 0,
    orgsFailed: 0,
    rowsExported: 3,
    bytesExported: 1234,
    retentionDeleted: 0,
    durationMs: 500,
    perOrg: [],
    ...overrides,
  };
}

function readPersisted(): { updatedAt: string; runs: WarehouseExportJobSummary[] } {
  const buf = storage.get(RECENT_RUNS_KEY);
  if (!buf) throw new Error("recent-runs file not written");
  return JSON.parse(buf.toString("utf-8")) as {
    updatedAt: string;
    runs: WarehouseExportJobSummary[];
  };
}

beforeEach(() => {
  storage.clear();
  savedMetadata.clear();
  failMode = "none";
  __resetRecentRunsForTests();
});

afterAll(() => {
  delete process.env.PRIVATE_OBJECT_DIR;
});

describe("telemetry-warehouse-export last-run persistence", () => {
  it("(a) writes a capped, oldest-to-newest JSON object to the expected key", async () => {
    // Push 16 runs — capacity is 14, so the two oldest should be evicted.
    for (let i = 0; i < 16; i++) {
      await recordRun(
        makeSummary({
          date: `2026-05-${String(i + 1).padStart(2, "0")}`,
          durationMs: 100 + i,
        }),
      );
    }

    const persisted = readPersisted();
    expect(persisted.runs).toHaveLength(14);
    // Oldest-to-newest ordering on disk: first entry is run #3 (index 2).
    expect(persisted.runs[0].durationMs).toBe(102);
    expect(persisted.runs[persisted.runs.length - 1].durationMs).toBe(115);
    expect(new Date(persisted.updatedAt).toString()).not.toBe("Invalid Date");

    const meta = savedMetadata.get(RECENT_RUNS_KEY) as {
      metadata: { contentType: string; metadata: { entryCount: string } };
    };
    expect(meta.metadata.contentType).toBe("application/json");
    expect(meta.metadata.metadata.entryCount).toBe("14");
  });

  it("(b) hydrates from the persisted file on first call after a simulated restart, newest-first", async () => {
    await recordRun(makeSummary({ date: "2026-05-17", durationMs: 100 }));
    await recordRun(makeSummary({ date: "2026-05-18", durationMs: 200 }));
    await recordRun(makeSummary({ date: "2026-05-19", durationMs: 300 }));

    // Simulate process restart — wipe in-memory state but keep object storage.
    __resetRecentRunsForTests();

    const runs = await getRecentRuns();
    expect(runs.map((r) => r.date)).toEqual([
      "2026-05-19",
      "2026-05-18",
      "2026-05-17",
    ]);

    const limited = await getRecentRuns(2);
    expect(limited.map((r) => r.date)).toEqual(["2026-05-19", "2026-05-18"]);
  });

  it("(c) dedupes runs on hydration so a corrupted persisted file with repeats only loads each identity once", async () => {
    // Seed the persisted file directly with three logical runs, one repeated
    // twice (simulates a prior write that double-appended the same job).
    const persistedRuns: WarehouseExportJobSummary[] = [
      makeSummary({ date: "2026-05-17", durationMs: 100 }),
      makeSummary({ date: "2026-05-18", durationMs: 200 }),
      makeSummary({ date: "2026-05-18", durationMs: 200 }),
      makeSummary({ date: "2026-05-19", durationMs: 300 }),
    ];
    storage.set(
      RECENT_RUNS_KEY,
      Buffer.from(
        JSON.stringify({ updatedAt: "2026-05-19T00:00:00.000Z", runs: persistedRuns }),
      ),
    );

    // First call after a "restart" must hydrate and dedupe the repeat.
    const runs = await getRecentRuns();
    expect(runs).toHaveLength(3);
    const identities = runs.map((r) => `${r.date}|${r.durationMs}|${r.orgsTotal}`);
    expect(new Set(identities).size).toBe(identities.length);
    // Newest-first ordering preserved (hydration keeps loaded order, getRecentRuns reverses).
    expect(runs.map((r) => r.date)).toEqual([
      "2026-05-19",
      "2026-05-18",
      "2026-05-17",
    ]);
  });

  it("(d) keeps the in-memory ring buffer working when object storage throws", async () => {
    failMode = "all";

    await recordRun(makeSummary({ date: "2026-05-18", durationMs: 100 }));
    await recordRun(makeSummary({ date: "2026-05-19", durationMs: 200 }));

    // Persistence failed — no file should be present.
    expect(storage.has(RECENT_RUNS_KEY)).toBe(false);

    // But getRecentRuns must still return the in-memory ring buffer, newest-first.
    const runs = await getRecentRuns();
    expect(runs.map((r) => r.date)).toEqual(["2026-05-19", "2026-05-18"]);
  });
});
