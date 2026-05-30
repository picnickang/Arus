/**
 * Crew Admin — last-admin lockout guard (Task #235).
 *
 * The service must never let an admin disable the final admin login, on
 * EITHER path that can flip `loginEnabled`:
 *   - `setLoginEnabled(orgId, userId, false)`
 *   - `setCredentials({ ..., loginEnabled: false })`
 * Both must throw `ADMIN_LOCKOUT` when the target is the last active
 * admin-capable login, and must succeed otherwise. Exercised against a
 * fake repository so no Postgres is required.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  CrewAdminApplicationService,
  CrewAdminError,
} from "../../server/domains/crew-admin/application/crew-admin-service";
import type { ICrewAdminRepository } from "../../server/domains/crew-admin/domain/ports";
import type { CrewUserSummary } from "../../server/domains/crew-admin/domain/types";

const ORG = "org-1";

function adminUser(overrides: Partial<CrewUserSummary> = {}): CrewUserSummary {
  return {
    id: "admin-1",
    email: "admin@test.local",
    name: "Admin",
    username: "admin",
    role: "company_admin",
    isActive: true,
    loginEnabled: true,
    mustChangePassword: false,
    hasPassword: true,
    lastLoginAt: null,
    assignments: [],
    assignedRoleNames: [],
    ...overrides,
  };
}

class FakeRepo {
  public remainingAdmins = 0;
  public setLoginEnabledCalls: boolean[] = [];
  public setCredentialsCalls: Array<{ loginEnabled?: boolean }> = [];
  public invalidatedSessions: string[] = [];
  private user: CrewUserSummary;

  constructor(user: CrewUserSummary) {
    this.user = user;
  }

  async findUser(): Promise<CrewUserSummary | undefined> {
    return this.user;
  }
  async countActiveAdminLogins(): Promise<number> {
    return this.remainingAdmins;
  }
  async setLoginEnabled(_org: string, _id: string, enabled: boolean): Promise<void> {
    this.setLoginEnabledCalls.push(enabled);
  }
  async setCredentials(
    _org: string,
    _id: string,
    patch: { username?: string; passwordHash?: string; loginEnabled?: boolean },
  ): Promise<void> {
    this.setCredentialsCalls.push(patch);
  }
  async setMustChangePassword(): Promise<void> {}
  async invalidateUserSessions(userId: string): Promise<void> {
    this.invalidatedSessions.push(userId);
  }
}

function makeService(repo: FakeRepo): CrewAdminApplicationService {
  return new CrewAdminApplicationService(repo as unknown as ICrewAdminRepository);
}

describe("setLoginEnabled — last-admin guard", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo(adminUser());
  });

  it("blocks disabling the final admin login", async () => {
    repo.remainingAdmins = 0;
    const service = makeService(repo);
    await expect(service.setLoginEnabled(ORG, "admin-1", false)).rejects.toMatchObject({
      code: "ADMIN_LOCKOUT",
    });
    expect(repo.setLoginEnabledCalls).toHaveLength(0);
  });

  it("allows disabling when another admin remains", async () => {
    repo.remainingAdmins = 1;
    const service = makeService(repo);
    await service.setLoginEnabled(ORG, "admin-1", false);
    expect(repo.setLoginEnabledCalls).toEqual([false]);
    expect(repo.invalidatedSessions).toContain("admin-1");
  });
});

describe("setCredentials — last-admin guard (loginEnabled:false)", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo(adminUser());
  });

  it("blocks disabling the final admin login via credentials", async () => {
    repo.remainingAdmins = 0;
    const service = makeService(repo);
    await expect(
      service.setCredentials({ orgId: ORG, userId: "admin-1", loginEnabled: false }),
    ).rejects.toBeInstanceOf(CrewAdminError);
    expect(repo.setCredentialsCalls).toHaveLength(0);
  });

  it("allows disabling via credentials when another admin remains", async () => {
    repo.remainingAdmins = 1;
    const service = makeService(repo);
    await service.setCredentials({ orgId: ORG, userId: "admin-1", loginEnabled: false });
    expect(repo.setCredentialsCalls[0]?.loginEnabled).toBe(false);
    expect(repo.invalidatedSessions).toContain("admin-1");
  });

  it("does not run the guard for a non-admin user", async () => {
    repo = new FakeRepo(adminUser({ role: "deck_officer" }));
    repo.remainingAdmins = 0;
    const service = makeService(repo);
    await service.setCredentials({ orgId: ORG, userId: "admin-1", loginEnabled: false });
    expect(repo.setCredentialsCalls[0]?.loginEnabled).toBe(false);
  });
});

interface FakeRoleRow {
  id: string;
  name: string;
  isProtected: boolean;
  isActive: boolean;
  assignedUserCount: number;
}

class FakeRoleRepo {
  public deletedRoles: string[] = [];
  public updatedRoles: Array<{ id: string; patch: Record<string, unknown> }> = [];
  constructor(private readonly role: FakeRoleRow) {}

  async findRoleById(): Promise<FakeRoleRow> {
    return this.role;
  }
  async updateRole(
    _org: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<FakeRoleRow> {
    this.updatedRoles.push({ id, patch });
    return { ...this.role, ...(patch as Partial<FakeRoleRow>) };
  }
  async deleteRole(_org: string, id: string): Promise<void> {
    this.deletedRoles.push(id);
  }
  async deleteConfig(): Promise<void> {}
}

function roleRow(overrides: Partial<FakeRoleRow> = {}): FakeRoleRow {
  return {
    id: "role-x",
    name: "deckhand",
    isProtected: false,
    isActive: true,
    assignedUserCount: 0,
    ...overrides,
  };
}

describe("role lifecycle — admin-capable lockout", () => {
  it("blocks deactivating an admin-capable role", async () => {
    const repo = new FakeRoleRepo(roleRow({ name: "company_admin" }));
    const service = new CrewAdminApplicationService(
      repo as unknown as ICrewAdminRepository,
    );
    await expect(
      service.updateRole(ORG, "role-x", { isActive: false }),
    ).rejects.toMatchObject({ code: "ADMIN_ROLE_PROTECTED" });
    expect(repo.updatedRoles).toHaveLength(0);
  });

  it("allows editing an admin-capable role without deactivating it", async () => {
    const repo = new FakeRoleRepo(roleRow({ name: "company_admin" }));
    const service = new CrewAdminApplicationService(
      repo as unknown as ICrewAdminRepository,
    );
    await service.updateRole(ORG, "role-x", { displayName: "Company Admin" });
    expect(repo.updatedRoles).toHaveLength(1);
  });

  it("blocks deleting an admin-capable role", async () => {
    const repo = new FakeRoleRepo(roleRow({ name: "system_admin" }));
    const service = new CrewAdminApplicationService(
      repo as unknown as ICrewAdminRepository,
    );
    await expect(service.deleteRole(ORG, "role-x")).rejects.toMatchObject({
      code: "PROTECTED_ROLE",
    });
    expect(repo.deletedRoles).toHaveLength(0);
  });

  it("allows deleting an unused custom role", async () => {
    const repo = new FakeRoleRepo(roleRow({ name: "deckhand" }));
    const service = new CrewAdminApplicationService(
      repo as unknown as ICrewAdminRepository,
    );
    await service.deleteRole(ORG, "role-x");
    expect(repo.deletedRoles).toEqual(["role-x"]);
  });
});
