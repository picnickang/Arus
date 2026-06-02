/**
 * §J / §K — Safety alarm types + alarm log (live dev server).
 *
 * Covers the full lifecycle: define an alarm type, trigger an alarm of that
 * type, see it in the active log, clear it, plus edge cases (invalid type id,
 * duplicate type key). Alarms are triggered in mode="test" to avoid real
 * operational notification side effects. Rows carry RUN_ID for cleanup.
 */
import { describe, it, expect, afterAll } from "@jest/globals";
import {
  makeRunId,
  cleanupCrewSuite,
  createAlarmType,
  listAlarmTypes,
  updateAlarmType,
  triggerAlarm,
  clearAlarm,
  listAlarms,
} from "./helpers";

const RUN_ID = makeRunId("safety");

afterAll(async () => {
  await cleanupCrewSuite(RUN_ID);
});

describe("Safety alarm types (§J)", () => {
  it("creates an active alarm type and lists it", async () => {
    const created = await createAlarmType(RUN_ID, { defaultSeverity: "warning" });
    expect(created.ok).toBe(true);
    expect(created.data.id).toBeTruthy();
    expect(created.data.isActive).toBe(true);

    const list = await listAlarmTypes();
    expect(list.ok).toBe(true);
    expect(list.data.some((t) => t.id === created.data.id)).toBe(true);
  });

  it("updates an alarm type display name", async () => {
    const created = await createAlarmType(RUN_ID);
    const updated = await updateAlarmType(created.data.id, {
      displayName: `Renamed ${RUN_ID}`,
    });
    expect(updated.ok).toBe(true);
    expect(updated.data.displayName).toBe(`Renamed ${RUN_ID}`);
  });

  it("rejects a duplicate alarm type key with a 4xx", async () => {
    const first = await createAlarmType(RUN_ID);
    const dup = await createAlarmType(RUN_ID, { key: first.data.key });
    expect(dup.ok).toBe(false);
    expect(dup.status).toBeGreaterThanOrEqual(400);
    expect(dup.status).toBeLessThan(500);
  });
});

describe("Safety alarm log (§K)", () => {
  it("triggers an alarm and shows it in the active log, then clears it", async () => {
    const type = await createAlarmType(RUN_ID, { defaultSeverity: "warning" });

    const triggered = await triggerAlarm({
      alarmTypeId: type.data.id,
      title: `Alarm ${RUN_ID}`,
      severity: "warning",
      mode: "test",
      confirmed: true,
    });
    expect(triggered.ok).toBe(true);
    expect(triggered.data.id).toBeTruthy();
    expect(triggered.data.severity).toBe("warning");

    const active = await listAlarms();
    expect(active.ok).toBe(true);
    expect(active.data.some((a) => a.id === triggered.data.id)).toBe(true);

    const cleared = await clearAlarm(triggered.data.id, {
      resolutionNote: "resolved by test",
    });
    expect(cleared.ok).toBe(true);

    const activeAfter = await listAlarms();
    expect(activeAfter.data.some((a) => a.id === triggered.data.id)).toBe(false);

    const all = await listAlarms(true);
    expect(all.data.some((a) => a.id === triggered.data.id)).toBe(true);
  });

  it("rejects triggering an alarm with an unknown type id", async () => {
    const res = await triggerAlarm({
      alarmTypeId: "00000000-0000-0000-0000-000000000000",
      title: `Bad ${RUN_ID}`,
      severity: "warning",
      mode: "test",
      confirmed: true,
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
