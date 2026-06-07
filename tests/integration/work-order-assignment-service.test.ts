/**
 * Crew accept/decline assignment flow — application-service coverage.
 *
 * Exercises WorkOrderApplicationService.{updateWorkOrder, respondToAssignment,
 * getAssignmentsForUser} against an in-memory repository + db stub so the
 * acknowledgement loop has regression protection without a live database.
 *
 * Why mocks (see .agents/memory/integration-test-jest-esm-mocking.md):
 * importing the real repository/db pulls server/db-config, which eagerly
 * builds a pg-node drizzle client and crashes under jest's ESM linker. We
 * mock `../repository`, `../../../db`, drizzle-orm, `@shared/schema`, and the
 * two side-effect modules so only the service's own logic is under test.
 *
 * `jest.mock` is a no-op in this native-ESM config — `jest.unstable_mockModule`
 * + a deferred `await import` is the working equivalent.
 */
import { describe, it, expect, beforeEach, beforeAll, jest } from "@jest/globals";

const ORG = "test-org-wo-assignment";

type WO = Record<string, unknown> & { id: string };

let store: Map<string, WO>;
let nextCrewResult: Array<{ id: string; name: string }>;

const repoMock = {
  findById: jest.fn(async (id: string) => store.get(id)),
  update: jest.fn(async (id: string, data: Record<string, unknown>) => {
    const current = store.get(id) ?? ({ id } as WO);
    const next = { ...current, ...data, id } as WO;
    store.set(id, next);
    return next;
  }),
  findAll: jest.fn(
    async (
      _equipmentId?: string,
      _orgId?: string,
      filters?: { assignedCrewId?: string }
    ) => {
      const all = Array.from(store.values());
      if (filters?.assignedCrewId) {
        return all.filter((w) => w.assignedCrewId === filters.assignedCrewId);
      }
      return all;
    }
  ),
};

const limitFn = jest.fn(async () => nextCrewResult);

jest.unstable_mockModule("../../server/domains/work-orders/repository", () => ({
  __esModule: true,
  workOrderRepository: repoMock,
}));

jest.unstable_mockModule("../../server/db", () => ({
  __esModule: true,
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: limitFn }) }) }),
  },
}));

jest.unstable_mockModule("drizzle-orm", () => ({
  __esModule: true,
  eq: (...args: unknown[]) => ({ __eq: args }),
  and: (...args: unknown[]) => ({ __and: args }),
}));

jest.unstable_mockModule("@shared/schema", () => ({
  __esModule: true,
  crew: { userId: "userId", orgId: "orgId", id: "id", name: "name" },
}));

jest.unstable_mockModule("../../server/db/inventory/index", () => ({
  __esModule: true,
  fireInventoryMovementProjections: jest.fn(async () => {}),
}));

jest.unstable_mockModule("../../server/db/workorders/types", () => ({
  __esModule: true,
  broadcastChange: jest.fn(() => {}),
}));

const eventPublisher = { publish: jest.fn(async () => () => {}) };

type ServiceCtor = typeof import(
  "../../server/domains/work-orders/application/work-order-service"
).WorkOrderApplicationService;

let WorkOrderApplicationService: ServiceCtor;
let service: InstanceType<ServiceCtor>;

beforeAll(async () => {
  ({ WorkOrderApplicationService } = await import(
    "../../server/domains/work-orders/application/work-order-service"
  ));
});

beforeEach(() => {
  store = new Map();
  nextCrewResult = [];
  service = new WorkOrderApplicationService({
    workOrderRepository: repoMock as never,
    eventPublisher: eventPublisher as never,
  });
});

describe("WorkOrderApplicationService.updateWorkOrder — (re)assignment reset", () => {
  it("assigning a crew member sets assignmentStatus='assigned' and clears prior response fields", async () => {
    store.set("wo1", {
      id: "wo1",
      orgId: ORG,
      assignedCrewId: null,
      assignmentStatus: "declined",
      assignmentRespondedAt: new Date("2026-01-01T00:00:00Z"),
      assignmentResponseReason: "previously busy",
      status: "open",
    });

    const result = await service.updateWorkOrder(
      "wo1",
      { assignedCrewId: "crew-1" },
      ORG,
      "user-supervisor"
    );

    expect(result.assignedCrewId).toBe("crew-1");
    expect(result.assignmentStatus).toBe("assigned");
    expect(result.assignmentRespondedAt).toBeNull();
    expect(result.assignmentResponseReason).toBeNull();
  });

  it("re-assigning to the SAME crew member does not reset the acknowledgement loop", async () => {
    store.set("wo1", {
      id: "wo1",
      orgId: ORG,
      assignedCrewId: "crew-1",
      assignmentStatus: "accepted",
      assignmentRespondedAt: new Date("2026-01-01T00:00:00Z"),
      assignmentResponseReason: null,
      status: "in_progress",
    });

    const result = await service.updateWorkOrder(
      "wo1",
      { assignedCrewId: "crew-1", priority: "high" },
      ORG,
      "user-supervisor"
    );

    expect(result.assignmentStatus).toBe("accepted");
    expect(result.assignmentRespondedAt).not.toBeNull();
  });

  it("does not overwrite an explicit assignmentStatus passed alongside a new assignee", async () => {
    store.set("wo1", {
      id: "wo1",
      orgId: ORG,
      assignedCrewId: "crew-1",
      assignmentStatus: "accepted",
      status: "in_progress",
    });

    const result = await service.updateWorkOrder(
      "wo1",
      { assignedCrewId: "crew-2", assignmentStatus: "accepted" },
      ORG,
      "user-supervisor"
    );

    expect(result.assignmentStatus).toBe("accepted");
  });
});

