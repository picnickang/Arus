/**
 * Dev Fake Data Service - Module Aggregator
 * 
 * Re-exports all dev fake data modules for convenient imports.
 * 
 * Module structure (1,039 lines → 12 files):
 * - types.ts (~30 lines): SeedFakeDataOptions, SeedResult
 * - dev-guards.ts (~70 lines): Dev mode checks, lock management, logging
 * - physics-utils.ts (~25 lines): PhysicsUtil class
 * - scale-conversions.ts (~35 lines): Beaufort and sea state conversions
 * - sensor-units.ts (~50 lines): Sensor unit definitions
 * - generators/navigation.ts (~60 lines): NavigationGenerator
 * - generators/weather.ts (~110 lines): WeatherGenerator
 * - generators/engine-telemetry.ts (~60 lines): EngineTelemetryGenerator
 * - generators/generator-telemetry.ts (~40 lines): GeneratorTelemetryGenerator
 * - generators/index.ts (~15 lines): Generators aggregator
 * - seeding/event-seeder.ts (~100 lines): Event seeding
 * - seeding/telemetry-seeder.ts (~250 lines): Telemetry seeding
 * - seeding/scenarios.ts (~260 lines): Scenario functions
 * - seeding/index.ts (~15 lines): Seeding aggregator
 * - index.ts (~35 lines): This aggregator
 */

export type { SeedFakeDataOptions, SeedResult } from "./types.js";
export { isDevModeEnabled, assertDevMode, log } from "./dev-guards.js";
export { PhysicsUtil } from "./physics-utils.js";
export { windSpeedToBeaufort, waveHeightToSeaState } from "./scale-conversions.js";
export { getSensorUnit } from "./sensor-units.js";
export {
  NavigationGenerator,
  WeatherGenerator,
  EngineTelemetryGenerator,
  GeneratorTelemetryGenerator,
} from "./generators/index.js";
export {
  seedFakeEvents,
  seedFakeTelemetryAndEvents,
  seedFakeEngineRoomLogScenario,
  seedFakeDeckLogScenario,
  seedBothLogScenarios,
} from "./seeding/index.js";
