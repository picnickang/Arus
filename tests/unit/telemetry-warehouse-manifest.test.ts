/**
 * Telemetry Warehouse Export — manifest helpers.
 *
 * Pure-function coverage for `mergeEntry` and `pruneEntries`:
 *   - mergeEntry replaces an existing same-date entry (re-run idempotency)
 *     and inserts a new one otherwise, keeping the list sorted DESC by date.
 *   - pruneEntries removes entries strictly older than the cutoff, leaving
 *     same-day and newer ones in place, and reports what it removed.
 */

import { describe, it, expect } from "@jest/globals";

import {
  mergeEntry,
  pruneEntries,
} from "../../server/services/telemetry-warehouse-export/manifest";
import type {
  WarehouseExportEntry,
  WarehouseManifest,
} from "../../server/services/telemetry-warehouse-export/types";

function entry(date: string, overrides: Partial<WarehouseExportEntry> = {}): WarehouseExportEntry {
  return {
    date,
    parquetKey: `key/${date}/part-0001.parquet`,
    rowCount: 10,
    exportedAt: `${date}T00:00:00.000Z`,
    sizeBytes: 1024,
    ...overrides,
  };
}

function manifest(orgId: string, exports: WarehouseExportEntry[]): WarehouseManifest {
  return {
    orgId,
    updatedAt: "2026-01-01T00:00:00.000Z",
    exports,
  };
}

describe("mergeEntry", () => {
  it("inserts a fresh entry into an empty manifest", () => {
    const m = manifest("org-1", []);
    const out = mergeEntry(m, entry("2026-05-19"));
    expect(out.orgId).toBe("org-1");
    expect(out.exports).toHaveLength(1);
    expect(out.exports[0].date).toBe("2026-05-19");
    expect(out.updatedAt).not.toBe(m.updatedAt);
  });

  it("replaces an existing entry with the same date (re-run overwrites)", () => {
    const original = entry("2026-05-19", { rowCount: 10, parquetKey: "old" });
    const updated = entry("2026-05-19", { rowCount: 42, parquetKey: "new" });
    const m = manifest("org-1", [original]);

    const out = mergeEntry(m, updated);

    expect(out.exports).toHaveLength(1);
    expect(out.exports[0].rowCount).toBe(42);
    expect(out.exports[0].parquetKey).toBe("new");
  });

  it("inserts a new entry without disturbing other dates", () => {
    const m = manifest("org-1", [entry("2026-05-18"), entry("2026-05-16")]);
    const out = mergeEntry(m, entry("2026-05-17"));
    expect(out.exports.map((e) => e.date)).toEqual(["2026-05-18", "2026-05-17", "2026-05-16"]);
  });

  it("sorts the result by date DESC regardless of input order", () => {
    const m = manifest("org-1", [entry("2026-05-10"), entry("2026-05-12"), entry("2026-05-11")]);
    const out = mergeEntry(m, entry("2026-05-13"));
    expect(out.exports.map((e) => e.date)).toEqual([
      "2026-05-13",
      "2026-05-12",
      "2026-05-11",
      "2026-05-10",
    ]);
  });

  it("preserves the orgId from the manifest, not the entry", () => {
    const m = manifest("org-keep", []);
    const out = mergeEntry(m, entry("2026-05-19"));
    expect(out.orgId).toBe("org-keep");
  });
});

describe("pruneEntries", () => {
  it("removes entries strictly older than the cutoff", () => {
    const m = manifest("org-1", [
      entry("2026-05-20"),
      entry("2026-05-15"),
      entry("2026-05-10"),
      entry("2026-05-05"),
    ]);

    const { manifest: pruned, removed } = pruneEntries(m, "2026-05-12");

    expect(pruned.exports.map((e) => e.date)).toEqual(["2026-05-20", "2026-05-15"]);
    expect(removed.map((e) => e.date).sort()).toEqual(["2026-05-05", "2026-05-10"]);
  });

  it("keeps entries on the cutoff date itself", () => {
    const m = manifest("org-1", [entry("2026-05-12"), entry("2026-05-11")]);
    const { manifest: pruned, removed } = pruneEntries(m, "2026-05-12");
    expect(pruned.exports.map((e) => e.date)).toEqual(["2026-05-12"]);
    expect(removed.map((e) => e.date)).toEqual(["2026-05-11"]);
  });

  it("returns no removals when everything is newer than the cutoff", () => {
    const m = manifest("org-1", [entry("2026-05-20"), entry("2026-05-19")]);
    const { manifest: pruned, removed } = pruneEntries(m, "2026-01-01");
    expect(pruned.exports).toHaveLength(2);
    expect(removed).toHaveLength(0);
  });

  it("returns an empty manifest when everything is older than the cutoff", () => {
    const m = manifest("org-1", [entry("2025-12-31"), entry("2024-01-01")]);
    const { manifest: pruned, removed } = pruneEntries(m, "2026-01-01");
    expect(pruned.exports).toEqual([]);
    expect(removed).toHaveLength(2);
  });

  it("preserves the orgId on the pruned manifest", () => {
    const m = manifest("org-keep", [entry("2025-01-01")]);
    const { manifest: pruned } = pruneEntries(m, "2026-01-01");
    expect(pruned.orgId).toBe("org-keep");
  });
});
