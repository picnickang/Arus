/**
 * Crew custom alerts — manager-raised ad-hoc alerts (not expiry-derived).
 *
 * Lifecycle: create crew member → create manual alert (FK crew) → alert
 *            appears in GET /api/crew-alerts?crewId= → acknowledge (resolve)
 *            flips acknowledged + records notes → delete removes the row.
 *
 * Propagation:
 *   - GET /api/crew-alerts?crewId= lists the new alert.
 *   - SQL FK assertion on crew_alerts.crew_id.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { api, getRefIds, makeRunId, pool, cleanupByRunId, expectInList } from "./_helpers";

const RUN_ID = makeRunId("crew-alerts");

describe("Crew custom alerts — CRUD + propagation", () => {
  let vesselId: string;
  let memberId: string;
  let alertId: string;

  beforeAll(async () => {
    const refs = await getRefIds();
    vesselId = refs.vesselId;
    const { status, data } = await api<{ id: string }>("POST", "/api/crew", {
      name: `QA Alert Sailor ${RUN_ID}`,
      rank: "AB",
      vesselId,
      active: true,
      onDuty: false,
      notes: `alerts test ${RUN_ID}`,
    });
    expect([200, 201]).toContain(status);
    memberId = data.id;
  }, 30000);

  afterAll(async () => {
    if (alertId) {await pool.query("DELETE FROM crew_alerts WHERE id=$1", [alertId]).catch(() => {});}
    if (memberId) {
      await pool.query("DELETE FROM crew_alerts WHERE crew_id=$1", [memberId]).catch(() => {});
      await pool.query("DELETE FROM crew WHERE id=$1", [memberId]).catch(() => {});
    }
    await cleanupByRunId(RUN_ID, ["crew", "crew_alerts"]);
  });

  it("creates a manual crew alert with FK to crew", async () => {
    const { status, data } = await api<{ id: string; severity: string; acknowledged: boolean }>(
      "POST",
      "/api/crew-alerts",
      {
        crewId: memberId,
        title: `Follow up ${RUN_ID}`,
        severity: "warning",
        detail: "verify lifecycle",
      }
    );
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.log("alert create returned", status, JSON.stringify(data).slice(0, 200));
    }
    expect([200, 201]).toContain(status);
    alertId = data.id;
    expect(data.severity).toBe("warning");
    expect(data.acknowledged).toBe(false);

    const { rows } = await pool.query(
      `SELECT a.crew_id, m.id AS m_id FROM crew_alerts a JOIN crew m ON m.id=a.crew_id WHERE a.id=$1`,
      [alertId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].crew_id).toBe(memberId);
  });

  it("alert appears in GET /api/crew-alerts?crewId=", async () => {
    await expectInList<{ id: string }>(
      `/api/crew-alerts?crewId=${memberId}`,
      (a) => a.id === alertId,
      "new alert not in /api/crew-alerts?crewId="
    );
  });

  it("acknowledge resolves the alert and records notes", async () => {
    const { status, data } = await api<{ acknowledged: boolean; acknowledgedNotes: string | null }>(
      "POST",
      `/api/crew-alerts/${alertId}/acknowledge`,
      { notes: "actioned" }
    );
    expect([200, 201]).toContain(status);
    expect(data.acknowledged).toBe(true);
    expect(data.acknowledgedNotes).toBe("actioned");

    const { rows } = await pool.query(
      "SELECT acknowledged FROM crew_alerts WHERE id=$1",
      [alertId]
    );
    expect(rows[0]?.acknowledged).toBe(true);
  });

  it("DELETE removes the alert row", async () => {
    const { status } = await api("DELETE", `/api/crew-alerts/${alertId}`);
    expect([200, 204, 404]).toContain(status);
    if (status === 200 || status === 204) {
      const { rows } = await pool.query("SELECT 1 FROM crew_alerts WHERE id=$1", [alertId]);
      expect(rows.length).toBe(0);
      alertId = "";
    }
  });
});
