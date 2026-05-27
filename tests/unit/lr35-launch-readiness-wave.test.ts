/**
 * LR-3.5 Launch Readiness Wave — wave-level integrity pins
 *
 * Most of the wave (SEC-1/2/3, TEN-1, TEN-5, OBJ-2, DB-2, TX-1,
 * AUD-1, AUD-2, PERF-1) is already covered by sibling tests
 * (lr35-role-auth-dev-bypass, lr35-object-storage-sniff,
 * lr35-wo-event-post-commit, lr35-audit-hash-orgid, lr35-pdm-
 * tenancy-hardening, the 0024 migration test).
 *
 * This file closes the two gaps that landed in this wave:
 *   - TX-2 on the remaining ML mutation routes
 *     (`/ml/train`, `/ml/models/:id/archive`, `DELETE /ml/models/:id`)
 *     which previously had no idempotency middleware and would
 *     duplicate work / overwrite timestamps / return 404 on a
 *     network-level retry.
 *   - V2 (ML-2) marker on the one real pgvector nearest-neighbour
 *     query (`semantic-cache.ts`) — pin that the org-id filter and
 *     the `<=>` scan live in the same SELECT so the top-K is
 *     pre-filtered by Postgres, never post-filtered by JS.
 *
 * Source-scan rather than runtime: the idempotency middleware
 * already has its own behavioural tests; what we need to pin is
 * "the routes are wired through it" — exactly what a source-scan
 * does well and what a runtime test could only assert by
 * re-mounting the router with a mock DB.
 */
import { readFile } from "fs/promises";
import { resolve } from "path";

// Jest is invoked from the repo root (both under CJS swc-jest and under
// `node --experimental-vm-modules` ESM jest). Anchoring on `process.cwd()`
// avoids the `__dirname` / `import.meta.url` split that breaks one or
// the other runner.
const REPO_ROOT = process.cwd();

async function loadSource(relativePath: string): Promise<string> {
  return readFile(resolve(REPO_ROOT, relativePath), "utf8");
}

