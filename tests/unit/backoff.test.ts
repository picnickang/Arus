import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { computeBackoffDelay } from "@/lib/backoff";

describe("computeBackoffDelay (full jitter)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const stubRandom = (value: number) => jest.spyOn(Math, "random").mockReturnValue(value);

  it("returns 0 when the jitter roll is 0, regardless of attempt", () => {
    stubRandom(0);
    expect(computeBackoffDelay(0)).toBe(0);
    expect(computeBackoffDelay(5)).toBe(0);
  });

  it("returns the full pre-jitter ceiling when the jitter roll is 1", () => {
    stubRandom(1);
    // base 4000, attempt 0 -> 4000 * 2^0
    expect(computeBackoffDelay(0)).toBe(4_000);
    // base 4000, attempt 2 -> 4000 * 2^2
    expect(computeBackoffDelay(2)).toBe(16_000);
  });

  it("scales the jitter roll across the ceiling", () => {
    stubRandom(0.5);
    expect(computeBackoffDelay(1)).toBe(4_000); // 0.5 * (4000 * 2^1)
  });

  it("uses a larger base for timeout errors", () => {
    stubRandom(1);
    expect(computeBackoffDelay(0, { errorType: "timeout" })).toBe(8_000);
  });

  it("caps the pre-jitter delay at capMs", () => {
    stubRandom(1);
    // attempt 10 would be 4000 * 1024; capped to default 60000
    expect(computeBackoffDelay(10)).toBe(60_000);
    expect(computeBackoffDelay(10, { capMs: 10_000 })).toBe(10_000);
  });

  it("honors custom base", () => {
    stubRandom(1);
    expect(computeBackoffDelay(1, { baseMs: 1_000 })).toBe(2_000);
  });

  it("clamps negative and fractional attempts to a sane floor", () => {
    stubRandom(1);
    expect(computeBackoffDelay(-3)).toBe(4_000); // treated as attempt 0
    expect(computeBackoffDelay(1.9)).toBe(8_000); // floored to attempt 1
  });
});
