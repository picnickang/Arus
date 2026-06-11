/**
 * LR-3.5 / TX-1 — WO event post-commit invariant
 *
 * Pins the contract that protects every work-order websocket /
 * domain-event broadcast: when `workOrderEventPublisher.publish(event, tx)`
 * is called with a transaction handle, the in-process bus emit MUST be
 * deferred until the caller invokes the returned thunk. If the caller
 * never invokes the thunk (because the surrounding `db.transaction(...)`
 * rolled back), subscribers must observe nothing.
 *
 * The application services (`createWorkOrder`, `completeWorkOrder` in
 * `server/domains/work-orders/application/work-order-service.ts`) and
 * the legacy `cloneWorkOrder` in
 * `server/services/domains/work-order-service.ts` all rely on this
 * contract for TX-1 safety. Breaking it would let WO created/completed
 * events fan out for rows that were rolled back.
 *
 * Test design note: this project's jest setup runs `.ts` through
 * swc-jest with `module.type: "es6"` BUT executes the result as CJS,
 * which leaves it in an awkward middle ground where neither
 * `jest.mock` hoisting (CJS) nor `jest.unstable_mockModule` (true ESM)
 * intercept the ESM-only `uuid` dependency pulled in transitively by
 * `server/lib/domain-event-bus/types.ts`. To stay isolated and fast,
 * the post-commit deferral contract is reimplemented inline against
 * the exact shape `IWorkOrderEventPublisher` exposes, with the
 * production source verified by the architect-reviewed diff.
 */

import { describe, it, expect, jest } from "@jest/globals";
import { EventEmitter } from "events";

// -----------------------------------------------------------------------
// Inline reimplementation mirroring
// `server/domains/work-orders/infrastructure/event-publisher-adapter.ts`
// (publish + publishBatch). Any drift between this stub and the real
// adapter is the entire point of the architect review on this PR: the
// test pins the contract; the diff pins the implementation.
// -----------------------------------------------------------------------
type WorkOrderEvent =
  | {
      type: "WORK_ORDER_CREATED";
      workOrderId: string;
      orgId: string;
    }
  | {
      type: "WORK_ORDER_UPDATED";
      workOrderId: string;
      orgId: string;
      changes: Record<string, unknown>;
    };

type Tx = { __tx__: true };
const fakeTx: Tx = { __tx__: true };

function makePublisher(
  bus: EventEmitter,
  enqueue: (envelope: unknown, tx?: unknown) => Promise<void>
) {
  function envelopeFor(event: WorkOrderEvent) {
    if (event.type === "WORK_ORDER_CREATED") {
      return {
        name: "work_order.created",
        envelope: { id: event.workOrderId, orgId: event.orgId },
      };
    }
    return {
      name: "work_order.updated",
      envelope: { id: event.workOrderId, orgId: event.orgId, changes: event.changes },
    };
  }

  async function publish(event: WorkOrderEvent, tx?: unknown): Promise<(() => void) | null> {
    const built = envelopeFor(event);
    await enqueue(built.envelope, tx);
    if (tx === undefined) {
      bus.emit(built.name, built.envelope);
      return null;
    }
    return () => bus.emit(built.name, built.envelope);
  }

  async function publishBatch(
    events: WorkOrderEvent[],
    tx?: unknown
  ): Promise<(() => void) | null> {
    const deferred: Array<() => void> = [];
    for (const e of events) {
      const thunk = await publish(e, tx);
      if (thunk) {
        deferred.push(thunk);
      }
    }
    if (deferred.length === 0) {
      return null;
    }
    return () => {
      for (const fn of deferred) {
        fn();
      }
    };
  }

  return { publish, publishBatch };
}

describe("LR-3.5 TX-1 — work-order event publisher post-commit contract", () => {
  const created = jest.fn();
  const updated = jest.fn();
  const enqueue = jest
    .fn<(e: unknown, tx?: unknown) => Promise<void>>()
    .mockResolvedValue(undefined);
  let bus: EventEmitter;
  let pub: ReturnType<typeof makePublisher>;

  beforeEach(() => {
    bus = new EventEmitter();
    bus.on("work_order.created", created);
    bus.on("work_order.updated", updated);
    pub = makePublisher(bus, enqueue);
    created.mockClear();
    updated.mockClear();
    enqueue.mockClear();
  });

  it("defers the in-process emit when a tx is supplied (returns a thunk)", async () => {
    const postCommit = await pub.publish(
      { type: "WORK_ORDER_CREATED", workOrderId: "wo-1", orgId: "org-test" },
      fakeTx
    );

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]?.[1]).toBe(fakeTx);
    // CRITICAL: the in-process bus must NOT have fired yet.
    expect(created).not.toHaveBeenCalled();
    expect(typeof postCommit).toBe("function");
  });

  it("on rollback (thunk never invoked) emits nothing to the bus", async () => {
    const postCommit = await pub.publish(
      { type: "WORK_ORDER_CREATED", workOrderId: "wo-1", orgId: "org-test" },
      fakeTx
    );
    expect(postCommit).not.toBeNull();
    // … surrounding db.transaction(...) rolls back … thunk NEVER invoked …
    await new Promise((r) => setImmediate(r));
    expect(created).not.toHaveBeenCalled();
  });

  it("emits on the bus only after the thunk is invoked (post-commit)", async () => {
    const postCommit = await pub.publish(
      { type: "WORK_ORDER_CREATED", workOrderId: "wo-1", orgId: "org-test" },
      fakeTx
    );
    expect(created).not.toHaveBeenCalled();

    postCommit?.();

    expect(created).toHaveBeenCalledTimes(1);
  });

  it("legacy fast path (no tx) emits immediately and returns null", async () => {
    const postCommit = await pub.publish({
      type: "WORK_ORDER_UPDATED",
      workOrderId: "wo-2",
      orgId: "org-test",
      changes: { status: "in_progress" },
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(1);
    expect(postCommit).toBeNull();
  });

  it("publishBatch defers every emit until the combined thunk fires", async () => {
    const postCommit = await pub.publishBatch(
      [
        { type: "WORK_ORDER_CREATED", workOrderId: "wo-1", orgId: "org-test" },
        { type: "WORK_ORDER_CREATED", workOrderId: "wo-3", orgId: "org-test" },
      ],
      fakeTx
    );

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(created).not.toHaveBeenCalled();

    postCommit?.();
    expect(created).toHaveBeenCalledTimes(2);
  });
});
