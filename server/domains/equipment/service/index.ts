/**
 * Equipment Service - Modular Exports
 */

export type {
  PaginationOptions,
  PaginatedResult,
  SensorCoverageResult,
  SensorSetupResult,
} from "./types.js";
export type {
  DecommissionResult,
  DecommissionedEquipmentWithEvent,
} from "./decommission-operations.js";
export { DEFAULT_SENSORS } from "./types.js";
export { EquipmentService, equipmentService } from "./main.js";
