export interface BridgeConfig {
  sqlitePath: string;
  batchSize: number;
  pollIntervalMs: number;
  maxQueueDepth: number;
}

export function loadBridgeConfig(): BridgeConfig {
  const sqlitePath = process.env.ARUS_SQLITE_PATH;

  if (!sqlitePath) {
    throw new Error("ARUS_SQLITE_PATH environment variable is required");
  }

  const batchSize = parseInt(process.env.ARUS_BRIDGE_BATCH_SIZE || "2000", 10);
  const pollIntervalMs = parseInt(process.env.ARUS_BRIDGE_POLL_MS || "500", 10);
  const maxQueueDepth = parseInt(process.env.ARUS_BRIDGE_MAX_QUEUE || "5000", 10);

  if (batchSize < 1 || batchSize > 10000) {
    throw new Error("ARUS_BRIDGE_BATCH_SIZE must be between 1 and 10000");
  }

  if (pollIntervalMs < 50 || pollIntervalMs > 10000) {
    throw new Error("ARUS_BRIDGE_POLL_MS must be between 50 and 10000");
  }

  return {
    sqlitePath,
    batchSize,
    pollIntervalMs,
    maxQueueDepth,
  };
}

export function loadBridgeConfigSafe(): BridgeConfig | null {
  try {
    return loadBridgeConfig();
  } catch {
    return null;
  }
}
