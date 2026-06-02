/**
 * §D — Crew access readiness (live dev server).
 *
 * Access readiness reflects the ACTUAL state of each crew member's login
 * account (does a login exist, is it enabled). This pins that a crew member
 * WITH an enabled account reports loginEnabled=true, while one with NO
 * linked login reports loginEnabled=false — readiness is not inferred from
 * the crew row alone.
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  makeRunId,
  cleanupCrewSuite,
  createCrew,
  createCrewWithAccount,
  listAccessReadiness,
  type AccessReadiness,
} from "./helpers";

const RUN_ID = makeRunId("readiness");

let withAccountId = "";
let withoutAccountId = "";

beforeAll(async () => {
  const withAcc = await createCrewWithAccount(RUN_ID, { loginEnabled: true });
  withAccountId = withAcc.crew.id;

  const noAcc = await createCrew(RUN_ID);
  withoutAccountId = noAcc.id;
}, 60000);

afterAll(async () => {
  await cleanupCrewSuite(RUN_ID);
});

function find(list: AccessReadiness[], id: string): AccessReadiness | undefined {
  return list.find((r) => r.crewId === id);
}

describe("Crew access readiness (§D)", () => {
  it("returns a well-formed readiness row per crew member", async () => {
    const res = await listAccessReadiness();
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    const row = find(res.data, withAccountId);
    expect(row).toBeDefined();
    expect(typeof row!.status).toBe("string");
    expect(row!.status.length).toBeGreaterThan(0);
    expect(Array.isArray(row!.reasons)).toBe(true);
  });

  it("reports loginEnabled=true for a member with an enabled account", async () => {
    const res = await listAccessReadiness();
    const row = find(res.data, withAccountId);
    expect(row).toBeDefined();
    expect(row!.loginEnabled).toBe(true);
  });

  it("reports loginEnabled=false for a member with no linked login", async () => {
    const res = await listAccessReadiness();
    const row = find(res.data, withoutAccountId);
    expect(row).toBeDefined();
    expect(row!.loginEnabled).toBe(false);
  });
});
