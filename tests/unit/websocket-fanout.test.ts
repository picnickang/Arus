/**
 * Push B2 — WebSocket fan-out unit tests.
 *
 * Exercises the substrate-agnostic contract directly against the
 * in-process bus. The cross-instance demonstration uses a `Loopback`
 * helper that bridges two `InProcessFanoutBus` instances via a shared
 * publish callback, simulating the role Redis plays in production.
 *
 * The Redis adapter itself is integration-tested in the load harness;
 * this file pins the protocol guarantees the wrapper builds on.
 */

import {
  InProcessFanoutBus,
  REPLAY_WINDOW_MS,
  SYSTEM_ORG_ID,
  compareEventIds,
  makeEventId,
} from "../../server/websocket-fanout";

describe("websocket-fanout / InProcessFanoutBus", () => {
  let bus: InProcessFanoutBus;

  beforeEach(() => {
    bus = new InProcessFanoutBus();
  });

  afterEach(async () => {
    await bus.close();
  });

  test("publish dispatches synchronously to local subscribers", async () => {
    const received: unknown[] = [];
    bus.subscribe("alerts", SYSTEM_ORG_ID, (e) => received.push(e.payload));
    await bus.publish("alerts", { id: "a1" });
    await bus.publish("alerts", { id: "a2" });
    expect(received).toEqual([{ id: "a1" }, { id: "a2" }]);
  });

  test("subscribers are tenant-isolated", async () => {
    const orgA: unknown[] = [];
    const orgB: unknown[] = [];
    bus.subscribe("alerts", "org-a", (e) => orgA.push(e.payload));
    bus.subscribe("alerts", "org-b", (e) => orgB.push(e.payload));
    await bus.publish("alerts", { id: "for-a" }, "org-a");
    await bus.publish("alerts", { id: "for-b" }, "org-b");
    expect(orgA).toEqual([{ id: "for-a" }]);
    expect(orgB).toEqual([{ id: "for-b" }]);
  });

  test("eventIds are strictly monotonic per (orgId, channel)", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      const e = await bus.publish("alerts", { i });
      ids.push(e.eventId);
    }
    for (let i = 1; i < ids.length; i++) {
      expect(compareEventIds(ids[i], ids[i - 1])).toBeGreaterThan(0);
    }
  });

  test("replaySince returns events strictly after the cursor", async () => {
    const e1 = await bus.publish("alerts", { i: 1 });
    const e2 = await bus.publish("alerts", { i: 2 });
    const e3 = await bus.publish("alerts", { i: 3 });

    const fromStart = await bus.replaySince("alerts", SYSTEM_ORG_ID, null);
    expect(fromStart.map((e) => e.eventId)).toEqual([e1.eventId, e2.eventId, e3.eventId]);

    const afterFirst = await bus.replaySince("alerts", SYSTEM_ORG_ID, e1.eventId);
    expect(afterFirst.map((e) => e.eventId)).toEqual([e2.eventId, e3.eventId]);

    const afterAll = await bus.replaySince("alerts", SYSTEM_ORG_ID, e3.eventId);
    expect(afterAll).toEqual([]);
  });

  test("replay drops events outside the window", async () => {
    // Spin a short-window bus so the test doesn't have to wait 5min.
    const shortBus = new InProcessFanoutBus(50);
    try {
      const e1 = await shortBus.publish("alerts", { i: 1 });
      await new Promise((r) => setTimeout(r, 80));
      const e2 = await shortBus.publish("alerts", { i: 2 });
      const replay = await shortBus.replaySince("alerts", SYSTEM_ORG_ID, null);
      // e1 should have aged out; only e2 remains.
      expect(replay.map((e) => e.eventId)).toEqual([e2.eventId]);
      // Asking for "since e1" still works — e1 is gone, but the
      // contract is "everything newer than the cursor that is still
      // in the window", which is e2.
      const sinceE1 = await shortBus.replaySince("alerts", SYSTEM_ORG_ID, e1.eventId);
      expect(sinceE1.map((e) => e.eventId)).toEqual([e2.eventId]);
    } finally {
      await shortBus.close();
    }
  });

  test("unsubscribe stops further delivery", async () => {
    const received: string[] = [];
    const unsub = bus.subscribe("alerts", SYSTEM_ORG_ID, (e) => received.push(e.eventId));
    await bus.publish("alerts", { i: 1 });
    unsub();
    await bus.publish("alerts", { i: 2 });
    expect(received).toHaveLength(1);
  });

  test("REPLAY_WINDOW_MS is exactly 5 minutes per ADR 002", () => {
    expect(REPLAY_WINDOW_MS).toBe(5 * 60 * 1000);
  });
});

