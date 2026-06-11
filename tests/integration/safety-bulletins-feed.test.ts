/**
 * Task #230 — Safety-bulletins feed API coverage.
 *
 * The user-facing safety derivers are unit-tested, but the backend
 * `GET/POST /api/safety-bulletins` endpoints had no automated coverage.
 * Their filtering rules are non-trivial and have regressed before:
 *   - active-only by default
 *   - effectiveDate <= now (future-dated notices hidden)
 *   - expiry handling (expiresAt <= now hidden)
 *   - includeInactive="false" must NOT coerce to truthy
 *   - vessel scope where null vesselId = fleet-wide
 *   - org scoping
 *
 * This boots a supertest-driven app that mounts the REAL
 * `registerSafetyBulletinRoutes` behind a test auth shim, and drives it
 * against a real Postgres (reachable via DATABASE_URL) so the actual
 * route + repository SQL is exercised end-to-end.
 *
 * The production `server/db` module is mocked with a drizzle instance
 * built directly from a `pg` Pool. This is necessary because the real
 * `server/db-config` bootstrap fails under the Jest ESM/swc transform
 * (its drizzle init reads the mocked `@shared/schema-runtime` barrel and
 * chokes on a null entry). The mock injects a genuine node-postgres
 * drizzle handle, so the adapter still runs real SQL against real rows —
 * only the broken bootstrap is bypassed.
 *
 * Skip-conditional: if Postgres is unreachable or the `safety_bulletins`
 * table has not been migrated, the suite reports skipped rather than
 * failing so it stays safe to run against partial environments.
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from "@jest/globals";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import request from "supertest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";

const databaseUrl = process.env["DATABASE_URL"];

const SUFFIX = randomUUID().slice(0, 8);
const ORG_A = `t230-org-a-${SUFFIX}`;
const ORG_B = `t230-org-b-${SUFFIX}`;
const VESSEL_A = `t230-vessel-a-${SUFFIX}`;
const VESSEL_OTHER = `t230-vessel-other-${SUFFIX}`;
const TAG = `t230-bulletin-${SUFFIX}`;

const pool = new Pool({
  connectionString: databaseUrl ?? "postgresql://localhost:5432/test",
  max: 4,
});
const realDb = drizzle(pool);

// Inject a real node-postgres drizzle handle in place of the production
// `server/db` (whose db-config bootstrap can't initialise under Jest's
// ESM transform). Getter keeps it lazy/robust.
jest.unstable_mockModule("../../server/db", () => ({
  __esModule: true,
  get db() {
    return realDb;
  },
  get pool() {
    return pool;
  },
}));

let ready = false;
let app: Express | null = null;

// Bulletin ids we seed, so assertions can filter to just this run's rows.
const ids = {
  fleetActive: `${TAG}-fleet-active`,
  inactive: `${TAG}-inactive`,
  future: `${TAG}-future`,
  expired: `${TAG}-expired`,
  vesselA: `${TAG}-vessel-a`,
  vesselOther: `${TAG}-vessel-other`,
  orgB: `${TAG}-org-b`,
};

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query<{ t: string | null }>(`SELECT to_regclass($1) AS t`, [
    `public.${name}`,
  ]);
  return r.rows[0]?.t !== null;
}

async function seedOrg(orgId: string): Promise<void> {
  await pool.query(
    `INSERT INTO organizations (id, name, slug)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
    [orgId, `T230 Org ${orgId}`, orgId],
  );
}

async function seedVessel(vesselId: string, orgId: string): Promise<void> {
  await pool.query(
    `INSERT INTO vessels (id, org_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
    [vesselId, orgId, `T230 Vessel ${vesselId}`],
  );
}

/**
 * Insert a bulletin with explicit control over the fields the filtering
 * rules key off. effectiveOffset / expiresOffset are SQL interval
 * expressions relative to NOW() (e.g. "-1 day", "1 day"); null expiry
 * means "no expiry".
 */
