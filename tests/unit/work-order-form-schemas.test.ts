/**
 * Work-order form schemas (Batch 2 of the forms migration):
 *  - quickWorkOrderSchema (QuickWorkOrderSheet)
 *  - makeCloseoutSchema   (WorkOrderCloseoutWizard, predictive factory)
 *  - partsRequestSchema   (MultiLinePartsRequestDialog, dynamic rows)
 *  - makeEnhancedServiceRequestSchema (EnhancedServiceRequestDialog modes)
 */

import {
  quickWorkOrderSchema,
  quickWorkOrderDefaults,
} from "@/features/work-orders/lib/quickWorkOrderSchema";
import {
  makeCloseoutSchema,
  parseCloseout,
  CLOSEOUT_DEFAULTS,
} from "@/features/work-orders/lib/closeoutSchema";
import {
  partsRequestSchema,
  toPartsRequestPayload,
} from "@/features/work-orders/hooks/useMultiLinePartsForm";
import {
  makeEnhancedServiceRequestSchema,
  toEnhancedServiceRequestData,
  ENHANCED_SR_DEFAULTS,
} from "@/features/work-orders/hooks/useEnhancedServiceRequestForm";

describe("quickWorkOrderSchema", () => {
  it("defaults to medium priority with the prefilled equipment", () => {
    const defaults = quickWorkOrderDefaults("EQ-1");
    expect(defaults).toEqual({ equipmentId: "EQ-1", description: "", priority: "medium" });
  });

  it("rejects a missing equipment selection on the equipmentId path", () => {
    const result = quickWorkOrderSchema.safeParse({
      equipmentId: "",
      description: "Knocking noise",
      priority: "medium",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["equipmentId"]);
    }
  });

  it("rejects whitespace-only descriptions and trims valid ones", () => {
    const blank = quickWorkOrderSchema.safeParse({
      equipmentId: "EQ-1",
      description: "   ",
      priority: "high",
    });
    expect(blank.success).toBe(false);

    const ok = quickWorkOrderSchema.safeParse({
      equipmentId: "EQ-1",
      description: "  Knocking noise  ",
      priority: "high",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.description).toBe("Knocking noise");
    }
  });
});

describe("makeCloseoutSchema", () => {
  const filled = {
    ...CLOSEOUT_DEFAULTS,
    workPerformed: "Replaced bearing",
    causeFound: "Worn bearing",
    evidenceNote: "Photos attached",
    checklistVerified: true,
    supervisorVerified: true,
    laborHours: "2.5",
    downtimeHours: "",
  };

  it("validates, then parseCloseout converts hours (empty → null)", () => {
    const result = makeCloseoutSchema(false).safeParse(filled);
    expect(result.success).toBe(true);

    const parsed = parseCloseout(filled);
    expect(parsed.laborHours).toBe(2.5);
    expect(parsed.downtimeHours).toBeNull();
  });

  it("requires both verification checkboxes", () => {
    const result = makeCloseoutSchema(false).safeParse({ ...filled, checklistVerified: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "checklistVerified")).toBe(true);
    }
  });

  it("rejects negative hours", () => {
    const result = makeCloseoutSchema(false).safeParse({ ...filled, laborHours: "-1" });
    expect(result.success).toBe(false);
  });

  it("requires PdM feedback only for predictive work orders", () => {
    const withoutFeedback = { ...filled, hasPredictionFeedback: false };
    expect(makeCloseoutSchema(false).safeParse(withoutFeedback).success).toBe(true);
    const predictive = makeCloseoutSchema(true).safeParse(withoutFeedback);
    expect(predictive.success).toBe(false);
    if (!predictive.success) {
      expect(predictive.error.issues[0]?.path).toEqual(["hasPredictionFeedback"]);
    }
  });
});

describe("partsRequestSchema", () => {
  const row = {
    rowId: "item-1",
    description: "FF-220 - Fuel filter",
    quantity: 3,
    notes: "",
    isCustom: false,
    inventoryItemId: "part-9",
    selectedSupplierId: "sup-1",
  };

  it("requires at least one row", () => {
    const result = partsRequestSchema.safeParse({ globalNotes: "", items: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Add at least one part");
    }
  });

  it("rejects an empty row description and zero quantity", () => {
    const result = partsRequestSchema.safeParse({
      globalNotes: "",
      items: [{ ...row, description: "", quantity: 0 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("items.0.description");
      expect(paths).toContain("items.0.quantity");
    }
  });

  it("maps rows to the purchase-request payload (empty optionals dropped)", () => {
    const payload = toPartsRequestPayload({ globalNotes: "", items: [row] });
    expect(payload).toEqual({
      notes: undefined,
      items: [
        {
          partId: "part-9",
          description: "FF-220 - Fuel filter",
          quantity: 3,
          notes: undefined,
          supplierId: "sup-1",
        },
      ],
    });
  });
});

describe("makeEnhancedServiceRequestSchema", () => {
  const filled = {
    ...ENHANCED_SR_DEFAULTS,
    providerId: "prov-1",
    equipmentIds: ["eq-1"],
    symptomDescription: "Pump leaking",
    requestedStartDate: new Date("2026-06-15"),
  };

  it("create mode requires provider, equipment and date; edit mode does not", () => {
    const missing = { ...filled, providerId: "", equipmentIds: [] };
    const create = makeEnhancedServiceRequestSchema(false).safeParse(missing);
    expect(create.success).toBe(false);
    if (!create.success) {
      const paths = create.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("providerId");
      expect(paths).toContain("equipmentIds");
    }

    const edit = makeEnhancedServiceRequestSchema(true).safeParse({
      ...ENHANCED_SR_DEFAULTS,
      symptomDescription: "Pump leaking",
    });
    expect(edit.success).toBe(true);
  });

  it("rejects non-numeric hour/amount text", () => {
    const result = makeEnhancedServiceRequestSchema(false).safeParse({
      ...filled,
      estimatedHours: "two",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["estimatedHours"]);
    }
  });

  it("basic-mode payload suppresses advanced fields; advanced mode parses numbers", () => {
    const basic = toEnhancedServiceRequestData(
      { ...filled, severity: "critical", estimatedHours: "4" },
      { showAdvanced: false, showCertificates: false }
    );
    expect(basic.severity).toBe("general");
    expect(basic.estimatedDurationHours).toBeUndefined();

    const advanced = toEnhancedServiceRequestData(
      { ...filled, severity: "critical", estimatedHours: "4" },
      { showAdvanced: true, showCertificates: false }
    );
    expect(advanced.severity).toBe("critical");
    expect(advanced.estimatedDurationHours).toBe(4);
  });
});
