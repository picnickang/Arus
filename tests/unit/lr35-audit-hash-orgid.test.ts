/**
 * LR-3.5 / AUD-2 regression: computeAuditHash must bind orgId.
 */
import { computeAuditHash } from "../../server/compliance/immutable-audit/hashing";

describe("LR-3.5 AUD-2 — orgId bound into audit chain hash", () => {
  const ts = new Date("2026-01-01T00:00:00Z");
  const base = [
    null,
    ts,
    "work_order",
    "wo-1",
    "operation",
    "completed",
    "user-1",
    { status: "open" },
    { status: "done" },
  ] as const;

  it("produces different hashes for different orgIds", () => {
    const h1 = computeAuditHash(base[0], "org-a", ...base.slice(1) as Parameters<typeof computeAuditHash> extends [unknown, unknown, ...infer R] ? R : never);
    const h2 = computeAuditHash(base[0], "org-b", ...base.slice(1) as Parameters<typeof computeAuditHash> extends [unknown, unknown, ...infer R] ? R : never);
    expect(h1).not.toEqual(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable for the same input", () => {
    const a = computeAuditHash(base[0], "org-a", ...base.slice(1) as Parameters<typeof computeAuditHash> extends [unknown, unknown, ...infer R] ? R : never);
    const b = computeAuditHash(base[0], "org-a", ...base.slice(1) as Parameters<typeof computeAuditHash> extends [unknown, unknown, ...infer R] ? R : never);
    expect(a).toEqual(b);
  });
});
