import { describe, expect, it } from "@jest/globals";
import { equipmentIdForThumbnail } from "@/pages/vessel-intelligence/registry-identifiers";
import type { EquipmentRecord } from "@/pages/vessel-intelligence/data";

describe("vessel intelligence registry API helpers", () => {
  it("returns null instead of a malformed thumbnail id when equipment has no identifier", () => {
    const equipment = {} as EquipmentRecord;

    expect(equipmentIdForThumbnail(equipment)).toBeNull();
  });

  it("uses the first stable equipment identifier for thumbnail operations", () => {
    expect(
      equipmentIdForThumbnail({
        equipmentId: "eq-1",
        assetCode: "asset-1",
        name: "Main Engine",
      } as EquipmentRecord)
    ).toBe("eq-1");
  });
});
