import { describe, it, expect } from "@jest/globals";
import * as fc from "fast-check";
import {
  computeBufferDays,
  computeSchedulingWindow,
} from "../../pdm/application/get-schedule.use-case";
import type { TelemetryFreshness } from "../../pdm/application/get-schedule.use-case";

describe("PdM Schedule Property-Based Tests (Tier 1)", () => {
  describe("computeBufferDays properties", () => {
    it("buffer should never exceed 5 days (MAX_BUFFER_DAYS)", () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
          fc.constantFrom<TelemetryFreshness>("online", "delayed", "offline"),
          fc.constantFrom<"critical" | "high" | "medium" | "low">(
            "critical",
            "high",
            "medium",
            "low"
          ),
          (confidence, telemetryFreshness, severity) => {
            const buffer = computeBufferDays({ confidence, telemetryFreshness, severity });
            expect(buffer).toBeLessThanOrEqual(5);
            expect(buffer).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("lower confidence should never decrease buffer", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 49 }),
          fc.constantFrom<TelemetryFreshness>("online", "delayed", "offline"),
          fc.constantFrom<"critical" | "high" | "medium" | "low">(
            "critical",
            "high",
            "medium",
            "low"
          ),
          (highConf, lowConfOffset, telemetryFreshness, severity) => {
            const lowConf = Math.max(0, highConf - lowConfOffset - 1);
            if (lowConf >= highConf) {
              return;
            }

            const highBuffer = computeBufferDays({
              confidence: highConf,
              telemetryFreshness,
              severity,
            });
            const lowBuffer = computeBufferDays({
              confidence: lowConf,
              telemetryFreshness,
              severity,
            });

            expect(lowBuffer).toBeGreaterThanOrEqual(highBuffer);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("null confidence should add buffer compared to high confidence", () => {
      fc.assert(
        fc.property(
          fc.constantFrom<TelemetryFreshness>("online", "delayed", "offline"),
          fc.constantFrom<"critical" | "high" | "medium" | "low">(
            "critical",
            "high",
            "medium",
            "low"
          ),
          (telemetryFreshness, severity) => {
            const withConf = computeBufferDays({ confidence: 90, telemetryFreshness, severity });
            const withoutConf = computeBufferDays({
              confidence: null,
              telemetryFreshness,
              severity,
            });

            expect(withoutConf).toBeGreaterThanOrEqual(withConf);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("offline/delayed telemetry should add buffer compared to online", () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 50, max: 100 }), { nil: null }),
          fc.constantFrom<"critical" | "high" | "medium" | "low">(
            "critical",
            "high",
            "medium",
            "low"
          ),
          (confidence, severity) => {
            const online = computeBufferDays({
              confidence,
              telemetryFreshness: "online",
              severity,
            });
            const delayed = computeBufferDays({
              confidence,
              telemetryFreshness: "delayed",
              severity,
            });
            const offline = computeBufferDays({
              confidence,
              telemetryFreshness: "offline",
              severity,
            });

            expect(delayed).toBeGreaterThanOrEqual(online);
            expect(offline).toBeGreaterThanOrEqual(online);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("critical severity should add buffer compared to non-critical", () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 50, max: 100 }), { nil: null }),
          fc.constantFrom<TelemetryFreshness>("online", "delayed", "offline"),
          fc.constantFrom<"high" | "medium" | "low">("high", "medium", "low"),
          (confidence, telemetryFreshness, nonCriticalSeverity) => {
            const critical = computeBufferDays({
              confidence,
              telemetryFreshness,
              severity: "critical",
            });
            const nonCritical = computeBufferDays({
              confidence,
              telemetryFreshness,
              severity: nonCriticalSeverity,
            });

            expect(critical).toBeGreaterThanOrEqual(nonCritical);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("computeSchedulingWindow properties", () => {
    it("earliestStart <= preferredDate <= latestFinish when not blocked", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 30 }),
          fc.integer({ min: 10, max: 60 }),
          fc.integer({ min: 15, max: 90 }),
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 1, max: 5 }),
          (p10, p50offset, p90offset, prepDays, bufferDays) => {
            const rulP10Days = p10;
            const rulP50Days = p10 + p50offset;
            const rulP90Days = p10 + p50offset + p90offset;
            const today = new Date();

            const result = computeSchedulingWindow({
              rulP10Days,
              rulP50Days,
              rulP90Days,
              prepDays,
              bufferDays,
              today,
            });

            if (!result.isBlockedByLeadTime) {
              expect(result.earliestStart.getTime()).toBeLessThanOrEqual(
                result.preferredDate.getTime()
              );
              expect(result.preferredDate.getTime()).toBeLessThanOrEqual(
                result.latestFinish.getTime()
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("increasing prepDays should never decrease earliestStart", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }),
          fc.integer({ min: 10, max: 30 }),
          fc.integer({ min: 15, max: 45 }),
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 1, max: 5 }),
          (p10, p50, p90, basePrepDays, bufferDays) => {
            const today = new Date();

            const result1 = computeSchedulingWindow({
              rulP10Days: p10,
              rulP50Days: p50,
              rulP90Days: p90,
              prepDays: basePrepDays,
              bufferDays,
              today,
            });

            const result2 = computeSchedulingWindow({
              rulP10Days: p10,
              rulP50Days: p50,
              rulP90Days: p90,
              prepDays: basePrepDays + 2,
              bufferDays,
              today,
            });

            expect(result2.earliestStart.getTime()).toBeGreaterThanOrEqual(
              result1.earliestStart.getTime()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("lead time blocking should trigger when prepDays > P10", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (p10, bufferDays) => {
            const today = new Date();
            const prepDays = p10 + bufferDays + 1;

            const result = computeSchedulingWindow({
              rulP10Days: p10,
              rulP50Days: p10 + 3,
              rulP90Days: p10 + 6,
              prepDays,
              bufferDays,
              today,
            });

            expect(result.isBlockedByLeadTime).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
