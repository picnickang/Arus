/**
 * Task-source parity: the set of task sources an admin can configure MUST equal
 * the set the personal task feed actually materializes. A configurable source
 * that no-ops on `/api/me/tasks` is a capability mismatch, so configs are
 * sanitized down to IMPLEMENTED_TASK_SOURCES at every boundary (schema parse,
 * default resolution, stored-override read).
 */

import {
  TASK_SOURCES,
  IMPLEMENTED_TASK_SOURCES,
  sanitizeTaskSources,
  roleDashboardConfigSchema,
  defaultConfigForRole,
  type TaskSourceKey,
} from "../../shared/role-dashboard";

describe("task-source parity", () => {
  it("only lists implemented sources that are also valid TASK_SOURCES", () => {
    for (const source of IMPLEMENTED_TASK_SOURCES) {
      expect(TASK_SOURCES).toContain(source);
    }
    expect(IMPLEMENTED_TASK_SOURCES.length).toBeGreaterThan(0);
  });

  it("sanitizeTaskSources strips unimplemented sources and preserves canonical order", () => {
    const all = [...TASK_SOURCES] as TaskSourceKey[];
    expect(sanitizeTaskSources(all)).toEqual([...IMPLEMENTED_TASK_SOURCES]);
    expect(sanitizeTaskSources(["alerts", "insights"] as TaskSourceKey[])).toEqual([]);
    expect(sanitizeTaskSources(["work_orders", "alerts"] as TaskSourceKey[])).toEqual([
      "work_orders",
    ]);
  });

  it("the config schema parse strips sources without a serving adapter", () => {
    const parsed = roleDashboardConfigSchema.parse({
      widgets: [],
      taskSources: [...TASK_SOURCES],
      visibilityScope: "vessel",
      quickActions: [],
      filters: {},
      highImpactQuestions: {},
    });
    expect(parsed.taskSources).toEqual([...IMPLEMENTED_TASK_SOURCES]);
  });

  it("default role configs never advertise an unimplemented source", () => {
    for (const role of ["admin", "chief_engineer", "crew_member", "unknown_role"]) {
      const config = defaultConfigForRole(role);
      for (const source of config.taskSources) {
        expect(IMPLEMENTED_TASK_SOURCES).toContain(source);
      }
    }
  });
});
