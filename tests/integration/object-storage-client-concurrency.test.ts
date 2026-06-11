/**
 * Task #345 — regression pin for the object-storage client cold-start race
 * (Task #341 cause #2).
 *
 * The original init used a synchronous `_clientInitAttempted = true` boolean
 * guard set BEFORE the `await import("@google-cloud/storage")` resolved. A
 * second request arriving during that window saw `attempted === true` and got
 * the still-null `_objectStorageClient` back, failing with "Object storage not
 * available" (HTTP 500) on cold start under concurrent load. The fix memoizes
 * the in-flight init *promise* so every concurrent caller awaits the same
 * initialization.
 *
 * This test forces the Replit code path (so a real client is constructed),
 * makes the GCS import deliberately slow, then fires many concurrent callers
 * during the in-flight window and asserts:
 *   - none receive a null client,
 *   - all receive the SAME client instance,
 *   - the underlying GCS client is constructed exactly once.
 *
 * `server/objectStorage.ts` has no db-config dependency, so this runs
 * hermetically in-sandbox (unlike most integration suites).
 */

import { describe, it, expect, beforeAll, jest } from "@jest/globals";

// Force isReplitEnvironment() === true so the real client-construction branch
// runs. Must be set before the module under test is imported.
process.env["REPL_ID"] = "test-repl-345";

let constructCount = 0;

// Deliberately-slow mock of @google-cloud/storage: the async factory delays the
// dynamic import resolution, widening the in-flight init window so concurrent
// callers provably overlap it. Under the old boolean guard, callers in this
// window would receive a null client.
jest.unstable_mockModule("@google-cloud/storage", async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  class Storage {
    readonly __mock = "storage";
    constructor() {
      constructCount += 1;
    }
    bucket() {
      return {};
    }
  }
  return { __esModule: true, Storage };
});

let getObjectStorageClient: () => Promise<unknown>;

beforeAll(async () => {
  const mod = await import("../../server/objectStorage");
  getObjectStorageClient = mod.getObjectStorageClient;
});

describe("Task #345 — object storage client init concurrency", () => {
  it("never hands a null client to concurrent cold-start callers", async () => {
    // Fire many callers in the same tick; under the buggy boolean guard the
    // later callers would resolve to null while the first init is in flight.
    const results = await Promise.all(Array.from({ length: 25 }, () => getObjectStorageClient()));

    for (const client of results) {
      expect(client).not.toBeNull();
      expect(client).toBeDefined();
    }
  });

  it("shares a single memoized client across all callers", async () => {
    const [a, b, c] = await Promise.all([
      getObjectStorageClient(),
      getObjectStorageClient(),
      getObjectStorageClient(),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("constructs the underlying GCS client exactly once", () => {
    // Across the module-load IIFE + every getObjectStorageClient() call above,
    // the promise memoization must keep this to a single construction.
    expect(constructCount).toBe(1);
  });
});
