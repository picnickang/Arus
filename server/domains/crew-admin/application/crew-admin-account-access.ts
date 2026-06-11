import { isSuperAdminRole } from "@shared/role-dashboard";
import type { ICrewAdminRepository } from "../domain/ports";
import type {
  AssignmentInput,
  CreateCrewAccountCommand,
  CrewUserSummary,
  OffboardingAccessRevocationResult,
} from "../domain/types";
import { CrewAdminError } from "./crew-admin-errors.js";
import { OFFBOARDING_SAFE_ROLE } from "./crew-admin-role-policy.js";

type OffboardingRevocationStepState = OffboardingAccessRevocationResult["loginDisabled"];

export interface CrewAccountWorkflowDeps {
  repo: ICrewAdminRepository;
  assertAssignableRole(orgId: string, role: string): Promise<void>;
  assertAssignableVessel(orgId: string, vesselId: string): Promise<void>;
  assertPasswordPolicy(password: string): void;
  hashPassword(password: string): Promise<string>;
  setLoginEnabled(orgId: string, userId: string, enabled: boolean): Promise<void>;
  setAssignments(
    orgId: string,
    userId: string,
    assignments: AssignmentInput[],
    assignedBy: string | undefined
  ): Promise<unknown>;
  changeRole(orgId: string, userId: string, newRole: string): Promise<void>;
}

export async function getCrewAccount(
  repo: ICrewAdminRepository,
  orgId: string,
  crewId: string
): Promise<CrewUserSummary | null> {
  const member = await repo.findCrewMember(orgId, crewId);
  if (!member) {
    throw new CrewAdminError("Crew member not found", "NOT_FOUND");
  }
  if (!member.userId) {
    return null;
  }
  const account = await repo.findUser(orgId, member.userId);
  return account ?? null;
}

export async function createAndLinkAccount(
  deps: CrewAccountWorkflowDeps,
  command: CreateCrewAccountCommand
): Promise<CrewUserSummary> {
  const member = await deps.repo.findCrewMember(command.orgId, command.crewId);
  if (!member) {
    throw new CrewAdminError("Crew member not found", "NOT_FOUND");
  }
  if (member.userId) {
    throw new CrewAdminError("This crew member already has a login account", "CREW_ALREADY_LINKED");
  }

  const username = command.username.trim();
  if (username.length < 3) {
    throw new CrewAdminError("Username must be at least 3 characters", "INVALID_USERNAME");
  }
  const existingUsername = await deps.repo.findUserByUsername(command.orgId, username);
  if (existingUsername) {
    throw new CrewAdminError("That username is already taken", "DUPLICATE_USERNAME");
  }

  const name = (command.name ?? member.name).trim();
  const email = (command.email ?? member.email ?? "").trim();
  if (!email) {
    throw new CrewAdminError(
      "An email address is required to create a login account",
      "EMAIL_REQUIRED"
    );
  }

  const role = (command.role ?? "viewer").trim();
  await deps.assertAssignableRole(command.orgId, role);

  const assignmentVesselId = !command.skipVesselAssignment
    ? command.vesselId !== undefined
      ? command.vesselId
      : (member.vesselId ?? undefined)
    : undefined;
  if (typeof assignmentVesselId === "string") {
    await deps.assertAssignableVessel(command.orgId, assignmentVesselId);
  }

  deps.assertPasswordPolicy(command.password);
  const passwordHash = await deps.hashPassword(command.password);

  const userId = await deps.repo.createUser({
    orgId: command.orgId,
    name,
    email,
    username,
    passwordHash,
    role,
    loginEnabled: command.loginEnabled ?? true,
    mustChangePassword: true,
  });
  await deps.repo.setCrewUserLink(command.orgId, command.crewId, userId);

  if (assignmentVesselId !== undefined) {
    await deps.repo.replaceAssignments(
      command.orgId,
      userId,
      [{ vesselId: assignmentVesselId }],
      command.assignedBy
    );
  }

  const created = await deps.repo.findUser(command.orgId, userId);
  if (!created) {
    throw new CrewAdminError("Account created but could not be loaded", "NOT_FOUND");
  }
  return created;
}

export async function linkExistingAccount(
  repo: ICrewAdminRepository,
  orgId: string,
  crewId: string,
  userId: string
): Promise<void> {
  const member = await repo.findCrewMember(orgId, crewId);
  if (!member) {
    throw new CrewAdminError("Crew member not found", "NOT_FOUND");
  }
  if (member.userId) {
    throw new CrewAdminError("This crew member already has a login account", "CREW_ALREADY_LINKED");
  }
  const user = await repo.findUser(orgId, userId);
  if (!user) {
    throw new CrewAdminError("User not found", "NOT_FOUND");
  }
  const otherCrew = await repo.findCrewByUserId(orgId, userId);
  if (otherCrew) {
    throw new CrewAdminError("That login is already linked to another crew member", "USER_ALREADY_LINKED");
  }
  await repo.setCrewUserLink(orgId, crewId, userId);
}

