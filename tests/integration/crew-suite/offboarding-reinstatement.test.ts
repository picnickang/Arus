/**
 * §G — Offboarding (retire / cancel) + reinstatement (live dev server).
 *
 * Note on the active/former split: GET /api/crew returns ALL crew rows
 * (including former ones, with active=false + terminationType set). The
 * roster UI derives "active" vs "former" client-side from the `active`
 * flag / terminationType, and GET /api/crew/former is the authoritative
 * former list. These tests therefore assert the DATA-LEVEL transitions
 * (active flag, terminationType) and former-list membership rather than
 * API-level roster exclusion.
 */
import { describe, it, expect, afterAll } from "@jest/globals";
import {
  makeRunId,
  cleanupCrewSuite,
  createCrew,
  getCrew,
  retireCrew,
  cancelCrew,
  reinstateCrew,
  listFormerCrew,
} from "./helpers";

const RUN_ID = makeRunId("offboard");

afterAll(async () => {
  await cleanupCrewSuite(RUN_ID);
});

function inFormer(list: Array<Record<string, unknown>>, id: string): boolean {
  return list.some((c) => c.id === id || c.crewId === id);
}

describe("Offboarding + reinstatement (§G)", () => {
  it("retire marks the member terminated and lists them as former", async () => {
    const crew = await createCrew(RUN_ID);

    const retired = await retireCrew(crew.id, { notes: "end of contract" });
    expect(retired.ok).toBe(true);

    const after = await getCrew(crew.id);
    expect(after.ok).toBe(true);
    expect(after.data.terminationType).toBe("retired");
    expect(after.data.active).toBe(false);

    const former = await listFormerCrew();
    expect(former.ok).toBe(true);
    expect(inFormer(former.data, crew.id)).toBe(true);
  });

  it("cancel marks the member with a cancelled termination type", async () => {
    const crew = await createCrew(RUN_ID);

    const cancelled = await cancelCrew(crew.id, { notes: "contract cancelled" });
    expect(cancelled.ok).toBe(true);

    const after = await getCrew(crew.id);
    expect(after.data.terminationType).toBe("cancelled");
    expect(after.data.active).toBe(false);

    const former = await listFormerCrew();
    expect(inFormer(former.data, crew.id)).toBe(true);
  });

  it("reinstate restores a former member to active and clears termination", async () => {
    const crew = await createCrew(RUN_ID);
    await retireCrew(crew.id, {});

    const reinstated = await reinstateCrew(crew.id, { notes: "rehired" });
    expect(reinstated.ok).toBe(true);

    const after = await getCrew(crew.id);
    expect(after.data.active).toBe(true);
    expect(after.data.terminationType).toBeNull();

    const former = await listFormerCrew();
    expect(inFormer(former.data, crew.id)).toBe(false);
  });
});
