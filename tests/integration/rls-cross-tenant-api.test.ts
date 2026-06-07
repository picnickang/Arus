/**
 * Task #104 — Cross-tenant RLS isolation through the live Express path.
 *
 * Task #88's sibling test (`rls-cross-tenant.test.ts`) issues raw `pg`
 * queries directly to confirm the RLS policies in migration 0018. That
 * proves the database is wired correctly but does NOT exercise the path
 * we actually rely on in production:
 *
 *   request → requireOrgId → withDatabaseContext (BEGIN + SET LOCAL)
 *           → tenantContextStore (AsyncLocalStorage)
 *           → `db` Proxy → repository → COMMIT
 *
 * A regression that loses ALS context across an `await` outside a tracked
 * promise chain (e.g. a top-level `setTimeout`/`process.nextTick` in the
 * service layer) would silently fall back to the shared pool-backed
 * `dbInstance` — which has NO pinned `SET LOCAL` — and the raw-SQL test
 * would still pass. This test catches that class of regression by booting
 * a supertest-driven app under `REQUIRE_TENANT_AUTH=true`, mounting the
 * real middleware chain (auth → ALS → pinned tx), and registering the
 * real `/api/equipment` route. Two distinct "tenants" hit the endpoint
 * with their own tokens and each must see only their own org's rows.
 *
 * Skip-conditional: requires a live Postgres reachable via `DATABASE_URL`
 * with migration 0018 applied. Mirrors the same guards as the raw-SQL
 * sibling so the suite is safe to run in environments without the full
 * schema.
 */

// Pinned-RLS env flags MUST be set before importing the db / middleware
// modules — `withDatabaseContext` caches `ENABLE_PG_RLS_CONTEXT` at
// module load, and `db-config` runs its boot gate against
// `REQUIRE_TENANT_AUTH` the first time it's imported.
process.env.REQUIRE_TENANT_AUTH = "true";
process.env.ENABLE_PG_RLS_CONTEXT = "true";

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import request from "supertest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";

const databaseUrl = process.env.DATABASE_URL;

const ORG_A = `t104-a-${Date.now().toString(36)}`;
const ORG_B = `t104-b-${Date.now().toString(36)}`;
const TAG = `task104-rls-${randomUUID()}`;

let pool: Pool | null = null;
let rlsReady = false;
let app: Express | null = null;

async function tableHasRls(client: PoolClient, table: string): Promise<boolean> {
  const r = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
    `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1`,
    [table],
  );
  return r.rows[0]?.relrowsecurity === true && r.rows[0]?.relforcerowsecurity === true;
}

async function insertAsSuperuser(
  client: PoolClient,
  orgId: string,
  name: string,
): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgId]);
    await client.query(
      `INSERT INTO equipment (id, name, org_id, type, status, criticality)
         VALUES ($1, $2, $3, 'pump', 'operational', 'medium')
         ON CONFLICT (id) DO NOTHING`,
      [`${TAG}-${orgId}`, name, orgId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  }
}

