import type { ICrewAdminRepository } from "../../server/domains/crew-admin/domain/ports.js";
import type {
  AssignmentInput,
  CreateRoleCommand,
  CrewAccessMemberRef,
  CrewMemberRef,
  CrewUserSummary,
  RoleSummary,
  UpdateRoleCommand,
  VesselAssignmentEntity,
} from "../../server/domains/crew-admin/domain/types.js";
import type { RoleDashboardConfig } from "@shared/role-dashboard";

export const orgId = "org-crew-admin";

export function role(overrides: Partial<RoleSummary> & { id: string; name: string }): RoleSummary {
  return {
    displayName: overrides.name,
    description: null,
    department: null,
    hierarchyLevel: 1,
    isSystemRole: false,
    isProtected: false,
    isActive: true,
    assignedUserCount: 0,
    hubAdmin: false,
    hubAccess: null,
    ...overrides,
  };
}

export function assignment(overrides: Partial<VesselAssignmentEntity>): VesselAssignmentEntity {
  return {
    id: `assignment-${overrides.userId ?? "user"}-${overrides.vesselId ?? "fleet"}`,
    orgId,
    userId: "user-1",
    vesselId: "vessel-1",
    department: null,
    isActive: true,
    assignedBy: "admin-1",
    ...overrides,
  };
}

export function user(
  overrides: Partial<CrewUserSummary> & { id: string; role: string }
): CrewUserSummary {
  return {
    email: `${overrides.id}@example.test`,
    name: overrides.id,
    username: overrides.id,
    isActive: true,
    loginEnabled: true,
    mustChangePassword: false,
    hasPassword: true,
    lastLoginAt: new Date("2026-06-01T00:00:00.000Z"),
    passwordUpdatedAt: null,
    supervisorUserId: null,
    assignments: [],
    assignedRoleNames: [],
    linkedCrewId: null,
    linkedCrewName: null,
    hubAdmin: false,
    hubAccess: null,
    ...overrides,
  };
}

export class FakeCrewAdminRepository implements ICrewAdminRepository {
  readonly roles = new Map<string, RoleSummary>();
  readonly users = new Map<string, CrewUserSummary>();
  readonly crew = new Map<string, CrewAccessMemberRef>();
  readonly configs = new Map<string, RoleDashboardConfig>();
  readonly vessels = new Set(["vessel-1", "vessel-2"]);
  readonly calls: string[] = [];
  remainingAdminLogins = 1;

  async listRoles(): Promise<RoleSummary[]> {
    return [...this.roles.values()];
  }

  async findRoleById(_orgId: string, id: string): Promise<RoleSummary | undefined> {
    return this.roles.get(id);
  }

  async findRoleByName(_orgId: string, name: string): Promise<RoleSummary | undefined> {
    return [...this.roles.values()].find((item) => item.name === name);
  }

  async createRole(command: CreateRoleCommand): Promise<RoleSummary> {
    const created = role({
      id: `role-${command.name}`,
      name: command.name,
      displayName: command.displayName,
      description: command.description ?? null,
      department: command.department ?? null,
      hierarchyLevel: command.hierarchyLevel ?? 1,
    });
    this.roles.set(created.id, created);
    this.calls.push(`createRole:${created.name}`);
    return created;
  }

  async updateRole(
    _orgId: string,
    id: string,
    patch: UpdateRoleCommand
  ): Promise<RoleSummary | undefined> {
    const current = this.roles.get(id);
    if (!current) {
      return undefined;
    }
    const updated = { ...current, ...patch };
    this.roles.set(id, updated);
    this.calls.push(`updateRole:${id}`);
    return updated;
  }

  async deleteRole(_orgId: string, id: string): Promise<void> {
    this.roles.delete(id);
    this.calls.push(`deleteRole:${id}`);
  }

  async setRoleHubAccess(
    _orgId: string,
    id: string,
    hubAdmin: boolean,
    hubAccess: string[] | null
  ): Promise<RoleSummary | undefined> {
    const current = this.roles.get(id);
    if (!current) {
      return undefined;
    }
    const updated = { ...current, hubAdmin, hubAccess };
    this.roles.set(id, updated);
    this.calls.push(`roleHub:${id}:${hubAdmin}:${hubAccess?.join(",") ?? "all"}`);
    return updated;
  }

