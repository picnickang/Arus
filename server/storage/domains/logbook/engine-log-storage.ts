/**
 * Engine Log Storage - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export type { EngineLogFilters, EngineLogEventFilters, SignData, LockData, EngineLogComplete } from "./engine-log/index.js";
export { DbEngineLogStorage, DbEngineLogStorage as DatabaseEngineLogStorage } from "./engine-log/index.js";