beforeAll(async () => {
  if (!databaseUrl) {return;}
  pool = new Pool({ connectionString: databaseUrl, max: 4 });
  const probe = await pool.connect();
  try {
    const r = await probe.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables
         WHERE table_schema = current_schema() AND table_name = 'equipment') AS exists`,
    );
    if (!r.rows[0]?.exists) {return;}
    if (!(await tableHasRls(probe, "equipment"))) {return;}
    rlsReady = true;
    await insertAsSuperuser(probe, ORG_A, "T104 A pump");
    await insertAsSuperuser(probe, ORG_B, "T104 B pump");
  } finally {
    probe.release();
  }

  if (!rlsReady) {return;}

  // Build the minimal Express app that exercises the production path
  // we actually care about: requireOrgId → withDatabaseContext (which
  // opens BEGIN + SET LOCAL on a pinned client and stashes the drizzle
  // handle into `tenantContextStore`) → the real `/api/equipment`
  // route, which calls the unchanged equipment service + repository.
  //
  // We do NOT mount `validateOrgIdHeader` from `server/orgIdValidation.ts`
  // — that legacy single-tenant gate rewrites `req.orgId` to
  // `DEFAULT_ORG_ID` unconditionally, which would collapse both
  // tenants into one and defeat the isolation contract this test
  // exists to prove. The chain under test is the canonical RLS
  // chain: middleware → ALS → `db` Proxy → repository.
  const { requireOrgId } = await import("../../server/middleware/auth");
  const { withDatabaseContext } = await import("../../server/middleware/db-context");
  const { registerEquipmentRoutes } = await import("../../server/domains/equipment/routes");

  app = express();
  app.use(express.json());

  // Test-only auth shim: read `x-test-token` and attach a `req.user`
  // with the tenant's orgId. In production this is what the session /
  // bearer-token middleware does — we skip the cookie/session machinery
  // because the substrate under test is everything AFTER auth.
  const TOKEN_TO_ORG = new Map<string, string>([
    ["tenant-a-token", ORG_A],
    ["tenant-b-token", ORG_B],
  ]);

  app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
    const tokenHeader = req.headers["x-test-token"];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    const orgId = token ? TOKEN_TO_ORG.get(token) : undefined;
    if (orgId) {
      (req as Request & { user?: unknown }).user = {
        id: `user-${orgId}`,
        email: `${orgId}@example.com`,
        role: "admin",
        isActive: true,
        orgId,
      };
    }
    next();
  });

  app.use("/api", requireOrgId);
  app.use("/api", withDatabaseContext);

  // No-op rate limiters — we're not stress-testing throttling here.
  const passthrough = (_req: Request, _res: Response, next: NextFunction) => next();
  registerEquipmentRoutes(app, {
    writeOperationRateLimit: passthrough,
    criticalOperationRateLimit: passthrough,
    generalApiRateLimit: passthrough,
  });
}, 60000);

afterAll(async () => {
  if (!pool) {return;}
  if (rlsReady) {
    const cleanup = await pool.connect();
    try {
      for (const org of [ORG_A, ORG_B]) {
        await cleanup.query("BEGIN");
        await cleanup.query("SELECT set_config('app.current_org_id', $1, true)", [org]);
        await cleanup.query(`DELETE FROM equipment WHERE id = $1`, [`${TAG}-${org}`]);
        await cleanup.query("COMMIT");
      }
    } catch {
      /* best-effort */
    } finally {
      cleanup.release();
    }
  }
  await pool.end();
});

describe("Task #104 — RLS cross-tenant isolation through the live API", () => {
  it("returns 401 when no tenant token is supplied (REQUIRE_TENANT_AUTH=true)", async () => {
    if (!databaseUrl || !rlsReady || !app) {
      console.warn("[rls-cross-tenant-api] skipping — DB / RLS / app not ready");
      return;
    }

    const res = await request(app).get("/api/equipment").send();
    expect(res.status).toBe(401);
  });

  it("tenant A only sees tenant A's equipment", async () => {
    if (!databaseUrl || !rlsReady || !app) {return;}

    const res = await request(app)
      .get("/api/equipment")
      .set("x-test-token", "tenant-a-token")
      .send();

    expect(res.status).toBe(200);
    const body = Array.isArray(res.body) ? res.body : res.body?.items ?? [];
    const fixtureRows = (body as Array<{ id: string; orgId: string }>).filter((row) =>
      row.id?.startsWith(`${TAG}-`),
    );
    const orgIds = fixtureRows.map((r) => r.orgId);
    expect(orgIds).toContain(ORG_A);
    expect(orgIds).not.toContain(ORG_B);
  });

  it("tenant B only sees tenant B's equipment", async () => {
    if (!databaseUrl || !rlsReady || !app) {return;}

    const res = await request(app)
      .get("/api/equipment")
      .set("x-test-token", "tenant-b-token")
      .send();

    expect(res.status).toBe(200);
    const body = Array.isArray(res.body) ? res.body : res.body?.items ?? [];
    const fixtureRows = (body as Array<{ id: string; orgId: string }>).filter((row) =>
      row.id?.startsWith(`${TAG}-`),
    );
    const orgIds = fixtureRows.map((r) => r.orgId);
    expect(orgIds).toContain(ORG_B);
    expect(orgIds).not.toContain(ORG_A);
  });

  it("two concurrent requests under different tenants do not bleed via ALS", async () => {
    // Fires both tenants in parallel so AsyncLocalStorage actually has
    // to keep their contexts separated across the await boundaries
    // inside `withDatabaseContext` + the equipment service.
    if (!databaseUrl || !rlsReady || !app) {return;}

    const [aRes, bRes] = await Promise.all([
      request(app).get("/api/equipment").set("x-test-token", "tenant-a-token").send(),
      request(app).get("/api/equipment").set("x-test-token", "tenant-b-token").send(),
    ]);

    expect(aRes.status).toBe(200);
    expect(bRes.status).toBe(200);

    const aBody = Array.isArray(aRes.body) ? aRes.body : aRes.body?.items ?? [];
    const bBody = Array.isArray(bRes.body) ? bRes.body : bRes.body?.items ?? [];

    const aFixture = (aBody as Array<{ id: string; orgId: string }>).filter((r) =>
      r.id?.startsWith(`${TAG}-`),
    );
    const bFixture = (bBody as Array<{ id: string; orgId: string }>).filter((r) =>
      r.id?.startsWith(`${TAG}-`),
    );

    expect(aFixture.map((r) => r.orgId)).toEqual([ORG_A]);
    expect(bFixture.map((r) => r.orgId)).toEqual([ORG_B]);
  });
});
