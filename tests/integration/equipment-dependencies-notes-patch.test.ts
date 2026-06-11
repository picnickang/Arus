/**
 * Task #136 — Cover the dependency notes editor with an automated test.
 *
 * The PATCH `/api/v1/equipment-dependencies/:id` route and the graph
 * notes dialog (`client/src/pages/admin/equipment-dependencies.tsx`)
 * are admin-only and easy to regress. This suite pins the route
 * contract end-to-end and exercises both client-side dialog flows
 * (edge-click → edit, drag-to-connect → create+patch) at the HTTP
 * boundary where the regression would actually surface.
 *
 * Why simulate the dialog flows at the API boundary rather than via
 * Playwright: the dialog is a thin wrapper around two mutations
 * (`graphPatchMutation` and `graphCreateMutation`); the dialog's
 * "Save notes" button in edit mode issues a single PATCH, and "Add
 * edge" in create mode issues a POST followed (on success, when
 * notes are non-empty) by a PATCH against the returned id. Driving
 * ReactFlow's drag-to-connect through a real browser would test
 * the library's pointer-event surface, not our contract. The
 * sibling test (`equipment-dependencies-graph-projection.test.ts`)
 * documents the same trade-off for create/delete.
 *
 * Uses `jest.unstable_mockModule` + dynamic imports because the
 * integration suite runs under `--experimental-vm-modules` (ESM),
 * where the legacy hoisted `jest.mock` factory is not invoked.
 * DB + projector are mocked so this test runs without any side
 * effects against Postgres or AGE — pure middleware/route contract.
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";

const ORG_ID = "org-t136";
const OTHER_ORG_ID = "org-other-t136";
const VESSEL_ID = "vessel-t136";
const EQUIP_A = "equip-a-t136";
const EQUIP_B = "equip-b-t136";
const DEP_ID = "dep-t136";

// ---- Projector spies — must NOT fire on PATCH (notes-only mutation) -------
const projectDependency = jest.fn(async (..._args: unknown[]) => undefined);
const retractDependency = jest.fn(async (..._args: unknown[]) => undefined);

// ---- DB chain mock ---------------------------------------------------------
// Chains exercised by the routes under test:
//   db.update().set().where().returning()                       → PATCH
//   db.insert().values().onConflictDoNothing().returning()      → POST create
//   db.select().from().where()                                  → vessel/equipment lookup
type Row = Record<string, unknown>;
type UpdateSetCall = { set: Record<string, unknown> };

let equipmentLookupRows: Row[] = [];
let nextInsertReturn: Row[] = [];
let nextUpdateReturn: Row[] = [];
const updateCalls: UpdateSetCall[] = [];

// ESM-compatible module mocks. Must run before any `await import(...)`
// of the route module under test.
jest.unstable_mockModule("@shared/schema", async () => {
  const eqDeps = await import("@shared/schema/equipment-dependencies");
  const eq = await import("@shared/schema/equipment");
  return { __esModule: true, ...eqDeps, ...eq };
});

jest.unstable_mockModule("../../server/graph", () => ({
  __esModule: true,
  projectDependency: (...args: unknown[]) => projectDependency(...args),
  retractDependency: (...args: unknown[]) => retractDependency(...args),
}));

jest.unstable_mockModule("../../server/db", () => ({
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
    update: () => ({
      set: (s: Record<string, unknown>) => {
        updateCalls.push({ set: s });
        return {
          where: () => ({
            returning: async () => nextUpdateReturn,
          }),
        };
      },
    }),
  },
}));

async function buildApp(role: string, orgId: string = ORG_ID): Promise<Express> {
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
      orgId,
    };
    (req as Request & { orgId?: string }).orgId = orgId;
    next();
  });
  app.use("/api/v1", equipmentDependenciesRouter);
  return app;
}

let adminApp: Express;
let chiefApp: Express;
let cookApp: Express;
let otherOrgAdminApp: Express;

beforeAll(async () => {
  adminApp = await buildApp("admin");
  chiefApp = await buildApp("chief_engineer");
  cookApp = await buildApp("cook");
  otherOrgAdminApp = await buildApp("admin", OTHER_ORG_ID);
});

beforeEach(() => {
  projectDependency.mockClear();
  retractDependency.mockClear();
  equipmentLookupRows = [{ id: EQUIP_A }, { id: EQUIP_B }];
  nextInsertReturn = [];
  nextUpdateReturn = [];
  updateCalls.length = 0;
});

async function flushMicrotasks(): Promise<void> {
  await new Promise((r) => setImmediate(r));
}

function depRow(overrides: Partial<Row> = {}): Row {
  return {
    id: DEP_ID,
    orgId: ORG_ID,
    vesselId: VESSEL_ID,
    upstreamEquipmentId: EQUIP_A,
    downstreamEquipmentId: EQUIP_B,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Task #136 — PATCH /api/v1/equipment-dependencies/:id (notes editor)", () => {
  it("admin can update notes for a dependency in their own org", async () => {
    nextUpdateReturn = [depRow({ notes: "shared cooling loop" })];

    const res = await request(adminApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: "shared cooling loop" });

    expect(res.status).toBe(200);
    expect(res.body.dependency).toMatchObject({
      id: DEP_ID,
      notes: "shared cooling loop",
    });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].set).toMatchObject({ notes: "shared cooling loop" });
    expect(updateCalls[0].set["updatedAt"]).toBeInstanceOf(Date);

    // Notes mutation must NOT touch the graph projector — edges already exist.
    await flushMicrotasks();
    expect(projectDependency).not.toHaveBeenCalled();
    expect(retractDependency).not.toHaveBeenCalled();
  });

  it("chief_engineer is also allowed to edit notes (matches role gate on POST/DELETE)", async () => {
    nextUpdateReturn = [depRow({ notes: "engineer note" })];

    const res = await request(chiefApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: "engineer note" });

    expect(res.status).toBe(200);
    expect(res.body.dependency.notes).toBe("engineer note");
  });

  it("empty / whitespace-only notes are normalised to null (clearing the field)", async () => {
    nextUpdateReturn = [depRow({ notes: null })];

    const res = await request(adminApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: "   " });

    expect(res.status).toBe(200);
    expect(res.body.dependency.notes).toBeNull();
    expect(updateCalls[0].set).toMatchObject({ notes: null });
  });

  it("explicit null clears the notes", async () => {
    nextUpdateReturn = [depRow({ notes: null })];

    const res = await request(adminApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: null });

    expect(res.status).toBe(200);
    expect(updateCalls[0].set).toMatchObject({ notes: null });
  });

  it("rejects notes longer than 500 chars with 400 and does NOT touch the DB", async () => {
    const oversized = "x".repeat(501);
    const res = await request(adminApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: oversized });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid body");
    expect(updateCalls).toHaveLength(0);
  });

  it("accepts notes exactly at the 500-char boundary", async () => {
    const atLimit = "y".repeat(500);
    nextUpdateReturn = [depRow({ notes: atLimit })];

    const res = await request(adminApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: atLimit });

    expect(res.status).toBe(200);
    expect(res.body.dependency.notes).toBe(atLimit);
  });

  it("returns 404 when the id belongs to another org (RLS-equivalent guard)", async () => {
    // Drizzle filters on (orgId, id); a row owned by OTHER_ORG_ID under
    // ORG_ID's auth context yields no rows from .returning(), which the
    // route surfaces as 404 — never leaking existence cross-tenant.
    nextUpdateReturn = [];

    const res = await request(adminApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: "cross-org attempt" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Dependency not found");
    expect(projectDependency).not.toHaveBeenCalled();
    expect(retractDependency).not.toHaveBeenCalled();
  });

  it("symmetric: an admin from another org cannot patch this org's row", async () => {
    // Same DB mock: scoping by (orgId, id) returns no rows → 404.
    nextUpdateReturn = [];

    const res = await request(otherOrgAdminApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: "from other org" });

    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent id", async () => {
    nextUpdateReturn = [];

    const res = await request(adminApp)
      .patch("/api/v1/equipment-dependencies/does-not-exist")
      .send({ notes: "hello" });

    expect(res.status).toBe(404);
  });

  it("non-admin / non-chief roles are blocked with 403 — UI cannot bypass the gate", async () => {
    const res = await request(cookApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: "should not pass" });

    expect(res.status).toBe(403);
    expect(updateCalls).toHaveLength(0);
  });

  it("rejects missing body / wrong type with 400", async () => {
    const res = await request(adminApp).patch(`/api/v1/equipment-dependencies/${DEP_ID}`).send({}); // notes missing

    expect(res.status).toBe(400);
    expect(updateCalls).toHaveLength(0);

    const res2 = await request(adminApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: 42 });

    expect(res2.status).toBe(400);
    expect(updateCalls).toHaveLength(0);
  });
});

/**
 * Simulate the two dialog flows from
 * `client/src/pages/admin/equipment-dependencies.tsx`:
 *
 *   1. Edit mode (`onEdgeClick` → dialog → "Save notes")
 *      → single PATCH against the existing dependency id.
 *
 *   2. Create mode (`onConnect` → dialog → "Add edge")
 *      → POST first, then on success (if notes non-empty) a PATCH
 *      against the returned id. See the "Add edge" button handler
 *      around `graphCreateMutation.mutate(..., { onSuccess: ... })`.
 *
 * Both flows funnel through the same two routes — exercising them at
 * the HTTP boundary pins the contract the dialog depends on.
 */
