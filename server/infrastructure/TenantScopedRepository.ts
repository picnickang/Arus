/**
 * Tenant-Scoped Repository Pattern (ADR 001 Implementation)
 *
 * BACKWARD COMPATIBILITY SHIM
 * This file re-exports all tenant-scoped repositories from their modular files.
 * Original monolith: 908 lines → Modular structure: 6 files (~700 lines total)
 *
 * Modules:
 * - tenant-scoped/base.ts: TenantScopedRepository base class
 * - tenant-scoped/equipment.ts: EquipmentRepository
 * - tenant-scoped/sensor-configuration.ts: SensorConfigurationRepository
 * - tenant-scoped/sensor-state.ts: SensorStateRepository
 * - tenant-scoped/parts.ts: PartsRepository
 * - tenant-scoped/factory.ts: TenantRepositoryFactory, DualWriteAdapter
 */

export {
  TenantScopedRepository,
  EquipmentRepository,
  SensorConfigurationRepository,
  SensorStateRepository,
  PartsRepository,
  TenantRepositoryFactory,
  DualWriteAdapter,
} from "./tenant-scoped";
