/**
 * withSingleFlight — overlap guard for periodic async work (audit B3).
 * Pins that an overlapping tick is skipped while a prior run is in flight,
 * that the in-flight flag clears after success AND after a throw (so the
 * wrapper never wedges), and that onSkip fires on the skipped call.
 */
import { describe, it, expect, jest } from "@jest/globals";
import { withSingleFlight } from "../../server/lib/single-flight";

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("withSingleFlight", () => {
  it("skips an overlapping invocation while the prior run is in flight", async () => {
    const gate = deferred();
    const fn = jest.fn(() => gate.promise);
    const onSkip = jest.fn();
    const tick = withSingleFlight(fn, onSkip);

    const first = tick(); // enters fn, hangs on the gate
    await tick(); // overlaps → skipped immediately

    expect(fn).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);

    gate.resolve();
    await first;

    // Once settled, a later tick runs again.
    await tick();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("clears the in-flight flag after the wrapped fn throws", async () => {
    let attempt = 0;
    const fn = jest.fn(async () => {
      attempt++;
      if (attempt === 1) {
        throw new Error("boom");
      }
    });
    const tick = withSingleFlight(fn);

    await expect(tick()).rejects.toThrow("boom");
    // Not wedged: the next tick proceeds.
    await expect(tick()).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