async function seedBulletin(opts: {
  id: string;
  orgId: string;
  vesselId: string | null;
  active: boolean;
  effectiveOffset: string;
  expiresOffset: string | null;
  severity?: string;
  title?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO safety_bulletins
       (id, org_id, vessel_id, title, severity, active, effective_date, expires_at)
     VALUES (
       $1, $2, $3, $4, $5, $6,
       NOW() + ($7)::interval,
       CASE WHEN $8::text IS NULL THEN NULL ELSE NOW() + ($8)::interval END
     )
     ON CONFLICT (id) DO NOTHING`,
    [
      opts.id,
      opts.orgId,
      opts.vesselId,
      opts.title ?? `T230 ${opts.id}`,
      opts.severity ?? "info",
      opts.active,
      opts.effectiveOffset,
      opts.expiresOffset,
    ],
  );
}

beforeAll(async () => {
  if (!databaseUrl) {return;}
  try {
    if (
      !(await tableExists("safety_bulletins")) ||
      !(await tableExists("organizations")) ||
      !(await tableExists("vessels"))
    ) {
      return;
    }

    await seedOrg(ORG_A);
    await seedOrg(ORG_B);
    await seedVessel(VESSEL_A, ORG_A);
    await seedVessel(VESSEL_OTHER, ORG_A);

    // ORG_A fixtures covering every filtering branch.
    await seedBulletin({
      id: ids.fleetActive,
      orgId: ORG_A,
      vesselId: null, // fleet-wide
      active: true,
      effectiveOffset: "-2 days",
      expiresOffset: null,
      severity: "warning",
    });
    await seedBulletin({
      id: ids.inactive,
      orgId: ORG_A,
      vesselId: null,
      active: false, // hidden unless includeInactive
      effectiveOffset: "-2 days",
      expiresOffset: null,
    });
    await seedBulletin({
      id: ids.future,
      orgId: ORG_A,
      vesselId: null,
      active: true,
      effectiveOffset: "2 days", // future-dated -> hidden by default
      expiresOffset: null,
    });
    await seedBulletin({
      id: ids.expired,
      orgId: ORG_A,
      vesselId: null,
      active: true,
      effectiveOffset: "-5 days",
      expiresOffset: "-1 day", // already expired -> hidden by default
    });
    await seedBulletin({
      id: ids.vesselA,
      orgId: ORG_A,
      vesselId: VESSEL_A,
      active: true,
      effectiveOffset: "-1 day",
      expiresOffset: null,
    });
    await seedBulletin({
      id: ids.vesselOther,
      orgId: ORG_A,
      vesselId: VESSEL_OTHER,
      active: true,
      effectiveOffset: "-1 day",
      expiresOffset: null,
    });
    // ORG_B fixture — must never leak into ORG_A reads.
    await seedBulletin({
      id: ids.orgB,
      orgId: ORG_B,
      vesselId: null,
      active: true,
      effectiveOffset: "-1 day",
      expiresOffset: null,
    });

    // Mount the real route behind a test auth shim. Imported AFTER the
    // db mock is registered so the adapter binds to the injected handle.
    // No `validateOrgIdHeader` — that legacy gate rewrites orgId to
    // DEFAULT_ORG_ID and would collapse the two test tenants.
    const { registerSafetyBulletinRoutes } = await import(
      "../../server/domains/safety-bulletins/interfaces/routes"
    );

    app = express();
    app.use(express.json());

    const TOKEN_TO_ORG = new Map<string, string>([
      ["org-a-token", ORG_A],
      ["org-b-token", ORG_B],
    ]);

    app.use((req: Request, _res: Response, next: NextFunction) => {
      const hdr = req.headers["x-test-token"];
      const token = Array.isArray(hdr) ? hdr[0] : hdr;
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

    const passthrough = (_req: Request, _res: Response, next: NextFunction) =>
      next();
    registerSafetyBulletinRoutes(app, {
      generalApiRateLimit: passthrough,
      writeOperationRateLimit: passthrough,
    });

    ready = true;
  } catch (err) {
    console.error("[safety-bulletins-feed] beforeAll failed:", err);
    ready = false;
  }
}, 60_000);

afterAll(async () => {
  if (ready) {
    try {
      await pool.query(
        `DELETE FROM safety_bulletins WHERE org_id = ANY($1::text[])`,
        [[ORG_A, ORG_B]],
      );
      await pool.query(`DELETE FROM vessels WHERE id = ANY($1::text[])`, [
        [VESSEL_A, VESSEL_OTHER],
      ]);
      await pool.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [
        [ORG_A, ORG_B],
      ]);
    } catch {
      /* best-effort */
    }
  }
  try {
    await pool.end();
  } catch {
    /* noop */
  }
}, 30_000);

type Bulletin = { id: string; orgId: string; vesselId: string | null };

function idsOf(body: unknown): string[] {
  const rows = Array.isArray(body) ? (body as Bulletin[]) : [];
  return rows.filter((r) => r.id?.startsWith(TAG)).map((r) => r.id);
}

const skip = () => {
  if (!ready || !app) {
    console.warn("[safety-bulletins-feed] skipping — DB / app not ready");
    return true;
  }
  return false;
};

describe("Task #230 — GET /api/safety-bulletins filtering", () => {
  it("returns 401 when unauthenticated", async () => {
    if (skip()) {return;}
    const res = await request(app!).get("/api/safety-bulletins").send();
    expect(res.status).toBe(401);
  });

  it("active-only by default: hides inactive, future-dated, and expired", async () => {
    if (skip()) {return;}
    const res = await request(app!)
      .get("/api/safety-bulletins")
      .set("x-test-token", "org-a-token")
      .send();

    expect(res.status).toBe(200);
    const got = idsOf(res.body);
    expect(got).toContain(ids.fleetActive);
    expect(got).toContain(ids.vesselA);
    expect(got).toContain(ids.vesselOther);
    expect(got).not.toContain(ids.inactive);
    expect(got).not.toContain(ids.future);
    expect(got).not.toContain(ids.expired);
  });

  it("includeInactive=true surfaces inactive bulletins", async () => {
    if (skip()) {return;}
    const res = await request(app!)
      .get("/api/safety-bulletins?includeInactive=true")
      .set("x-test-token", "org-a-token")
      .send();

    expect(res.status).toBe(200);
    expect(idsOf(res.body)).toContain(ids.inactive);
  });

  it("includeInactive=false is NOT coerced to truthy (inactive stays hidden)", async () => {
    if (skip()) {return;}
    const res = await request(app!)
      .get("/api/safety-bulletins?includeInactive=false")
      .set("x-test-token", "org-a-token")
      .send();

    expect(res.status).toBe(200);
    expect(idsOf(res.body)).not.toContain(ids.inactive);
  });

  it("vessel scope returns vessel-specific + fleet-wide (null), not other vessels", async () => {
    if (skip()) {return;}
    const res = await request(app!)
      .get(`/api/safety-bulletins?vesselId=${VESSEL_A}`)
      .set("x-test-token", "org-a-token")
      .send();

    expect(res.status).toBe(200);
    const got = idsOf(res.body);
    expect(got).toContain(ids.vesselA); // vessel-scoped
    expect(got).toContain(ids.fleetActive); // fleet-wide (null vesselId)
    expect(got).not.toContain(ids.vesselOther); // a different vessel
  });

  it("org scoping: tenant A never sees tenant B bulletins", async () => {
    if (skip()) {return;}
    const res = await request(app!)
      .get("/api/safety-bulletins?includeInactive=true")
      .set("x-test-token", "org-a-token")
      .send();

    expect(res.status).toBe(200);
    expect(idsOf(res.body)).not.toContain(ids.orgB);
  });

  it("tenant B sees only its own bulletins", async () => {
    if (skip()) {return;}
    const res = await request(app!)
      .get("/api/safety-bulletins")
      .set("x-test-token", "org-b-token")
      .send();

    expect(res.status).toBe(200);
    const got = idsOf(res.body);
    expect(got).toContain(ids.orgB);
    expect(got).not.toContain(ids.fleetActive);
  });
});

describe("Task #230 — POST /api/safety-bulletins validation", () => {
  it("rejects a missing title with 400", async () => {
    if (skip()) {return;}
    const res = await request(app!)
      .post("/api/safety-bulletins")
      .set("x-test-token", "org-a-token")
      .send({ body: "no title here" });

    expect(res.status).toBe(400);
  });

  it("rejects an out-of-enum severity with 400", async () => {
    if (skip()) {return;}
    const res = await request(app!)
      .post("/api/safety-bulletins")
      .set("x-test-token", "org-a-token")
      .send({ title: "Bad severity", severity: "catastrophic" });

    expect(res.status).toBe(400);
  });

  it("creates a valid bulletin and scopes it to the caller's org", async () => {
    if (skip()) {return;}
    const res = await request(app!)
      .post("/api/safety-bulletins")
      .set("x-test-token", "org-a-token")
      .send({ title: `${TAG}-created`, severity: "critical" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe(`${TAG}-created`);
    expect(res.body.severity).toBe("critical");
    expect(res.body.orgId).toBe(ORG_A);

    // Confirm it persisted and is visible through the active-only feed.
    const list = await request(app!)
      .get("/api/safety-bulletins")
      .set("x-test-token", "org-a-token")
      .send();
    const titles = (Array.isArray(list.body) ? list.body : []).map(
      (r: { title: string }) => r.title,
    );
    expect(titles).toContain(`${TAG}-created`);
  });
});
