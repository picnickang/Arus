/**
 * CircuitBreaker — Unit Tests
 *
 * Covers:
 *  - Stale-state hardening on the failure path (fallback fires on the
 *    very call that crosses the failure threshold).
 *  - HALF_OPEN success-path concurrency: re-reads liveState so concurrent
 *    transitions are observed.
 *  - onStateChange metric only fires on actual state transitions, not on
 *    every partial update (regression test for the prior typo).
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { CircuitBreaker, circuitBreakers } from "../../server/error-handling/circuit-breaker.js";
import { ERROR_HANDLING_CONFIG } from "../../server/error-handling/types.js";

const FAILURE_THRESHOLD = ERROR_HANDLING_CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD;
const SUCCESS_THRESHOLD = ERROR_HANDLING_CONFIG.CIRCUIT_BREAKER.SUCCESS_THRESHOLD;

function freshBreaker(): CircuitBreaker {
  circuitBreakers.clear();
  return new CircuitBreaker();
}

describe("CircuitBreaker", () => {
  beforeEach(() => {
    circuitBreakers.clear();
  });

  describe("failure-path stale-state fix", () => {
    it("invokes the fallback on the very call that crosses FAILURE_THRESHOLD", async () => {
      const cb = freshBreaker();
      const fallback = jest.fn(async () => "fallback-value");
      const op = jest.fn(async () => {
        throw new Error("boom");
      });

      // Drive failures up to (but not crossing) the threshold without a
      // fallback so we can isolate the threshold-crossing call.
      for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) {
        await expect(cb.execute("svc-a", op)).rejects.toThrow("boom");
      }
      expect(circuitBreakers.get("svc-a")?.state).toBe("CLOSED");

      // Threshold-crossing call: should transition to OPEN and invoke
      // fallback on this same call (the bug being guarded against).
      const result = await cb.execute("svc-a", op, fallback);
      expect(result).toBe("fallback-value");
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(circuitBreakers.get("svc-a")?.state).toBe("OPEN");
    });

    it("re-throws when no fallback is supplied even on the threshold-crossing call", async () => {
      const cb = freshBreaker();
      const op = jest.fn(async () => {
        throw new Error("boom");
      });
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await expect(cb.execute("svc-b", op)).rejects.toThrow("boom");
      }
      expect(circuitBreakers.get("svc-b")?.state).toBe("OPEN");
    });
  });

  describe("HALF_OPEN success-path re-read", () => {
    it("CLOSES after SUCCESS_THRESHOLD consecutive HALF_OPEN successes", async () => {
      const cb = freshBreaker();

      // Manually seed HALF_OPEN with successCount = 0 to avoid waiting
      // out the OPEN timeout.
      circuitBreakers.set("svc-c", {
        failures: FAILURE_THRESHOLD,
        lastFailureTime: 0,
        state: "HALF_OPEN",
        successCount: 0,
      });

      for (let i = 0; i < SUCCESS_THRESHOLD; i++) {
        await cb.execute("svc-c", async () => "ok");
      }
      const state = circuitBreakers.get("svc-c")!;
      expect(state.state).toBe("CLOSED");
      expect(state.failures).toBe(0);
      expect(state.successCount).toBe(0);
    });

    it("observes a concurrent transition out of HALF_OPEN by re-reading liveState", async () => {
      const cb = freshBreaker();
      circuitBreakers.set("svc-d", {
        failures: FAILURE_THRESHOLD,
        lastFailureTime: 0,
        state: "HALF_OPEN",
        successCount: 0,
      });

      // Operation succeeds, but mid-flight a "concurrent" call mutates
      // shared state to CLOSED. The success-path re-read should pick
      // that up and skip the HALF_OPEN bookkeeping branch — it must NOT
      // increment successCount on a CLOSED breaker.
      await cb.execute("svc-d", async () => {
        circuitBreakers.set("svc-d", {
          failures: 0,
          lastFailureTime: 0,
          state: "CLOSED",
          successCount: 0,
        });
        return "ok";
      });

      const state = circuitBreakers.get("svc-d")!;
      expect(state.state).toBe("CLOSED");
      // The CLOSED branch resets failures to 0 — confirms we took it.
      expect(state.failures).toBe(0);
      expect(state.successCount).toBe(0);
    });
  });

  describe("onStateChange metric emission", () => {
    it("does NOT fire onStateChange for partial updates that don't change state", async () => {
      const cb = freshBreaker();
      const onStateChange = jest.fn();
      cb.setMetricsCallbacks({ onStateChange });

      // A handful of pure-success calls only update `failures: 0` — they
      // must not emit a state-change event.
      for (let i = 0; i < 4; i++) {
        await cb.execute("svc-e", async () => "ok");
      }
      expect(onStateChange).not.toHaveBeenCalled();
    });

    it("fires onStateChange exactly once per real transition (CLOSED → OPEN)", async () => {
      const cb = freshBreaker();
      const onStateChange = jest.fn();
      cb.setMetricsCallbacks({ onStateChange });

      const op = async () => {
        throw new Error("boom");
      };
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await expect(cb.execute("svc-f", op)).rejects.toThrow();
      }

      const openCalls = onStateChange.mock.calls.filter(
        (c: unknown[]) => c[0] === "svc-f" && c[1] === 1
      );
      expect(openCalls).toHaveLength(1);
    });

    it("fires onStateChange when HALF_OPEN closes after enough successes", async () => {
      const cb = freshBreaker();
      const onStateChange = jest.fn();
      cb.setMetricsCallbacks({ onStateChange });

      circuitBreakers.set("svc-g", {
        failures: FAILURE_THRESHOLD,
        lastFailureTime: 0,
        state: "HALF_OPEN",
        successCount: 0,
      });

      for (let i = 0; i < SUCCESS_THRESHOLD; i++) {
        await cb.execute("svc-g", async () => "ok");
      }
      const closedCalls = onStateChange.mock.calls.filter(
        (c: unknown[]) => c[0] === "svc-g" && c[1] === 0
      );
      expect(closedCalls).toHaveLength(1);
    });
  });
});
