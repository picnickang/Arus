/**
 * Shared change-password schema (client/src/lib/password-change.ts) — the one
 * contract behind both the portal-login forced-change flow and the profile
 * page. Pins the min-length boundary, the confirm-match refinement (and that
 * its error lands on the confirm field), and a valid round-trip.
 */

import { passwordChangeSchema, PASSWORD_CHANGE_DEFAULTS } from "@/lib/password-change";

describe("passwordChangeSchema", () => {
  const valid = {
    currentPassword: "old-secret",
    newPassword: "longenough",
    confirmPassword: "longenough",
  };

  it("accepts a valid change", () => {
    const result = passwordChangeSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("requires the current password", () => {
    const result = passwordChangeSchema.safeParse({ ...valid, currentPassword: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["currentPassword"]);
    }
  });

  it("rejects a 7-character new password and accepts 8", () => {
    const seven = passwordChangeSchema.safeParse({
      ...valid,
      newPassword: "1234567",
      confirmPassword: "1234567",
    });
    expect(seven.success).toBe(false);
    if (!seven.success) {
      expect(seven.error.issues[0]?.path).toEqual(["newPassword"]);
    }

    const eight = passwordChangeSchema.safeParse({
      ...valid,
      newPassword: "12345678",
      confirmPassword: "12345678",
    });
    expect(eight.success).toBe(true);
  });

  it("puts the mismatch error on confirmPassword", () => {
    const result = passwordChangeSchema.safeParse({
      ...valid,
      confirmPassword: "different-pw",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "confirmPassword");
      expect(issue?.message).toBe("Passwords do not match.");
    }
  });

  it("rejects the empty defaults (all three fields error)", () => {
    const result = passwordChangeSchema.safeParse(PASSWORD_CHANGE_DEFAULTS);
    expect(result.success).toBe(false);
  });
});
