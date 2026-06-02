/**
 * Task #299 — Equipment Hub "Acknowledge" action.
 *
 * Pins the route contract for
 *   POST /api/equipment-intelligence/anomalies/:equipmentId/acknowledge
 * at the HTTP boundary, exercising the REAL route handler, the REAL
 * `createGetEquipmentHubUseCase`, and the REAL
 * `PostgresEquipmentHubRepository` — only the Drizzle `db` handle
 * (`server/db-config`) is mocked, so the repository's
 * "acknowledge only an active, *unacknowledged* anomaly" guard and the
 * `acknowledgedBy` / `acknowledgedAt` write are genuinely executed.
 *
 * What is covered (mirrors the task's "Done looks like"):
 *   - a 200 acknowledges the latest active anomaly, deriving
 *     `acknowledgedBy` from the caller and stamping `acknowledgedAt`;
 *   - the "only unacknowledged" guard: when the org-scoped + isNull
 *     SELECT yields no row (already acknowledged, or none), the route
 *     returns 404 and NEVER issues the UPDATE;
 *   - org-scoping: no `orgId` on the request → 403, and a cross-tenant
 *     row (scoped SELECT returns empty) → 404 (no existence leak);
 *   - the `acknowledgedBy` fallback chain (name → email → id → "system");
 *   - param validation (over-long equipmentId → 400).
 *
 * Uses `jest.unstable_mockModule` + dynamic import because the
 * integration suite runs under `--experimental-vm-modules` (ESM), where
 * a hoisted `jest.mock` factory is not invoked — same pattern as
 * `safety-bulletins.test.ts` and `equipment-dependencies-notes-patch.test.ts`.
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
} from "@jest/globals";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import request from "supertest";

const ORG_ID = "org-t299";
const OTHER_ORG_ID = "org-other-t299";
const EQUIP_ID = "equip-t299";

// ---- Drizzle `db` chain mock ----------------------------------------------
// The only chains the acknowledge path exercises:
//   db.select({id}).from(t).where(c).orderBy(o).limit(1)        → guard SELECT
//   db.update(t).set(s).where(c).returning({...})               → write
type Row = Record<string, unknown>;

let selectRows: Row[] = [];
let updateRows: Row[] = [];
const setCalls: Row[] = [];
let selectWhereCount = 0;
let updateWhereCount = 0;

const fakeDb = {
  select: (_cols?: unknown) => ({
    from: (_t: unknown) => ({
      where: (_c: unknown) => {
        selectWhereCount += 1;
        return {
          orderBy: (_o: unknown) => ({
            limit: async (_n: number) => selectRows,
          }),
        };
      },
    }),
  }),
  update: (_t: unknown) => ({
    set: (s: Row) => {
      setCalls.push(s);
      return {
        where: (_c: unknown) => {
          updateWhereCount += 1;
          return { returning: async (_cols?: unknown) => updateRows };
        },
      };
    },
  }),
};

jest.unstable_mockModule("../../server/db-config", () => ({
  __esModule: true,
  db: fakeDb,
}));

const PATH = `/api/equipment-intelligence/anomalies/${EQUIP_ID}/acknowledge`;

type AuthUser = { id?: string; name?: string; email?: string };

// Per-request injection of (orgId, user) so each test can drive the
// auth context the route reads (`req.orgId`, `req.user`).
let currentOrgId: string | null = ORG_ID;
let currentUser: AuthUser | null = { id: "user-1", name: "Chief Engineer" };

let app: Express;
let mountError: string | undefined;

beforeAll(async () => {
  let router: express.Router;
  try {
    router = (await import(
      "../../server/domains/equipment-intelligence/interfaces/routes"
    )).default;
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    return;
  }

  app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as Request & { user?: AuthUser; orgId?: string };
    if (currentUser) {
      r.user = currentUser;
    }
    if (currentOrgId) {
      r.orgId = currentOrgId;
    }
    next();
  });
  app.use("/api/equipment-intelligence", router);
});

beforeEach(() => {
  selectRows = [];
  updateRows = [];
  setCalls.length = 0;
  selectWhereCount = 0;
  updateWhereCount = 0;
  currentOrgId = ORG_ID;
  currentUser = { id: "user-1", name: "Chief Engineer" };
});

function ackedRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 42,
    anomalyType: "bearing_temp",
    sensorType: "temperature",
    severity: "high",
    detectionTimestamp: new Date("2026-06-01T10:00:00.000Z"),
    acknowledgedBy: "Chief Engineer",
    acknowledgedAt: new Date("2026-06-02T08:00:00.000Z"),
    ...overrides,
  };
}

describe("Task #299 — acknowledge route mounted", () => {
  it("registers without error", () => {
    expect(mountError).toBeUndefined();
  });
});

describe("POST acknowledge — happy path", () => {
  it("acknowledges the active anomaly, stamping acknowledgedBy + acknowledgedAt", async () => {
    if (mountError) throw new Error(mountError);
    selectRows = [{ id: 42 }]; // an unacknowledged anomaly exists
    updateRows = [ackedRow()];

    const res = await request(app).post(PATH).send();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 42,
      acknowledged: true,
      acknowledgedBy: "Chief Engineer",
    });
    expect(typeof res.body.acknowledgedAt).toBe("string");

    // The write happened exactly once, carrying the caller + a Date stamp.
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]).toMatchObject({ acknowledgedBy: "Chief Engineer" });
    expect(setCalls[0]!.acknowledgedAt).toBeInstanceOf(Date);
    expect(updateWhereCount).toBe(1);
  });

  it("derives acknowledgedBy via the name → email → id → 'system' chain", async () => {
    if (mountError) throw new Error(mountError);

    // email fallback (no name)
    currentUser = { id: "u2", email: "eng@example.com" };
    selectRows = [{ id: 7 }];
    updateRows = [ackedRow({ id: 7, acknowledgedBy: "eng@example.com" })];
    let res = await request(app).post(PATH).send();
    expect(res.status).toBe(200);
    expect(setCalls[0]).toMatchObject({ acknowledgedBy: "eng@example.com" });

    // id fallback (no name/email)
    setCalls.length = 0;
    currentUser = { id: "u3" };
    selectRows = [{ id: 8 }];
    updateRows = [ackedRow({ id: 8, acknowledgedBy: "u3" })];
    res = await request(app).post(PATH).send();
    expect(res.status).toBe(200);
    expect(setCalls[0]).toMatchObject({ acknowledgedBy: "u3" });

    // "system" fallback (no user at all, orgId still present)
    setCalls.length = 0;
    currentUser = null;
    selectRows = [{ id: 9 }];
    updateRows = [ackedRow({ id: 9, acknowledgedBy: "system" })];
    res = await request(app).post(PATH).send();
    expect(res.status).toBe(200);
    expect(setCalls[0]).toMatchObject({ acknowledgedBy: "system" });
  });
});

describe("POST acknowledge — 'only unacknowledged' guard", () => {
  it("returns 404 and never updates when no active unacknowledged anomaly exists", async () => {
    if (mountError) throw new Error(mountError);
    // The org-scoped + isNull(acknowledgedAt) SELECT yields nothing —
    // production-equivalent of "already acknowledged" or "none at all".
    selectRows = [];

    const res = await request(app).post(PATH).send();

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "No active anomaly to acknowledge" });
    // The guard SELECT ran, but the UPDATE must not have.
    expect(selectWhereCount).toBe(1);
    expect(setCalls).toHaveLength(0);
    expect(updateWhereCount).toBe(0);
  });

  it("returns 404 if the UPDATE returns no row (lost race)", async () => {
    if (mountError) throw new Error(mountError);
    selectRows = [{ id: 42 }];
    updateRows = []; // someone else acknowledged between SELECT and UPDATE

    const res = await request(app).post(PATH).send();

    expect(res.status).toBe(404);
    expect(setCalls).toHaveLength(1);
  });
});

describe("POST acknowledge — org scoping", () => {
  it("returns 403 when the request carries no orgId", async () => {
    if (mountError) throw new Error(mountError);
    currentOrgId = null;

    const res = await request(app).post(PATH).send();

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "Organization ID is required" });
    expect(setCalls).toHaveLength(0);
  });

  it("treats a cross-tenant anomaly as not found (scoped SELECT empty → 404)", async () => {
    if (mountError) throw new Error(mountError);
    // Another org's row is invisible under this org's scope: the
    // (orgId, equipmentId, isNull) SELECT returns no rows → 404.
    currentOrgId = OTHER_ORG_ID;
    selectRows = [];

    const res = await request(app).post(PATH).send();

    expect(res.status).toBe(404);
    expect(setCalls).toHaveLength(0);
  });
});

describe("POST acknowledge — param validation", () => {
  it("rejects an over-long equipmentId with 400 and never touches the DB", async () => {
    if (mountError) throw new Error(mountError);
    const longId = "x".repeat(256); // schema cap is 255
    const res = await request(app)
      .post(`/api/equipment-intelligence/anomalies/${longId}/acknowledge`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid equipment ID" });
    expect(selectWhereCount).toBe(0);
    expect(setCalls).toHaveLength(0);
  });
});
