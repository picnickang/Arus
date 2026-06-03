/**
 * Crew Task Domain
 * DDD Modular Monolith with Hexagonal Architecture (cloud-only).
 *
 * Layers:
 * - domain/: Pure business logic (types, ports)
 * - application/: Use case orchestration (service with DI)
 * - infrastructure/: Port implementations (repository + effects adapters)
 * - interfaces/: HTTP routes
 */

export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export * from "./interfaces";
