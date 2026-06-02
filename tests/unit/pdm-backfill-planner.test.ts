/**
 * Predictive-maintenance permission backfill — planner contract.
 *
 * Pins the safety properties the operator runbook
 * (`docs/permission-backfill-notes.md`) promises, against the db-free
 * `planPdmBackfill()` decision logic. Because the planner takes plain rows and
 * returns a plain plan, these run in the sandbox (no database, no db-config).
 *
 * Covered:
 *  - dry-run produces a plan without claiming writes happened
 *  - apply flag is reflected on every result
 *  - idempotency: all grants already present → empty plan (no-op)
 *  - no duplicate grants: an already-granted row is never re-added
 *  - deliberate revocations (isGranted=false) are reported, never re-enabled
 *  - a missing org role yields roleId=null with nothing to add
 *  - only `predictive_maintenance` on the four admin roles is ever touched
 */

import { describe, it, expect } from "@jest/globals";
import {
  planPdmBackfill,
  PDM_BACKFILL_ROLE_NAMES,
  PDM_RESOURCE_CODE,
  type PlannerTemplate,
  type PlannerRole,
  type PlannerGrant,
} from "../../server/domains/permissions/pdm-backfill-planner";

/** Build a template whose permissions JSON carries the given PdM actions (plus noise). */
function template(name: string, id: string, pdmActions: string[]): PlannerTemplate {
  const perms = [
    // Noise from another resource — the planner must ignore it entirely.
    { resource: "crew", action: "view" },
    ...pdmActions.map((action) => ({ resource: PDM_RESOURCE_CODE, action })),
  ];
  return { id, name, permissions: JSON.stringify(perms) };
}

const ADMIN_TEMPLATE = template("admin", "tpl-admin", ["view", "manage_config", "override"]);
const CHIEF_TEMPLATE = template("chief_engineer", "tpl-chief", ["view", "manage_config"]);

function grant(resource: string, action: string, isGranted: boolean): PlannerGrant {
  return { resourceCode: resource, actionCode: action, isGranted };
}

