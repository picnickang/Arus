/**
 * Aquametro FMCC Integration - Backward Compatibility Shim
 * 
 * This file re-exports from the modular aquametro-fmcc/ directory.
 * New code should import from './aquametro-fmcc/index.js'
 * 
 * Original: 858 lines → 7 modular files
 */

export {
  AquametroFMCCService,
  getFMCCService,
  loadFMCCConfig,
  generateMockInstantFlow,
  generateMockCumulativeCounters,
  FMCCRestClient,
  FMCCModbusClient,
} from "./aquametro-fmcc/index.js";

export type {
  FMCCConfig,
  FMCCInstantFlow,
  FMCCCumulativeCounters,
  FMCCEngineEfficiency,
  FMCCMeterStatus,
  FMCCAlarm,
  FMCCRawSample,
  FMCCServiceResult,
} from "./aquametro-fmcc/index.js";

export { getFMCCService as default } from "./aquametro-fmcc/index.js";
