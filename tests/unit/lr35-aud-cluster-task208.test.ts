/**
 * LR-3.5 / AUD-2 (Task #208) — audit hash binds orgId, version-dispatched
 *
 * Sibling integration test `tests/integration/lr35-aud-cluster-task208.test.ts`
 * covers AUD-1 (compliance findings soft-archive) which needs a live DB.
 */
import {
  AUDIT_HASH_VERSION_CURRENT,
  computeAuditHash,
} from "../../server/compliance/immutable-audit/hashing";

describe("LR-3.5 / AUD-2 (Task #208) — audit hash binds orgId, version-dispatched", () => {
  const ts = new Date("2026-01-01T00:00:00Z");
  const args = [
    ts,
    "work_order",
    "wo-1",
    "operation",
    "completed",
    "user-1",
    { status: "open" },
    { status: "done" },
  ] as const;

  it("v2 (current): two rows differing only by orgId hash differently", () => {
    const h1 = computeAuditHash(null, "org-a", ...args);
    const h2 = computeAuditHash(null, "org-b", ...args);
    expect(h1).not.toEqual(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("v2 (current): two rows with the same orgId hash identically", () => {
    const h1 = computeAuditHash(null, "org-a", ...args);
    const h2 = computeAuditHash(null, "org-a", ...args);
    expect(h1).toEqual(h2);
  });

  it("v1 (legacy): hash is independent of orgId — preserves historical chain verifiability", () => {
    // Pre-LR-3.5 rows were hashed WITHOUT orgId. The verifier must
    // still validate them under the original payload, so v1 hashes
    // for two different orgIds must collide given identical other
    // fields (otherwise we'd be silently rejecting historical rows).
    const legacyA = computeAuditHash(null, "org-a", ...args, 1);
    const legacyB = computeAuditHash(null, "org-b", ...args, 1);
    expect(legacyA).toEqual(legacyB);

    // And v1 MUST differ from v2 for the same input — otherwise the
    // version dispatch would be cosmetic.
    const v2 = computeAuditHash(null, "org-a", ...args, 2);
    expect(legacyA).not.toEqual(v2);
  });

  it("AUDIT_HASH_VERSION_CURRENT is 2", () => {
    expect(AUDIT_HASH_VERSION_CURRENT).toBe(2);
  });
});
