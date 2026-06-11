/**
 * Offboarding form schema (client/src/features/crew/lib/lifecycleSchema.ts) —
 * the zod contract behind the lifecycle dialog's retire / cancel flows:
 * reason and end date are mandatory, and a fully populated offboarding
 * round-trips unchanged.
 */

import {
  lifecycleOffboardSchema,
  createDefaultLifecycleOffboardValues,
} from "@/features/crew/lib/lifecycleSchema";

const validOffboarding = {
  ...createDefaultLifecycleOffboardValues(),
  reason: "resignation",
  endDate: "2026-06-30",
  exitNotes: "Handover complete; locker cleared.",
  handoverDocs: true,
  applyPenalty: true,
};

describe("lifecycleOffboardSchema", () => {
  it("rejects a missing reason with a field-scoped message", () => {
    const result = lifecycleOffboardSchema.safeParse({ ...validOffboarding, reason: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "reason");
      expect(issue?.message).toBe("Reason is required");
    }
  });

  it("rejects a missing end date with a field-scoped message", () => {
    const result = lifecycleOffboardSchema.safeParse({ ...validOffboarding, endDate: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "endDate");
      expect(issue?.message).toBe("End date is required");
    }
  });

  it("rejects the untouched defaults (reason AND end date both flagged)", () => {
    const result = lifecycleOffboardSchema.safeParse(createDefaultLifecycleOffboardValues());
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("reason");
      expect(paths).toContain("endDate");
    }
  });

  it("round-trips a fully populated offboarding unchanged", () => {
    const result = lifecycleOffboardSchema.safeParse(validOffboarding);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validOffboarding);
    }
  });
});
