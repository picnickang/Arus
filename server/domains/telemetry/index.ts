/**
 * Telemetry Domain
 * DDD Modular Monolith with Hexagonal Architecture
 *
 * Layers: domain/ application/ infrastructure/ interfaces/
 * The cross-domain reads (sensor configs, device heartbeats, open alerts) are
 * injected via composition; ingestion routes remain a separate flat module.
 */
export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export * from "./interfaces";
