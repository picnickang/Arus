/**
 * Inventory (Parts) Domain
 * DDD Modular Monolith with Hexagonal Architecture
 * 
 * Layers:
 * - domain/: Pure business logic (types, events, ports)
 * - application/: Use case orchestration (service with DI)
 * - infrastructure/: Port implementations (repository and event adapters)
 * - interfaces/: HTTP routes and external adapters
 */

// Re-export from hexagonal layers
export * from "./domain/index.js";
export * from "./application/index.js";
export * from "./infrastructure/index.js";
export * from "./interfaces/index";

// Backward compatibility shims (deprecated) - removed, use hexagonal layers instead
export { inventoryAppService as inventoryService } from "./application/index.js";
export { partsInventoryRepository as inventoryRepository } from "./infrastructure/index.js";
