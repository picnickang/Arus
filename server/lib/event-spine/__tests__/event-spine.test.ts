import { tmpdir } from "node:os";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { jest } from "@jest/globals";

import {
  InMemoryFanoutProducer,
  NoopProducer,
} from "../producers";
import { TelemetryAnalyticsSink } from "../telemetry-analytics-sink";
import { envelopeToOutboxInput } from "../types";
import type { EventSpineMessage } from "../types";

function makeMessage(over: Partial<EventSpineMessage> = {}): EventSpineMessage {
  return {
    eventId: `evt-${  Math.random().toString(36).slice(2)}`,
    eventType: "telemetry.batch_ingested",
    orgId: "org-A",
    aggregateId: "equipment-1",
    aggregateType: "Equipment",
    occurredAt: new Date("2026-05-19T12:00:00Z"),
    payload: { readingCount: 10 },
    ...over,
  };
}

describe("event-spine producers", () => {
  it("NoopProducer succeeds and is closeable", async () => {
    const p = new NoopProducer();
    await p.publish(makeMessage());
    await p.publishBatch([makeMessage(), makeMessage()]);
    await p.close();
  });

  it("InMemoryFanoutProducer delivers every message to every subscriber in order", async () => {
    const p = new InMemoryFanoutProducer();
    const received: string[] = [];
    p.onMessage((m) => {
      received.push(m.eventId);
    });
    const msgs = [makeMessage({ eventId: "a" }), makeMessage({ eventId: "b" }), makeMessage({ eventId: "c" })];
    await p.publishBatch(msgs);
    expect(received).toEqual(["a", "b", "c"]);
    await p.close();
  });

  it("InMemoryFanoutProducer isolates subscriber failures from publish success", async () => {
    const p = new InMemoryFanoutProducer();
    const seen: string[] = [];
    p.onMessage(() => {
      throw new Error("bad consumer");
    });
    p.onMessage((m) => {
      seen.push(m.eventId);
    });
    await expect(p.publish(makeMessage({ eventId: "x" }))).resolves.toBeUndefined();
    expect(seen).toEqual(["x"]);
  });
});

describe("TelemetryAnalyticsSink", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "event-spine-sink-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("filters to telemetry.* by default and writes NDJSON partitioned by orgId + day", async () => {
    const sink = new TelemetryAnalyticsSink({ baseDir: dir });
    const fanout = new InMemoryFanoutProducer();
    sink.subscribe(fanout);

    await fanout.publish(
      makeMessage({ eventType: "telemetry.batch_ingested", orgId: "org-A" })
    );
    await fanout.publish(
      makeMessage({ eventType: "telemetry.anomaly_detected", orgId: "org-A" })
    );
    await fanout.publish(
      makeMessage({ eventType: "work_order.created", orgId: "org-A" })
    );
    await fanout.publish(
      makeMessage({ eventType: "telemetry.batch_ingested", orgId: "org-B" })
    );

    expect(sink.getWriteCount()).toBe(3);

    const orgs = (await readdir(dir)).sort();
    expect(orgs).toEqual(["org-A", "org-B"]);

    const orgAFiles = await readdir(path.join(dir, "org-A"));
    expect(orgAFiles).toEqual(["2026-05-19.ndjson"]);

    const contents = await readFile(path.join(dir, "org-A", "2026-05-19.ndjson"), "utf8");
    const lines = contents.trim().split("\n");
    expect(lines).toHaveLength(2);
    const parsed = lines.map((l) => JSON.parse(l));
    expect(parsed[0].eventType).toBe("telemetry.batch_ingested");
    expect(parsed[1].eventType).toBe("telemetry.anomaly_detected");
    expect(parsed[0].orgId).toBe("org-A");
  });

  it("sanitizes pathological orgId values", async () => {
    const sink = new TelemetryAnalyticsSink({ baseDir: dir });
    const fanout = new InMemoryFanoutProducer();
    sink.subscribe(fanout);
    await fanout.publish(makeMessage({ orgId: "../escape/attempt" }));
    const orgs = await readdir(dir);
    expect(orgs).toEqual(["___escape_attempt"]);
  });

  it("respects custom event prefixes", async () => {
    const sink = new TelemetryAnalyticsSink({
      baseDir: dir,
      eventTypePrefixes: ["alert.", "rms."],
    });
    expect(sink.matches("alert.triggered")).toBe(true);
    expect(sink.matches("rms.alert_triggered")).toBe(true);
    expect(sink.matches("telemetry.batch_ingested")).toBe(false);
  });
});