describe("LR-3.5 / TX-2 — ML mutation routes mount idempotencyMiddleware", () => {
  const ROUTES_PATH = "server/ml-routes/model-routes.ts";

  it("/ml/train carries idempotencyMiddleware({ required: true })", async () => {
    const src = await loadSource(ROUTES_PATH);
    // Task #200: training inserts an ml_models row + enqueues a job; a
    // caller that forgets the Idempotency-Key header would create
    // duplicate training rows. Require the key up-front.
    expect(src).toMatch(
      /router\.post\(\s*"\/ml\/train",\s*idempotencyMiddleware\(\{\s*required:\s*true\s*\}\)/,
    );
  });

  it("/ml/models/:id/archive carries idempotencyMiddleware({ required: true })", async () => {
    const src = await loadSource(ROUTES_PATH);
    expect(src).toMatch(
      /router\.post\(\s*"\/ml\/models\/:id\/archive",\s*requireRole\("admin",\s*"chief_engineer"\),\s*idempotencyMiddleware\(\{\s*required:\s*true\s*\}\)/,
    );
  });

  it("DELETE /ml/models/:id carries idempotencyMiddleware({ required: true })", async () => {
    const src = await loadSource(ROUTES_PATH);
    expect(src).toMatch(
      /router\.delete\(\s*"\/ml\/models\/:id",\s*requireRole\("admin",\s*"chief_engineer"\),\s*idempotencyMiddleware\(\{\s*required:\s*true\s*\}\)/,
    );
  });

  it("/ml/models/:id/deploy + /promote + /rollback require an Idempotency-Key", async () => {
    // Task #200: these high-impact lifecycle mutations should reject a
    // request that arrives without an Idempotency-Key, not silently
    // proceed.
    const src = await loadSource(ROUTES_PATH);
    expect(src).toMatch(/"\/ml\/models\/:id\/deploy"[\s\S]{0,600}?idempotencyMiddleware\(\{\s*required:\s*true\s*\}\)/);
    expect(src).toMatch(/"\/ml\/models\/:id\/promote"[\s\S]{0,600}?idempotencyMiddleware\(\{\s*required:\s*true\s*\}\)/);
    expect(src).toMatch(/"\/ml\/models\/:id\/rollback"[\s\S]{0,600}?idempotencyMiddleware\(\{\s*required:\s*true\s*\}\)/);
  });
});

describe("LR-3.5 / TX-2 (Task #207) — PO mutation routes mount idempotencyMiddleware", () => {
  // The four mutating PO endpoints insert purchaseOrderEvents audit rows
  // and (for /fulfill-pr) decrement inventory via fulfillItem. Without
  // idempotency, a replayed POST from the offline outbox duplicates the
  // event trail and risks double-side-effects. Non-required mount so
  // legacy callers without a key still pass through (matches the WO
  // complete-with-feedback / cancel mount style).
  const PO_ROUTES_PATH = "server/purchasing/po-routes.ts";

  it("POST /:id/receive carries idempotencyMiddleware after requireOrgId, before writeLimit", async () => {
    const src = await loadSource(PO_ROUTES_PATH);
    expect(src).toMatch(
      /router\.post\(\s*"\/:id\/receive",\s*requireOrgId,\s*idempotencyMiddleware\(\),\s*writeLimit/,
    );
  });

  it("POST /:id/reject-items carries idempotencyMiddleware after requireOrgId, before writeLimit", async () => {
    const src = await loadSource(PO_ROUTES_PATH);
    expect(src).toMatch(
      /router\.post\(\s*"\/:id\/reject-items",\s*requireOrgId,\s*idempotencyMiddleware\(\),\s*writeLimit/,
    );
  });

  it("PATCH /:id/items/:itemId carries idempotencyMiddleware after requireOrgId, before writeLimit", async () => {
    const src = await loadSource(PO_ROUTES_PATH);
    expect(src).toMatch(
      /router\.patch\(\s*"\/:id\/items\/:itemId",\s*requireOrgId,\s*idempotencyMiddleware\(\),\s*writeLimit/,
    );
  });

  it("POST /:id/fulfill-pr carries idempotencyMiddleware after requireOrgId, before writeLimit", async () => {
    const src = await loadSource(PO_ROUTES_PATH);
    expect(src).toMatch(
      /router\.post\(\s*"\/:id\/fulfill-pr",\s*requireOrgId,\s*idempotencyMiddleware\(\),\s*writeLimit/,
    );
  });
});

describe("Task #200 — idempotencyMiddleware({ required: true }) rejects missing key with 400", () => {
  it("returns 400 + IDEMPOTENCY_KEY_REQUIRED when no header / clientMutationId is present", async () => {
    const { idempotencyMiddleware } = await import("../../server/middleware/idempotency");
    const mw = idempotencyMiddleware({ required: true });

    const req = { headers: {}, body: {}, method: "POST", path: "/ml/train" } as unknown as import("express").Request;
    let statusCode = 0;
    let jsonBody: unknown;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        jsonBody = body;
        return this;
      },
    } as unknown as import("express").Response;
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    mw(req, res, next);

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(400);
    expect(jsonBody).toEqual({
      error: {
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Idempotency-Key header is required for this endpoint",
      },
    });
  });
});

describe("LR-3.5 / V2 (ML-2) — RAG vector search pre-filters by org_id", () => {
  it("semantic-cache.ts keeps `WHERE org_id` + `<=>` + `ORDER BY ... LIMIT` in ONE statement", async () => {
    const src = await loadSource("server/services/rag/semantic-cache.ts");
    // Pull out the SELECT that performs the nearest-neighbour scan.
    // It must contain all four ingredients: the <=> operator, the
    // org_id predicate, the ORDER BY <=>, and the LIMIT — splitting
    // any of these off into a separate query would mean the org
    // filter no longer pre-filters the top-K.
    const m = src.match(
      /db\.execute<[^>]*>\(\s*sql`([\s\S]+?)`\s*\)/,
    );
    expect(m).not.toBeNull();
    const query = m![1]!;
    expect(query).toMatch(/<=>/);
    expect(query).toMatch(/WHERE\s+org_id\s*=\s*\$\{orgId\}/i);
    expect(query).toMatch(/ORDER BY[^;]+<=>/);
    expect(query).toMatch(/LIMIT\s+\d+/i);
    // And the marker that documents the contract is in place so a
    // refactor that drops it gets caught in review.
    expect(src).toContain("LR-3.5 / V2 (ML-2)");
  });

  it("vector-search-service.ts stub documents the forward-safety contract", async () => {
    const src = await loadSource("server/vector-search-service.ts");
    expect(src).toContain("LR-3.5 / V2 (ML-2)");
    // The stub must continue to return [] — anything else without
    // an orgId-filtered SQL would be a regression.
    expect(src).toMatch(/return\s*\[\]/);
  });
});

describe("LR-3.5 wave — already-shipped items still in place (regression guards)", () => {
  it("SEC-1: role-auth.ts has no NODE_ENV bypass and uses RBAC_DEV_NO_AUTH gate", async () => {
    const src = await loadSource("server/middleware/role-auth.ts");
    expect(src).toContain("LR-3.5 / SEC-1");
    expect(src).toContain("RBAC_DEV_NO_AUTH");
    // The previous footgun was `NODE_ENV === "development"` short-
    // circuiting the role check. That string must not reappear as a
    // bypass condition.
    expect(src).not.toMatch(/NODE_ENV[^\n]*===[^\n]*"development"[^\n]*next\(\)/);
  });

  it("SEC-2: admin auth-routes uses constant-time setup-token compare", async () => {
    const src = await loadSource("server/domains/system-admin/routes/auth-routes.ts");
    expect(src).toContain("LR-3.5 / SEC-2");
    expect(src).toContain("constantTimeEqualString");
    expect(src).toContain("crypto.timingSafeEqual");
    // The previous bug was `provided === configuredToken` directly in
    // hasValidSetupToken. Make sure that exact pattern doesn't return.
    expect(src).not.toMatch(/provided\s*===\s*configuredToken/);
  });

  it("SEC-3: rag-security-routes uses requireAdminAuth on mutating endpoints", async () => {
    const src = await loadSource("server/routes/rag-security-routes.ts");
    expect(src).toContain("LR-3.5 / SEC-3");
    // The PUT config endpoint is the canonical mutating route — it
    // MUST sit behind requireAdminAuth.
    expect(src).toMatch(
      /app\.put\([\s\S]{0,80}?"\/api\/rag\/security\/config",[\s\S]{0,80}?requireAdminAuth/,
    );
    // The other mutating endpoints listed in the SEC-3 brief
    // (audit, sanitize, validate-file) must also sit behind it.
    expect(src).toMatch(/"\/api\/rag\/security\/test\/sanitize",[\s\S]{0,80}?requireAdminAuth/);
    expect(src).toMatch(/"\/api\/rag\/security\/test\/validate-file",[\s\S]{0,80}?requireAdminAuth/);
  });

  it("TEN-1: GET /api/maintenance-schedules carries requireOrgId", async () => {
    const src = await loadSource("server/domains/maintenance/interfaces/routes.ts");
    expect(src).toContain("LR-3.5 / TEN-1");
    expect(src).toMatch(
      /app\.get\(\s*"\/api\/maintenance-schedules",\s*requireOrgId/,
    );
  });

  it("OBJ-2 / TEN-5: objectStorage.downloadObject sniffs MIME + emits nosniff + accepts auditCtx.orgId", async () => {
    const src = await loadSource("server/objectStorage.ts");
    expect(src).toContain("LR-3.5 / OBJ-2 + TEN-5");
    expect(src).toContain("sniffMimeFamily");
    expect(src).toContain("pickSafeContentType");
    expect(src).toContain("X-Content-Type-Options");
    expect(src).toMatch(/auditCtx\?:\s*\{[^}]*orgId\?/);
  });

  it("DB-2: db-telemetry.ts uses onConflictDoNothing on the natural key", async () => {
    const src = await loadSource("server/db/telemetry/db-telemetry.ts");
    expect(src).toContain("LR-3.5");
    expect(src).toContain("onConflictDoNothing");
  });

  it("AUD-1: deleteComplianceFinding soft-archives instead of DELETE", async () => {
    const src = await loadSource("server/db/compliance/db-compliance.ts");
    expect(src).toContain("LR-3.5");
    // The previous implementation did `db.delete(complianceFindings)`.
    // After AUD-1 it should be an UPDATE setting status='archived'
    // (raw SQL form: `SET status = 'archived'`).
    expect(src).toMatch(/SET[\s\S]{0,40}?status\s*=\s*['"]archived['"]/i);
    expect(src).toMatch(/UPDATE\s+compliance_findings/i);
  });

  it("AUD-2: computeAuditHash includes orgId in the hash input", async () => {
    const src = await loadSource("server/compliance/immutable-audit/hashing.ts");
    expect(src).toContain("LR-3.5");
    // The hashed payload must reference orgId; sibling test
    // lr35-audit-hash-orgid.test.ts pins the runtime distinctness.
    expect(src).toMatch(/orgId/);
  });

  it("PERF-1: crew-compliance-generator pulls certifications in one fetch, not per-crew", async () => {
    const src = await loadSource(
      "server/domains/scheduled-reports/generators/crew-compliance-generator.ts",
    );
    expect(src).toContain("LR-3.5");
    // The fix replaces a per-crew loop with a single org-scoped call.
    expect(src).toMatch(/getCrewCertifications\(\s*undefined,\s*orgId\s*\)/);
    // And the legacy "for (const crew of ...)" loop that wrapped the
    // per-member fetch should be gone.
    expect(src).not.toMatch(
      /for\s*\([^)]+of\s+\w*[Cc]rew\w*\)\s*\{[^}]*getCrewCertifications/,
    );
  });
});
