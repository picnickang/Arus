/**
 * Equipment Service - Backward Compatible Shim
 * Delegates to modular files in ./service/
 */

export type {
  PaginationOptions,
  PaginatedResult,
  SensorCoverageResult,
  SensorSetupResult,
} from "./service/index.js";
export { EquipmentService, equipmentService } from "./service/index.js";
