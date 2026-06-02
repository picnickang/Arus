/**
 * §B / §C — Crew CRUD + active roster (live dev server).
 *
 * Runs as the fixed dev admin, so this exercises real persistence end to
 * end: create → read → update → toggle-duty → delete, plus roster
 * membership and input validation. Every row carries RUN_ID for cleanup.
 */
import { describe, it, expect, afterAll } from "@jest/globals";
import {
  api,
  makeRunId,
  cleanupCrewSuite,
  createCrew,
  listCrew,
  getCrew,
  updateCrew,
  deleteCrew,
  toggleDuty,
} from "./helpers";

const RUN_ID = makeRunId("crew-crud");

afterAll(async () => {
  await cleanupCrewSuite(RUN_ID);
});

describe("Crew CRUD + roster (§B/§C)", () => {
  it("creates a crew member that is active and off duty by default", async () => {
    const crew = await createCrew(RUN_ID, { rank: "second_engineer" });
    expect(crew.id).toBeTruthy();
    expect(crew.active).toBe(true);
    expect(crew.onDuty).toBe(false);
    expect(crew.terminationType).toBeNull();
  });

  it("reads, updates, toggles duty, and deletes a crew member", async () => {
    const crew = await createCrew(RUN_ID);

    const fetched = await getCrew(crew.id);
    expect(fetched.ok).toBe(true);
    expect(fetched.data.name).toBe(crew.name);

    const updated = await updateCrew(crew.id, { rank: "chief_engineer" });
    expect(updated.ok).toBe(true);
    expect(updated.data.rank).toBe("chief_engineer");

    const duty = await toggleDuty(crew.id);
    expect(duty.ok).toBe(true);
    expect(duty.data.crew.onDuty).toBe(true);

    const dutyBack = await toggleDuty(crew.id);
    expect(dutyBack.data.crew.onDuty).toBe(false);

    const del = await deleteCrew(crew.id);
    expect(del.status).toBe(204);

    const after = await getCrew(crew.id);
    expect(after.status).toBe(404);
  });

  it("lists a newly created member in the active roster", async () => {
    const crew = await createCrew(RUN_ID);
    const roster = await listCrew();
    expect(roster.ok).toBe(true);
    expect(roster.data.some((c) => c.id === crew.id)).toBe(true);
  });

  it("rejects a crew payload missing the required name with a 4xx", async () => {
    const res = await api("POST", "/api/crew", { rank: "engineer" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