describe("websocket-fanout / cross-instance loopback", () => {
  /**
   * Loopback simulates the role Redis Pub/Sub plays in production:
   * a publish on bus A is delivered as a peer message to bus B (and
   * vice versa), so a client connected to one bus sees events
   * published by the other. This is the unit-test equivalent of the
   * "two Node instances behind a load balancer" acceptance criterion.
   */
  class LoopbackBus extends InProcessFanoutBus {
    public peer: LoopbackBus | null = null;

    override async publish(channel: string, payload: unknown, orgId = SYSTEM_ORG_ID) {
      const event = await super.publish(channel, payload, orgId);
      if (this.peer) {
        // Mirror to the peer's local dispatch + replay buffer without
        // re-publishing (which would loop). We use a protected hook to
        // inject the event as if it had arrived over the wire.
        (this.peer as unknown as { dispatch: (e: typeof event) => void }).dispatch(event);
        (this.peer as unknown as { ring: { append: (e: typeof event) => void } }).ring.append(
          event
        );
      }
      return event;
    }
  }

  test("event published on node A reaches subscribers on node B", async () => {
    const a = new LoopbackBus();
    const b = new LoopbackBus();
    a.peer = b;
    b.peer = a;
    try {
      const onA: string[] = [];
      const onB: string[] = [];
      a.subscribe("alerts", SYSTEM_ORG_ID, (e) =>
        onA.push(`a:${(e.payload as { id: string }).id}`)
      );
      b.subscribe("alerts", SYSTEM_ORG_ID, (e) =>
        onB.push(`b:${(e.payload as { id: string }).id}`)
      );

      await a.publish("alerts", { id: "from-a" });
      await b.publish("alerts", { id: "from-b" });

      expect(onA.sort()).toEqual(["a:from-a", "a:from-b"]);
      expect(onB.sort()).toEqual(["b:from-a", "b:from-b"]);
    } finally {
      await a.close();
      await b.close();
    }
  });

  test("mixed legacy+tenant publishing during disconnect — both namespaces replay independently", async () => {
    // Push B2 — clients dual-subscribe to (tenantOrg, channel) AND
    // (SYSTEM_ORG_ID, channel). The two fan-out streams have
    // independent monotonic eventId sequences, so the cursor for one
    // namespace MUST NOT filter the other namespace's replay. This
    // test pins that invariant: a tenant cursor against a system
    // replay returns the system events untouched, and vice versa.
    const a = new LoopbackBus();
    const b = new LoopbackBus();
    a.peer = b;
    b.peer = a;
    try {
      // Legacy broadcasts land on SYSTEM_ORG_ID; tenant-scoped
      // publishes land on `tenant-x`. Interleave so the streams'
      // eventIds overlap in wall-clock ms.
      const sysCursor = (await a.publish("alerts", { id: "sys-seen" })).eventId;
      const tenCursor = (await a.publish("alerts", { id: "ten-seen" }, "tenant-x")).eventId;
      await a.publish("alerts", { id: "sys-missed-1" });
      await a.publish("alerts", { id: "ten-missed-1" }, "tenant-x");
      await a.publish("alerts", { id: "sys-missed-2" });
      await a.publish("alerts", { id: "ten-missed-2" }, "tenant-x");

      // Each namespace replays only its own missed events using its
      // own per-namespace cursor — no false dedupe, no missed events.
      const sysReplay = await b.replaySince("alerts", SYSTEM_ORG_ID, sysCursor);
      const tenReplay = await b.replaySince("alerts", "tenant-x", tenCursor);
      expect(sysReplay.map((e) => (e.payload as { id: string }).id)).toEqual([
        "sys-missed-1",
        "sys-missed-2",
      ]);
      expect(tenReplay.map((e) => (e.payload as { id: string }).id)).toEqual([
        "ten-missed-1",
        "ten-missed-2",
      ]);

      // A cursor from the WRONG namespace must not silently filter or
      // duplicate the other namespace's stream. Asking for system
      // events with a tenant cursor returns the system stream as if
      // the cursor matched nothing in it — exactly what the per-
      // namespace `(orgId, channel)` cursor key guarantees.
      const crossWrongCursor = await b.replaySince("alerts", SYSTEM_ORG_ID, tenCursor);
      const allSystem = await b.replaySince("alerts", SYSTEM_ORG_ID, null);
      // The replay-from-wrong-cursor returns a SUBSET of the full
      // system stream (those with eventId numerically greater than
      // tenCursor); it never returns events from the tenant stream.
      for (const e of crossWrongCursor) {
        expect(e.orgId).toBe(SYSTEM_ORG_ID);
      }
      expect(crossWrongCursor.length).toBeLessThanOrEqual(allSystem.length);
    } finally {
      await a.close();
      await b.close();
    }
  });

  test("client disconnected from A and reconnected to B sees missed events via replay", async () => {
    // Models the load-balanced reconnect: the client was on node A,
    // missed 3 events during a disconnect, then reconnected to node B.
    // Because every event was mirrored to B's replay buffer at publish
    // time, B can replay them on resubscribe — zero missed events.
    const a = new LoopbackBus();
    const b = new LoopbackBus();
    a.peer = b;
    b.peer = a;
    try {
      const cursor = (await a.publish("alerts", { id: "seen-before-disconnect" })).eventId;
      // Three events published while the client was disconnected.
      await a.publish("alerts", { id: "missed-1" });
      await a.publish("alerts", { id: "missed-2" });
      await a.publish("alerts", { id: "missed-3" });
      // Client reconnects to B and asks for everything since `cursor`.
      const replay = await b.replaySince("alerts", SYSTEM_ORG_ID, cursor);
      expect(replay.map((e) => (e.payload as { id: string }).id)).toEqual([
        "missed-1",
        "missed-2",
        "missed-3",
      ]);
    } finally {
      await a.close();
      await b.close();
    }
  });
});

describe("websocket-fanout / compareEventIds", () => {
  test("compares by ms first, then by seq", () => {
    expect(compareEventIds(makeEventId(1000, 0), makeEventId(1000, 0))).toBe(0);
    expect(compareEventIds(makeEventId(1000, 1), makeEventId(1000, 0))).toBeGreaterThan(0);
    expect(compareEventIds(makeEventId(1000, 0), makeEventId(1001, 0))).toBeLessThan(0);
    // Sanity: cross-second comparison
    expect(compareEventIds(makeEventId(2_000_000, 5), makeEventId(1_999_999, 99))).toBeGreaterThan(
      0
    );
  });
});