describe("envelopeToOutboxInput", () => {
  it("flattens a DomainEventEnvelope into an outbox input row, preserving the full envelope as payload", () => {
    const envelope = {
      eventId: "evt-1",
      eventType: "work_order.created",
      occurredAt: new Date("2026-05-19T10:00:00Z"),
      orgId: "org-A",
      aggregateId: "wo-42",
      aggregateType: "WorkOrder",
      payload: { workOrderId: "wo-42", priority: "high" },
    };
    const input = envelopeToOutboxInput(envelope);
    expect(input).toEqual({
      eventId: "evt-1",
      eventType: "work_order.created",
      orgId: "org-A",
      aggregateId: "wo-42",
      aggregateType: "WorkOrder",
      occurredAt: new Date("2026-05-19T10:00:00Z"),
      payload: envelope,
    });
  });

  it("normalizes missing aggregate fields to null", () => {
    const envelope = {
      eventId: "evt-2",
      eventType: "telemetry.batch_ingested",
      occurredAt: new Date(),
      orgId: "org-A",
      payload: {},
    };
    const input = envelopeToOutboxInput(envelope);
    expect(input.aggregateId).toBeNull();
    expect(input.aggregateType).toBeNull();
  });
});

describe("event-spine worker backoff", () => {
  it("backoff grows exponentially and caps at 5 minutes", async () => {
    const { backoffMs } = await import("../backoff");
    expect(backoffMs(0)).toBe(1_000);
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(2)).toBe(4_000);
    expect(backoffMs(10)).toBe(5 * 60_000);
    expect(backoffMs(20)).toBe(5 * 60_000);
  });
});

describe("EventSpineWorker (mocked repository)", () => {
  jest.resetModules();

  it("publishes claimed rows through the producer and marks them published", async () => {
    const claimed: Array<{ id: string; status: string; attempts: number }> = [];
    const claimMock = jest.fn().mockImplementation(async (limit: number) => {
      if (claimed.length > 0) {return [];}
      const rows = [
        {
          id: "r1",
          eventId: "evt-1",
          eventType: "work_order.created",
          orgId: "org-A",
          aggregateId: null,
          aggregateType: null,
          payload: { foo: 1 },
          occurredAt: new Date(),
          status: "dispatching",
          attempts: 1,
          lastError: null,
          nextAttemptAt: new Date(),
          publishedAt: null,
          createdAt: new Date(),
        },
      ];
      for (const r of rows) {claimed.push({ id: r.id, status: r.status, attempts: r.attempts });}
      return rows;
    });
    const markPublishedMock = jest.fn().mockResolvedValue(undefined);
    const markFailedMock = jest.fn().mockResolvedValue(undefined);

    await jest.unstable_mockModule("../outbox-repository", () => ({
      claimPendingBatch: claimMock,
      markPublished: markPublishedMock,
      markFailed: markFailedMock,
      reapStaleDispatching: jest.fn().mockResolvedValue(0),
      backoffMs: (n: number) => 1_000 * 2 ** n,
    }));

    const { EventSpineWorker } = await import("../worker");
    const published: string[] = [];
    const producer = {
      publish: async (m: EventSpineMessage) => {
        published.push(m.eventId);
      },
      publishBatch: async () => {},
      close: async () => {},
    };

    const worker = new EventSpineWorker({ producer, busyPollMs: 1, idlePollMs: 1 });
    const dispatched = await worker.tick();
    expect(dispatched).toBe(1);
    expect(published).toEqual(["evt-1"]);
    expect(markPublishedMock).toHaveBeenCalledWith("r1");
    expect(markFailedMock).not.toHaveBeenCalled();
    await worker.stop();
  });

  it("marks the row failed (and triggers backoff) when the producer throws", async () => {
    jest.resetModules();
    const claimMock = jest.fn().mockResolvedValueOnce([
      {
        id: "r2",
        eventId: "evt-2",
        eventType: "alert.triggered",
        orgId: "org-B",
        aggregateId: null,
        aggregateType: null,
        payload: {},
        occurredAt: new Date(),
        status: "dispatching",
        attempts: 3,
        lastError: null,
        nextAttemptAt: new Date(),
        publishedAt: null,
        createdAt: new Date(),
      },
    ]);
    const markPublishedMock = jest.fn().mockResolvedValue(undefined);
    const markFailedMock = jest.fn().mockResolvedValue(undefined);

    await jest.unstable_mockModule("../outbox-repository", () => ({
      claimPendingBatch: claimMock,
      markPublished: markPublishedMock,
      markFailed: markFailedMock,
      reapStaleDispatching: jest.fn().mockResolvedValue(0),
      backoffMs: (n: number) => 1_000 * 2 ** n,
    }));

    const { EventSpineWorker } = await import("../worker");
    const producer = {
      publish: async () => {
        throw new Error("broker offline");
      },
      publishBatch: async () => {},
      close: async () => {},
    };

    const worker = new EventSpineWorker({ producer, busyPollMs: 1, idlePollMs: 1 });
    await worker.tick();
    expect(markPublishedMock).not.toHaveBeenCalled();
    expect(markFailedMock).toHaveBeenCalledTimes(1);
    expect(markFailedMock.mock.calls[0][0]).toBe("r2");
    expect(markFailedMock.mock.calls[0][1]).toBe(3);
    expect(markFailedMock.mock.calls[0][2]).toBe("broker offline");
    await worker.stop();
    jest.dontMock("../outbox-repository");
  });
});
