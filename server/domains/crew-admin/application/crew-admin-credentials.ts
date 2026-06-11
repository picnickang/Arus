import type { ICrewAdminRepository } from "../domain/ports";
import type { SetCredentialsCommand } from "../domain/types";
import { CrewAdminError } from "./crew-admin-errors.js";
import { isAdminCapableRole } from "./crew-admin-role-policy.js";

export interface CrewCredentialWorkflowDeps {
  repo: ICrewAdminRepository;
  assertNotLastAdmin(orgId: string, excludeUserId: string): Promise<void>;
  assertPasswordPolicy(password: string): void;
  hashPassword(password: string): Promise<string>;
}

export async function setLoginEnabled(
  deps: CrewCredentialWorkflowDeps,
  orgId: string,
  userId: string,
  enabled: boolean
): Promise<void> {
  const user = await deps.repo.findUser(orgId, userId);
  if (!user) {
    throw new CrewAdminError("User not found", "NOT_FOUND");
  }
  if (!enabled && isAdminCapableRole(user.role)) {
    await deps.assertNotLastAdmin(orgId, userId);
  }
  await deps.repo.setLoginEnabled(orgId, userId, enabled);
  if (!enabled) {
    await deps.repo.invalidateUserSessions(userId);
  }
}

export async function setCredentials(
  deps: CrewCredentialWorkflowDeps,
  command: SetCredentialsCommand
): Promise<void> {
  const user = await deps.repo.findUser(command.orgId, command.userId);
  if (!user) {
    throw new CrewAdminError("User not found", "NOT_FOUND");
  }
  const patch: { username?: string; passwordHash?: string; loginEnabled?: boolean } = {};
  if (command.username !== undefined) {
    const username = command.username.trim();
    if (username.length < 3) {
      throw new CrewAdminError("Username must be at least 3 characters", "INVALID_USERNAME");
    }
    const existingUsername = await deps.repo.findUserByUsername(command.orgId, username);
    if (existingUsername && existingUsername.id !== command.userId) {
      throw new CrewAdminError("That username is already taken", "DUPLICATE_USERNAME");
    }
    patch.username = username;
  }
  if (command.password !== undefined) {
    deps.assertPasswordPolicy(command.password);
    patch.passwordHash = await deps.hashPassword(command.password);
  }
  if (command.loginEnabled !== undefined) {
    if (command.loginEnabled === false && isAdminCapableRole(user.role)) {
      await deps.assertNotLastAdmin(command.orgId, command.userId);
    }
    patch.loginEnabled = command.loginEnabled;
  }
  await deps.repo.setCredentials(command.orgId, command.userId, patch);
  if (command.loginEnabled === false) {
    await deps.repo.invalidateUserSessions(command.userId);
  }
  if (command.password !== undefined) {
    await deps.repo.setMustChangePassword(command.orgId, command.userId, true);
    await deps.repo.invalidateUserSessions(command.userId);
  }
}

export async function resetPassword(
  deps: CrewCredentialWorkflowDeps,
  orgId: string,
  userId: string,
  newPassword: string
): Promise<void> {
  const user = await deps.repo.findUser(orgId, userId);
  if (!user) {
    throw new CrewAdminError("User not found", "NOT_FOUND");
  }
  deps.assertPasswordPolicy(newPassword);
  const passwordHash = await deps.hashPassword(newPassword);
  await deps.repo.setCredentials(orgId, userId, { passwordHash });
  await deps.repo.setMustChangePassword(orgId, userId, true);
  await deps.repo.invalidateUserSessions(userId);
}
