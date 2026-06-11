/**
 * Vessel schematic-layout forms — useEquipmentViewData / schematic editor
 *
 * Lifecycle: GET base layout → PUT/POST a zone → GET shows it → DELETE.
 *
 * The schematic-layout domain stores zones + slots per vessel. These are the
 * primary "form fields" exposed by the equipment-view page.
 */

import { describe, it, expect, afterAll } from "@jest/globals";
import { api, makeRunId, getRefIds } from "./_helpers";

const RUN_ID = makeRunId("vs");

describe("Vessel schematic-layout forms — zone CRUD", () => {
  let vesselId: string;
  let zoneId: string | undefined;

  afterAll(async () => {
    if (vesselId && zoneId) {
      await api("DELETE", `/api/vessels/${vesselId}/schematic-layout/zones/${zoneId}`).catch(
        () => {}
      );
    }
  });

  it("GET schematic-layout for the vessel returns 2xx", async () => {
    const refs = await getRefIds();
    vesselId = refs.vesselId;
    const { status } = await api("GET", `/api/vessels/${vesselId}/schematic-layout`);
    expect([200]).toContain(status);
  });

  it("POST a new zone, then GET shows it", async () => {
    const { status, data } = await api<{ id: string }>(
      "POST",
      `/api/vessels/${vesselId}/schematic-layout/zones`,
      { label: `Z ${RUN_ID}`.slice(0, 100), order: 99 }
    );
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.log("zone create returned", status, JSON.stringify(data).slice(0, 300));
    }
    expect([200, 201]).toContain(status);
    // POST returns the full layout. Find the new zone by label.
    const layout = data as unknown as { zones?: Array<{ id: string; label: string }> };
    const matched = layout.zones?.find((z) => z.label.includes(RUN_ID));
    expect(matched).toBeTruthy();
    zoneId = matched!.id;

    const { status: getStatus, data: refetched } = await api<{
      zones?: Array<{ id: string }>;
    }>("GET", `/api/vessels/${vesselId}/schematic-layout`);
    expect(getStatus).toBe(200);
    expect(refetched.zones?.find((z) => z.id === zoneId)).toBeTruthy();
  });

  it("DELETE removes the zone", async () => {
    if (!zoneId) {
      return;
    }
    const { status } = await api(
      "DELETE",
      `/api/vessels/${vesselId}/schematic-layout/zones/${zoneId}`
    );
    expect([200, 204]).toContain(status);
    zoneId = undefined;
  });
});
