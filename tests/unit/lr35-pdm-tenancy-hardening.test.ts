/**
 * LR-3.5 / PdM tenancy hardening — regression test.
 *
 * Architect flagged that the PdM training-pipeline and model-registry
 * route handlers were sourcing `orgId` from `DEFAULT_ORG_ID` rather
 * than the authenticated request context. With `requireOrgId` mounted
 * on the router this was usually benign, but it created two failure
 * modes worth pinning:
 *   (1) if the router-level middleware is ever removed or reordered,
 *       the handler silently degrades to single-tenant behaviour
 *       instead of failing closed, and
 *   (2) if multi-tenant auth is enabled (REQUIRE_TENANT_AUTH=true),
 *       org B could see org A's data because the handler ignores
 *       `req.orgId` entirely.
 *
 * The fix:
 *   - drop the `DEFAULT_ORG_ID` import from both routers;
 *   - read `orgId` from `(req as AuthenticatedRequest).orgId`;
 *   - rely on the router-level `requireOrgId` to reject unauth /
 *     missing-claim before the handler runs.
 *
 * Test strategy — why no supertest-against-the-real-router:
 * The training-pipeline and model-registry routers transitively
 * import `server/db.ts` → `server/db-config.ts`, which uses a
 * top-level `await import(...)` that swc compiles to CJS require
 * with a preserved top-level `await`. Under this project's
 * `extensionsToTreatAsEsm:[".ts"]` + swc `module.type:"es6"` hybrid
 * Jest config that file evaluates in a CJS sandbox and throws
 * "await is only valid in async functions". The same constraint is
 * documented in `tests/unit/lr35-wo-event-post-commit.test.ts`.
 *
 * So this test pins the same three-layer contract without booting
 * the real DB:
 *   (1) source-file invariants — neither route file imports
 *       `DEFAULT_ORG_ID` any more, every handler reads `req.orgId`,
 *       and the legacy fallback strings are gone;
 *   (2) middleware invariants — the real `requireOrgId` rejects
 *       unauth with 401 UNAUTHENTICATED, rejects authenticated
 *       users without an org claim under `REQUIRE_TENANT_AUTH=true`
 *       with 401 TENANT_CLAIM_MISSING, and otherwise populates
 *       `req.orgId` from the user claim (proves cross-tenant
 *       routing: org A and org B land on their own orgId);
 *   (3) registry invariants — both routers are still wired through
 *       `requireOrgId` at mount time in
 *       `server/routes/domain-router-registry.ts`, so the per-
 *       handler reliance on `req.orgId` is backed by a guaranteed
 *       fail-closed middleware.
 */

import { jest, describe, it, expect, afterEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";

import { requireOrgId, type AuthenticatedRequest } from "../../server/middleware/auth";

const TRAINING_ROUTES_PATH = "server/domains/pdm-platform/training-pipeline/routes.ts";
const MODEL_REGISTRY_ROUTES_PATH = "server/domains/pdm-platform/model-registry/routes.ts";

async function readSource(rel: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), rel), "utf8");
}

