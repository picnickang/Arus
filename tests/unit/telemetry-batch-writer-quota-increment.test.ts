/**
 * P0 #4 — Unit test for the quota-increment timeout wrapper.
 *
 * The full `TelemetryBatchWriter.writeBatch()` path can't be unit-tested
 * here because importing the writer transitively initializes drizzle-pg
 * at module load (same infra limitation that affects
 * `tests/unit/ml-retrain-promotion-gate.test.ts`). Instead we test the
 * isolated `withQuotaTimeout` helper that wraps every
 * `quotaService.incrementUsage(...)` call.
 *
 * The integration-level proof — that a quota failure does not block
 * ingest and that the failure counter increments — is covered by
 * `tests/integration/tenant-quota-throttle.test.ts` style suites that
 * spin a real Postgres. Here we pin the wrapper's two essential
 * guarantees:
 *   1. resolves a fast-resolving promise unchanged
 *   2. rejects with a `quota_increment_timeout_*` message when the
 *      underlying promise never settles within the budget
 *
 * Guarantee (2) is the trigger for the `reason="timeout"` label on
 * `arus_telemetry_quota_increment_failed_total` in the writer.
 */

import { describe, expect, it } from "@jest/globals";

// Path-import the helper directly so we don't load the writer's
// drizzle-pulling module graph at jest init time.
import { withQuotaTimeout } from "../../server/telemetry-batch-writer-quota-timeout";

describe("withQuotaTimeout — P0 #4", () => {
  it("resolves with the wrapped value when the inner promise resolves quickly", async () => {
    await expect(withQuotaTimeout(Promise.resolve(42))).resolves.toBe(42);
  });

  it("propagates the inner rejection unchanged", async () => {
    await expect(
      withQuotaTimeout(Promise.reject(new Error("quota store down"))),
    ).rejects.toThrow("quota store down");
  });

  it("rejects with a tagged timeout error when the inner promise never settles", async () => {
    const never = new Promise(() => {});
    const start = Date.now();
    await expect(withQuotaTimeout(never)).rejects.toThrow(
      /quota_increment_timeout_\d+ms/,
    );
    const elapsed = Date.now() - start;
    // Bounded by 2s budget. Use a generous ceiling for CI noise.
    expect(elapsed).toBeLessThan(4_000);
    expect(elapsed).toBeGreaterThanOrEqual(1_800);
  }, 10_000);
});
