import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { CrewTaskApplicationService } from "./crew-task-service";
import type {
  ICrewTaskEffects,
  ICrewTaskEventRepository,
  ICrewTaskRepository,
} from "../domain/ports";
import type { CrewTaskEntity, CrewTaskEventEntity } from "../domain/types";

const ORG = "org-crew-task-coverage";
const ACTOR = { id: "user-1", name: "Chief", role: "chief_engineer" };

function task(overrides: Partial<CrewTaskEntity> = {}): CrewTaskEntity {
  return {
    id: "task-1",
    orgId: ORG,
    vesselId: "vessel-1",
    assignedCrewId: "crew-1",
    title: "Inspect rescue boat davit",
    description: "Confirm release gear condition",
    status: "open",
    priority: "high",
    dueDate: new Date("2026-06-12T00:00:00.000Z"),
    blockedReason: null,
    assignedTo: "lead-tech",
    linkedSourceType: "certificate",
    linkedSourceId: "cert-1",
    linkedSourceLabel: "LSA certificate",
    createdBy: "user-1",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function event(overrides: Partial<CrewTaskEventEntity> = {}): CrewTaskEventEntity {
  return {
    id: "event-1",
    orgId: ORG,
    taskId: "task-1",
    eventType: "comment",
    message: "Checked on deck",
    actorId: ACTOR.id ?? null,
    actorName: ACTOR.name ?? null,
    actorRole: ACTOR.role ?? null,
    metadata: null,
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("CrewTaskApplicationService", () => {
  let rows: Map<string, CrewTaskEntity>;
  let repo: jest.Mocked<ICrewTaskRepository>;
  let effects: jest.Mocked<ICrewTaskEffects>;
  let eventRepo: jest.Mocked<ICrewTaskEventRepository>;
  let service: CrewTaskApplicationService;

  beforeEach(() => {
    rows = new Map([["task-1", task()]]);
    repo = {
      findAll: jest.fn(async () => Array.from(rows.values())),
      findById: jest.fn(async (_orgId, id) => rows.get(id) ?? null),
      create: jest.fn(async (command) => {
        const created = task({
          id: "task-created",
          title: command.title,
          status: command.status ?? "open",
          priority: command.priority ?? "medium",
        });
        rows.set(created.id, created);
        return created;
      }),
      update: jest.fn(async (_orgId, id, patch) => {
        const existing = rows.get(id);
        if (!existing) {
          return null;
        }
        const updated: CrewTaskEntity = {
          ...existing,
          ...patch,
          dueDate:
            patch.dueDate === undefined
              ? existing.dueDate
              : patch.dueDate === null
                ? null
                : new Date(patch.dueDate),
          updatedAt: new Date("2026-06-03T00:00:00.000Z"),
        };
        rows.set(id, updated);
        return updated;
      }),
      delete: jest.fn(async (_orgId, id) => rows.delete(id)),
    };
    effects = {
      onCreated: jest.fn(async () => {}),
      onUpdated: jest.fn(async () => {}),
      onDeleted: jest.fn(async () => {}),
      onCommented: jest.fn(async () => {}),
    };
    eventRepo = {
      listByTask: jest.fn(async (_orgId, taskId) => [event({ taskId })]),
      add: jest.fn(async (command) =>
        event({
          taskId: command.taskId,
          message: command.message,
          actorId: command.actorId ?? null,
          actorName: command.actorName ?? null,
          actorRole: command.actorRole ?? null,
        })
      ),
    };
    service = new CrewTaskApplicationService(repo, effects, eventRepo);
  });

  it("delegates list/get and emits create side effects after persistence", async () => {
    await expect(service.listTasks(ORG, { status: "open" })).resolves.toHaveLength(1);
    await expect(service.getTask(ORG, "task-1")).resolves.toMatchObject({
      title: "Inspect rescue boat davit",
    });

    const created = await service.createTask({ orgId: ORG, title: "Check fire pump" }, ACTOR);

    expect(created).toMatchObject({ id: "task-created", title: "Check fire pump" });
    expect(repo.create).toHaveBeenCalledWith({ orgId: ORG, title: "Check fire pump" });
    expect(effects.onCreated).toHaveBeenCalledWith(created, ACTOR);
  });

  it("tracks only changed audited fields and suppresses no-op updates", async () => {
    const before = rows.get("task-1")!;
    const unchanged = { ...before };
    repo.update.mockResolvedValueOnce(unchanged);

    await service.updateTask(ORG, "task-1", { title: before.title }, ACTOR);

    expect(effects.onUpdated).not.toHaveBeenCalled();

    const updated = await service.updateTask(
      ORG,
      "task-1",
      { status: "blocked", blockedReason: "Awaiting permit" },
      ACTOR
    );

    expect(updated).toMatchObject({ status: "blocked", blockedReason: "Awaiting permit" });
    expect(effects.onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1", status: "open" }),
      expect.objectContaining({ id: "task-1", status: "blocked" }),
      ["status", "blockedReason"],
      ACTOR
    );
  });

  it("does not emit update/delete/comment effects when the task is missing", async () => {
    await expect(service.updateTask(ORG, "missing", { status: "done" }, ACTOR)).resolves.toBeNull();
    await expect(service.deleteTask(ORG, "missing", ACTOR)).resolves.toBe(false);
    await expect(service.addComment(ORG, "missing", "Anyone there?", ACTOR)).resolves.toBeNull();

    expect(effects.onUpdated).not.toHaveBeenCalled();
    expect(effects.onDeleted).not.toHaveBeenCalled();
    expect(effects.onCommented).not.toHaveBeenCalled();
  });

  it("emits delete and comment effects only after task existence is confirmed", async () => {
    await expect(service.deleteTask(ORG, "task-1", ACTOR)).resolves.toBe(true);
    expect(effects.onDeleted).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1" }),
      ACTOR
    );

    rows.set("task-1", task());
    const added = await service.addComment(ORG, "task-1", "Checked on deck", ACTOR);
    if (!added) {
      throw new Error("Expected addComment to return the created event");
    }

    expect(eventRepo.add).toHaveBeenCalledWith({
      orgId: ORG,
      taskId: "task-1",
      eventType: "comment",
      message: "Checked on deck",
      actorId: ACTOR.id,
      actorName: ACTOR.name,
      actorRole: ACTOR.role,
    });
    expect(effects.onCommented).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1" }),
      added,
      ACTOR
    );
  });

  it("returns an empty activity log when no event repository exists or task is gone", async () => {
    const noEvents = new CrewTaskApplicationService(repo, effects);

    await expect(noEvents.listEvents(ORG, "task-1")).resolves.toEqual([]);
    await expect(service.listEvents(ORG, "missing")).resolves.toEqual([]);
  });
});