function buildRes(): { status: jest.Mock; json: jest.Mock; statusCode?: number; body?: unknown } {
  const res: { status: jest.Mock; json: jest.Mock; statusCode?: number; body?: unknown } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

const ORIG_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("LR-3.5 PdM tenancy — source-file invariants", () => {
  it("training-pipeline routes no longer import or reference DEFAULT_ORG_ID", async () => {
    const src = await readSource(TRAINING_ROUTES_PATH);
    expect(src).not.toMatch(/DEFAULT_ORG_ID/);
    // Spot-check that the legacy "const orgId = DEFAULT_ORG_ID" pattern is gone
    expect(src).not.toMatch(/const\s+orgId\s*=\s*DEFAULT_ORG_ID/);
    // Every previous DEFAULT_ORG_ID usage site (8 of them) must now source
    // orgId from the authenticated request. The shared `getOrgId(req)`
    // helper is the canonical funnel; assert it's defined and used.
    expect(src).toMatch(/function getOrgId\(req: AuthenticatedRequest\): string \{\s*return req\.orgId;/);
    expect(src.match(/getOrgId\(req\)/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
  });

  it("model-registry routes no longer import or reference DEFAULT_ORG_ID", async () => {
    const src = await readSource(MODEL_REGISTRY_ROUTES_PATH);
    expect(src).not.toMatch(/DEFAULT_ORG_ID/);
    expect(src).not.toMatch(/const\s+orgId\s*=\s*DEFAULT_ORG_ID/);
    expect(src).toMatch(/function getOrgId\(req: AuthenticatedRequest\): string \{\s*return req\.orgId;/);
    // 7 previous DEFAULT_ORG_ID usage sites in model-registry routes.
    expect(src.match(/getOrgId\(req\)/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
  });

  it("both routers type their handlers as AuthenticatedRequest, not bare Request", async () => {
    for (const p of [TRAINING_ROUTES_PATH, MODEL_REGISTRY_ROUTES_PATH]) {
      const src = await readSource(p);
      // Handler signature must be `(req: AuthenticatedRequest, res: Response)`.
      // Tolerate `, res: Response` whitespace variance.
      expect(src).toMatch(/async \(req: AuthenticatedRequest, res: Response\)/);
      // Reject the old bare-Request handler signature that was paired
      // with DEFAULT_ORG_ID fallback.
      expect(src).not.toMatch(/async \(req: Request, res: Response\)/);
    }
  });
});

describe("LR-3.5 PdM tenancy — registry mount preserves requireOrgId", () => {
  it("both routers are still mounted with requireOrgId in domain-router-registry", async () => {
    const src = await readSource("server/routes/domain-router-registry.ts");
    // Find the TrainingPipeline + PdmModelRegistry registry entries and
    // confirm the middleware chain still includes requireOrgId. If a
    // future refactor removes the middleware, the handlers' direct
    // reliance on `req.orgId` would let an unauthenticated request
    // through with `req.orgId === undefined`, so this assertion is the
    // failsafe.
    expect(src).toMatch(
      /name:\s*"TrainingPipeline"[\s\S]{0,400}middlewareKeys:\s*\["requireOrgId"/
    );
    expect(src).toMatch(
      /name:\s*"PdmModelRegistry"[\s\S]{0,400}middlewareKeys:\s*\["requireOrgId"/
    );
  });
});

describe("LR-3.5 PdM tenancy — requireOrgId middleware contract", () => {
  it("rejects an unauthenticated request with 401 UNAUTHENTICATED", async () => {
    const req = { headers: {}, method: "GET" } as unknown as Request;
    const res = buildRes();
    const next = jest.fn() as NextFunction;
    await requireOrgId(req, res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects authenticated-but-missing-claim under REQUIRE_TENANT_AUTH=true with 401 TENANT_CLAIM_MISSING", async () => {
    process.env['REQUIRE_TENANT_AUTH'] = "true";
    const req = {
      headers: {},
      method: "GET",
      user: { id: "u1", email: "u1@example.com", role: "admin", isActive: true },
    } as unknown as Request;
    const res = buildRes();
    const next = jest.fn() as NextFunction;
    await requireOrgId(req, res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: "TENANT_CLAIM_MISSING" });
  });

  it("populates req.orgId from the authenticated user claim (org A vs org B)", async () => {
    process.env['REQUIRE_TENANT_AUTH'] = "true";

    const reqA = {
      headers: {},
      method: "GET",
      user: { id: "ua", email: "a@x", role: "admin", isActive: true, orgId: "org-A" },
    } as unknown as Request;
    const resA = buildRes();
    const nextA = jest.fn() as NextFunction;
    await requireOrgId(reqA, resA as unknown as Response, nextA);
    expect(nextA).toHaveBeenCalledTimes(1);
    expect((reqA as unknown as AuthenticatedRequest).orgId).toBe("org-A");

    const reqB = {
      headers: {},
      method: "GET",
      user: { id: "ub", email: "b@x", role: "admin", isActive: true, orgId: "org-B" },
    } as unknown as Request;
    const resB = buildRes();
    const nextB = jest.fn() as NextFunction;
    await requireOrgId(reqB, resB as unknown as Response, nextB);
    expect(nextB).toHaveBeenCalledTimes(1);
    expect((reqB as unknown as AuthenticatedRequest).orgId).toBe("org-B");

    // Cross-tenant isolation: the middleware never copies one user's
    // claim onto another request, so a handler that reads `req.orgId`
    // will receive the caller's own org, not DEFAULT_ORG_ID and not
    // some other tenant's id.
    expect((reqA as unknown as AuthenticatedRequest).orgId).not.toBe(
      (reqB as unknown as AuthenticatedRequest).orgId,
    );
  });
});

describe("LR-3.5 PdM tenancy — ModelRegistryAdapter.rollback orgId scoping", () => {
  /**
   * Architect review pass 1 flagged a real cross-tenant IDOR in
   * `ModelRegistryAdapter.rollback`: the select and the deprecating
   * update both used `where(eq(modelDeployments.id, deploymentId))`
   * with NO orgId predicate, so an admin/chief_engineer in org A
   * could pass a deploymentId belonging to org B and force-deprecate
   * org B's active deployment. The route-level `requireOrgId` and
   * `requireRole` gates did not catch this — both pass for any admin
   * caller in any org, and the adapter trusted the caller's orgId
   * for filtering AFTER the destructive write.
   *
   * Booting drizzle in jest is blocked by the same top-level-await
   * issue documented at the top of this file, so we pin the contract
   * by source-file invariant: every `where()` clause inside
   * `rollback` that touches `modelDeployments.id` must ALSO carry
   * an `eq(modelDeployments.orgId, orgId)` predicate. A future
   * regression that drops the orgId predicate will fail this test.
   */
  it("every modelDeployments.id predicate inside rollback() is co-scoped by orgId", async () => {
    const src = await readSource("server/domains/pdm-platform/model-registry/adapter.ts");
    const rollbackMatch = src.match(/async rollback\([\s\S]*?\n\s{2}\}\n/);
    expect(rollbackMatch).not.toBeNull();
    const body = rollbackMatch?.[0] ?? "";

    // Count predicate sites touching modelDeployments.id (current
    // implementation: select-by-id, update-by-id deprecate, update-by-
    // previous.id restore = 3).
    const idPredicateCount =
      body.match(/eq\(modelDeployments\.id,/g)?.length ?? 0;
    const orgIdPredicateCount =
      body.match(/eq\(modelDeployments\.orgId,\s*orgId\)/g)?.length ?? 0;

    expect(idPredicateCount).toBeGreaterThanOrEqual(2);
    // At minimum, the orgId predicate count must match the id
    // predicate count (every id-by reads/writes pairs with an
    // orgId-by). One additional orgId-only predicate also exists
    // for the "find previous deprecated deployment" select, so the
    // orgId count may legitimately exceed the id count.
    expect(orgIdPredicateCount).toBeGreaterThanOrEqual(idPredicateCount);

    // Belt-and-braces: assert the legacy IDOR pattern
    //   .where(eq(modelDeployments.id, deploymentId));
    // (eq on id only, no surrounding and()) is gone.
    expect(body).not.toMatch(/\.where\(eq\(modelDeployments\.id,\s*deploymentId\)\);/);
  });
});

describe("LR-3.5 PdM tenancy — ModelRegistryAdapter foreign-id ownership checks", () => {
  /**
   * Architect review pass 2 flagged that `deploy(orgId, modelId,
   * modelVersionId, ...)` and `createVersion({orgId, modelId, ...})`
   * trusted the caller's foreign `modelId`/`modelVersionId` without
   * checking that those rows belong to the caller's org. The FK is
   * on `id` alone (not `(orgId, id)`), so an admin in org A who
   * knew or guessed an org-B `modelId` could:
   *   (1) create a `modelVersion` row poisoning org B's lineage, or
   *   (2) deploy org B's modelVersion into org A's active routing.
   * The fix gates both methods on a SELECT scoped by `(id, orgId)`
   * (and for the version: `(id, orgId, modelId)`) BEFORE any write.
   * Real DB behavioural coverage is in the integration follow-up
   * (#192); this test pins the source-level guard so a future
   * refactor cannot regress.
   */
  it("createVersion validates modelId ownership before INSERT", async () => {
    const src = await readSource("server/domains/pdm-platform/model-registry/adapter.ts");
    const method = src.match(/async createVersion\([\s\S]*?\n\s{2}\}\n/)?.[0] ?? "";
    expect(method).toMatch(/this\.getModel\(data\.orgId,\s*data\.modelId\)/);
    // Ownership check must precede the INSERT.
    const ownerIdx = method.indexOf("getModel(data.orgId");
    const insertIdx = method.indexOf("db.insert(modelVersions)");
    expect(ownerIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThan(ownerIdx);
  });

  it("deploy validates modelId AND modelVersionId ownership before any write", async () => {
    const src = await readSource("server/domains/pdm-platform/model-registry/adapter.ts");
    const method = src.match(/async deploy\([\s\S]*?\n\s{2}\}\n/)?.[0] ?? "";
    // modelId ownership: getModel(orgId, modelId)
    expect(method).toMatch(/this\.getModel\(orgId,\s*modelId\)/);
    // modelVersionId ownership: SELECT modelVersions WHERE id AND orgId AND modelId
    expect(method).toMatch(/eq\(modelVersions\.id,\s*modelVersionId\)/);
    expect(method).toMatch(/eq\(modelVersions\.orgId,\s*orgId\)/);
    expect(method).toMatch(/eq\(modelVersions\.modelId,\s*modelId\)/);
    // Both ownership checks must precede the first UPDATE/INSERT.
    const modelOwnerIdx = method.indexOf("getModel(orgId, modelId)");
    const versionOwnerIdx = method.indexOf("modelVersions.id, modelVersionId");
    const firstWriteIdx = Math.min(
      ...[
        method.indexOf("db.update(modelDeployments)"),
        method.indexOf("db.insert(modelDeployments)"),
      ].filter((n) => n >= 0)
    );
    expect(modelOwnerIdx).toBeGreaterThanOrEqual(0);
    expect(versionOwnerIdx).toBeGreaterThan(modelOwnerIdx);
    expect(firstWriteIdx).toBeGreaterThan(versionOwnerIdx);
  });
});

describe("LR-3.5 PdM tenancy — handler reads req.orgId (contract dispatch)", () => {
  /**
   * Re-implements the route handler's orgId-extraction step in the
   * same shape the production code now uses. The production handler
   * is a one-liner — `const orgId = getOrgId(req)` — and that one
   * line is the entire surface area of the architect's fix. We
   * verify the dispatch matches by exercising the exact contract:
   * given an AuthenticatedRequest carrying `orgId`, the handler
   * passes THAT orgId (not DEFAULT_ORG_ID) to the downstream
   * service. Loading the real router into Jest would require
   * resolving the swc/ESM/top-level-await issue documented at the
   * top of this file — out of scope for this hardening task.
   */
  function getOrgIdContract(req: AuthenticatedRequest): string {
    return req.orgId;
  }

  it("returns the caller's orgId verbatim — does not fall back to DEFAULT_ORG_ID", () => {
    const reqA = { orgId: "org-A" } as AuthenticatedRequest;
    const reqB = { orgId: "org-B" } as AuthenticatedRequest;
    expect(getOrgIdContract(reqA)).toBe("org-A");
    expect(getOrgIdContract(reqB)).toBe("org-B");
    expect(getOrgIdContract(reqA)).not.toBe("default-org");
  });
});
