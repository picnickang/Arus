/**
 * Crew accept/decline assignment flow — HTTP route-gate coverage.
 *
 * Pins the contract of the two crew-facing work-order routes registered in
 * `interfaces/core.ts`:
 *   POST /api/work-orders/:id/assignment-response
 *   GET  /api/work-orders/my-assignments
 *
 * Focus is the route-layer behaviour the service tests cannot reach:
 *   - decline WITHOUT a reason is rejected with 400 (route guard ahead of
 *     the service call);
 *   - the discriminated service result is mapped to the right HTTP status
 *     (ok->200, forbidden->403, not_crew->403, not_found->404,
 *     no_assignment->400);
 *   - an unauthenticated caller gets 401.
 *
 * The real `registerCoreRoutes` handler + the real auth middleware are
 * mounted; only `../application` (which would pull server/db-config and
 * crash under jest ESM) is stubbed. See
 * .agents/memory/integration-test-jest-esm-mocking.md.
 */
import { describe, it, expect, beforeAll, beforeEach, jest } from "@jest/globals";
import type { Express, NextFunction, Request, Response } from "express";
import request from "supertest";

const ORG = "test-org-wo-route-gate";

// Local mirror of the service's RespondToAssignmentResult discriminated
// union, with the `ok` arm carrying only the work-order fields these
// tests assert on (the real arm carries a full SelectWorkOrder row).
type RespondToAssignmentRouteResult =
  | { status: "ok"; workOrder: { id: string; assignmentStatus: string; status: string } }
  | { status: "forbidden" | "not_crew" | "not_found" | "no_assignment" };

const respondToAssignment =
  jest.fn<
    (
      workOrderId: string,
      userId: string,
      orgId: string,
      response: "accept" | "decline",
      reason?: string
    ) => Promise<RespondToAssignmentRouteResult>
  >();
const getAssignmentsForUser =
  jest.fn<(userId: string, orgId: string) => Promise<Array<{ id: string; status: string }>>>();

jest.unstable_mockModule("../../server/domains/work-orders/application", () => ({
  __esModule: true,
  workOrderAppService: {
    respondToAssignment,
    getAssignmentsForUser,
    // Unused by the routes under test but referenced by registerCoreRoutes.
    listWorkOrders: jest.fn(async () => []),
    listWorkOrdersPaginated: jest.fn(async () => ({ items: [], total: 0 })),
    getWorkOrderById: jest.fn(async () => undefined),
    createWorkOrder: jest.fn(async () => ({})),
    createWorkOrderWithSuggestions: jest.fn(async () => ({})),
    updateWorkOrder: jest.fn(async () => ({})),
    deleteWorkOrder: jest.fn(async () => {}),
  },
}));

let app: Express;
let mountError: string | undefined;

