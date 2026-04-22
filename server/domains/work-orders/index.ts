/**
 * Work Orders Domain
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
export { registerWorkOrderRoutes } from "./interfaces";

// Backward compatibility shims (deprecated) - removed, use hexagonal layers instead
export { workOrderAppService as workOrderService } from "./application";
export { workOrderRepoAdapter as workOrderRepository } from "./infrastructure";
