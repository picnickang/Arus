/**
 * Crew Extensions Domain
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
export * from "./interfaces/index.js";

// Event bridge for WebSocket real-time updates
export {
  setupSimulationEventBridge,
  setWebSocketServer as setSimulationWebSocketServer,
} from "./infrastructure/simulation-event-bridge.js";

// Backward compatibility aliases
export { crewExtensionsAppService as crewExtensionsService } from "./application/index.js";
