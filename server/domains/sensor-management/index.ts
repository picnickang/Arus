/**
 * Sensor Management Domain
 * DDD Modular Monolith with Hexagonal Architecture
 *
 * Layers: domain/ application/ infrastructure/ interfaces/
 * Cross-domain reads (equipment, ML optimization, telemetry history) are
 * injected via composition.
 */
export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export { registerSensorManagementRoutes } from "./interfaces";
export type { SensorManagementConfig } from "./interfaces";