describe("planPdmBackfill", () => {
  it("dry-run lists missing grants without claiming a write happened", () => {
    const roles: PlannerRole[] = [{ id: "role-admin", name: "admin", templateId: "tpl-admin" }];
    const plan = planPdmBackfill([ADMIN_TEMPLATE], roles, new Map(), false);

    expect(plan).toHaveLength(1);
    const admin = plan[0];
    expect(admin.roleName).toBe("admin");
    expect(admin.roleId).toBe("role-admin");
    expect(admin.applied).toBe(false);
    expect(admin.added.map((a) => a.action).sort()).toEqual(
      ["manage_config", "override", "view"].sort(),
    );
    expect(admin.added.every((a) => a.resource === PDM_RESOURCE_CODE)).toBe(true);
    expect(admin.skippedRevoked).toEqual([]);
  });

  it("apply flag is reflected on every result", () => {
    const roles: PlannerRole[] = [{ id: "role-admin", name: "admin", templateId: "tpl-admin" }];
    const plan = planPdmBackfill([ADMIN_TEMPLATE], roles, new Map(), true);
    expect(plan.every((r) => r.applied === true)).toBe(true);
  });

  it("is idempotent: all grants present → empty plan (no-op)", () => {
    const roles: PlannerRole[] = [{ id: "role-admin", name: "admin", templateId: "tpl-admin" }];
    const grants = new Map<string, PlannerGrant[]>([
      [
        "role-admin",
        [
          grant(PDM_RESOURCE_CODE, "view", true),
          grant(PDM_RESOURCE_CODE, "manage_config", true),
          grant(PDM_RESOURCE_CODE, "override", true),
        ],
      ],
    ]);
    const plan = planPdmBackfill([ADMIN_TEMPLATE], roles, grants, true);
    expect(plan[0].added).toEqual([]);
    expect(plan[0].skippedRevoked).toEqual([]);
  });

  it("never re-adds an already-granted row (no duplicate grants)", () => {
    const roles: PlannerRole[] = [{ id: "role-admin", name: "admin", templateId: "tpl-admin" }];
    const grants = new Map<string, PlannerGrant[]>([
      ["role-admin", [grant(PDM_RESOURCE_CODE, "view", true)]],
    ]);
    const plan = planPdmBackfill([ADMIN_TEMPLATE], roles, grants, false);
    // view already exists → only the two missing actions are added.
    expect(plan[0].added.map((a) => a.action).sort()).toEqual(["manage_config", "override"]);
  });

  it("reports deliberate revocations and never re-enables them", () => {
    const roles: PlannerRole[] = [{ id: "role-admin", name: "admin", templateId: "tpl-admin" }];
    const grants = new Map<string, PlannerGrant[]>([
      [
        "role-admin",
        [
          grant(PDM_RESOURCE_CODE, "view", true),
          grant(PDM_RESOURCE_CODE, "manage_config", false), // explicitly revoked
        ],
      ],
    ]);
    const plan = planPdmBackfill([ADMIN_TEMPLATE], roles, grants, true);
    // manage_config is revoked → skipped, not added; override is genuinely missing → added.
    expect(plan[0].skippedRevoked.map((a) => a.action)).toEqual(["manage_config"]);
    expect(plan[0].added.map((a) => a.action)).toEqual(["override"]);
  });

  it("yields roleId=null with nothing to add when the org has no such role", () => {
    const plan = planPdmBackfill([ADMIN_TEMPLATE], [], new Map(), false);
    expect(plan).toHaveLength(1);
    expect(plan[0].roleId).toBeNull();
    expect(plan[0].added).toEqual([]);
    expect(plan[0].skippedRevoked).toEqual([]);
  });

  it("prefers templateId match over a name-only custom role", () => {
    const roles: PlannerRole[] = [
      // A custom role that happens to be named "admin" but is tracked under a
      // different templateId must NOT be hijacked.
      { id: "role-custom", name: "admin", templateId: "tpl-other" },
      { id: "role-real-admin", name: "admin", templateId: "tpl-admin" },
    ];
    const plan = planPdmBackfill([ADMIN_TEMPLATE], roles, new Map(), false);
    expect(plan[0].roleId).toBe("role-real-admin");
  });

  it("falls back to name match only for legacy roles with no templateId", () => {
    const roles: PlannerRole[] = [{ id: "role-legacy", name: "admin", templateId: null }];
    const plan = planPdmBackfill([ADMIN_TEMPLATE], roles, new Map(), false);
    expect(plan[0].roleId).toBe("role-legacy");
  });

  it("only touches the four admin-capable roles and the PdM resource", () => {
    // A non-admin template is present but must never appear in the plan.
    const viewerTemplate = template("viewer", "tpl-viewer", ["view"]);
    const roles: PlannerRole[] = [
      { id: "role-admin", name: "admin", templateId: "tpl-admin" },
      { id: "role-chief", name: "chief_engineer", templateId: "tpl-chief" },
      { id: "role-viewer", name: "viewer", templateId: "tpl-viewer" },
    ];
    const plan = planPdmBackfill([ADMIN_TEMPLATE, CHIEF_TEMPLATE, viewerTemplate], roles, new Map(), false);

    const roleNames = plan.map((r) => r.roleName);
    expect(roleNames).not.toContain("viewer");
    expect(roleNames.every((n) => (PDM_BACKFILL_ROLE_NAMES as readonly string[]).includes(n))).toBe(true);
    // chief_engineer template carries view + manage_config but NOT override.
    const chief = plan.find((r) => r.roleName === "chief_engineer");
    expect(chief?.added.map((a) => a.action).sort()).toEqual(["manage_config", "view"]);
    // every added grant is for predictive_maintenance only
    expect(plan.flatMap((r) => r.added).every((a) => a.resource === PDM_RESOURCE_CODE)).toBe(true);
  });
});
