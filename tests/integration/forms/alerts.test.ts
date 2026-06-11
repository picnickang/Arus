/**
 * Alerts settings forms — AlertThresholdEditor + AlertSettingsForm.
 *
 * Lifecycle: POST a threshold → list contains it → PUT updates → DELETE.
 *
 * Propagation: GET /api/alert-settings/thresholds reflects writes.
 */

import { describe, it, expect, afterAll } from "@jest/globals";
import { api, makeRunId, pool, cleanupByRunId } from "./_helpers";

const RUN_ID = makeRunId("alert");
const KEY = `forms_test_${RUN_ID}`
  .toLowerCase()
  .replace(/[^a-z0-9_]/g, "_")
  .slice(0, 60);

describe("Alert-threshold forms — CRUD + propagation", () => {
  afterAll(async () => {
    await pool.query("DELETE FROM alert_thresholds WHERE key=$1", [KEY]).catch(() => {});
    await cleanupByRunId(RUN_ID, ["alert_thresholds"]);
  });

  it("creates a new threshold via POST /api/alert-settings/thresholds", async () => {
    const { status, data } = await api<{ id?: string; key?: string }>(
      "POST",
      "/api/alert-settings/thresholds",
      {
        category: "vibration",
        key: KEY,
        name: `Forms Test Threshold ${RUN_ID}`,
        description: `description ${RUN_ID}`,
        severity: "warning",
        thresholdValue: 7.1,
        thresholdUnit: "mm/s",
        enabled: true,
      }
    );
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.log("threshold create", status, JSON.stringify(data).slice(0, 300));
    }
    expect([200, 201]).toContain(status);
  });

  it("threshold appears in GET /api/alert-settings/thresholds", async () => {
    const { status, data } = await api<unknown>("GET", "/api/alert-settings/thresholds");
    expect(status).toBe(200);
    const items = Array.isArray(data)
      ? (data as Array<{ key?: string; name?: string }>)
      : ((data as { items?: Array<{ key?: string }> }).items ?? []);
    const found = items.find((t) => t.key === KEY);
    expect(found).toBeTruthy();
  });

  it("PUT updates the threshold value", async () => {
    const { status } = await api("PUT", `/api/alert-settings/thresholds/${KEY}`, {
      thresholdValue: 9.0,
      severity: "critical",
    });
    expect([200, 204]).toContain(status);
    const { rows } = await pool.query(
      "SELECT threshold_value, severity FROM alert_thresholds WHERE key=$1",
      [KEY]
    );
    expect(Number(rows[0]?.threshold_value)).toBe(9.0);
    expect(rows[0]?.severity).toBe("critical");
  });

  it("DELETE removes the threshold", async () => {
    const { status } = await api("DELETE", `/api/alert-settings/thresholds/${KEY}`);
    expect([200, 204]).toContain(status);
    const { rows } = await pool.query("SELECT 1 FROM alert_thresholds WHERE key=$1", [KEY]);
    expect(rows.length).toBe(0);
  });
});
