/**
 * Observability Module - Backward Compatibility Re-export
 * 
 * This file re-exports all observability metrics from modular domain-specific files.
 * 
 * MODULARIZATION COMPLETE:
 * - Original: 1,567 lines
 * - New: ~100 lines (re-exports only)
 * - Reduction: 94%
 * 
 * New code should import directly from './observability/index' or specific modules.
 * This file exists for backward compatibility with existing imports.
 * 
 * Module Structure (server/observability/):
 * - core-metrics.ts: Event loop, database, memory monitoring
 * - http-metrics.ts: HTTP request metrics and middleware
 * - performance-tracking.ts: Performance tracking utilities
 * - websocket-metrics.ts: WebSocket connection metrics
 * - equipment-metrics.ts: Equipment, fleet health, work order metrics
 * - alert-metrics.ts: Alert system metrics
 * - mqtt-metrics.ts: MQTT reliable sync metrics
 * - security-metrics.ts: Tenant isolation and auth metrics
 * - ml-metrics.ts: ML prediction metrics
 * - hub-sync-metrics.ts: Hub/sync/sheet metrics
 * - rag-metrics.ts: RAG/knowledge base metrics
 * - job-queue-metrics.ts: Job queue metrics
 * - reconciliation-metrics.ts: Data reconciliation metrics
 * - telemetry-ingestion-metrics.ts: Telemetry processing metrics
 * - circuit-breaker-metrics.ts: External circuit breaker metrics
 * - health-endpoints.ts: Health check endpoints
 * - initialization.ts: Metrics initialization
 * - index.ts: Aggregator (this file re-exports from here)
 * 
 * Pre-existing modules:
 * - inventory-metrics.ts: Advanced inventory management metrics
 * - optimizer-metrics.ts: LP optimizer metrics
 * - scheduler-metrics.ts: Scheduler metrics
 * - telemetry-metrics.ts: Telemetry metrics
 */

// Re-export everything from the modular index
export * from "./observability/index";
