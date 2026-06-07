import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const BASE_URL = "http://localhost:5000";
const VESSEL_ID = "56aee8c0-184c-4d23-9187-f5db91cf8d61";
const HEADERS = {
  "Content-Type": "application/json",
  "x-org-id": "default-org-id",
};

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

const layoutUrl = `/api/vessels/${VESSEL_ID}/schematic-layout`;

describe("Schematic Layout CRUD API", () => {
  beforeEach(async () => {
    await api("POST", `${layoutUrl}/reset`);
  });

  afterEach(async () => {
    await api("POST", `${layoutUrl}/reset`);
  });

  it("GET returns default layout with 5 zones and 10 slots", async () => {
    const { status, data } = await api("GET", layoutUrl);
    expect(status).toBe(200);
    expect(data.zones).toHaveLength(5);
    expect(data.slots).toHaveLength(10);
    expect(data.zones.map((z: { label: string }) => z.label)).toEqual([
      "Bow / Thruster",
      "Bridge / Navigation",
      "Main Deck",
      "Engine Room",
      "Tank / Cargo",
    ]);
  });

  it("PUT saves full layout and GET returns it", async () => {
    const customLayout = {
      zones: [{ zoneId: "z1", label: "Custom Zone", order: 0, slotIds: ["s1"] }],
      slots: [{ slotId: "s1", label: "Custom Slot", category: "test", typeMatch: ["test"] }],
    };
    const { status: putStatus, data: putData } = await api("PUT", layoutUrl, customLayout);
    expect(putStatus).toBe(200);
    expect(putData.zones[0].label).toBe("Custom Zone");

    const { data: getData } = await api("GET", layoutUrl);
    expect(getData.zones).toHaveLength(1);
    expect(getData.slots).toHaveLength(1);
    expect(getData.zones[0].label).toBe("Custom Zone");
    expect(getData.slots[0].label).toBe("Custom Slot");
  });

  it("POST /zones adds a zone", async () => {
    const { status, data } = await api("POST", `${layoutUrl}/zones`, { label: "Pump Room" });
    expect(status).toBe(201);
    expect(data.zones).toHaveLength(6);
    const pumpRoom = data.zones.find((z: { label: string }) => z.label === "Pump Room");
    expect(pumpRoom).toBeDefined();
    expect(pumpRoom.slotIds).toEqual([]);
  });

  it("PUT /zones/:id renames a zone", async () => {
    const { data } = await api("POST", `${layoutUrl}/zones`, { label: "Old Name" });
    const zone = data.zones.find((z: { label: string }) => z.label === "Old Name");
    const { status, data: updated } = await api("PUT", `${layoutUrl}/zones/${zone.zoneId}`, {
      label: "New Name",
    });
    expect(status).toBe(200);
    expect(updated.zones.find((z: { zoneId: string }) => z.zoneId === zone.zoneId).label).toBe(
      "New Name"
    );
  });

  it("DELETE /zones/:id removes zone, keeps orphaned slots", async () => {
    const { data: before } = await api("GET", layoutUrl);
    const engineRoom = before.zones.find((z: { zoneId: string }) => z.zoneId === "engine-room");
    const engineSlotCount = engineRoom.slotIds.length;

    const { status, data } = await api("DELETE", `${layoutUrl}/zones/engine-room`);
    expect(status).toBe(200);
    expect(data.zones).toHaveLength(4);
    expect(data.slots).toHaveLength(10);

    const assignedIds = new Set(data.zones.flatMap((z: { slotIds: string[] }) => z.slotIds));
    const unassigned = data.slots.filter((s: { slotId: string }) => !assignedIds.has(s.slotId));
    expect(unassigned.length).toBeGreaterThanOrEqual(engineSlotCount);
  });

  it("POST /slots adds a slot to a zone", async () => {
    const { status, data } = await api("POST", `${layoutUrl}/slots`, {
      label: "Test Pump",
      category: "pumps",
      typeMatch: ["pump"],
      zoneId: "engine-room",
    });
    expect(status).toBe(201);
    expect(data.slots).toHaveLength(11);
    const slot = data.slots.find((s: { label: string }) => s.label === "Test Pump");
    expect(slot).toBeDefined();
    const engineRoom = data.zones.find((z: { zoneId: string }) => z.zoneId === "engine-room");
    expect(engineRoom.slotIds).toContain(slot.slotId);
  });

  it("DELETE /slots/:id succeeds for slot with no matching equipment (server-side check)", async () => {
    const { status: ok, data } = await api("DELETE", `${layoutUrl}/slots/me`, {});
    expect(ok).toBe(200);
    expect(data.slots).toHaveLength(9);
    expect(data.slots.find((s: { slotId: string }) => s.slotId === "me")).toBeUndefined();
  });

  it("DELETE /slots/:id succeeds with force=true even if equipment matched", async () => {
    const { status: forced, data } = await api("DELETE", `${layoutUrl}/slots/gen1`, {
      force: true,
    });
    expect(forced).toBe(200);
    expect(data.slots.find((s: { slotId: string }) => s.slotId === "gen1")).toBeUndefined();
  });

  it("PUT /slots/:id/move moves a slot between zones", async () => {
    const { data: before } = await api("GET", layoutUrl);
    expect(
      before.zones.find((z: { zoneId: string }) => z.zoneId === "engine-room").slotIds
    ).toContain("me");

    const { status, data } = await api("PUT", `${layoutUrl}/slots/me/move`, {
      targetZoneId: "bow-thruster",
    });
    expect(status).toBe(200);
    expect(
      data.zones.find((z: { zoneId: string }) => z.zoneId === "bow-thruster").slotIds
    ).toContain("me");
    expect(
      data.zones.find((z: { zoneId: string }) => z.zoneId === "engine-room").slotIds
    ).not.toContain("me");
  });

  it("POST /reset restores default layout", async () => {
    await api("PUT", layoutUrl, { zones: [], slots: [] });
    const { data: empty } = await api("GET", layoutUrl);
    expect(empty.zones).toHaveLength(0);

    const { status, data } = await api("POST", `${layoutUrl}/reset`);
    expect(status).toBe(200);
    expect(data.zones).toHaveLength(5);
    expect(data.slots).toHaveLength(10);
  });

  it("returns 404 for non-existent zone/slot operations", async () => {
    const { status: zoneNotFound } = await api("PUT", `${layoutUrl}/zones/nonexistent`, {
      label: "X",
    });
    expect(zoneNotFound).toBe(404);

    const { status: slotNotFound } = await api("DELETE", `${layoutUrl}/slots/nonexistent`, {
      force: true,
    });
    expect(slotNotFound).toBe(404);
  });
});
