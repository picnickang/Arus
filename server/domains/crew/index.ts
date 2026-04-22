/**
 * Crew Domain
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
export { registerCrewRoutes } from "./interfaces";

// Backward compatibility aliases
export { crewAppService as crewService } from "./application";
export { crewMemberRepository as crewRepository } from "./infrastructure";
