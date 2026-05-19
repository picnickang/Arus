import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { readTelemetryFromSink, analyticsReadMode } from "../analytics-sink-reader";

describe("analytics sink reader", () => {
  let baseDir: string;
  beforeAll(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), "spine-reader-"));
    const orgDir = path.join(baseDir, "org-A");
    await mkdir(orgDir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const file = path.join(orgDir, `${today}.ndjson`);
    const lines = [
      {
        eventType: "telemetry.batch_ingested",
        payload: { readings: [{ equipmentId: "eq-1", sensorType: "vib", value: 1.2, ts: "2026-05-19T11:00:00Z" }] },
      },
      {
        eventType: "telemetry.batch_ingested",
        payload: { readings: [{ equipmentId: "eq-1", sensorType: "vib", value: 1.5, ts: "2026-05-19T12:00:00Z" }] },
      },
      {
        eventType: "telemetry.batch_ingested",
        payload: { readings: [{ equipmentId: "eq-2", sensorType: "temp", value: 60, ts: "2026-05-19T12:30:00Z" }] },
      },
    ].map((l) => JSON.stringify(l)).join("\n");
    await writeFile(file, lines, "utf-8");
  });
  afterAll(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("filters to equipmentId + sensorType and returns rows newest-first within a file", async () => {
    const rows = await readTelemetryFromSink({
      baseDir,
      orgId: "org-A",
      equipmentId: "eq-1",
      sensorType: "vib",
      daysBack: 1,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].equipmentId).toBe("eq-1");
    expect(rows[0].sensorType).toBe("vib");
    // newest first
    expect(rows[0].value).toBe(1.5);
    expect(rows[1].value).toBe(1.2);
  });

  it("returns empty when no matching org dir", async () => {
    const rows = await readTelemetryFromSink({
      baseDir,
      orgId: "missing-org",
      equipmentId: "eq-1",
      daysBack: 1,
    });
    expect(rows).toEqual([]);
  });

  it("returns empty when equipmentId doesn't match", async () => {
    const rows = await readTelemetryFromSink({
      baseDir,
      orgId: "org-A",
      equipmentId: "eq-999",
      daysBack: 1,
    });
    expect(rows).toEqual([]);
  });

  it("analyticsReadMode reflects EVENT_SPINE_ANALYTICS_READ env var", () => {
    const prev = process.env.EVENT_SPINE_ANALYTICS_READ;
    process.env.EVENT_SPINE_ANALYTICS_READ = "sink";
    expect(analyticsReadMode()).toBe("sink");
    process.env.EVENT_SPINE_ANALYTICS_READ = "";
    expect(analyticsReadMode()).toBe("oltp");
    if (prev === undefined) delete process.env.EVENT_SPINE_ANALYTICS_READ;
    else process.env.EVENT_SPINE_ANALYTICS_READ = prev;
  });
});
