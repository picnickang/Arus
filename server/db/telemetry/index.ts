/**
 * Telemetry Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseTelemetryStorage } from "./db-telemetry.js";

import { DatabaseTelemetryStorage } from "./db-telemetry.js";

export const dbTelemetryStorage = new DatabaseTelemetryStorage();

console.log("[Telemetry Repository] Loaded 4 modular files");
