/**
 * Legacy ML training queue shim.
 *
 * Replaced by the modular training pipeline. The shutdown hook in
 * bootstrap/shutdown.ts still references this; we expose a safe no-op so
 * graceful shutdown does not throw.
 */

export const mlTrainingQueue = {
  async shutdown(): Promise<void> {
    // no-op: legacy queue no longer exists
  },
};
