/**
 * retryUnlessClientError: React Query retry predicate that never retries a 4xx
 * (auth/not-found/validation are terminal) but still retries transient failures
 * up to the configured cap. Guards the regression where the pre-auth
 * `/api/permissions/me` probe retried its 401 several times, firing redundant
 * failing requests on every fresh load.
 */

import { describe, it, expect } from "@jest/globals";
import { ApiError } from "../../client/src/lib/api-error";
import { retryUnlessClientError } from "../../client/src/lib/query-retry";

const apiError = (status: number) => new ApiError({ status, detail: "x" });

describe("retryUnlessClientError", () => {
  it("never retries client errors (4xx)", () => {
    const retry = retryUnlessClientError(3);
    for (const status of [400, 401, 403, 404, 422, 429, 499]) {
      expect(retry(1, apiError(status))).toBe(false);
    }
  });

  it("retries transient ApiErrors (5xx) up to the cap", () => {
    const retry = retryUnlessClientError(1);
    expect(retry(1, apiError(500))).toBe(true); // first retry allowed
    expect(retry(2, apiError(503))).toBe(false); // cap reached
  });

  it("retries non-ApiError throws (network/timeout) up to the cap", () => {
    const retry = retryUnlessClientError(3);
    const networkErr = new TypeError("Failed to fetch");
    expect(retry(1, networkErr)).toBe(true);
    expect(retry(3, networkErr)).toBe(true);
    expect(retry(4, networkErr)).toBe(false);
  });

  it("a 401 burns zero retries (single request, not a storm)", () => {
    const retry = retryUnlessClientError(3);
    // On the very first failure the predicate already refuses to retry, so the
    // unauthenticated probe fires exactly once.
    expect(retry(1, apiError(401))).toBe(false);
  });
});
