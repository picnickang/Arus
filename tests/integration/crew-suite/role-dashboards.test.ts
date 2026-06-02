/**
 * §M — Role dashboard configuration (live dev server).
 *
 * A dashboard config can only be saved for an EXISTING role (the endpoint
 * 404s with "Role not found" otherwise), so each test seeds a real custom
 * role first. The config row is keyed by the role's uuid, so cleanup is done
 * explicitly via deleteRoleHard rather than RUN_ID matching.
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  makeRunId,
  createRole,
  deleteRoleHard,
  getRoleDashboard,
  saveRoleDashboard,
  resetRoleDashboard,
} from "./helpers";

const RUN_ID = makeRunId("dash");

let roleId = "";

interface DashboardResponse {
  roleId: string;
  config: { widgets: string[]; taskSources: unknown[]; [k: string]: unknown };
  [k: string]: unknown;
}

beforeAll(async () => {
  const role = await createRole(RUN_ID);
  roleId = role.id;
}, 30000);

afterAll(async () => {
  if (roleId) await deleteRoleHard(roleId);
});

describe("Role dashboards (§M)", () => {
  it("saves a dashboard config and reads it back", async () => {
    const save = await saveRoleDashboard(roleId, {
      widgets: ["safety_status", "safety_notices"],
      taskSources: [],
    });
    expect(save.ok).toBe(true);

    const get = await getRoleDashboard(roleId);
    expect(get.ok).toBe(true);
    const body = get.data as DashboardResponse;
    expect(body.config.widgets).toEqual(
      expect.arrayContaining(["safety_status", "safety_notices"]),
    );
  });

  it("rejects an invalid widget id with a 4xx", async () => {
    const save = await saveRoleDashboard(roleId, {
      widgets: ["not_a_real_widget"],
      taskSources: [],
    });
    expect(save.ok).toBe(false);
    expect(save.status).toBeGreaterThanOrEqual(400);
    expect(save.status).toBeLessThan(500);
  });

  it("404s when saving a config for a non-existent role", async () => {
    const save = await saveRoleDashboard("no_such_role_id", {
      widgets: ["active_alerts"],
      taskSources: [],
    });
    expect(save.status).toBe(404);
  });

  it("resets the dashboard config for a role", async () => {
    await saveRoleDashboard(roleId, {
      widgets: ["active_alerts"],
      taskSources: [],
    });
    const reset = await resetRoleDashboard(roleId);
    expect(reset.ok).toBe(true);
  });
});
