/**
 * Maintenance checklist routes — contract coverage.
 *
 * These paths were called by shipped UI (work-order Tasks tab,
 * LinkTemplateDialog, maintenance-templates page) since their introduction
 * but never had server routes (route-contract triage, family "Work orders
 * & maintenance templates"). Asserts the Tasks-tab contract: progress
 * rollup math, the complete/reset upsert semantics, and org scoping via
 * work-order ownership checks.
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import express from "express";
import request from "supertest";

type Completion = {
  id: string;
  itemId: string;
  completedBy: string | null;
  passed: boolean | null;
  status: string;
};

const state = {
  workOrder: { id: "wo-1", maintenanceTemplateId: "tpl-1" } as Record<string, unknown> | undefined,
  templateItems: [{ id: "i1" }, { id: "i2" }, { id: "i3" }, { id: "i4" }] as Array<{ id: string }>,
  completions: [] as Completion[],
};

const updateCompletionMock = jest.fn(async (id: string, fields: Record<string, unknown>) => ({
  id,
  ...fields,
}));
const createCompletionMock = jest.fn(async (row: Record<string, unknown>) => ({
  id: "new-completion",
  ...row,
}));
const updateWorkOrderMock = jest.fn(async (id: string, updates: Record<string, unknown>) => ({
  id,
  ...updates,
}));

let app: express.Express;

beforeAll(async () => {
  // checklist-routes imports the storage singletons from their canonical
  // homes (not the repositories barrel — that import is forbidden from a
  // domain interfaces file by check:domain-repositories-imports), so the
  // mocks target those modules directly.
  jest.unstable_mockModule("../../server/db/checklists/index", () => ({
    __esModule: true,
    dbChecklistsStorage: {
      getMaintenanceTemplate: jest.fn(async (id: string) =>
        id === "tpl-1" ? { id: "tpl-1", name: "Engine 500h" } : undefined
      ),
      getMaintenanceChecklistItems: jest.fn(async () => state.templateItems),
      createMaintenanceChecklistItem: jest.fn(async (row: Record<string, unknown>) => ({
        id: "new-item",
        ...row,
      })),
      cloneMaintenanceTemplate: jest.fn(async (_id: string, newName: string) => ({
        id: "tpl-clone",
        name: newName,
      })),
      getChecklistCompletions: jest.fn(async () => state.completions),
      createChecklistCompletion: createCompletionMock,
      updateChecklistCompletion: updateCompletionMock,
    },
  }));
  jest.unstable_mockModule("../../server/db/workorders/index", () => ({
    __esModule: true,
    dbWorkOrderStorage: {
      getWorkOrder: jest.fn(async (_orgId: string, id: string) =>
        id === "wo-1" ? state.workOrder : undefined
      ),
      updateWorkOrder: updateWorkOrderMock,
      getWorkOrderChecklists: jest.fn(async () => []),
      getWorkOrderWorklogs: jest.fn(async () => []),
      addWorkOrderWorklog: jest.fn(async (row: Record<string, unknown>) => ({
        id: "wl-1",
        ...row,
      })),
    },
  }));
  jest.unstable_mockModule("../../server/middleware/auth", () => ({
    __esModule: true,
    requireOrgId: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (req as express.Request & { orgId?: string }).orgId = "org-test";
      next();
    },
    requireOrgIdAndValidateBody: (
      req: express.Request,
      _res: express.Response,
      next: express.NextFunction
    ) => {
      (req as express.Request & { orgId?: string }).orgId = "org-test";
      next();
    },
    authenticatedRequest: (req: express.Request) => req as express.Request & { orgId: string },
  }));

  const { registerChecklistRoutes } = await import(
    "../../server/domains/maintenance/interfaces/checklist-routes"
  );
  app = express();
  app.use(express.json());
  const passthrough = (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next();
  registerChecklistRoutes(app, {
    writeOperationRateLimit: passthrough,
    criticalOperationRateLimit: passthrough,
    generalApiRateLimit: passthrough,
  });
});

beforeEach(() => {
  state.completions = [];
  updateCompletionMock.mockClear();
  createCompletionMock.mockClear();
  updateWorkOrderMock.mockClear();
});

describe("GET /api/maintenance-checklist/:workOrderId", () => {
  it("returns completions plus the Tasks-tab progress rollup", async () => {
    state.completions = [
      { id: "c1", itemId: "i1", completedBy: "u1", passed: true, status: "completed" },
      { id: "c2", itemId: "i2", completedBy: "u1", passed: false, status: "failed" },
      { id: "c3", itemId: "i3", completedBy: null, passed: null, status: "skipped" },
    ];
    const res = await request(app).get("/api/maintenance-checklist/wo-1");
    expect(res.status).toBe(200);
    // 4 template items dominate the 3 completion rows.
    expect(res.body.progress).toEqual({
      totalItems: 4,
      completedItems: 2,
      pendingItems: 2,
      skippedItems: 1,
      failedItems: 1,
      percentComplete: 50,
    });
    expect(res.body.completions).toHaveLength(3);
  });

  it("404s for an unknown work order", async () => {
    const res = await request(app).get("/api/maintenance-checklist/wo-unknown");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/maintenance-checklist/:workOrderId/complete", () => {
  it("creates a completion row on first completion", async () => {
    const res = await request(app)
      .post("/api/maintenance-checklist/wo-1/complete")
      .send({ itemId: "i1", completedBy: "u1", completedByName: "User One", passed: true });
    expect(res.status).toBe(200);
    expect(createCompletionMock).toHaveBeenCalledTimes(1);
    const row = createCompletionMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(row).toMatchObject({
      orgId: "org-test",
      workOrderId: "wo-1",
      itemId: "i1",
      status: "completed",
    });
    expect(row["completedAt"]).toBeInstanceOf(Date);
  });

  it("updates in place and maps passed:false to status failed", async () => {
    state.completions = [
      { id: "c1", itemId: "i1", completedBy: "u1", passed: true, status: "completed" },
    ];
    const res = await request(app)
      .post("/api/maintenance-checklist/wo-1/complete")
      .send({ itemId: "i1", completedBy: "u1", completedByName: "User One", passed: false });
    expect(res.status).toBe(200);
    expect(updateCompletionMock).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ status: "failed", passed: false })
    );
    expect(createCompletionMock).not.toHaveBeenCalled();
  });

  it("resets to pending when completedBy is null (the client reset path)", async () => {
    state.completions = [
      { id: "c1", itemId: "i1", completedBy: "u1", passed: true, status: "completed" },
    ];
    const res = await request(app)
      .post("/api/maintenance-checklist/wo-1/complete")
      .send({ itemId: "i1", completedBy: null, completedByName: null, passed: null, notes: null });
    expect(res.status).toBe(200);
    expect(updateCompletionMock).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ status: "pending", completedBy: null, completedAt: null })
    );
  });
});

describe("POST /api/work-orders/:id/initialize-checklist", () => {
  it("links the template onto the work order", async () => {
    const res = await request(app)
      .post("/api/work-orders/wo-1/initialize-checklist")
      .send({ templateId: "tpl-1" });
    expect(res.status).toBe(200);
    expect(updateWorkOrderMock).toHaveBeenCalledWith("wo-1", {
      maintenanceTemplateId: "tpl-1",
    });
  });

  it("404s when the template is not in the caller's org", async () => {
    const res = await request(app)
      .post("/api/work-orders/wo-1/initialize-checklist")
      .send({ templateId: "tpl-foreign" });
    expect(res.status).toBe(404);
    expect(updateWorkOrderMock).not.toHaveBeenCalled();
  });
});

describe("template items and clone", () => {
  it("creates an item bound to the template and org", async () => {
    const res = await request(app)
      .post("/api/maintenance-templates/tpl-1/items")
      .send({ title: "Check oil level", stepNumber: 1 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ templateId: "tpl-1", orgId: "org-test" });
  });

  it("clones with a derived name", async () => {
    const res = await request(app).post("/api/maintenance-templates/tpl-1/clone");
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Engine 500h (Copy)");
  });
});
