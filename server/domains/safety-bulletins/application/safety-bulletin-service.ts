/**
 * Safety Bulletin Application Service
 * Orchestrates domain logic using ports (interfaces).
 */

import type { ISafetyBulletinRepository } from "../domain/ports";
import type {
  SafetyBulletinEntity,
  CreateSafetyBulletinCommand,
  ListSafetyBulletinsFilters,
} from "../domain/types";

export class SafetyBulletinApplicationService {
  constructor(private readonly repo: ISafetyBulletinRepository) {}

  async listBulletins(
    orgId: string,
    filters?: ListSafetyBulletinsFilters
  ): Promise<SafetyBulletinEntity[]> {
    return this.repo.findAll(orgId, filters);
  }

  async createBulletin(command: CreateSafetyBulletinCommand): Promise<SafetyBulletinEntity> {
    return this.repo.create(command);
  }
}
