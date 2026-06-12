/**
 * Immutable Audit Trail Service - Backward Compatibility Shim
 *
 * This file maintains backward compatibility with existing imports.
 * The actual implementation has been modularized into ./immutable-audit/
 *
 * @see ./immutable-audit/index.ts - Main entry point
 * @see ./immutable-audit/types.ts - Type definitions
 * @see ./immutable-audit/hashing.ts - Hash computation
 * @see ./immutable-audit/log-event-postgres.ts - PostgreSQL logging
 * @see ./immutable-audit/log-event-sqlite.ts - SQLite logging
 * @see ./immutable-audit/query.ts - Query operations
 * @see ./immutable-audit/verify.ts - Chain verification
 * @see ./immutable-audit/convenience-loggers.ts - Pre-configured loggers
 */

export * from "./immutable-audit/index";
export { auditService } from "./immutable-audit/index";
