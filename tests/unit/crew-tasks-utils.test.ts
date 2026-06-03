/**
 * Crew Task Tracker — pure-helper verification (Figma 58:1716).
 *
 * The Crew Task Tracker is a full-stack `crew_tasks` module inside
 * /crew-management. Its list/count/sort/filter/label logic lives in
 * `crewTaskUtils.ts` as pure functions so it can be unit-tested directly
 * (no browser, no React, no network) and reused by the Tasks view, the
 * landing "Open tasks" tile, the shared attention feed, and the profile
 * Tasks tab.
 *
 * What this DOES verify (automated):
 *  - overdue / due-this-week / blocked / active classification.
 *  - countTasks rolls those into the tile + attention numbers.
 *  - sortTasks ranks overdue → priority → soonest due → title (pure, no mutate).
 *  - filterTasks honours the All / Mine / Overdue / By-vessel chips + search.
 *  - status / priority / due human labels.
 *  - Source-scan: the spec's UI wiring (landing tile, attention task rows,
 *    Tasks view, profile Tasks tab) is actually present in the components.
 *
 * What this does NOT verify (covered by backend API tests + CI Playwright):
 *  live rendering, real API wiring, permissions, websocket refresh.
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isDone,
  isActive,
  isOverdue,
  isDueThisWeek,
  isBlocked,
  countTasks,
  sortTasks,
  filterTasks,
  statusLabel,
  priorityLabel,
  dueLabel,
  type CrewTaskView,
} from "@/features/crew/lib/crewTaskUtils";

const NOW = new Date("2026-06-03T12:00:00.000Z");

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function makeTask(overrides: Partial<CrewTaskView> = {}): CrewTaskView {
  return {
    id: "t1",
    orgId: "org1",
    vesselId: null,
    assignedCrewId: null,
    title: "Inspect bilge pump",
    description: null,
    status: "open",
    priority: "medium",
    dueDate: null,
    blockedReason: null,
    createdBy: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("classification helpers", () => {
  it("treats a done task as not active and not overdue", () => {
    const task = makeTask({ status: "done", dueDate: daysFromNow(-5) });
    expect(isDone(task)).toBe(true);
    expect(isActive(task)).toBe(false);
    expect(isOverdue(task, NOW)).toBe(false);
  });

  it("flags a past-due open task as overdue", () => {
    const task = makeTask({ dueDate: daysFromNow(-1) });
    expect(isOverdue(task, NOW)).toBe(true);
  });

  it("does not flag a future-due task as overdue", () => {
    const task = makeTask({ dueDate: daysFromNow(3) });
    expect(isOverdue(task, NOW)).toBe(false);
  });

  it("flags due-this-week only within the next 7 days", () => {
    expect(isDueThisWeek(makeTask({ dueDate: daysFromNow(3) }), NOW)).toBe(true);
    expect(isDueThisWeek(makeTask({ dueDate: daysFromNow(10) }), NOW)).toBe(false);
    expect(isDueThisWeek(makeTask({ dueDate: daysFromNow(-1) }), NOW)).toBe(false);
  });

  it("reads blocked from status", () => {
    expect(isBlocked(makeTask({ status: "blocked" }))).toBe(true);
    expect(isBlocked(makeTask({ status: "open" }))).toBe(false);
  });

  it("ignores an unparseable due date", () => {
    expect(isOverdue(makeTask({ dueDate: "not-a-date" }), NOW)).toBe(false);
    expect(isDueThisWeek(makeTask({ dueDate: "not-a-date" }), NOW)).toBe(false);
  });
});

describe("countTasks", () => {
  it("rolls active / overdue / dueThisWeek / blocked totals", () => {
    const tasks = [
      makeTask({ id: "a", dueDate: daysFromNow(-2) }), // overdue + active
      makeTask({ id: "b", status: "blocked" }), // active + blocked
      makeTask({ id: "c", dueDate: daysFromNow(2) }), // active + dueThisWeek
      makeTask({ id: "d", status: "done", dueDate: daysFromNow(-9) }), // none
    ];
    expect(countTasks(tasks, NOW)).toEqual({
      active: 3,
      overdue: 1,
      dueThisWeek: 1,
      blocked: 1,
    });
  });
});

describe("sortTasks", () => {
  it("ranks overdue first, then priority, then soonest due, then title", () => {
    const overdue = makeTask({ id: "overdue", priority: "low", dueDate: daysFromNow(-1) });
    const urgent = makeTask({ id: "urgent", priority: "urgent", dueDate: daysFromNow(5) });
    const soon = makeTask({ id: "soon", priority: "medium", dueDate: daysFromNow(1) });
    const later = makeTask({ id: "later", priority: "medium", dueDate: daysFromNow(9) });
    const input = [later, urgent, soon, overdue];
    const sorted = sortTasks(input, NOW);
    expect(sorted.map((t) => t.id)).toEqual(["overdue", "urgent", "soon", "later"]);
    // pure — input untouched
    expect(input.map((t) => t.id)).toEqual(["later", "urgent", "soon", "overdue"]);
  });
});

describe("filterTasks", () => {
  const tasks = [
    makeTask({ id: "mine", assignedCrewId: "c1", vesselId: "v1", title: "Replace zinc anode" }),
    makeTask({ id: "od", dueDate: daysFromNow(-3), title: "Lube winch" }),
    makeTask({ id: "v2", vesselId: "v2", title: "Test EPIRB" }),
  ];

  it("all returns everything", () => {
    expect(filterTasks(tasks, { filter: "all", now: NOW }).map((t) => t.id)).toEqual([
      "mine",
      "od",
      "v2",
    ]);
  });

  it("mine uses the myTaskIds set", () => {
    const out = filterTasks(tasks, { filter: "mine", myTaskIds: new Set(["mine"]), now: NOW });
    expect(out.map((t) => t.id)).toEqual(["mine"]);
  });

  it("overdue keeps only overdue tasks", () => {
    expect(filterTasks(tasks, { filter: "overdue", now: NOW }).map((t) => t.id)).toEqual(["od"]);
  });

  it("by_vessel filters to the chosen vessel", () => {
    expect(
      filterTasks(tasks, { filter: "by_vessel", vesselId: "v2", now: NOW }).map((t) => t.id),
    ).toEqual(["v2"]);
  });

  it("search matches title or description, case-insensitive", () => {
    expect(filterTasks(tasks, { filter: "all", search: "epirb", now: NOW }).map((t) => t.id)).toEqual(
      ["v2"],
    );
  });
});

describe("labels", () => {
  it("humanises status", () => {
    expect(statusLabel("in_progress")).toBe("In progress");
    expect(statusLabel("done")).toBe("Done");
  });

  it("humanises priority", () => {
    expect(priorityLabel("urgent")).toBe("Critical");
    expect(priorityLabel("high")).toBe("High");
    expect(priorityLabel("medium")).toBe("Normal");
    expect(priorityLabel("low")).toBe("Low");
  });

  it("renders due labels relative to today", () => {
    expect(dueLabel(daysFromNow(0), NOW)).toBe("Due today");
    expect(dueLabel(daysFromNow(3), NOW)).toBe("Due in 3d");
    expect(dueLabel(daysFromNow(-2), NOW)).toBe("Overdue 2d");
    expect(dueLabel(null, NOW)).toBeNull();
  });
});

describe("source-scan: Crew Task Tracker UI wiring", () => {
  const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

  it("landing renders the Open tasks tile and a task-aware attention row", () => {
    const landing = read("client/src/components/UnifiedCrewManagement/CrewRegistryLanding.tsx");
    expect(landing).toContain('data-testid="card-open-tasks"');
    expect(landing).toContain('kind: "cert" | "doc" | "task"');
    expect(landing).toContain("onOpenTasks");
  });

  it("index wires the Tasks view, counts and task attention feed", () => {
    const index = read("client/src/components/UnifiedCrewManagement/index.tsx");
    expect(index).toContain("CrewTaskTracker");
    expect(index).toContain("useCrewTasks");
    expect(index).toContain('view === "tasks"');
    expect(index).toContain("taskAttention");
  });

  it("profile dialog exposes a Tasks tab backed by the crew-task hook", () => {
    const profile = read("client/src/components/unified-crew-components.tsx");
    expect(profile).toContain('data-testid="tab-crew-tasks"');
    expect(profile).toContain("CrewProfileTasksTab");
    expect(profile).toContain("useCrewTasks({ assignedCrewId: crewId })");
  });

  it("the tracker view component exists and subscribes to crew_task websocket channels", () => {
    const tracker = read("client/src/components/UnifiedCrewManagement/CrewTaskTracker.tsx");
    expect(tracker).toContain("crew_task");
  });
});
