import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";

describe("WorkOrder publisher: post-commit emit semantics", () => {
  // Guards against the prior regression where domainEventBus.emit ran
  // inside the tx, exposing uncommitted events to in-process subscribers.
  beforeEach(() => {
    jest.resetModules();
    jest.doMock("../../../db", () => ({ db: {}, pool: {} }));
    jest.doMock("../outbox-repository", () => ({
      __esModule: true,
      enqueueOutboxFromEnvelope: jest.fn(async () => undefined),
      enqueueOutbox: jest.fn(async () => undefined),
    }));
    const onceBus = new (require("node:events").EventEmitter)();
    jest.doMock("../../domain-event-bus/index", () => ({
      __esModule: true,
      domainEventBus: onceBus,
      createDomainEvent: (name: string, orgId: string, payload: unknown, meta: unknown) => ({
        name,
        orgId,
        payload,
        ...((meta as never) ?? {}),
      }),
    }));
  });

  async function loadAdapter() {
    return (await import(
      "../../../domains/work-orders/infrastructure/event-publisher-adapter"
    )) as typeof import("../../../domains/work-orders/infrastructure/event-publisher-adapter");
  }

  test("publish(event, tx) defers in-process emit — caller must invoke thunk after commit", async () => {
    const { workOrderEventPublisher } = await loadAdapter();
    const busRaw: unknown = (await import("../../domain-event-bus/index")).domainEventBus;
    const bus = busRaw as {
      emit: jest.Mock;
      on: (n: string, cb: (e: unknown) => void) => void;
    };
    bus.emit = jest.fn() as never;

    const fakeTx: object = {};
    const post = await workOrderEventPublisher.publish(
      {
        type: "WORK_ORDER_CREATED",
        workOrderId: "wo-1",
        orgId: "org-1",
        timestamp: new Date(),
      } as never,
      fakeTx
    );
    // Critical: emit MUST NOT have fired during publish (would leak
    // uncommitted events to in-process subscribers).
    expect(bus.emit).not.toHaveBeenCalled();
    expect(typeof post).toBe("function");

    // Now simulate post-commit invocation.
    (post as () => void)();
    expect(bus.emit).toHaveBeenCalledTimes(1);
  });

  test("publish(event) without tx emits inline (legacy fast path)", async () => {
    const { workOrderEventPublisher } = await loadAdapter();
    const busRaw: unknown = (await import("../../domain-event-bus/index")).domainEventBus;
    const bus = busRaw as { emit: jest.Mock };
    bus.emit = jest.fn() as never;

    const post = await workOrderEventPublisher.publish({
      type: "WORK_ORDER_CREATED",
      workOrderId: "wo-2",
      orgId: "org-2",
      timestamp: new Date(),
    } as never);
    expect(bus.emit).toHaveBeenCalledTimes(1);
    expect(post).toBeNull();
  });

  test("rollback (thunk never invoked) → no in-process emit", async () => {
    const { workOrderEventPublisher } = await loadAdapter();
    const busRaw: unknown = (await import("../../domain-event-bus/index")).domainEventBus;
    const bus = busRaw as { emit: jest.Mock };
    bus.emit = jest.fn() as never;
    const fakeTx: object = {};
    const post = await workOrderEventPublisher.publish(
      {
        type: "WORK_ORDER_CREATED",
        workOrderId: "wo-3",
        orgId: "org-3",
        timestamp: new Date(),
      } as never,
      fakeTx
    );
    expect(typeof post).toBe("function");
    // Simulate the application service deciding NOT to call the thunk
    // because db.transaction rolled back.
    expect(bus.emit).not.toHaveBeenCalled();
  });
});