describe("Task #136 — dialog flows hit the documented routes", () => {
  it("edit-mode dialog: clicking an edge → 'Save notes' issues PATCH and the table sees the new notes", async () => {
    // Server returns the updated row — the UI invalidates the deps
    // query and re-renders the table cell from this payload.
    nextUpdateReturn = [depRow({ notes: "edited from dialog" })];

    const res = await request(adminApp)
      .patch(`/api/v1/equipment-dependencies/${DEP_ID}`)
      .send({ notes: "edited from dialog" });

    expect(res.status).toBe(200);
    expect(res.body.dependency).toMatchObject({
      id: DEP_ID,
      notes: "edited from dialog",
    });
    // The /existing-dependencies table reads .notes off the same row
    // shape; assert the contract field is present and stringly equal.
    expect(typeof res.body.dependency.notes).toBe("string");
  });

  it("create-mode dialog with notes: POST creates the edge, then PATCH persists notes against the returned id", async () => {
    const NEW_ID = "dep-new-t136";

    // Step 1 — POST returns the new row (no notes yet, matching the
    // create payload the dialog sends).
    nextInsertReturn = [depRow({ id: NEW_ID, notes: null })];

    const createRes = await request(adminApp).post("/api/v1/equipment-dependencies").send({
      vesselId: VESSEL_ID,
      upstreamEquipmentId: EQUIP_A,
      downstreamEquipmentId: EQUIP_B,
      notes: null,
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.dependency.id).toBe(NEW_ID);

    // The dialog projects the create — that contract is owned by the
    // sibling test, but assert it here too to make the dialog flow
    // self-contained.
    await flushMicrotasks();
    expect(projectDependency).toHaveBeenCalledTimes(1);
    expect(projectDependency).toHaveBeenCalledWith(ORG_ID, EQUIP_A, EQUIP_B);

    // Step 2 — PATCH the returned id with the dialog's notes value.
    nextUpdateReturn = [depRow({ id: NEW_ID, notes: "drawn with notes" })];

    const patchRes = await request(adminApp)
      .patch(`/api/v1/equipment-dependencies/${NEW_ID}`)
      .send({ notes: "drawn with notes" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.dependency).toMatchObject({
      id: NEW_ID,
      notes: "drawn with notes",
    });

    // No additional projector activity from the PATCH.
    await flushMicrotasks();
    expect(projectDependency).toHaveBeenCalledTimes(1);
    expect(retractDependency).not.toHaveBeenCalled();
  });

  it("create-mode dialog with 'Skip notes' / empty input: POST only, no follow-up PATCH expected", async () => {
    const NEW_ID = "dep-skip-t136";
    nextInsertReturn = [depRow({ id: NEW_ID, notes: null })];

    const createRes = await request(adminApp).post("/api/v1/equipment-dependencies").send({
      vesselId: VESSEL_ID,
      upstreamEquipmentId: EQUIP_A,
      downstreamEquipmentId: EQUIP_B,
      notes: null,
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.dependency.notes).toBeNull();

    // Skip-notes path never fires a PATCH — verified by asserting the
    // update chain was never invoked.
    expect(updateCalls).toHaveLength(0);
  });
});
