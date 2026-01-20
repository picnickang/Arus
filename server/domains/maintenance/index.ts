/**
 * Maintenance Domain
 * DDD Modular Monolith with Hexagonal Architecture
 * 
 * Layers:
 * - domain/: Pure business logic (types, events, ports)
 * - application/: Use case orchestration (service with DI)
 * - infrastructure/: Port implementations (repository and event adapters)
 * - interfaces/: HTTP routes and external adapters
 */

// Re-export from hexagonal layers
export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export * from "./interfaces";
