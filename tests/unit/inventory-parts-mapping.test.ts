import { describe, expect, it } from "@jest/globals";

import type { Part, Stock } from "@shared/schema";
import { partAndStockToPartsInventory } from "../../server/db/inventory/db-parts";

function part(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-1",
    orgId: "org-1",
    partNo: "PN-100",
    name: "Pump Seal",
    description: "Main pump mechanical seal",
    category: "seals",
    manufacturer: "Acme Marine",
    standardCost: 42,
    minStockQty: 2,
    maxStockQty: 10,
    leadTimeDays: 7,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  } as Part;
}

function stockRow(overrides: Partial<Stock> = {}): Stock {
  return {
    id: "stock-1",
    orgId: "org-1",
    partId: "part-1",
    partNo: "PN-100",
    location: "MAIN",
    quantityOnHand: 4,
    quantityReserved: 1,
    unitCost: 50,
    createdAt: new Date("2026-01-03T00:00:00.000Z"),
    updatedAt: new Date("2026-01-04T00:00:00.000Z"),
    ...overrides,
  } as Stock;
}

describe("partAndStockToPartsInventory", () => {
  it("rolls up multiple stock rows into the legacy inventory view", () => {
    const result = partAndStockToPartsInventory(part(), [
      stockRow({ id: "stock-1", quantityOnHand: 4, quantityReserved: 1, unitCost: 50 }),
      stockRow({
        id: "stock-2",
        location: "ENGINE_ROOM",
        quantityOnHand: 6,
        quantityReserved: 2,
        unitCost: 70,
      }),
    ]);

    expect(result).toMatchObject({
      id: "part-1",
      orgId: "org-1",
      partNumber: "PN-100",
      partName: "Pump Seal",
      category: "seals",
      manufacturer: "Acme Marine",
      quantityOnHand: 10,
      quantityReserved: 3,
      unitCost: 60,
      minStockLevel: 2,
      maxStockLevel: 10,
      location: "MAIN",
      leadTimeDays: 7,
      isActive: true,
    });
  });

  it("uses the part standard cost when stock rows have no usable price", () => {
    const result = partAndStockToPartsInventory(part({ standardCost: 88 }), [
      stockRow({ unitCost: 0 }),
      stockRow({ id: "stock-2", unitCost: null }),
    ]);

    expect(result.unitCost).toBe(88);
  });

  it("returns safe defaults when no stock rows exist", () => {
    const result = partAndStockToPartsInventory(
      part({
        category: null,
        manufacturer: null,
        standardCost: null,
        minStockQty: null,
        maxStockQty: null,
        leadTimeDays: null,
        isActive: null,
      }),
      null
    );

    expect(result).toMatchObject({
      category: "general",
      manufacturer: null,
      quantityOnHand: 0,
      quantityReserved: 0,
      unitCost: 0,
      minStockLevel: 0,
      maxStockLevel: 0,
      location: "MAIN",
      leadTimeDays: 7,
      isActive: true,
    });
  });
});
