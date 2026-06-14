/**
 * Notifications Domain
 * DDD Modular Monolith with Hexagonal Architecture
 *
 * Layers:
 * - domain/: types, ports
 * - application/: use-case orchestration (service with DI)
 * - infrastructure/: port implementation (repository adapter)
 * - interfaces/: HTTP routes
 */
export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export * from "./interfaces";
