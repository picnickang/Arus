/**
 * Tenant-Scoped Repository Pattern - Module Aggregator
 * Re-exports all tenant-scoped repositories for easy importing
 */

export { TenantScopedRepository } from "./base";
export { EquipmentRepository } from "./equipment";
export { SensorConfigurationRepository } from "./sensor-configuration";
export { SensorStateRepository } from "./sensor-state";
export { PartsRepository } from "./parts";
export { TenantRepositoryFactory, DualWriteAdapter } from "./factory";
