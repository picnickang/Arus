/**
 * Aquametro FMCC - Configuration Loader
 */

import type { FMCCConfig } from "./types.js";

export function loadFMCCConfig(): FMCCConfig {
  const enabled = process.env['FMCC_ENABLED'] === "true";
  const protocol = (process.env['FMCC_PROTOCOL'] || "rest") as "rest" | "modbus";

  const pollIntervalMs = Number.parseInt(process.env['FMCC_POLLING_INTERVAL_MS'] || "", 10);
  const pollIntervalSec = Number.parseInt(process.env['FMCC_POLL_INTERVAL_SECONDS'] || "", 10);
  const pollIntervalSeconds = !Number.isNaN(pollIntervalMs)
    ? pollIntervalMs / 1000
    : !Number.isNaN(pollIntervalSec)
      ? pollIntervalSec
      : 60;

  const config: FMCCConfig = {
    enabled,
    protocol,
    pollIntervalSeconds,
    retryAttempts: Number.parseInt(process.env['FMCC_RETRY_ATTEMPTS'] || "3", 10),
    retryDelayMs: Number.parseInt(process.env['FMCC_RETRY_DELAY_MS'] || "1000", 10),
  };

  if (protocol === "rest") {
    config.restConfig = {
      baseUrl: process.env['FMCC_API_URL'] || process.env['FMCC_BASE_URL'] || "",
      apiKey: process.env['FMCC_API_KEY'],
      username: process.env['FMCC_USERNAME'],
      password: process.env['FMCC_PASSWORD'],
      timeoutMs: Number.parseInt(process.env['FMCC_TIMEOUT_MS'] || "10000", 10),
    };
  } else if (protocol === "modbus") {
    config.modbusConfig = {
      host: process.env['FMCC_MODBUS_HOST'] || "localhost",
      port: Number.parseInt(process.env['FMCC_MODBUS_PORT'] || "502", 10),
      unitId: Number.parseInt(process.env['FMCC_MODBUS_UNIT_ID'] || "1", 10),
      timeoutMs: Number.parseInt(process.env['FMCC_TIMEOUT_MS'] || "5000", 10),
    };
  }

  return config;
}
