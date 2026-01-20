/**
 * Aquametro FMCC - Index
 * 
 * Modularized Aquametro FMCC Integration
 * 
 * Original: 858 lines
 * Modularized into 9 files:
 * - types.ts (~108 lines): Configuration and data types
 * - config.ts (~45 lines): Configuration loader
 * - mock-data.ts (~56 lines): Mock data generators
 * - rest-client.ts (~168 lines): REST API client
 * - modbus-client.ts (~51 lines): Modbus TCP client (stubbed)
 * - service-core.ts (~89 lines): Core service class
 * - efficiency-calculator.ts (~62 lines): Efficiency calculations
 * - service-operations.ts (~256 lines): Data fetching operations
 */

import { AquametroFMCCService, getFMCCService } from "./service-operations.js";

export { AquametroFMCCService, getFMCCService };

export { AquametroFMCCServiceCore } from "./service-core.js";

export { loadFMCCConfig } from "./config.js";

export { generateMockInstantFlow, generateMockCumulativeCounters } from "./mock-data.js";

export { FMCCRestClient } from "./rest-client.js";

export { FMCCModbusClient } from "./modbus-client.js";

export type {
  FMCCConfig,
  FMCCInstantFlow,
  FMCCCumulativeCounters,
  FMCCEngineEfficiency,
  FMCCMeterStatus,
  FMCCAlarm,
  FMCCRawSample,
  FMCCServiceResult,
} from "./types.js";

export default getFMCCService;
