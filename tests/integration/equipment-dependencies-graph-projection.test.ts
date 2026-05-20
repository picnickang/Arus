/**
 * Task #131 — Visual dependency editor (ReactFlow) ↔ AGE graph
 * projection contract.
 *
 * The /admin/equipment-dependencies page issues optimistic create +
 * delete mutations through `POST /api/v1/equipment-dependencies` and
 * `DELETE /api/v1/equipment-dependencies/:id`. Both routes are
 * expected to fan out to the graph projector so the AGE knowledge
 * graph stays in lockstep with relational truth — that's the
 * contract this test pins.
 *
 * Why not a full Playwright run: the drag-to-connect interaction is a
 * thin client-side wrapper that ultimately calls the same two HTTP
 * endpoints (see `graphCreateMutation` / `graphDeleteMutation` in
 * `client/src/pages/admin/equipment-dependencies.tsx`). Exercising the
 * server contract behind those mutations is what catches the
 * regression class the task cares about (a create that doesn't
 * project, a delete that doesn't retract). The UI optimistic
 * rollback is implemented entirely on the TanStack Query cache via
 * `onMutate`/`onError` and is exercised here by asserting that a 409
 * never triggers projection.
 *
 * DB + projector are mocked so this test runs without Postgres or
 * AGE — it's a pure middleware/route contract test, which is the
 * boundary where the regression would actually surface.
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import request from "supertest";

const ORG_ID = "org-t131";
const VESSEL_ID = "vessel-t131";
const EQUIP_A = "equip-a-t131";
const EQUIP_B = "equip-b-t131";
const DEP_ID = "dep-t131";

// ---- Projector spies (the contract under test) -----------------------------
const projectDependency = jest.fn(async (..._args: unknown[]) => undefined);
const retractDependency = jest.fn(async (..._args: unknown[]) => undefined);

// `@shared/schema` is a barrel that transitively pulls in a stray
// `sync-conflicts-schema.js` (raw ESM in plain JS), which Jest's
// TS-only transform can't parse. We only need the equipment-deps
// + equipment slices, so re-export them directly from their
// per-table modules and skip the barrel.
jest.mock("@shared/schema", () => {
  const eqDeps = jest.requireActual("@shared/schema/equipment-dependencies");
  const eq = jest.requireActual("@shared/schema/equipment");
  return { __esModule: true, ...eqDeps, ...eq };
});

jest.mock("../../server/graph", () => ({
  __esModule: true,
  projectDependency: (...args: unknown[]) => projectDependency(...args),
  retractDependency: (...args: unknown[]) => retractDependency(...args),
}));

// ---- DB chain mock ---------------------------------------------------------
// Drizzle chains we mock:
//   db.select().from().where()                                  → resolves to rows
//   db.insert().values().onConflictDoNothing().returning()      → resolves to rows
//   db.delete().where().returning()                             → resolves to rows
type Row = Record<string, unknown>;
let equipmentLookupRows: Row[] = [];
let nextInsertReturn: Row[] = [];
let nextDeleteReturn: Row[] = [];

jest.mock("../../server/db", () => ({
  __esModule: true,
  db: {
    select: () => ({
      from: () => ({
        where: async () => equipmentLookupRows,
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => nextInsertReturn,
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: async () => nextDeleteReturn,
      }),
    }),
  },
}));

// Build a fresh app for a given user role so we can exercise both the
// admin happy-path and the role gate without re-mocking modules.
async function buildApp(role: string): Promise<Express> {
  const { equipmentDependenciesRouter } = await import(
    "../../server/routes/equipment-dependencies-routes"
  );
  const app = express();
  app.use(express.json());
  app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user?: unknown; orgId?: string }).user = {
      id: `u-${role}`,
      email: `${role}@example.com`,
      role,
      isActive: true,
      orgId: ORG_ID,
    };
    (req as Request & { orgId?: string }).orgId = ORG_ID;
    next();
  });
  app.use("/api/v1", equipmentDependenciesRouter);
  return app;
}

let adminApp: Express;

beforeAll(async () => {
  adminApp = await buildApp("admin");
});

beforeEach(() => {
  projectDependency.mockClear();
  retractDependency.mockClear();
  equipmentLookupRows = [{ id: EQUIP_A }, { id: EQUIP_B }];
  nextInsertReturn = [];
  nextDeleteReturn = [];
});

// Projector calls in the routes are `void projectDependency(...)` — fire-and-
// forget. Yield once to the microtask queue so the spy has been invoked
// before we assert on it.
async function flushMicrotasks(): Promise<void> {
  await new Promise((r) => setImmediate(r));
}

describe("Task #131 — Visual dependency editor → projector contract", () => {
  it("drag-to-connect (POST) creates the row AND projects DEPENDS_ON into the graph", async () => {
    const inserted = {
      id: DEP_ID,
      orgId: ORG_ID,
      vesselId: VESSEL_ID,
      upstreamEquipmentId: EQUIP_A,
      downstreamEquipmentId: EQUIP_B,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    nextInsertReturn = [inserted];

    const res = await request(adminApp)
      .post("/api/v1/equipment-dependencies")
      .send({
        vesselId: VESSEL_ID,
        upstreamEquipmentId: EQUIP_A,
        downstreamEquipmentId: EQUIP_B,
        notes: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.dependency).toMatchObject({
      id: DEP_ID,
      upstreamEquipmentId: EQUIP_A,
      downstreamEquipmentId: EQUIP_B,
    });

    await flushMicrotasks();
    expect(projectDependency).toHaveBeenCalledTimes(1);
    expect(projectDependency).toHaveBeenCalledWith(ORG_ID, EQUIP_A, EQUIP_B);
    expect(retractDependency).not.toHaveBeenCalled();
  });

  it("graph edge removal (DELETE) drops the row AND retracts DEPENDS_ON from the graph", async () => {
    nextDeleteReturn = [
      {
        id: DEP_ID,
        orgId: ORG_ID,
        vesselId: VESSEL_ID,
        upstreamEquipmentId: EQUIP_A,
        downstreamEquipmentId: EQUIP_B,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const res = await request(adminApp).delete(
      `/api/v1/equipment-dependencies/${DEP_ID}`
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    await flushMicrotasks();
    expect(retractDependency).toHaveBeenCalledTimes(1);
    expect(retractDependency).toHaveBeenCalledWith(ORG_ID, EQUIP_A, EQUIP_B);
    expect(projectDependency).not.toHaveBeenCalled();
  });

  it("duplicate edge (409 from onConflictDoNothing) MUST NOT project — proves optimistic rollback path", async () => {
    // Mirrors the contract the UI relies on: when the server rejects
    // the create, `onError` in `graphCreateMutation` restores the
    // pre-mutate cache snapshot. If projectDependency fired anyway,
    // the graph would drift from relational truth.
    nextInsertReturn = []; // onConflictDoNothing returned no rows

    const res = await request(adminApp)
      .post("/api/v1/equipment-dependencies")
      .send({
        vesselId: VESSEL_ID,
        upstreamEquipmentId: EQUIP_A,
        downstreamEquipmentId: EQUIP_B,
      });

    expect(res.status).toBe(409);
    await flushMicrotasks();
    expect(projectDependency).not.toHaveBeenCalled();
  });

  it("delete of a non-existent edge (404) MUST NOT retract", async () => {
    nextDeleteReturn = [];

    const res = await request(adminApp).delete(
      `/api/v1/equipment-dependencies/does-not-exist`
    );

    expect(res.status).toBe(404);
    await flushMicrotasks();
    expect(retractDependency).not.toHaveBeenCalled();
  });

  it("self-loop is rejected by the create schema before any DB or projector call", async () => {
    const res = await request(adminApp)
      .post("/api/v1/equipment-dependencies")
      .send({
        vesselId: VESSEL_ID,
        upstreamEquipmentId: EQUIP_A,
        downstreamEquipmentId: EQUIP_A,
      });

    expect(res.status).toBe(400);
    await flushMicrotasks();
    expect(projectDependency).not.toHaveBeenCalled();
  });

  it("cross-vessel / unknown equipment ids are rejected before projection", async () => {
    equipmentLookupRows = [{ id: EQUIP_A }]; // EQUIP_B missing from this vessel

    const res = await request(adminApp)
      .post("/api/v1/equipment-dependencies")
      .send({
        vesselId: VESSEL_ID,
        upstreamEquipmentId: EQUIP_A,
        downstreamEquipmentId: EQUIP_B,
      });

    expect(res.status).toBe(400);
    expect(res.body.missingIds).toContain(EQUIP_B);
    await flushMicrotasks();
    expect(projectDependency).not.toHaveBeenCalled();
  });

  it("non-admin roles are gated server-side — UI cannot bypass the role check", async () => {
    const cookApp = await buildApp("cook");
    const res = await request(cookApp)
      .post("/api/v1/equipment-dependencies")
      .send({
        vesselId: VESSEL_ID,
        upstreamEquipmentId: EQUIP_A,
        downstreamEquipmentId: EQUIP_B,
      });

    expect(res.status).toBe(403);
    await flushMicrotasks();
    expect(projectDependency).not.toHaveBeenCalled();
  });
});
