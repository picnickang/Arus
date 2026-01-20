/**
 * Service-Level Metrics Registration
 * 
 * This module triggers loading of service modules that define their own Prometheus
 * metrics. By importing these modules, we ensure their metrics get registered
 * with the default prom-client registry at startup.
 * 
 * Metrics registered by loaded modules:
 * - Circuit Breaker (circuitBreaker.ts): arus_circuit_breaker_state, arus_circuit_breaker_failures_total, arus_circuit_breaker_successes_total
 * - Dead Letter Queue (dead-letter-queue/index.ts): arus_dlq_entries_total, arus_dlq_added_total, arus_dlq_replayed_total
 * - SQLite Bridge (sqlite-bridge/index.ts): arus_bridge_frames_processed_total, arus_bridge_readings_decoded_total, etc.
 */

import { structuredLog } from '../logging';

let initialized = false;

export async function initializeServiceMetrics(): Promise<void> {
  if (initialized) {
    return;
  }

  try {
    await import('../services/circuit-breaker/circuitBreaker');
  } catch (err) {
    structuredLog('warn', 'Failed to load circuit-breaker metrics', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await import('../services/dead-letter-queue');
  } catch (err) {
    structuredLog('warn', 'Failed to load dead-letter-queue metrics', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await import('../services/sqlite-bridge');
  } catch (err) {
  }

  initialized = true;
  structuredLog('info', 'Service-level Prometheus metrics registered', {
    operation: 'metrics_init',
    metadata: {
      modules: ['circuit-breaker', 'dead-letter-queue', 'sqlite-bridge'],
    },
  });
}

export function getServiceMetricsStatus(): { initialized: boolean; modules: string[] } {
  return {
    initialized,
    modules: ['circuit-breaker', 'dead-letter-queue', 'sqlite-bridge'],
  };
}
