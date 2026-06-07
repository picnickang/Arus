/**
 * Journey: crew member → certification → SQL FK + propagation to /api/crew-certifications.
 *
 * This is the "create form chain" that powers the crew-certification-expiry
 * card on the bridge dashboard.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { api, getRefIds, makeRunId, pool, cleanupByRunId, expectInList } from "../forms/_helpers";

const RUN_ID = makeRunId("j-crew-cert");

describe("Journey — Crew member → Cert → Listing", () => {
  let vesselId: string;
  let memberId: string;
  let certId: string;

  beforeAll(async () => {
    const refs = await getRefIds();
    vesselId = refs.vesselId;
  }, 30000);

  afterAll(async () => {
    if (certId) {await pool.query("DELETE FROM crew_cert WHERE id=$1", [certId]).catch(() => {});}
    if (memberId) {
      await pool.query("DELETE FROM crew_cert WHERE crew_id=$1", [memberId]).catch(() => {});
      await pool.query("DELETE FROM crew WHERE id=$1", [memberId]).catch(() => {});
    }
    await cleanupByRunId(RUN_ID, ["crew", "crew_cert"]);
  });

  it("creates a crew member", async () => {
    const r = await api<{ id: string }>("POST", "/api/crew", {
      name: `Journey Sailor ${RUN_ID}`,
      rank: "AB",
      vesselId,
      active: true,
      onDuty: true,
      notes: `cert journey ${RUN_ID}`,
    });
    expect([200, 201]).toContain(r.status);
    memberId = r.data.id;
  });

  it("creates a near-expiring cert against that member", async () => {
    // Expire in 15 days — clearly inside the 30-day alert window.
    const expiresAt = new Date(Date.now() + 15 * 86400000).toISOString();
    const r = await api<{ id: string }>("POST", "/api/crew-certifications", {
      crewId: memberId,
      cert: `STCW-${RUN_ID}`.slice(0, 50),
      certNumber: `C-${RUN_ID}`,
      expiresAt,
    });
    expect([200, 201]).toContain(r.status);
    certId = r.data.id;

    // SQL FK
    const { rows } = await pool.query(
      `SELECT c.crew_id, m.id AS m_id
         FROM crew_cert c
         JOIN crew m ON m.id = c.crew_id
        WHERE c.id = $1`,
      [certId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].crew_id).toBe(memberId);
  });

  it("cert appears in GET /api/crew-certifications?crewId=", async () => {
    await expectInList<{ id: string }>(
      `/api/crew-certifications?crewId=${memberId}`,
      (c) => c.id === certId,
      "cert not in /api/crew-certifications?crewId="
    );
  });
});
