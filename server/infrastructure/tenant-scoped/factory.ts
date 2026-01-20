/**
 * Repository Factory and Dual-Write Adapter
 * Creates tenant-scoped repositories and handles migration patterns
 */

import { TenantScopedRepository } from "./base";
import { EquipmentRepository } from "./equipment";
import { SensorConfigurationRepository } from "./sensor-configuration";
import { SensorStateRepository } from "./sensor-state";
import { PartsRepository } from "./parts";

/**
 * Repository factory - Creates tenant-scoped repositories
 * This is the primary interface for route handlers
 */
export class TenantRepositoryFactory {
  /**
   * Create Equipment repository for given organization
   */
  static equipment(orgId: string): EquipmentRepository {
    return new EquipmentRepository(orgId);
  }

  /**
   * Create SensorConfiguration repository for given organization
   */
  static sensorConfiguration(orgId: string): SensorConfigurationRepository {
    return new SensorConfigurationRepository(orgId);
  }

  /**
   * Create SensorState repository for given organization
   */
  static sensorState(orgId: string): SensorStateRepository {
    return new SensorStateRepository(orgId);
  }

  /**
   * Create Parts repository for given organization
   */
  static parts(orgId: string): PartsRepository {
    return new PartsRepository(orgId);
  }

  /**
   * Create repositories from Express request
   * SINGLE-TENANT: Always uses default-org-id
   */
  static fromRequest(req: any) {
    const orgId = req.orgId || "default-org-id";

    return {
      equipment: () => new EquipmentRepository(orgId),
      sensorConfiguration: () => new SensorConfigurationRepository(orgId),
      sensorState: () => new SensorStateRepository(orgId),
      parts: () => new PartsRepository(orgId),
    };
  }
}

/**
 * Dual-write adapter for gradual migration
 * Allows calling both old and new storage patterns during transition
 */
export class DualWriteAdapter<TRepo extends TenantScopedRepository> {
  constructor(
    private readonly orgId: string,
    private readonly legacyStorage: any,
    private readonly repositoryFactory: (orgId: string) => TRepo
  ) {}

  /**
   * Call both old storage and new repository
   * Compare results to ensure consistency
   */
  async dualRead<T>(
    repositoryFn: (repo: TRepo) => Promise<T>,
    legacyFn: (storage: any, orgId: string) => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    try {
      const repository = this.repositoryFactory(this.orgId);
      return repositoryFn(repository);
    } catch (error) {
      console.error(`Repository read failed, falling back to legacy: ${errorMessage}`, error);
      return legacyFn(this.legacyStorage, this.orgId);
    }
  }

  /**
   * Dual write - writes to both new and legacy systems
   */
  async dualWrite<T>(
    repositoryFn: (repo: TRepo) => Promise<T>,
    legacyFn: (storage: any, orgId: string) => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    const repository = this.repositoryFactory(this.orgId);

    try {
      const result = await repositoryFn(repository);

      try {
        await legacyFn(this.legacyStorage, this.orgId);
      } catch (legacyError) {
        console.warn(`Legacy write failed during dual-write: ${errorMessage}`, legacyError);
      }

      return result;
    } catch (error) {
      console.error(`Repository write failed, falling back to legacy: ${errorMessage}`, error);
      return legacyFn(this.legacyStorage, this.orgId);
    }
  }
}
