import { describe, expect, it } from "@jest/globals";
import {
  buildSupplierFormDefaultValues,
  supplierFormSchema,
} from "../../client/src/features/suppliers/components/SupplierFormSchema";
import type { Supplier } from "../../client/src/features/suppliers/types";

describe("SupplierFormSchema", () => {
  it("builds the same create defaults used by SupplierForm", () => {
    expect(buildSupplierFormDefaultValues(undefined, "service_provider")).toMatchObject({
      name: "",
      code: "",
      type: "service_provider",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      paymentTerms: "",
      isActive: true,
      notes: "",
      qualityRating: 5,
      defectRate: 0,
      isPreferred: false,
      serviceCapabilities: [],
      certifications: [],
      equipmentTypesServiced: [],
    });
  });

  it("preserves existing supplier values without inventing absent optional numbers", () => {
    const supplier = {
      id: "supplier-1",
      orgId: "org-1",
      name: "Northwind Marine",
      code: "NWM",
      type: "both",
      contactName: null,
      email: null,
      phone: null,
      address: null,
      paymentTerms: "NET30",
      isActive: false,
      notes: null,
      qualityRating: null,
      defectRate: null,
      isPreferred: true,
      serviceCapabilities: ["Engine Overhaul"],
      certifications: ["ISO 9001"],
      responseSlaHours: 12,
      equipmentTypesServiced: ["Main Engine"],
    } satisfies Supplier;

    const defaults = buildSupplierFormDefaultValues(supplier, "supplier");
    expect(defaults).toMatchObject({
      type: "both",
      contactName: "",
      paymentTerms: "NET30",
      isActive: false,
      qualityRating: 5,
      defectRate: 0,
      isPreferred: true,
      responseSlaHours: 12,
    });
    expect(defaults).not.toHaveProperty("leadTimeDays");
  });

  it("coerces numeric and comma-separated fields during validation", () => {
    const parsed = supplierFormSchema.parse({
      name: "Northwind Marine",
      code: "NWM",
      type: "both",
      email: "",
      leadTimeDays: "7",
      qualityRating: "8.5",
      defectRate: "2",
      responseSlaHours: "24",
      serviceCapabilities: "Engine Overhaul, Electrical Systems",
      certifications: "ISO 9001, DNV-GL",
      equipmentTypesServiced: "Main Engine, Generator",
    });

    expect(parsed).toMatchObject({
      email: undefined,
      leadTimeDays: 7,
      qualityRating: 8.5,
      defectRate: 2,
      responseSlaHours: 24,
      serviceCapabilities: ["Engine Overhaul", "Electrical Systems"],
      certifications: ["ISO 9001", "DNV-GL"],
      equipmentTypesServiced: ["Main Engine", "Generator"],
    });
  });
});
