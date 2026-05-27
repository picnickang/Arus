/**
 * LR-3.5 / TEN-5 — structural object-to-org ownership gate.
 *
 * The upload signer now folds `orgId` into the storage path
 * (`uploads/orgs/<orgId>/<uuid>`); the matching download helper
 * `ObjectStorageService.assertObjectOwnedByOrg` parses that segment
 * and rejects mismatched callers. This file pins:
 *
 *   - same-org download → allowed
 *   - cross-org download → denied (returns ownerOrgId for audit)
 *   - legacy `uploads/<uuid>` path (pre-TEN-5 objects) → allowed but
 *     flagged `legacy: true` so the route layer can audit-log
 *
 * The route-level enforcement (HTTP 403 on `allowed: false`) lives in
 * `server/domains/storage-config/routes.ts`; this unit test pins the
 * helper, which is the actual decision-point.
 */

import { describe, it, expect } from "@jest/globals";
import { ObjectStorageService } from "../../server/objectStorage";

function fakeFile(objectName: string): { name: string } {
  return { name: objectName };
}

const ORG_A = "org-aaaa";
const ORG_B = "org-bbbb";

describe("LR-3.5 TEN-5 — assertObjectOwnedByOrg", () => {
  const svc = new ObjectStorageService();

  it("same-org path is allowed", () => {
    const out = svc.assertObjectOwnedByOrg(
      fakeFile(`bucket/.private/uploads/orgs/${ORG_A}/uuid-1`) as never,
      ORG_A,
    );
    expect(out.allowed).toBe(true);
    expect(out.ownerOrgId).toBe(ORG_A);
    expect(out.legacy).toBe(false);
  });

  it("cross-org path is rejected and reports owner for audit", () => {
    const out = svc.assertObjectOwnedByOrg(
      fakeFile(`bucket/.private/uploads/orgs/${ORG_A}/uuid-1`) as never,
      ORG_B,
    );
    expect(out.allowed).toBe(false);
    expect(out.ownerOrgId).toBe(ORG_A);
    expect(out.legacy).toBe(false);
  });

  it("legacy `uploads/<uuid>` path is allowed but flagged legacy", () => {
    const out = svc.assertObjectOwnedByOrg(
      fakeFile("bucket/.private/uploads/legacy-uuid") as never,
      ORG_A,
    );
    expect(out.allowed).toBe(true);
    expect(out.ownerOrgId).toBeNull();
    expect(out.legacy).toBe(true);
  });

  it("non-upload path (e.g. public asset) is allowed with no ownership opinion", () => {
    const out = svc.assertObjectOwnedByOrg(
      fakeFile("bucket/public/logo.png") as never,
      ORG_A,
    );
    expect(out.allowed).toBe(true);
    expect(out.ownerOrgId).toBeNull();
    expect(out.legacy).toBe(false);
  });
});
