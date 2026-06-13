import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { createCircuitBreaker } from "@/lib/circuit-breaker";

// Client-side fetch breaker (client/src/lib/circuit-breaker.ts). Distinct from
// the server-side server/error-handling/circuit-breaker.ts.
describe("createCircuitBreaker (client fetch breaker)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const atTime = (ms: number) => jest.spyOn(Date, "now").mockReturnValue(ms);

  it("starts closed and allows requests", () => {
    const cb = createCircuitBreaker();
    expect(cb.getState()).toBe("closed");
    expect(cb.canRequest()).toBe(true);
  });

  it("stays closed below the failure threshold", () => {
    const cb = createCircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("closed");
    expect(cb.canRequest()).toBe(true);
  });

  it("opens once the failure threshold is reached and fails fast", () => {
    atTime(1_000);
    const cb = createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 30_000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("open");
    expect(cb.canRequest()).toBe(false);
  });

  it("drifts to halfOpen after the reset timeout elapses", () => {
    const clock = atTime(1_000);
    const cb = createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 30_000 });
    cb.recordFailure();
    expect(cb.canRequest()).toBe(false);

    clock.mockReturnValue(1_000 + 30_000);
    expect(cb.getState()).toBe("halfOpen");
    expect(cb.canRequest()).toBe(true); // single probe allowed through
  });

  it("closes when the halfOpen probe succeeds", () => {
    const clock = atTime(0);
    const cb = createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 10 });
    cb.recordFailure();
    clock.mockReturnValue(10);
    expect(cb.getState()).toBe("halfOpen");
    cb.recordSuccess();
    expect(cb.getState()).toBe("closed");
    expect(cb.canRequest()).toBe(true);
  });

  it("re-opens (with a fresh cooldown) when the halfOpen probe fails", () => {
    const clock = atTime(0);
    const cb = createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 10 });
    cb.recordFailure(); // open at t=0
    clock.mockReturnValue(10); // -> halfOpen
    expect(cb.getState()).toBe("halfOpen");

    cb.recordFailure(); // probe fails -> open again at t=10
    expect(cb.getState()).toBe("open");
    expect(cb.canRequest()).toBe(false);

    clock.mockReturnValue(15); // only 5ms since re-open, still open
    expect(cb.canRequest()).toBe(false);
    clock.mockReturnValue(20); // full window since re-open
    expect(cb.getState()).toBe("halfOpen");
  });

  it("resets the failure count on success while closed", () => {
    const cb = createCircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("closed"); // count restarted, never hit 3
  });

  it("reset() returns a tripped breaker to closed", () => {
    atTime(0);
    const cb = createCircuitBreaker({ failureThreshold: 1 });
    cb.recordFailure();
    expect(cb.getState()).toBe("open");
    cb.reset();
    expect(cb.getState()).toBe("closed");
    expect(cb.canRequest()).toBe(true);
  });
});