beforeAll(async () => {
  const express = (await import("express")).default;
  app = express();
  app.use(express.json());

  // Auth shim — `x-test-user` header "userId" attaches an authenticated
  // user with an org claim so requireOrgId(AndValidateBody) resolves orgId.
  // Omit the header to simulate an unauthenticated caller.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const hdr = req.headers["x-test-user"];
    const value = Array.isArray(hdr) ? hdr[0] : hdr;
    if (value && typeof value === "string") {
      (req as Request & { user?: unknown }).user = {
        id: value,
        email: `${value}@test.local`,
        role: "engineer",
        isActive: true,
        orgId: ORG,
      };
    }
    next();
  });

  try {
    const { registerCoreRoutes } = await import("../../server/domains/work-orders/interfaces/core");
    const noop = (_req: Request, _res: Response, next: NextFunction) => next();
    registerCoreRoutes(app, {
      writeOperationRateLimit: noop,
      criticalOperationRateLimit: noop,
      generalApiRateLimit: noop,
    });
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

beforeEach(() => {
  respondToAssignment.mockReset();
  getAssignmentsForUser.mockReset();
});

describe("work-order assignment routes mounted", () => {
  it("registerCoreRoutes mounted without error", () => {
    expect(mountError).toBeUndefined();
  });
});

describe("POST /api/work-orders/:id/assignment-response", () => {
  it("rejects a decline without a reason with 400 and never calls the service", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .post("/api/work-orders/wo1/assignment-response")
      .set("x-test-user", "user-alice")
      .send({ response: "decline" });

    expect(res.status).toBe(400);
    expect(respondToAssignment).not.toHaveBeenCalled();
  });

  it("rejects a decline whose reason is only whitespace with 400", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .post("/api/work-orders/wo1/assignment-response")
      .set("x-test-user", "user-alice")
      .send({ response: "decline", reason: "   " });

    expect(res.status).toBe(400);
    expect(respondToAssignment).not.toHaveBeenCalled();
  });

  it("returns 200 with the updated work order on a successful accept", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    respondToAssignment.mockResolvedValue({
      status: "ok",
      workOrder: { id: "wo1", assignmentStatus: "accepted", status: "in_progress" },
    });

    const res = await request(app)
      .post("/api/work-orders/wo1/assignment-response")
      .set("x-test-user", "user-alice")
      .send({ response: "accept" });

    expect(res.status).toBe(200);
    expect(res.body.assignmentStatus).toBe("accepted");
    expect(respondToAssignment).toHaveBeenCalledWith("wo1", "user-alice", ORG, "accept", undefined);
  });

  it("passes the trimmed reason to the service on a valid decline", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    respondToAssignment.mockResolvedValue({
      status: "ok",
      workOrder: { id: "wo1", assignmentStatus: "declined", status: "open" },
    });

    const res = await request(app)
      .post("/api/work-orders/wo1/assignment-response")
      .set("x-test-user", "user-alice")
      .send({ response: "decline", reason: "  Already assigned elsewhere  " });

    expect(res.status).toBe(200);
    expect(respondToAssignment).toHaveBeenCalledWith(
      "wo1",
      "user-alice",
      ORG,
      "decline",
      "Already assigned elsewhere"
    );
  });

  it("maps a 'forbidden' service result (assigned to someone else) to 403", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    respondToAssignment.mockResolvedValue({ status: "forbidden" });

    const res = await request(app)
      .post("/api/work-orders/wo1/assignment-response")
      .set("x-test-user", "user-alice")
      .send({ response: "accept" });

    expect(res.status).toBe(403);
  });

  it("maps a 'not_crew' service result to 403", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    respondToAssignment.mockResolvedValue({ status: "not_crew" });

    const res = await request(app)
      .post("/api/work-orders/wo1/assignment-response")
      .set("x-test-user", "user-ghost")
      .send({ response: "accept" });

    expect(res.status).toBe(403);
  });

  it("maps a 'not_found' service result to 404", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    respondToAssignment.mockResolvedValue({ status: "not_found" });

    const res = await request(app)
      .post("/api/work-orders/missing/assignment-response")
      .set("x-test-user", "user-alice")
      .send({ response: "accept" });

    expect(res.status).toBe(404);
  });

  it("maps a 'no_assignment' service result to 400", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    respondToAssignment.mockResolvedValue({ status: "no_assignment" });

    const res = await request(app)
      .post("/api/work-orders/wo1/assignment-response")
      .set("x-test-user", "user-alice")
      .send({ response: "accept" });

    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated caller with 401", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .post("/api/work-orders/wo1/assignment-response")
      .send({ response: "accept" });

    expect(res.status).toBe(401);
    expect(respondToAssignment).not.toHaveBeenCalled();
  });

  it("rejects an invalid response value with 400", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .post("/api/work-orders/wo1/assignment-response")
      .set("x-test-user", "user-alice")
      .send({ response: "maybe" });

    expect(res.status).toBe(400);
    expect(respondToAssignment).not.toHaveBeenCalled();
  });
});

describe("GET /api/work-orders/my-assignments", () => {
  it("returns the caller's assignments from the service", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    getAssignmentsForUser.mockResolvedValue([
      { id: "wo-open", status: "open" },
      { id: "wo-progress", status: "in_progress" },
    ]);

    const res = await request(app)
      .get("/api/work-orders/my-assignments")
      .set("x-test-user", "user-alice");

    expect(res.status).toBe(200);
    expect(res.body.map((w: { id: string }) => w.id)).toEqual(["wo-open", "wo-progress"]);
    expect(getAssignmentsForUser).toHaveBeenCalledWith("user-alice", ORG);
  });

  it("rejects an unauthenticated caller with 401", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app).get("/api/work-orders/my-assignments");

    expect(res.status).toBe(401);
    expect(getAssignmentsForUser).not.toHaveBeenCalled();
  });
});
