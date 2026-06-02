/**
 * §E — Former-crew access risks (live dev server).
 *
 * This pins the recent behaviour change: access risk is computed from the
 * ACTUAL state of the linked login account (exists / active / login-enabled),
 * NOT merely inferred from the presence of a crew row or a userId link.
 *
 * Three seeded scenarios, all retired (former) crew:
 *   1. Retained an active, login-enabled account (retired with revocation
 *      flags OFF)            → MUST be flagged as an access risk.
 *   2. Fully offboarded (default retire flags disable the login)
 *                            → MUST NOT be flagged.
 *   3. Never had a login at all
 *                            → MUST NOT be flagged; reason "No linked login.".
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  makeRunId,
  cleanupCrewSuite,
  createCrew,
  createCrewWithAccount,
  retireCrew,
  listFormerAccessRisks,
  type FormerAccessRisk,
} from "./helpers";

const RUN_ID = makeRunId("former-risk");

let liveAccessCrewId = "";
let revokedCrewId = "";
let noLoginCrewId = "";

beforeAll(async () => {
  // 1. Former crew whose login was deliberately NOT revoked on retire.
  const live = await createCrewWithAccount(RUN_ID, { loginEnabled: true });
  liveAccessCrewId = live.crew.id;
  await retireCrew(live.crew.id, {
    disableLogin: false,
    removeVesselAccess: false,
    removeDashboardAccess: false,
    removeAdditionalRoles: false,
    downgradePrimaryRole: false,
  });

  // 2. Former crew fully offboarded (defaults disable login + strip access).
  const revoked = await createCrewWithAccount(RUN_ID, { loginEnabled: true });
  revokedCrewId = revoked.crew.id;
  await retireCrew(revoked.crew.id, {});

  // 3. Former crew that never had a linked login.
  const noLogin = await createCrew(RUN_ID);
  noLoginCrewId = noLogin.id;
  await retireCrew(noLogin.id, {});
}, 60000);

afterAll(async () => {
  await cleanupCrewSuite(RUN_ID);
});

function find(list: FormerAccessRisk[], id: string): FormerAccessRisk | undefined {
  return list.find((r) => r.crewId === id);
}

describe("Former-crew access risks (§E)", () => {
  it("flags a former crew member who retained an active login", async () => {
    const res = await listFormerAccessRisks();
    expect(res.ok).toBe(true);
    const row = find(res.data, liveAccessCrewId);
    expect(row).toBeDefined();
    expect(row!.hasLinkedLogin).toBe(true);
    expect(row!.accountActive).toBe(true);
    expect(row!.loginEnabled).toBe(true);
    expect(row!.hasAccessRisk).toBe(true);
    expect(row!.reasons.length).toBeGreaterThan(0);
  });

  it("does NOT flag a fully offboarded former crew member", async () => {
    const res = await listFormerAccessRisks();
    const row = find(res.data, revokedCrewId);
    expect(row).toBeDefined();
    expect(row!.loginEnabled).toBe(false);
    expect(row!.hasAccessRisk).toBe(false);
  });

  it("does NOT infer access from a crew row that has no linked login", async () => {
    const res = await listFormerAccessRisks();
    const row = find(res.data, noLoginCrewId);
    expect(row).toBeDefined();
    expect(row!.hasLinkedLogin).toBe(false);
    expect(row!.hasAccessRisk).toBe(false);
    expect(row!.reasons).toContain("No linked login.");
  });
});
