/**
 * P2 #22 / #28 regression tests for the `complete-with-feedback`
 * closeout payload. Two invariants must hold under
 * `exactOptionalPropertyTypes` (EOPT):
 *
 *   1. The Zod schema bounds malformed inputs (negative hours,
 *      oversize strings, garbage extra keys) so the persisted
 *      completion can't carry hostile data into reporting (#22).
 *   2. Falsy-but-legitimate values — `0`, `null`, `""`, `false` —
 *      survive the route's spread when present and are NOT
 *      synthesised when absent. This is the property the explicit
 *      `!== undefined` spread defends (#28).
 */
import { describe, it, expect } from "@jest/globals";
import {
  completeWithFeedbackSchema,
  _closeoutSchemaForTests as closeoutSchema,
} from "../../domains/work-orders/interfaces/workflow-routes";

describe("complete-with-feedback closeout validation (#22)", () => {
  it("rejects negative laborHours", () => {
    const r = closeoutSchema.safeParse({ laborHours: -1 });
    expect(r.success).toBe(false);
  });

  it("rejects laborHours above the 1000h cap", () => {
    const r = closeoutSchema.safeParse({ laborHours: 1500 });
    expect(r.success).toBe(false);
  });

  it("rejects unknown closeout keys (strict mode)", () => {
    const r = closeoutSchema.safeParse({ phantomField: "x" });
    expect(r.success).toBe(false);
  });

  it("rejects oversize workPerformed text", () => {
    const r = closeoutSchema.safeParse({ workPerformed: "a".repeat(2001) });
    expect(r.success).toBe(false);
  });

  it("accepts an empty body (every field optional)", () => {
    const r = closeoutSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});

describe("complete-with-feedback EOPT falsy preservation (#28)", () => {
  function selectBuilt<K extends string>(
    input: Record<string, unknown>,
  ): Record<K, unknown> {
    const parsed = completeWithFeedbackSchema.parse(input);
    const { completionNotes, actualHours, actualDowntimeHours, closeout } = parsed;
    // Mirror the route's spread pattern verbatim.
    const built: Record<string, unknown> = {
      ...(completionNotes !== undefined && { completionNotes }),
      ...(actualHours !== undefined && { actualHours }),
      ...(actualDowntimeHours !== undefined && { actualDowntimeHours }),
      ...(closeout !== undefined && { closeout }),
    };
    return built as Record<K, unknown>;
  }

  it("preserves actualHours=0 (does not silently drop falsy)", () => {
    const out = selectBuilt({ actualHours: 0 });
    expect("actualHours" in out).toBe(true);
    expect(out["actualHours"]).toBe(0);
  });

  it("preserves empty-string completionNotes when sent", () => {
    const out = selectBuilt({ completionNotes: "" });
    expect("completionNotes" in out).toBe(true);
    expect(out["completionNotes"]).toBe("");
  });

  it("omits keys that were never sent (EOPT-clean)", () => {
    const out = selectBuilt({ actualHours: 1 });
    expect("completionNotes" in out).toBe(false);
    expect("actualDowntimeHours" in out).toBe(false);
    expect("closeout" in out).toBe(false);
  });

  it("preserves closeout.laborHours=null clear-out", () => {
    const out = selectBuilt({ closeout: { laborHours: null } });
    expect(out["closeout"]).toEqual({ laborHours: null });
  });
});
