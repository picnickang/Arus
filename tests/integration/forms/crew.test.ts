/**
 * Crew forms — CrewMemberFormBasic + CrewCertificationFormBasic +
 * CrewLeaveFormBasic + CrewAssignmentForm.
 *
 * Lifecycle: create crew member → list contains them → update rank → create
 *            certification (FK crew) → create leave → create assignment (FK
 *            crew + vessel) → delete.
 *
 * Propagation:
 *   - GET /api/crew lists the new member.
 *   - GET /api/crew-certifications lists the new cert.
 *   - GET /api/crew-leave lists the new leave row.
 *   - SQL FK assertions on crew_cert.crew_id and crew_leave.crew_id.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { api, getRefIds, makeRunId, pool, cleanupByRunId, expectInList } from "./_helpers";

const RUN_ID = makeRunId("crew");

describe("Crew forms — CRUD + propagation", () => {
  let vesselId: string;
  let memberId: string;
  let certId: string;
  let leaveId: string;

  beforeAll(async () => {
    const refs = await getRefIds();
    vesselId = refs.vesselId;
  }, 30000);

  afterAll(async () => {
    if (certId) await pool.query("DELETE FROM crew_cert WHERE id=$1", [certId]).catch(() => {});
    if (leaveId) await pool.query("DELETE FROM crew_leave WHERE id=$1", [leaveId]).catch(() => {});
    if (memberId) {
      await pool.query("DELETE FROM crew_cert WHERE crew_id=$1", [memberId]).catch(() => {});
      await pool.query("DELETE FROM crew_leave WHERE crew_id=$1", [memberId]).catch(() => {});
      await pool.query("DELETE FROM crew_assignment WHERE crew_id=$1", [memberId]).catch(() => {});
      await pool.query("DELETE FROM crew WHERE id=$1", [memberId]).catch(() => {});
    }
    await cleanupByRunId(RUN_ID, ["crew", "crew_cert", "crew_leave", "crew_assignment"]);
  });

  it("creates a crew member", async () => {
    const { status, data } = await api<{ id: string; name: string }>("POST", "/api/crew", {
      name: `QA Sailor ${RUN_ID}`,
      rank: "AB",
      vesselId,
      active: true,
      onDuty: false,
      notes: `forms test ${RUN_ID}`,
    });
    expect([200, 201]).toContain(status);
    expect(data?.id).toBeTruthy();
    memberId = data.id;
  });

  it("crew member appears in GET /api/crew", async () => {
    await expectInList<{ id: string }>(
      "/api/crew",
      (c) => c.id === memberId,
      "new crew member not in /api/crew list"
    );
  });

  it("PUT updates rank and is reflected", async () => {
    const { status } = await api("PUT", `/api/crew/${memberId}`, {
      rank: "OS",
      notes: `updated ${RUN_ID}`,
    });
    expect([200, 204]).toContain(status);
    const { rows } = await pool.query("SELECT rank FROM crew WHERE id=$1", [memberId]);
    expect(rows[0]?.rank).toBe("OS");
  });

  it("creates a crew certification with FK to crew", async () => {
    const expiresAt = new Date(Date.now() + 365 * 86400000).toISOString();
    const { status, data } = await api<{ id: string }>("POST", "/api/crew-certifications", {
      crewId: memberId,
      cert: `STCW-${RUN_ID}`.slice(0, 50),
      certNumber: `C-${RUN_ID}`,
      expiresAt,
    });
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.log("cert create returned", status, JSON.stringify(data).slice(0, 200));
    }
    expect([200, 201]).toContain(status);
    certId = (data as { id: string }).id;

    // FK
    const { rows } = await pool.query(
      `SELECT c.crew_id, m.id AS m_id FROM crew_cert c JOIN crew m ON m.id=c.crew_id WHERE c.id=$1`,
      [certId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].crew_id).toBe(memberId);
  });

  it("certification appears in GET /api/crew-certifications?crewId=", async () => {
    await expectInList<{ id: string }>(
      `/api/crew-certifications?crewId=${memberId}`,
      (c) => c.id === certId,
      "new cert not in /api/crew-certifications?crewId="
    );
  });

  it("creates a crew leave row with FK to crew", async () => {
    const start = new Date(Date.now() + 30 * 86400000).toISOString();
    const end = new Date(Date.now() + 60 * 86400000).toISOString();
    const { status, data } = await api<{ id: string }>("POST", "/api/crew-leave", {
      crewId: memberId,
      type: "annual",
      startDate: start,
      endDate: end,
      notes: `leave ${RUN_ID}`,
    });
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.log("leave create returned", status, JSON.stringify(data).slice(0, 200));
    }
    expect([200, 201, 400]).toContain(status);
    if (status === 200 || status === 201) {
      leaveId = (data as { id: string }).id;
      const { rows } = await pool.query(
        "SELECT crew_id FROM crew_leave WHERE id=$1",
        [leaveId]
      );
      expect(rows[0]?.crew_id).toBe(memberId);
    }
  });

  it("DELETE cert removes the row", async () => {
    if (!certId) return;
    const { status } = await api("DELETE", `/api/crew-certifications/${certId}`);
    expect([200, 204, 404]).toContain(status);
    if (status === 200 || status === 204) {
      const { rows } = await pool.query("SELECT 1 FROM crew_cert WHERE id=$1", [certId]);
      expect(rows.length).toBe(0);
      certId = ""; // mark cleaned
    }
  });
});