describe("WorkOrderApplicationService.respondToAssignment", () => {
  it("accepting moves the assignment to 'accepted' and the work order to in_progress", async () => {
    store.set("wo1", {
      id: "wo1",
      orgId: ORG,
      assignedCrewId: "crew-1",
      assignmentStatus: "assigned",
      status: "open",
    });
    nextCrewResult = [{ id: "crew-1", name: "Alice" }];

    const res = await service.respondToAssignment("wo1", "user-alice", ORG, "accept");

    expect(res.status).toBe("ok");
    if (res.status !== "ok") {throw new Error("expected ok result");}
    expect(res.workOrder.assignmentStatus).toBe("accepted");
    expect(res.workOrder.status).toBe("in_progress");
    expect(res.workOrder.assignmentResponseReason).toBeNull();
    expect(res.workOrder.assignmentRespondedAt).toBeInstanceOf(Date);
  });

  it("declining with a reason marks 'declined', reopens the work order, and stores the reason", async () => {
    store.set("wo1", {
      id: "wo1",
      orgId: ORG,
      assignedCrewId: "crew-1",
      assignmentStatus: "assigned",
      status: "in_progress",
    });
    nextCrewResult = [{ id: "crew-1", name: "Alice" }];

    const res = await service.respondToAssignment(
      "wo1",
      "user-alice",
      ORG,
      "decline",
      "Already on another job"
    );

    expect(res.status).toBe("ok");
    if (res.status !== "ok") {throw new Error("expected ok result");}
    expect(res.workOrder.assignmentStatus).toBe("declined");
    expect(res.workOrder.status).toBe("open");
    expect(res.workOrder.assignmentResponseReason).toBe("Already on another job");
    expect(res.workOrder.assignmentRespondedAt).toBeInstanceOf(Date);
  });

  it("returns 'forbidden' when responding to a work order assigned to a different crew member", async () => {
    store.set("wo1", {
      id: "wo1",
      orgId: ORG,
      assignedCrewId: "crew-2",
      assignmentStatus: "assigned",
      status: "open",
    });
    nextCrewResult = [{ id: "crew-1", name: "Alice" }];

    const res = await service.respondToAssignment("wo1", "user-alice", ORG, "accept");

    expect(res.status).toBe("forbidden");
  });

  it("returns 'not_crew' when the user is not a registered crew member", async () => {
    store.set("wo1", {
      id: "wo1",
      orgId: ORG,
      assignedCrewId: "crew-1",
      assignmentStatus: "assigned",
      status: "open",
    });
    nextCrewResult = [];

    const res = await service.respondToAssignment("wo1", "user-ghost", ORG, "accept");

    expect(res.status).toBe("not_crew");
  });

  it("returns 'not_found' when the work order does not exist", async () => {
    nextCrewResult = [{ id: "crew-1", name: "Alice" }];

    const res = await service.respondToAssignment("missing", "user-alice", ORG, "accept");

    expect(res.status).toBe("not_found");
  });

  it("returns 'no_assignment' when the work order has no assigned crew member", async () => {
    store.set("wo1", {
      id: "wo1",
      orgId: ORG,
      assignedCrewId: null,
      assignmentStatus: null,
      status: "open",
    });
    nextCrewResult = [{ id: "crew-1", name: "Alice" }];

    const res = await service.respondToAssignment("wo1", "user-alice", ORG, "accept");

    expect(res.status).toBe("no_assignment");
  });
});

describe("WorkOrderApplicationService.getAssignmentsForUser", () => {
  it("returns only the caller's non-completed, non-cancelled assignments", async () => {
    nextCrewResult = [{ id: "crew-1", name: "Alice" }];
    store.set("wo-open", { id: "wo-open", orgId: ORG, assignedCrewId: "crew-1", status: "open" });
    store.set("wo-progress", { id: "wo-progress", orgId: ORG, assignedCrewId: "crew-1", status: "in_progress" });
    store.set("wo-done", { id: "wo-done", orgId: ORG, assignedCrewId: "crew-1", status: "completed" });
    store.set("wo-cancelled", { id: "wo-cancelled", orgId: ORG, assignedCrewId: "crew-1", status: "cancelled" });
    store.set("wo-other", { id: "wo-other", orgId: ORG, assignedCrewId: "crew-2", status: "open" });

    const assignments = await service.getAssignmentsForUser("user-alice", ORG);
    const ids = assignments.map((a) => a.id).sort();

    expect(ids).toEqual(["wo-open", "wo-progress"]);
  });

  it("returns an empty list when the user is not a crew member", async () => {
    nextCrewResult = [];
    store.set("wo-open", { id: "wo-open", orgId: ORG, assignedCrewId: "crew-1", status: "open" });

    const assignments = await service.getAssignmentsForUser("user-ghost", ORG);

    expect(assignments).toEqual([]);
  });
});
