/**
 * Logbook Domain Routes - Backward Compatibility Shim
 * 
 * DEPRECATED: This file re-exports from the modular routes/ directory.
 * New code should import directly from './routes/index.js'.
 * 
 * Original: 1,150 lines → Modularized into 5 files:
 * - routes/types.ts (45 lines): Shared types
 * - routes/deck-log-routes.ts (~335 lines): Deck logbook handlers
 * - routes/engine-log-routes.ts (~380 lines): Engine logbook handlers
 * - routes/autofill-routes.ts (~160 lines): Auto-fill & anomaly detection
 * - routes/index.ts (~35 lines): Aggregator
 */

export { registerLogbookRoutes } from "./routes/index";
export * from "./routes/types";
