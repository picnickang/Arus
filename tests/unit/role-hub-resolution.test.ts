/**
 * Role-level hub access resolution (Task #359).
 *
 * The server read path (`getEffectiveHubAccess` in the permissions service) and
 * the access-driven landing both fold a user's role hub fields + per-user
 * override through these two PURE resolvers. Testing them directly is
 * deterministic and runs in the sandbox (no DB, no browser).
 *
 * Contract under test:
 *  - A super-admin role => full hub access (hubAdmin true, hubAccess null).
 *  - A non-admin role => not a hub admin, hubAccess null (lands on dashboard).
 *  - A grant-eligible admin role => union of every role's granted hubs PLUS the
 *    per-user override; any "full" contributor or a union covering every hub
 *    collapses to null; an empty union returns [] (overview, all hubs locked).
 *  - A per-user override only counts when the user still holds an eligible role
 *    (a demoted user loses effective access).
 */

import { describe, it, expect } from "@jest/globals";
import {
  resolveEffectiveHubAdmin,
  resolveEffectiveHubAccess,
  normalizeRoleHubAccess,
  HUB_IDS,
  type RoleHubFields,
} from "@shared/role-dashboard";

const role = (
  name: string,
  hubAdmin = false,
  hubAccess: string[] | null = null
): RoleHubFields => ({ name, hubAdmin, hubAccess });

describe("resolveEffectiveHubAdmin (role-level)", () => {
  it("a super-admin role is always a hub admin, regardless of stored flag", () => {
    expect(resolveEffectiveHubAdmin([role("super_admin")], false)).toBe(true);
  });

  it("a demoted admin role is NOT always-on — it needs the stored flag or override", () => {
    expect(resolveEffectiveHubAdmin([role("admin")], false)).toBe(false);
    expect(resolveEffectiveHubAdmin([role("admin", true)], false)).toBe(true);
    expect(resolveEffectiveHubAdmin([role("admin")], true)).toBe(true);
  });

  it("a grant-eligible role carrying hubAdmin is a hub admin", () => {
    expect(resolveEffectiveHubAdmin([role("chief_engineer", true)], false)).toBe(true);
  });

  it("a per-user override grants admin only on an eligible role", () => {
    expect(resolveEffectiveHubAdmin([role("chief_engineer")], true)).toBe(true);
    expect(resolveEffectiveHubAdmin([role("crew_member")], true)).toBe(false);
  });

  it("an eligible role with neither role-flag nor override is not a hub admin", () => {
    expect(resolveEffectiveHubAdmin([role("chief_engineer")], false)).toBe(false);
  });
});

describe("resolveEffectiveHubAccess (role-level)", () => {
  it("a super-admin role gets full access (null)", () => {
    expect(resolveEffectiveHubAccess([role("super_admin")], false, null)).toBeNull();
  });

  it("a non-admin role resolves to null (lands on dashboard, not overview)", () => {
    expect(resolveEffectiveHubAccess([role("crew_member")], false, null)).toBeNull();
  });

  it("an admin role's hub allow-list is returned as-is", () => {
    expect(
      resolveEffectiveHubAccess([role("chief_engineer", true, ["maintenance"])], false, null)
    ).toEqual(["maintenance"]);
  });

  it("multiple admin roles union their granted hubs", () => {
    const result = resolveEffectiveHubAccess(
      [role("chief_engineer", true, ["maintenance"]), role("fleet_manager", true, ["crew"])],
      false,
      null
    );
    expect(result).not.toBeNull();
    expect((result ?? []).sort()).toEqual(["crew", "maintenance"]);
  });

  it("an admin role with a null (full) list collapses to null", () => {
    expect(resolveEffectiveHubAccess([role("chief_engineer", true, null)], false, null)).toBeNull();
  });

  it("a union covering every hub collapses to null", () => {
    expect(
      resolveEffectiveHubAccess([role("chief_engineer", true, [...HUB_IDS])], false, null)
    ).toBeNull();
  });

  it("an admin with no hubs granted returns [] (overview with every hub locked)", () => {
    expect(resolveEffectiveHubAccess([role("chief_engineer", true, [])], false, null)).toEqual([]);
  });

  it("a per-user override is additive on top of the role grants", () => {
    const result = resolveEffectiveHubAccess(
      [role("chief_engineer", true, ["maintenance"])],
      true,
      ["analytics"]
    );
    expect((result ?? []).sort()).toEqual(["analytics", "maintenance"]);
  });

  it("a per-user override is ignored when no eligible role remains", () => {
    expect(resolveEffectiveHubAccess([role("crew_member")], true, ["analytics"])).toBeNull();
  });
});

describe("normalizeRoleHubAccess (write-path normalisation)", () => {
  it("a non-admin role is forced to {hubAdmin:false, hubAccess:null}", () => {
    expect(normalizeRoleHubAccess(false, ["maintenance"])).toEqual({
      hubAdmin: false,
      hubAccess: null,
    });
    expect(normalizeRoleHubAccess(false, [])).toEqual({
      hubAdmin: false,
      hubAccess: null,
    });
  });

  it("an admin with a null list means ALL hubs (stays null)", () => {
    expect(normalizeRoleHubAccess(true, null)).toEqual({
      hubAdmin: true,
      hubAccess: null,
    });
    expect(normalizeRoleHubAccess(true, undefined)).toEqual({
      hubAdmin: true,
      hubAccess: null,
    });
  });

  it("an admin with an EMPTY list stays [] (no hubs) — never collapses to null", () => {
    // Regression guard: `[]` (admin, zero hubs) is semantically distinct
    // from `null` (admin, all hubs). Collapsing `[]`→null would silently
    // grant every hub to an admin meant to have none.
    expect(normalizeRoleHubAccess(true, [])).toEqual({
      hubAdmin: true,
      hubAccess: [],
    });
  });

  it("an admin granted every hub collapses to null (all hubs)", () => {
    expect(normalizeRoleHubAccess(true, [...HUB_IDS])).toEqual({
      hubAdmin: true,
      hubAccess: null,
    });
  });

  it("an admin with a partial list keeps that list (deduped, unknowns dropped)", () => {
    const result = normalizeRoleHubAccess(true, ["maintenance", "maintenance", "not-a-real-hub"]);
    expect(result.hubAdmin).toBe(true);
    expect(result.hubAccess).toEqual(["maintenance"]);
  });
});
