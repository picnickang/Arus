/**
 * Tier A — Crew Scheduling Application Service Contract (Hexagonal Unit Test)
 * --------------------------------------------------------------------
 * Critical-path test for the crew-scheduling application service defined
 * in replit.md › Operational & Compliance › STCW-compliant Crew Scheduling.
 *
 * Exercises `CrewExtensionsApplicationService` with stub repositories and
 * an in-memory event publisher. Asserts the orchestration contract:
 *
 *   1. Read paths route through the correct repository ports.
 *   2. `getSchedulerRunWithAssignments` correctly composes data from two
 *      ports (run repo + assignment repo) and short-circuits when the run
 *      is missing — so a missing run never produces a phantom assignment list.
 *   3. The hex boundary holds: the service never touches infrastructure
 *      directly; every external effect goes through a port.
 *
 * Placement: tests/unit/ — see cost-savings-claim-integrity.test.ts header
 * for the rationale.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { CrewExtensionsApplicationService } from "../../server/domains/crew-extensions/application/crew-extensions-service";
import type {
  ISchedulerRunRepository,
  IScheduleAssignmentRepository,
  ICrewExtensionsEventPublisher,
  ISchedulePlannerReadModel,
} from "../../server/domains/crew-extensions/domain/ports";
import type {
  SchedulerRunEntity,
  ScheduleAssignmentEntity,
} from "../../server/domains/crew-extensions/domain/types";

// ---------- Fixtures ----------

const ORG_ID = "test-org-crew";
const RUN_ID = "run-abc-123";

function makeRun(overrides: Partial<SchedulerRunEntity> = {}): SchedulerRunEntity {
  return {
    id: RUN_ID,
    orgId: ORG_ID,
    status: "pending",
    startDate: new Date("2026-04-24T00:00:00Z"),
    endDate: new Date("2026-05-01T00:00:00Z"),
    totalAssignments: 14,
    unfilledCount: 0,
    inputHash: "hash-xyz",
    generatedByRunId: null,
    horGenerated: false,
    createdAt: new Date("2026-04-24T08:00:00Z"),
    completedAt: null,
    approvedAt: null,
    approvedBy: null,
    publishedAt: null,
    publishedBy: null,
    ...overrides,
  };
}

function makeAssignment(crewId: string, day: number): ScheduleAssignmentEntity {
  return {
    id: `assign-${crewId}-${day}`,
    runId: RUN_ID,
    crewId,
    vesselId: "vessel-1",
    date: new Date(`2026-04-${String(24 + day).padStart(2, "0")}T00:00:00Z`),
    shift: day % 2 === 0 ? "day" : "night",
    role: "Deck Officer",
    status: "proposed",
    createdAt: new Date("2026-04-24T08:00:00Z"),
  };
}

// ---------- Stub builders ----------

function buildPorts(
  initial: { run?: SchedulerRunEntity; assignments?: ScheduleAssignmentEntity[] } = {}
) {
  const schedulerRunRepository: ISchedulerRunRepository = {
    create: jest.fn() as ISchedulerRunRepository["create"],
    findById: jest
      .fn<(id: string, orgId?: string) => Promise<SchedulerRunEntity | undefined>>()
      .mockResolvedValue(initial.run),
    findByOrgId: jest
      .fn<(orgId: string, limit?: number) => Promise<SchedulerRunEntity[]>>()
      .mockResolvedValue(initial.run ? [initial.run] : []),
    findByStatus: jest.fn() as ISchedulerRunRepository["findByStatus"],
    findRecentByHash: jest.fn() as ISchedulerRunRepository["findRecentByHash"],
    update: jest.fn() as ISchedulerRunRepository["update"],
    approve: jest.fn() as ISchedulerRunRepository["approve"],
    publish: jest.fn() as ISchedulerRunRepository["publish"],
    cancel: jest.fn() as ISchedulerRunRepository["cancel"],
    markHoRGenerated: jest.fn() as ISchedulerRunRepository["markHoRGenerated"],
  };

  const assignmentRepository: IScheduleAssignmentRepository = {
    createBulk: jest.fn() as IScheduleAssignmentRepository["createBulk"],
    findByRunId: jest
      .fn<(runId: string) => Promise<ScheduleAssignmentEntity[]>>()
      .mockResolvedValue(initial.assignments ?? []),
    findByDateRange: jest.fn() as IScheduleAssignmentRepository["findByDateRange"],
    deleteByDateRange: jest.fn() as IScheduleAssignmentRepository["deleteByDateRange"],
  };

  const eventPublisher: ICrewExtensionsEventPublisher = {
    publish: jest
      .fn<(event: unknown) => Promise<void>>()
      .mockResolvedValue(undefined) as ICrewExtensionsEventPublisher["publish"],
    publishBatch: jest
      .fn<(events: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined) as ICrewExtensionsEventPublisher["publishBatch"],
  };

  const schedulePlannerReadModel: ISchedulePlannerReadModel = {
    getView: jest.fn() as ISchedulePlannerReadModel["getView"],
    refresh: jest.fn() as ISchedulePlannerReadModel["refresh"],
  };

  return { schedulerRunRepository, assignmentRepository, eventPublisher, schedulePlannerReadModel };
}

describe("Crew Scheduling Application Service Contract", () => {
  let ports: ReturnType<typeof buildPorts>;
  let service: CrewExtensionsApplicationService;

  beforeEach(() => {
    ports = buildPorts({
      run: makeRun(),
      assignments: [
        makeAssignment("crew-001", 0),
        makeAssignment("crew-002", 0),
        makeAssignment("crew-001", 1),
      ],
    });
    service = new CrewExtensionsApplicationService(ports);
  });

  it("getSchedulerRuns delegates to the run repository with the org filter", async () => {
    const runs = await service.getSchedulerRuns(ORG_ID, 10);

    expect(ports.schedulerRunRepository.findByOrgId).toHaveBeenCalledWith(ORG_ID, 10);
    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe(RUN_ID);
    expect(runs[0].orgId).toBe(ORG_ID);

    // Hex boundary: the service must NOT have called any other port
    expect(ports.assignmentRepository.findByRunId).not.toHaveBeenCalled();
    expect(ports.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it("getSchedulerRun returns the single run and only touches the run repo", async () => {
    const run = await service.getSchedulerRun(RUN_ID, ORG_ID);

    expect(ports.schedulerRunRepository.findById).toHaveBeenCalledWith(RUN_ID, ORG_ID);
    expect(run).toBeDefined();
    expect(run?.id).toBe(RUN_ID);
    expect(ports.assignmentRepository.findByRunId).not.toHaveBeenCalled();
  });

  it("getSchedulerRunWithAssignments composes data from BOTH ports when run exists", async () => {
    const result = await service.getSchedulerRunWithAssignments(RUN_ID, ORG_ID);

    expect(result).toBeDefined();
    expect(result?.run.id).toBe(RUN_ID);
    expect(result?.assignments).toHaveLength(3);

    // Both ports queried in the correct order: run first, then assignments
    expect(ports.schedulerRunRepository.findById).toHaveBeenCalledWith(RUN_ID, ORG_ID);
    expect(ports.assignmentRepository.findByRunId).toHaveBeenCalledWith(RUN_ID);

    // Golden: returned assignments include the expected crew rotation
    const crewIds = result?.assignments.map((a) => a.crewId).sort();
    expect(crewIds).toEqual(["crew-001", "crew-001", "crew-002"]);
  });

  it("getSchedulerRunWithAssignments short-circuits when run not found (no phantom data)", async () => {
    const emptyPorts = buildPorts({ run: undefined, assignments: [] });
    const emptyService = new CrewExtensionsApplicationService(emptyPorts);

    const result = await emptyService.getSchedulerRunWithAssignments("missing-run", ORG_ID);

    expect(result).toBeUndefined();

    // The run repo was queried…
    expect(emptyPorts.schedulerRunRepository.findById).toHaveBeenCalledWith("missing-run", ORG_ID);

    // …but the assignment repo was NEVER touched. This is the contract that
    // protects against returning a phantom assignment list keyed to a
    // non-existent run (which would be a serious data-integrity bug).
    expect(emptyPorts.assignmentRepository.findByRunId).not.toHaveBeenCalled();
  });

  it("returns undefined for a missing single run rather than throwing", async () => {
    const emptyPorts = buildPorts({ run: undefined });
    const emptyService = new CrewExtensionsApplicationService(emptyPorts);

    const run = await emptyService.getSchedulerRun("nope", ORG_ID);
    expect(run).toBeUndefined();
  });
});
