/**
 * Telemetry Pipeline Integration Test Suite
 *
 * Comprehensive end-to-end testing for the ARUS telemetry ingestion pipeline.
 *
 * Test Modules:
 * - fixtures.ts: Test data generators for J1939/J1587 protocol frames
 * - pipeline.integration.test.ts: Frame decoding, validation, and processing
 * - persistence.integration.test.ts: PostgreSQL persistence and consistency
 * - resilience.integration.test.ts: Circuit breaker and dead-letter queue
 * - pages.integration.test.ts: Page-level data contract validation
 *
 * Pipeline Architecture:
 * Hardware → C# Agent → SQLite → Node Bridge (BridgeProcessor) → PostgreSQL
 *
 * Components Under Test:
 * - SqliteRawFrameSource: Fetches frames from SQLite
 * - BridgeProcessor: Decodes frames and validates readings
 * - TelemetryBatchWriter: Batches and persists readings
 * - CircuitBreaker: Protects against PostgreSQL failures
 * - DeadLetterQueue: Handles failed writes for replay
 *
 * Run Tests:
 * npm test -- --testPathPattern=telemetry-pipeline
 */

export * from "./fixtures";
