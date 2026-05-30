/**
 * Safety Bulletin Domain
 * DDD Modular Monolith with Hexagonal Architecture (cloud-only).
 *
 * Layers:
 * - domain/: Pure business logic (types, ports)
 * - application/: Use case orchestration (service with DI)
 * - infrastructure/: Port implementations (repository adapter)
 * - interfaces/: HTTP routes
 */

export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export * from "./interfaces";