export async function unlinkAccount(
  repo: ICrewAdminRepository,
  orgId: string,
  crewId: string
): Promise<void> {
  const member = await repo.findCrewMember(orgId, crewId);
  if (!member) {
    throw new CrewAdminError("Crew member not found", "NOT_FOUND");
  }
  await repo.setCrewUserLink(orgId, crewId, null);
}

export async function revokeCrewAccessForOffboarding(
  deps: CrewAccountWorkflowDeps,
  orgId: string,
  crewId: string,
  options: {
    disableLogin?: boolean | undefined;
    removeVesselAccess?: boolean | undefined;
    removeDashboardAccess?: boolean | undefined;
    removeAdditionalRoles?: boolean | undefined;
    downgradePrimaryRole?: boolean | undefined;
    endDutyStatus?: boolean | undefined;
    preserveRecords?: boolean | undefined;
  },
  performedBy: string | undefined
): Promise<OffboardingAccessRevocationResult> {
  const account = await getCrewAccount(deps.repo, orgId, crewId);
  if (!account) {
    return {
      userId: null,
      loginDisabled: "not_applicable",
      vesselAccessRemoved: "not_applicable",
      dashboardAccessRemoved: "not_applicable",
      additionalRolesRemoved: "not_applicable",
      primaryRoleDowngraded: "not_applicable",
      dutyEnded: (options.endDutyStatus ?? true) ? "yes" : "no",
      recordsPreserved: "yes",
      previousRole: null,
      previousAdditionalRoles: [],
      previousVesselAccessCount: 0,
      previousHubAdmin: false,
      failures: [],
    };
  }

  const result: OffboardingAccessRevocationResult = {
    userId: account.id,
    loginDisabled: (options.disableLogin ?? true) ? "no" : "skipped",
    vesselAccessRemoved: (options.removeVesselAccess ?? true) ? "no" : "skipped",
    dashboardAccessRemoved: (options.removeDashboardAccess ?? true) ? "no" : "skipped",
    additionalRolesRemoved: (options.removeAdditionalRoles ?? true) ? "no" : "skipped",
    primaryRoleDowngraded: (options.downgradePrimaryRole ?? true) ? "no" : "skipped",
    dutyEnded: (options.endDutyStatus ?? true) ? "yes" : "no",
    recordsPreserved: "yes",
    previousRole: account.role,
    previousAdditionalRoles: account.assignedRoleNames,
    previousVesselAccessCount: account.assignments.filter((assignment) => assignment.isActive).length,
    previousHubAdmin: account.hubAdmin || isSuperAdminRole(account.role),
    failures: [],
  };

  const runStep = async (
    label: string,
    assign: (value: OffboardingRevocationStepState) => void,
    action: () => Promise<void>
  ) => {
    try {
      await action();
      assign("yes");
    } catch (error) {
      assign("failed");
      result.failures.push(`${label}: ${error instanceof Error ? error.message : "failed"}`);
    }
  };

  if (options.disableLogin ?? true) {
    await runStep("Disable login", (value) => (result.loginDisabled = value), () =>
      deps.setLoginEnabled(orgId, account.id, false)
    );
  }
  if (options.removeVesselAccess ?? true) {
    if (result.previousVesselAccessCount === 0) {
      result.vesselAccessRemoved = "not_applicable";
    } else {
      await runStep("Remove vessel access", (value) => (result.vesselAccessRemoved = value), () =>
        deps.setAssignments(orgId, account.id, [], performedBy).then(() => undefined)
      );
    }
  }
  if (options.removeDashboardAccess ?? true) {
    if (!result.previousHubAdmin) {
      result.dashboardAccessRemoved = "not_applicable";
    } else {
      await runStep("Remove dashboard/admin access", (value) => (result.dashboardAccessRemoved = value), () =>
        deps.repo.setHubAccessGrant(orgId, account.id, false, null)
      );
    }
  }
  if (options.removeAdditionalRoles ?? true) {
    if (account.assignedRoleNames.length === 0) {
      result.additionalRolesRemoved = "not_applicable";
    } else {
      await runStep("Remove additional roles", (value) => (result.additionalRolesRemoved = value), () =>
        deps.repo.replaceRoleAssignments(orgId, account.id, [], performedBy)
      );
    }
  }
  if (options.downgradePrimaryRole ?? true) {
    if (account.role === OFFBOARDING_SAFE_ROLE) {
      result.primaryRoleDowngraded = "not_applicable";
    } else {
      await runStep("Downgrade primary role", (value) => (result.primaryRoleDowngraded = value), () =>
        deps.changeRole(orgId, account.id, OFFBOARDING_SAFE_ROLE)
      );
    }
  }

  return result;
}
