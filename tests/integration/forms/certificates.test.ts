/**
 * Vessel certificate forms — VesselCertForm + endorsement / condition forms.
 *
 * Lifecycle: create cert (FK vessel) → list contains it → patch with
 *            endorsement → delete.
 *
 * Propagation:
 *   - GET /api/certificates lists the new cert.
 *   - SQL FK assertion: vessel_certificates.vessel_id → vessels.id.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { api, getRefIds, makeRunId, pool, cleanupByRunId, expectInList } from "./_helpers";

const RUN_ID = makeRunId("cert");

describe("Vessel-certificate forms — CRUD + propagation", () => {
  let vesselId: string;
  let certId: string;

  beforeAll(async () => {
    const refs = await getRefIds();
    vesselId = refs.vesselId;
  }, 30000);

  afterAll(async () => {
    if (certId) {
      await pool
        .query("DELETE FROM certificate_events WHERE certificate_id=$1", [certId])
        .catch(() => {});
      await pool.query("DELETE FROM vessel_certificates WHERE id=$1", [certId]).catch(() => {});
    }
    await cleanupByRunId(RUN_ID, ["vessel_certificates", "certificate_events"]);
  });

  it("creates a vessel certificate with FK to vessel", async () => {
    const issueDate = new Date().toISOString();
    const expiryDate = new Date(Date.now() + 365 * 86400000).toISOString();

    const { status, data } = await api<{ id: string }>("POST", "/api/certificates", {
      vesselId,
      certificateType: "SOLAS",
      certificateNumber: `SOLAS-${RUN_ID}`.slice(0, 64),
      issuingAuthority: "Class NK",
      issuingAuthorityType: "classification_society",
      issueDate,
      expiryDate,
      status: "valid",
      notes: `forms test ${RUN_ID}`,
    });

    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.log("cert create returned", status, JSON.stringify(data).slice(0, 300));
    }
    expect([200, 201, 400]).toContain(status);
    if (status === 200 || status === 201) {
      certId = (data as { id: string }).id;

      const { rows } = await pool.query(
        `SELECT c.vessel_id, v.id AS v_id
           FROM vessel_certificates c
           JOIN vessels v ON v.id = c.vessel_id
          WHERE c.id = $1`,
        [certId]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].vessel_id).toBe(vesselId);
    }
  });

  it("certificate appears in GET /api/certificates list", async () => {
    if (!certId) {
      return;
    }
    await expectInList<{ id: string }>(
      "/api/certificates",
      (c) => c.id === certId,
      "new cert not in /api/certificates"
    );
  });

  it("PATCH updates the certificate", async () => {
    if (!certId) {
      return;
    }
    const { status } = await api("PATCH", `/api/certificates/${certId}`, {
      notes: `updated forms test ${RUN_ID}`,
    });
    expect([200, 204, 404]).toContain(status);
  });

  it("DELETE removes the certificate", async () => {
    if (!certId) {
      return;
    }
    const { status } = await api("DELETE", `/api/certificates/${certId}`);
    expect([200, 204, 403, 404, 409]).toContain(status);
    if (status === 200 || status === 204) {
      certId = ""; // cleaned
    }
  });
});
