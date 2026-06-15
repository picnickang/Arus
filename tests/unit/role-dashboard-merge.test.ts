/**
 * Multi-role dashboard merge (Task #235).
 *
 * A user with more than one active role sees the ADDITIVE union of every
 * role's dashboard config: widgets/taskSources/quickActions are unioned
 * (widgets/taskSources in canonical order), visibilityScope takes the most
 * permissive rank, and an empty list collapses to the safe-minimal config.
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mergeDashboardConfigs,
  safeMinimalDashboardConfig,
  emptyDashboardConfig,
  scopeForSource,
  scopeForAlarms,
  maxScope,
  DASHBOARD_WIDGETS,
  TASK_SOURCES,
  type RoleDashboardConfig,
} from "../../shared/role-dashboard";

describe("mergeDashboardConfigs", () => {
  it("keeps the public role-dashboard module delegated to internal policy data files", () => {
    const sharedDir = join(process.cwd(), "shared");
    const roleDashboard = readFileSync(join(sharedDir, "role-dashboard.ts"), "utf-8");
    const defaults = readFileSync(join(sharedDir, "role-dashboard-defaults.ts"), "utf-8");
    const alarms = readFileSync(join(sharedDir, "role-dashboard-alarms.ts"), "utf-8");
    const access = readFileSync(join(sharedDir, "role-dashboard-access.ts"), "utf-8");

    expect(roleDashboard).toContain('from "./role-dashboard-defaults"');
    expect(roleDashboard).toContain('from "./role-dashboard-alarms"');
    expect(roleDashboard).toContain('from "./role-dashboard-access"');
    expect(roleDashboard).toContain("createDefaultRoleDashboardConfigs");
    expect(roleDashboard).not.toContain("super_admin: {");
    expect(defaults).toContain("export function createDefaultRoleDashboardConfigs");
    expect(alarms).toContain("export const PROTECTED_ALARM_TYPES");
    expect(access).toContain("export function resolveEffectiveHubAccess");
  });

  it("returns the safe-minimal config for an empty list", () => {
    expect(mergeDashboardConfigs([])).toEqual(safeMinimalDashboardConfig());
  });

  it("returns the single config unchanged when only one is provided", () => {
    const only: RoleDashboardConfig = {
      ...emptyDashboardConfig(),
      widgets: ["current_vessel"],
      visibilityScope: "vessel",
    };
    expect(mergeDashboardConfigs([only])).toEqual(only);
  });

  it("unions widgets/taskSources in canonical order and takes the most permissive scope", () => {
    const technician: RoleDashboardConfig = {
      ...emptyDashboardConfig(),
      widgets: ["user_tasks", "current_vessel"],
      taskSources: ["work_orders", "maintenance_schedules"],
      quickActions: ["complete_work_order"],
      visibilityScope: "self",
    };
    const safetyOfficer: RoleDashboardConfig = {
      ...emptyDashboardConfig(),
      widgets: ["safety_status", "safety_notices", "current_vessel"],
      taskSources: ["alerts", "insights"],
      quickActions: ["complete_work_order", "view_analytics"],
      visibilityScope: "fleet",
    };

    const merged = mergeDashboardConfigs([technician, safetyOfficer]);

    // canonical widget order preserved, no duplicates
    expect(merged.widgets).toEqual(
      DASHBOARD_WIDGETS.filter((w) =>
        ["current_vessel", "user_tasks", "safety_status", "safety_notices"].includes(w)
      )
    );
    expect(merged.taskSources).toEqual(
      TASK_SOURCES.filter((s) =>
        ["work_orders", "maintenance_schedules", "alerts", "insights"].includes(s)
      )
    );
    expect(merged.quickActions.sort()).toEqual(["complete_work_order", "view_analytics"].sort());
    // self (0) vs fleet (3) -> fleet wins
    expect(merged.visibilityScope).toBe("fleet");
  });

  it("shallow-merges filters and highImpactQuestions with later roles winning", () => {
    const a: RoleDashboardConfig = {
      ...emptyDashboardConfig(),
      filters: { dept: "engine" },
      highImpactQuestions: { user_tasks: "A?" },
    };
    const b: RoleDashboardConfig = {
      ...emptyDashboardConfig(),
      filters: { vessel: "alpha" },
      highImpactQuestions: { user_tasks: "B?", active_alerts: "C?" },
    };

    const merged = mergeDashboardConfigs([a, b]);
    expect(merged.filters).toEqual({ dept: "engine", vessel: "alpha" });
    expect(merged.highImpactQuestions).toEqual({ user_tasks: "B?", active_alerts: "C?" });
  });
});

describe("capability-scoped visibility (no cross-role escalation)", () => {
  // Technician: self-scoped, grants work_orders + the active_alerts widget.
  const technician: RoleDashboardConfig = {
    ...emptyDashboardConfig(),
    widgets: ["active_alerts", "user_tasks"],
    taskSources: ["work_orders", "maintenance_schedules"],
    visibilityScope: "self",
  };
  // Procurement: fleet-scoped, but ONLY grants purchase_requests — no work
  // orders and no alarm-bearing widget.
  const procurement: RoleDashboardConfig = {
    ...emptyDashboardConfig(),
    widgets: ["user_tasks"],
    taskSources: ["purchase_requests"],
    visibilityScope: "fleet",
  };
  const configs = [technician, procurement];

  it("maxScope picks the most permissive and returns null for an empty set", () => {
    expect(maxScope(["self", "fleet", "vessel"])).toBe("fleet");
    expect(maxScope([])).toBeNull();
  });

  it("does NOT widen work_orders to fleet via an unrelated fleet role", () => {
    // The merged config would report fleet scope — the escalation bug.
    expect(mergeDashboardConfigs(configs).visibilityScope).toBe("fleet");
    // Capability scope only counts the role that actually grants work_orders.
    expect(scopeForSource(configs, "work_orders")).toBe("self");
  });

  it("scopes purchase_requests to fleet (the role that grants it)", () => {
    expect(scopeForSource(configs, "purchase_requests")).toBe("fleet");
  });

  it("returns null for a source no role grants", () => {
    expect(scopeForSource(configs, "reservations")).toBeNull();
  });

  it("does NOT widen alarms to fleet via a role with no alarm capability", () => {
    // Only technician surfaces alarms (active_alerts widget) at self scope;
    // procurement's fleet scope must not bleed into alarm visibility.
    expect(scopeForAlarms(configs)).toBe("self");
  });

  it("returns null alarm scope when no role surfaces alarm data", () => {
    const noAlarm: RoleDashboardConfig = {
      ...emptyDashboardConfig(),
      widgets: ["user_tasks"],
      taskSources: ["work_orders"],
      visibilityScope: "fleet",
    };
    expect(scopeForAlarms([noAlarm])).toBeNull();
  });

  it("uses the alerts task source as an alarm-capability signal", () => {
    const alertFeed: RoleDashboardConfig = {
      ...emptyDashboardConfig(),
      taskSources: ["alerts"],
      visibilityScope: "vessel",
    };
    expect(scopeForAlarms([alertFeed])).toBe("vessel");
  });
});