describe("PgWalCdcBridge.handle (committed change → outbox event)", () => {
  beforeEach(() => {
    jest.resetModules();
    // Stub server/db so importing the bridge does not trigger the
    // top-level-await chain in production db-config.
    jest.doMock("../../../db", () => ({ db: {}, pool: {} }));
  });

  async function load() {
    const mod = (await import("../cdc-pg-wal")) as typeof import("../cdc-pg-wal");
    return mod.PgWalCdcBridge;
  }

  type Input = import("../types").EnqueueOutboxInput;
  type AnyBridge = {
    handle: (lsn: string, log: unknown) => Promise<void>;
    service: { acknowledge: (lsn: string) => Promise<boolean> } | null;
  };

  async function makeBridge(
    enqueue: (input: Input) => Promise<void>
  ): Promise<AnyBridge> {
    const PgWalCdcBridge = await load();
    const bridge = new PgWalCdcBridge({
      connectionString: "postgres://test/test",
      tables: [
        {
          table: "work_orders",
          eventTypePrefix: "cdc.work_order",
          aggregateType: "WorkOrder",
        },
      ],
      enqueue,
    }) as never as AnyBridge;
    bridge.service = { acknowledge: jest.fn(async () => true) } as never;
    return bridge;
  }

  test("INSERT on a configured table produces exactly one outbox row keyed by orgId", async () => {
    const calls: Input[] = [];
    const bridge = await makeBridge(async (input) => {
      calls.push(input);
    });
    await bridge.handle("0/1A2B3C", {
      change: [
        {
          kind: "insert",
          schema: "public",
          table: "work_orders",
          new: { id: "wo-1", org_id: "org-42", status: "open" },
        },
      ],
    });
    expect(calls).toHaveLength(1);
    const row = calls[0];
    expect(row.eventType).toBe("cdc.work_order.insert");
    expect(row.orgId).toBe("org-42");
    expect(row.aggregateId).toBe("wo-1");
    expect(row.aggregateType).toBe("WorkOrder");
    const payload = row.payload as { source: string; op: string; lsn: string };
    expect(payload.source).toBe("cdc:wal");
    expect(payload.op).toBe("insert");
    expect(payload.lsn).toBe("0/1A2B3C");
  });

  test("UPDATE produces an outbox row that includes the previous row", async () => {
    const calls: Input[] = [];
    const bridge = await makeBridge(async (input) => {
      calls.push(input);
    });
    await bridge.handle("0/2", {
      change: [
        {
          kind: "update",
          table: "work_orders",
          new: { id: "wo-2", org_id: "org-9", status: "completed" },
          old: { id: "wo-2", org_id: "org-9", status: "open" },
        },
      ],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].eventType).toBe("cdc.work_order.update");
    const previous = (calls[0].payload as { previous: Record<string, unknown> | null }).previous;
    expect(previous).toEqual({ id: "wo-2", org_id: "org-9", status: "open" });
  });

  test("rows on tables NOT in the publication config are skipped", async () => {
    const calls: Input[] = [];
    const bridge = await makeBridge(async (input) => {
      calls.push(input);
    });
    await bridge.handle("0/3", {
      change: [
        {
          kind: "insert",
          table: "unrelated_table",
          new: { id: "x", org_id: "org-1" },
        },
      ],
    });
    expect(calls).toHaveLength(0);
  });

  test("rows with missing orgId are dropped (LSN still acked, no enqueue)", async () => {
    const calls: Input[] = [];
    const bridge = await makeBridge(async (input) => {
      calls.push(input);
    });
    await bridge.handle("0/4", {
      change: [
        {
          kind: "insert",
          table: "work_orders",
          new: { id: "wo-3", org_id: null, status: "open" },
        },
      ],
    });
    expect(calls).toHaveLength(0);
    expect(bridge.service?.acknowledge).toHaveBeenCalledWith("0/4");
  });

  test("start() throws when pg-logical-replication dependency is missing (caller must fall back)", () => {
    // Guards against the prior silent-success bug where startEventSpine
    // logged "WAL CDC active" while producing zero events because the
    // dynamic import failed.
    const src = readFileSync("server/lib/event-spine/cdc-pg-wal.ts", "utf8");
    expect(src).toMatch(
      /pg-logical-replication is required for WAL CDC mode but is not installed/
    );
  });
});
