/**
 * Safety Alarms Domain (cloud-only)
 * DDD Modular Monolith with Hexagonal Architecture.
 *
 * Configurable emergency alarm types + active vessel/fleet alarms with
 * acknowledgement tracking. In-app emergency notice only — never a
 * replacement for physical alarms or muster procedures.
 */

export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export * from "./interfaces";
export { safetyAlarmService } from "./service";