  async getStoredConfig(_orgId: string, roleId: string): Promise<RoleDashboardConfig | undefined> {
    return this.configs.get(roleId);
  }

  async listStoredConfigs(): Promise<Map<string, RoleDashboardConfig>> {
    return new Map(this.configs);
  }

  async upsertConfig(_orgId: string, roleId: string, config: RoleDashboardConfig): Promise<void> {
    this.configs.set(roleId, config);
    this.calls.push(`upsertConfig:${roleId}`);
  }

  async deleteConfig(_orgId: string, roleId: string): Promise<void> {
    this.configs.delete(roleId);
    this.calls.push(`deleteConfig:${roleId}`);
  }

  async listUsers(): Promise<CrewUserSummary[]> {
    return [...this.users.values()];
  }

  async findUser(_orgId: string, userId: string): Promise<CrewUserSummary | undefined> {
    return this.users.get(userId);
  }

  async vesselExists(_orgId: string, vesselId: string): Promise<boolean> {
    return this.vessels.has(vesselId);
  }

  async getAssignments(_orgId: string, userId: string): Promise<VesselAssignmentEntity[]> {
    return this.users.get(userId)?.assignments ?? [];
  }

  async replaceAssignments(
    _orgId: string,
    userId: string,
    assignments: AssignmentInput[],
    assignedBy: string | undefined
  ): Promise<VesselAssignmentEntity[]> {
    const next = assignments.map((input, index) =>
      assignment({
        id: `assignment-${index}`,
        userId,
        vesselId: input.vesselId ?? null,
        department: input.department ?? null,
        assignedBy: assignedBy ?? null,
      })
    );
    const current = this.users.get(userId);
    if (current) {
      this.users.set(userId, { ...current, assignments: next });
    }
    this.calls.push(`replaceAssignments:${userId}:${next.length}`);
    return next;
  }

  async listAssignedRoleIds(_orgId: string, userId: string): Promise<string[]> {
    return this.users.get(userId)?.assignedRoleNames.map((name) => `role-${name}`) ?? [];
  }

  async listAssignedRoleNames(_orgId: string, userId: string): Promise<string[]> {
    return this.users.get(userId)?.assignedRoleNames ?? [];
  }

  async replaceRoleAssignments(_orgId: string, userId: string, roleIds: string[]): Promise<void> {
    const current = this.users.get(userId);
    if (current) {
      const names = roleIds
        .map((roleId) => this.roles.get(roleId)?.name)
        .filter((name): name is string => Boolean(name));
      this.users.set(userId, { ...current, assignedRoleNames: names });
    }
    this.calls.push(`replaceRoles:${userId}:${roleIds.join(",")}`);
  }

  async setRole(_orgId: string, userId: string, nextRole: string): Promise<void> {
    const current = this.users.get(userId);
    if (current) {
      this.users.set(userId, { ...current, role: nextRole });
    }
    this.calls.push(`setRole:${userId}:${nextRole}`);
  }

  async setSupervisor(
    _orgId: string,
    userId: string,
    supervisorUserId: string | null
  ): Promise<void> {
    const current = this.users.get(userId);
    if (current) {
      this.users.set(userId, { ...current, supervisorUserId });
    }
    this.calls.push(`supervisor:${userId}:${supervisorUserId ?? "none"}`);
  }

  async setLoginEnabled(_orgId: string, userId: string, enabled: boolean): Promise<void> {
    const current = this.users.get(userId);
    if (current) {
      this.users.set(userId, { ...current, loginEnabled: enabled });
    }
    this.calls.push(`login:${userId}:${enabled}`);
  }

  async setCredentials(
    _orgId: string,
    userId: string,
    patch: { username?: string; passwordHash?: string; loginEnabled?: boolean }
  ): Promise<void> {
    const current = this.users.get(userId);
    if (current) {
      this.users.set(userId, {
        ...current,
        username: patch.username ?? current.username,
        hasPassword: patch.passwordHash !== undefined ? true : current.hasPassword,
        loginEnabled: patch.loginEnabled ?? current.loginEnabled,
      });
    }
    this.calls.push(`credentials:${userId}`);
  }

