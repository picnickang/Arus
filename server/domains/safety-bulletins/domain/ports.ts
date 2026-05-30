/**
 * Safety Bulletin Domain - Ports (Interfaces)
 * Contracts implemented by infrastructure adapters.
 */

import type {
  SafetyBulletinEntity,
  CreateSafetyBulletinCommand,
  ListSafetyBulletinsFilters,
} from "./types";

export interface ISafetyBulletinRepository {
  findAll(
    orgId: string,
    filters?: ListSafetyBulletinsFilters,
  ): Promise<SafetyBulletinEntity[]>;

  create(command: CreateSafetyBulletinCommand): Promise<SafetyBulletinEntity>;
}
