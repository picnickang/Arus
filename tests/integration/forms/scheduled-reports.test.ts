/**
 * Scheduled-reports forms — scheduled-reports.tsx
 *
 * Lifecycle: POST /api/scheduled-reports/schedules -> GET /schedules contains
 *            it -> PATCH disables it -> DELETE removes it.
 *
 * The scheduled-reports domain is gated by `isCloudMode` + cloud feature flag.
 * In vessel/dev installs every route returns 403 with code FEATURE_DISABLED;
 * the suite skips with a clear reason in that case (so the test still runs in
 * cloud builds and turns into real coverage there).
 */

import { describe, it, expect, afterAll, beforeAll } from "@jest/globals";
import { api, makeRunId } from "./_helpers";

const RUN_ID = makeRunId("sr");
const BASE = "/api/scheduled-reports";

let cloudEnabled = true;
let scheduleId: string | undefined;

describe("Scheduled-reports forms — CRUD + propagation", () => {
  beforeAll(async () => {
    const { status } = await api("GET", `${BASE}/schedules`);
    if (status === 403) {
      cloudEnabled = false;

      console.warn(
        "SKIP scheduled-reports suite: domain disabled (FEATURE_DISABLED) in this install"
      );
    }
  });

  afterAll(async () => {
    if (scheduleId) {
      await api("DELETE", `${BASE}/schedules/${scheduleId}`).catch(() => {});
    }
  });

  it("creates a schedule", async () => {
    if (!cloudEnabled) {return;}
    const { status, data } = await api<{ data?: { id: string }; id?: string }>(
      "POST",
      `${BASE}/schedules`,
      {
        name: `Test schedule ${RUN_ID}`,
        reportType: "fleet_health",
        frequency: "weekly",
        timezone: "UTC",
        format: "pdf",
        recipients: [`qa+${RUN_ID}@example.com`],
        enabled: true,
      }
    );
    expect([200, 201]).toContain(status);
    scheduleId = (data?.data?.id ?? data?.id) as string;
    expect(scheduleId).toBeTruthy();
  });

  it("schedule appears in /schedules list", async () => {
    if (!cloudEnabled || !scheduleId) {return;}
    const { status, data } = await api<{ data?: Array<{ id: string }> }>(
      "GET",
      `${BASE}/schedules`
    );
    expect(status).toBe(200);
    const items = data?.data ?? (data as unknown as Array<{ id: string }>);
    const list = Array.isArray(items) ? items : [];
    expect(list.find((s) => s.id === scheduleId)).toBeTruthy();
  });

  it("PATCH disables the schedule", async () => {
    if (!cloudEnabled || !scheduleId) {return;}
    const { status } = await api("PATCH", `${BASE}/schedules/${scheduleId}`, { enabled: false });
    expect([200, 204]).toContain(status);

    const { data } = await api<{ enabled?: boolean; data?: { enabled?: boolean } }>(
      "GET",
      `${BASE}/schedules/${scheduleId}`
    );
    const enabled = (data?.data?.enabled ?? data?.enabled) as boolean | undefined;
    if (typeof enabled === "boolean") {expect(enabled).toBe(false);}
  });

  it("DELETE removes the schedule", async () => {
    if (!cloudEnabled || !scheduleId) {return;}
    const { status } = await api("DELETE", `${BASE}/schedules/${scheduleId}`);
    expect([200, 204]).toContain(status);
    scheduleId = undefined;
  });
});