  async setMustChangePassword(_orgId: string, userId: string, value: boolean): Promise<void> {
    const current = this.users.get(userId);
    if (current) {
      this.users.set(userId, { ...current, mustChangePassword: value });
    }
    this.calls.push(`mustChange:${userId}:${value}`);
  }

  async setHubAccessGrant(
    _orgId: string,
    userId: string,
    hubAdmin: boolean,
    hubAccess: string[] | null
  ): Promise<void> {
    const current = this.users.get(userId);
    if (current) {
      this.users.set(userId, { ...current, hubAdmin, hubAccess });
    }
    this.calls.push(`hub:${userId}:${hubAdmin}:${hubAccess?.join(",") ?? "all"}`);
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    this.calls.push(`invalidate:${userId}`);
  }

  async countActiveAdminLogins(): Promise<number> {
    return this.remainingAdminLogins;
  }

  async listCrewMembers(): Promise<CrewAccessMemberRef[]> {
    return [...this.crew.values()];
  }

  async findCrewMember(_orgId: string, crewId: string): Promise<CrewMemberRef | undefined> {
    return this.crew.get(crewId);
  }

  async findCrewByUserId(_orgId: string, userId: string): Promise<CrewMemberRef | undefined> {
    return [...this.crew.values()].find((member) => member.userId === userId);
  }

  async setCrewUserLink(_orgId: string, crewId: string, userId: string | null): Promise<void> {
    const current = this.crew.get(crewId);
    if (current) {
      this.crew.set(crewId, { ...current, userId });
    }
    this.calls.push(`crewLink:${crewId}:${userId ?? "none"}`);
  }

  async findUserByUsername(_orgId: string, username: string): Promise<{ id: string } | undefined> {
    const match = [...this.users.values()].find((item) => item.username === username);
    return match ? { id: match.id } : undefined;
  }

  async createUser(input: {
    orgId: string;
    name: string;
    email: string;
    username: string;
    passwordHash: string;
    role: string;
    loginEnabled: boolean;
    mustChangePassword: boolean;
  }): Promise<string> {
    const id = `user-${input.username}`;
    this.users.set(
      id,
      user({
        id,
        role: input.role,
        email: input.email,
        name: input.name,
        username: input.username,
        loginEnabled: input.loginEnabled,
        mustChangePassword: input.mustChangePassword,
        hasPassword: true,
      })
    );
    this.calls.push(`createUser:${id}`);
    return id;
  }
}

export function seedCrewAdminRepository(repo: FakeCrewAdminRepository): void {
  repo.roles.set("role-viewer", role({ id: "role-viewer", name: "viewer", displayName: "Viewer" }));
  repo.roles.set(
    "role-manager",
    role({ id: "role-manager", name: "manager", displayName: "Manager", hierarchyLevel: 50 })
  );
  repo.roles.set(
    "role-super",
    role({
      id: "role-super",
      name: "super_admin",
      displayName: "Super Admin",
      hierarchyLevel: 100,
      isProtected: true,
      hubAdmin: true,
    })
  );
  repo.users.set(
    "admin-1",
    user({ id: "admin-1", role: "admin", assignments: [assignment({ userId: "admin-1" })] })
  );
  repo.users.set(
    "viewer-1",
    user({ id: "viewer-1", role: "viewer", hasPassword: false, assignments: [] })
  );
  repo.users.set(
    "manager-1",
    user({
      id: "manager-1",
      role: "manager",
      assignments: [assignment({ userId: "manager-1", vesselId: null })],
    })
  );
  repo.crew.set("crew-no-login", {
    id: "crew-no-login",
    name: "No Login",
    email: null,
    userId: null,
    vesselId: "vessel-1",
    active: true,
  });
  repo.crew.set("crew-viewer", {
    id: "crew-viewer",
    name: "Viewer Crew",
    email: "viewer@example.test",
    userId: "viewer-1",
    vesselId: "vessel-1",
    active: true,
  });
  repo.crew.set("crew-manager-former", {
    id: "crew-manager-former",
    name: "Former Manager",
    email: "manager@example.test",
    userId: "manager-1",
    vesselId: "vessel-1",
    active: false,
  });
}
