/**
 * Route contract checker — matcher semantics.
 *
 * The checker's value rests on findUnmatched: it must catch a client
 * path with no server route (the /api/pdm/health bug class) without
 * false-positives on param segments or interpolations.
 */

import { describe, it, expect } from "@jest/globals";
import { findUnmatched } from "../../scripts/check-route-contract.mjs";

const server = new Set([
  "/api/pdm/health/:equipmentId",
  "/api/telemetry/baseline/:equipmentId",
  "/api/telemetry/history/:equipmentId/:sensorType",
  "/api/vessels/:id/power-stw-analysis",
  "/api/equipment",
]);

function client(paths: string[]): Map<string, string> {
  return new Map(paths.map((p) => [p, "test-fixture.tsx"]));
}

describe("findUnmatched", () => {
  it("matches interpolated client paths against param routes", () => {
    const unmatched = findUnmatched(
      client([
        "/api/pdm/health/*", // `/api/pdm/health/${id}`
        "/api/telemetry/history/*/*",
        "/api/vessels/*/power-stw-analysis",
        "/api/equipment",
      ]),
      server
    );
    expect(unmatched).toEqual([]);
  });

  it("catches a client path with no server route (the pdm/health bug class)", () => {
    const unmatched = findUnmatched(client(["/api/pdm/health-summary/*"]), server);
    expect(unmatched.map((u) => u.path)).toEqual(["/api/pdm/health-summary/*"]);
  });

  it("does not let prefix overlap mask a missing deeper route", () => {
    // /api/equipment exists, but /api/equipment/:id/sensors/health does not —
    // segment-count matching must not treat the short route as covering it.
    const unmatched = findUnmatched(client(["/api/equipment/*/sensors/health"]), server);
    expect(unmatched).toHaveLength(1);
  });

  it("strips query strings before matching", () => {
    const unmatched = findUnmatched(client(["/api/telemetry/baseline/*?days=30"]), server);
    expect(unmatched).toEqual([]);
  });
});
