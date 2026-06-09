import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  CrewAdminApplicationService,
  type PermissionCacheInvalidatorPort,
} from "./crew-admin-service.js";
import {
  FakeCrewAdminRepository,
  assignment,
  orgId,
  seedCrewAdminRepository,
  user,
} from "../../../../tests/fixtures/crew-admin-service-fixture.js";

describe("CrewAdminApplicationService", () => {
  let repo: FakeCrewAdminRepository;
  let service: CrewAdminApplicationService;
  let invalidator: PermissionCacheInvalidatorPort & { calls: string[] };

  beforeEach(() => {
    repo = new FakeCrewAdminRepository();
    seedCrewAdminRepository(repo);
    service = new CrewAdminApplicationService(repo);
    invalidator = {
      calls: [],
      invalidateOrg(id: string) {
        this.calls.push(`org:${id}`);
      },
      invalidateUser(userId: string, id: string) {
        this.calls.push(`user:${userId}:${id}`);
      },
    };
    service.setPermissionCacheInvalidator(invalidator);
  });

  it("protects role lifecycle and invalidates permission cache on role hub grants", async () => {
    await expect(
      service.createRole({ orgId, name: " super_admin ", displayName: "Duplicate system role" })
    ).rejects.toMatchObject({ code: "RESERVED_ROLE" });

    const custom = await service.createRole({
      orgId,
      name: " Watch_Lead ",
      displayName: "Watch Lead",
    });
    expect(custom).toMatchObject({ name: "watch_lead", displayName: "Watch Lead" });

    await expect(
      service.updateRole(orgId, "missing", { displayName: "Nope" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.deleteRole(orgId, "role-super")).rejects.toMatchObject({
      code: "PROTECTED_ROLE",
    });

    const grant = await service.setRoleHubAccess(orgId, "role-manager", true, ["fleet", "crew"]);
    expect(grant.previousHubState).toEqual({ hubAdmin: false, hubAccess: null });
    expect(grant.role).toMatchObject({ hubAdmin: true });
    expect(invalidator.calls).toContain(`org:${orgId}`);

    await expect(
      service.setRoleHubAccess(orgId, "role-viewer", true, ["fleet"])
    ).rejects.toMatchObject({ code: "ROLE_NOT_ELIGIBLE" });
    await expect(service.setRoleHubAccess(orgId, "role-super", false, null)).rejects.toMatchObject({
      code: "ADMIN_ROLE_PROTECTED",
    });
  });

  it("reports crew access readiness and former-crew access risk from org-scoped inputs", async () => {
    const readiness = await service.listCrewAccessReadiness(orgId);
    const byCrew = new Map(readiness.map((item) => [item.crewId, item]));

    expect(byCrew.get("crew-no-login")).toMatchObject({
      status: "no_login",
      vesselScope: "none",
    });
    expect(byCrew.get("crew-viewer")).toMatchObject({
      userId: "viewer-1",
      status: "no_password_set",
      hasPassword: false,
    });

    const risks = await service.listFormerCrewAccessRisks(orgId);
    expect(risks).toHaveLength(1);
    expect(risks[0]).toMatchObject({
      crewId: "crew-manager-former",
      hasAccessRisk: true,
      hasFleetAccess: true,
      hasHighRiskRole: true,
    });
  });

  it("gates assignments, secondary roles, supervisors, and user hub access", async () => {
    await expect(
      service.setAssignments(orgId, "admin-1", [{ vesselId: "missing-vessel" }], "admin-1")
    ).rejects.toMatchObject({ code: "INVALID_VESSEL" });
    await service.setAssignments(
      orgId,
      "admin-1",
      [{ vesselId: "vessel-1" }, { vesselId: null, department: "engineering" }],
      "admin-1"
    );
    expect(repo.users.get("admin-1")?.assignments).toHaveLength(2);

    await expect(
      service.setRoleAssignments(orgId, "admin-1", ["missing-role"], "admin-1")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await service.setRoleAssignments(
      orgId,
      "admin-1",
      ["role-viewer", "role-viewer", "role-manager"],
      "admin-1"
    );
    expect(repo.calls).toContain("replaceRoles:admin-1:role-viewer,role-manager");
    expect(invalidator.calls).toContain(`user:admin-1:${orgId}`);

    await expect(service.setSupervisor(orgId, "admin-1", "admin-1")).rejects.toMatchObject({
      code: "INVALID_SUPERVISOR",
    });
    await expect(service.setSupervisor(orgId, "admin-1", "missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await service.setSupervisor(orgId, "admin-1", "manager-1");
    expect(repo.users.get("admin-1")?.supervisorUserId).toBe("manager-1");

    await expect(service.setHubAccess(orgId, "viewer-1", true, ["fleet"])).rejects.toMatchObject({
      code: "ROLE_NOT_ELIGIBLE",
    });
    await service.setHubAccess(orgId, "manager-1", true, ["fleet", "crew", "unknown"]);
    expect(repo.users.get("manager-1")).toMatchObject({
      hubAdmin: true,
      hubAccess: expect.arrayContaining(["fleet", "crew"]),
    });
  });

  it("prevents admin lockout and enforces credential boundary checks", async () => {
    repo.remainingAdminLogins = 0;
    await expect(service.changeRole(orgId, "admin-1", "viewer")).rejects.toMatchObject({
      code: "ADMIN_LOCKOUT",
    });
    await expect(service.setLoginEnabled(orgId, "admin-1", false)).rejects.toMatchObject({
      code: "ADMIN_LOCKOUT",
    });
    await expect(
      service.setCredentials({ orgId, userId: "admin-1", username: "ab" })
    ).rejects.toMatchObject({ code: "INVALID_USERNAME" });
    await expect(
      service.setCredentials({ orgId, userId: "admin-1", password: "short" })
    ).rejects.toMatchObject({ code: "PASSWORD_TOO_SHORT" });

    repo.remainingAdminLogins = 1;
    await service.setLoginEnabled(orgId, "admin-1", false);
    expect(repo.calls).toEqual(
      expect.arrayContaining(["login:admin-1:false", "invalidate:admin-1"])
    );
  });

  it("links crew accounts safely and revokes offboarding access without deleting records", async () => {
    repo.crew.set("crew-new", {
      id: "crew-new",
      name: "New Crew",
      email: "new@example.test",
      userId: null,
      vesselId: "vessel-2",
      active: true,
    });

    await expect(
      service.createAndLinkAccount({
        orgId,
        crewId: "crew-new",
        username: "newcrew",
        password: "short",
      })
    ).rejects.toMatchObject({ code: "PASSWORD_TOO_SHORT" });

    await service.linkExistingAccount(orgId, "crew-new", "admin-1");
    expect(repo.crew.get("crew-new")?.userId).toBe("admin-1");
    await expect(
      service.linkExistingAccount(orgId, "crew-viewer", "manager-1")
    ).rejects.toMatchObject({
      code: "CREW_ALREADY_LINKED",
    });
    await service.unlinkAccount(orgId, "crew-new");
    expect(repo.crew.get("crew-new")?.userId).toBeNull();

    repo.users.set(
      "manager-1",
      user({
        id: "manager-1",
        role: "manager",
        hubAdmin: true,
        assignedRoleNames: ["viewer"],
        assignments: [assignment({ userId: "manager-1", vesselId: null })],
      })
    );
    const result = await service.revokeCrewAccessForOffboarding(
      orgId,
      "crew-manager-former",
      {},
      "admin-1"
    );

    expect(result).toMatchObject({
      userId: "manager-1",
      loginDisabled: "yes",
      vesselAccessRemoved: "yes",
      dashboardAccessRemoved: "yes",
      additionalRolesRemoved: "yes",
      primaryRoleDowngraded: "yes",
      recordsPreserved: "yes",
      failures: [],
    });
    expect(repo.users.get("manager-1")).toMatchObject({
      role: "viewer",
      loginEnabled: false,
      hubAdmin: false,
      assignedRoleNames: [],
      assignments: [],
    });
  });
});
