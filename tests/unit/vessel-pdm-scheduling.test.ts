/**
 * Vessel PdM scoring cadence — the reboot-tolerant "is a daily pass due?"
 * decision behind the onboard scheduler (server/vessel-scheduler.ts).
 *
 * A vessel may reboot several times a day, so the producer must NOT key off a
 * naive 24h setInterval (which resets every boot). Instead it wakes hourly and
 * runs only when the newest pdm_score_logs row is older than the daily
 * threshold — the pure logic asserted here. Importing vessel-scheduler is
 * side-effect free (no interval is armed until setupVesselSchedules runs).
 */

import { describe, it, expect } from "@jest/globals";
import { isPdmScoringDue } from "../../server/vessel-scheduler";

const DUE = 20 * 60 * 60 * 1000; // 20h threshold (matches the module default)
const NOW = Date.UTC(2026, 5, 14, 12, 0, 0);
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60 * 1000);

describe("isPdmScoringDue — onboard daily cadence", () => {
  it("is due when nothing has ever been scored", () => {
    expect(isPdmScoringDue(null, NOW, DUE)).toBe(true);
  });

  it("is not due immediately after a score (e.g. a fresh reboot)", () => {
    expect(isPdmScoringDue(hoursAgo(0), NOW, DUE)).toBe(false);
    expect(isPdmScoringDue(hoursAgo(1), NOW, DUE)).toBe(false);
  });

  it("is not due just before the threshold", () => {
    expect(isPdmScoringDue(hoursAgo(19), NOW, DUE)).toBe(false);
  });

  it("is due exactly at the threshold (>=)", () => {
    expect(isPdmScoringDue(new Date(NOW - DUE), NOW, DUE)).toBe(true);
  });

  it("is due once a full day-ish has elapsed", () => {
    expect(isPdmScoringDue(hoursAgo(21), NOW, DUE)).toBe(true);
    expect(isPdmScoringDue(hoursAgo(48), NOW, DUE)).toBe(true);
  });

  it("defaults to the module threshold and current clock when omitted", () => {
    // ~2 days old against the real clock: unambiguously due regardless of jitter.
    expect(isPdmScoringDue(new Date(Date.now() - 48 * 60 * 60 * 1000))).toBe(true);
    // Just now: never due.
    expect(isPdmScoringDue(new Date())).toBe(false);
  });
});
