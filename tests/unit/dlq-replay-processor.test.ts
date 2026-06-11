/**
 * processDlqReplay — hourly DLQ auto-replay sweep.
 *
 * Uses REAL DeadLetterQueue instances (persistence disabled via env so the
 * repository's write-through never touches a database): the sweep's
 * contract is about queue mutation — success removes, failure bumps
 * retryCount — which stubs would just re-state.
 *
 * Pins: successful drain; poison skip (retryCount >= maxRetryCount stays
 * for manual replay); per-queue cap; handler-less queues skipped; the
 * consecutive-failure abort that protects a backlog from being marched to
 * the poison threshold while the underlying sink is still down.
 */

process.env["DLQ_PERSISTENCE_DISABLED"] = "true";

import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";

type DlqModule = typeof import("../../server/services/dead-letter-queue");
type ProcessorModule = typeof import("../../server/job-processors/dlq-replay-processor");

let DeadLetterQueue: DlqModule["DeadLetterQueue"];
let clearRegisteredQueuesForTests: DlqModule["clearRegisteredQueuesForTests"];
let processDlqReplay: ProcessorModule["processDlqReplay"];

beforeAll(async () => {
  ({ DeadLetterQueue, clearRegisteredQueuesForTests } = await import(
    "../../server/services/dead-letter-queue"
  ));
  ({ processDlqReplay } = await import("../../server/job-processors/dlq-replay-processor"));
});

beforeEach(() => {
  clearRegisteredQueuesForTests();
});

function makeQueue(name: string) {
  return new DeadLetterQueue<{ n: number }>({ name, maxEntries: 100 });
}

describe("processDlqReplay", () => {
  it("replays entries through the queue handler and removes them on success", async () => {
    const queue = makeQueue("replay-ok");
    const replayed: number[] = [];
    queue.setReplayHandler(async (entry) => {
      replayed.push(entry.payload.n);
    });
    queue.add({ n: 1 }, "boom", "test");
    queue.add({ n: 2 }, "boom", "test");
    queue.add({ n: 3 }, "boom", "test");

    const summary = await processDlqReplay();

    expect(summary.queuesScanned).toBe(1);
    expect(summary.replaySucceeded).toBe(3);
    expect(summary.replayFailed).toBe(0);
    expect(replayed).toEqual([1, 2, 3]);
    expect(queue.list()).toHaveLength(0);
  });

  it("skips queues without a replay handler, leaving their entries intact", async () => {
    const handlerless = makeQueue("no-handler");
    handlerless.add({ n: 1 }, "boom", "test");

    const summary = await processDlqReplay();

    expect(summary.queuesScanned).toBe(1);
    expect(summary.queuesWithoutHandler).toBe(1);
    expect(summary.replaySucceeded).toBe(0);
    expect(handlerless.list()).toHaveLength(1);
  });

  it("caps replays per queue at maxPerQueue", async () => {
    const queue = makeQueue("capped");
    queue.setReplayHandler(async () => {});
    for (let i = 0; i < 4; i++) {
      queue.add({ n: i }, "boom", "test");
    }

    const summary = await processDlqReplay({ maxPerQueue: 2 });

    expect(summary.replaySucceeded).toBe(2);
    expect(queue.list()).toHaveLength(2);
  });

  it("leaves poison entries (retryCount >= maxRetryCount) for manual replay", async () => {
    const queue = makeQueue("poison");
    queue.setReplayHandler(async () => {
      throw new Error("sink still down");
    });
    queue.add({ n: 1 }, "boom", "test");
    queue.add({ n: 2 }, "boom", "test");

    // First sweep: both entries are fresh (retryCount 0), both fail → bumped to 1.
    const first = await processDlqReplay({ maxRetryCount: 1 });
    expect(first.replayFailed).toBe(2);
    expect(first.skippedPoison).toBe(0);

    // Second sweep: retryCount 1 >= maxRetryCount 1 → skipped, not retried.
    const second = await processDlqReplay({ maxRetryCount: 1 });
    expect(second.replayFailed).toBe(0);
    expect(second.skippedPoison).toBe(2);
    expect(queue.list()).toHaveLength(2);
  });

  it("abandons a queue after consecutive failures, preserving the rest of the backlog", async () => {
    const queue = makeQueue("storming");
    queue.setReplayHandler(async () => {
      throw new Error("circuit open");
    });
    for (let i = 0; i < 5; i++) {
      queue.add({ n: i }, "boom", "test");
    }

    const summary = await processDlqReplay();

    // Abort threshold is 3 consecutive failures: only the first three
    // entries get a retryCount bump; the rest keep their auto-replay
    // eligibility for the next sweep.
    expect(summary.replayFailed).toBe(3);
    const entries = queue.list();
    expect(entries).toHaveLength(5);
    expect(entries.filter((e) => e.retryCount > 0)).toHaveLength(3);
    expect(entries.filter((e) => e.retryCount === 0)).toHaveLength(2);
  });

  it("sweeps multiple registered queues independently", async () => {
    const healthy = makeQueue("multi-healthy");
    healthy.setReplayHandler(async () => {});
    healthy.add({ n: 1 }, "boom", "test");

    const broken = makeQueue("multi-broken");
    broken.setReplayHandler(async () => {
      throw new Error("nope");
    });
    broken.add({ n: 2 }, "boom", "test");

    const summary = await processDlqReplay();

    expect(summary.queuesScanned).toBe(2);
    expect(summary.replaySucceeded).toBe(1);
    expect(summary.replayFailed).toBe(1);
    expect(healthy.list()).toHaveLength(0);
    expect(broken.list()).toHaveLength(1);
  });
});
