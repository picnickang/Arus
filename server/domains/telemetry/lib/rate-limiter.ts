/**
 * Telemetry Rate Limiter Service
 *
 * Enforces sensor rate limits and deadband filtering.
 * Caches sensor configurations for fast lookup.
 *
 * Features:
 * - Per-sensor rate limiting (sampleRateHz)
 * - Deadband filtering (skip readings within threshold)
 * - Configuration caching with TTL
 * - Grace period multiplier for intermittent sensors
 *
 * Module size: ~180 lines (target 100-250)
 */

import { logger } from "../../../utils/logger";

export interface SensorRateConfig {
  equipmentId: string;
  sensorType: string;
  sampleRateHz: number;
  expectedIntervalMs: number;
  deadband: number;
  graceMultiplier: number;
  enabled: boolean;
}

interface SensorState {
  lastValue: number | null;
  lastTimestamp: number;
  config: SensorRateConfig;
  configLoadedAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: "rate_limited" | "deadband_filtered" | "disabled";
  nextAllowedMs?: number;
}

export interface RateLimiterConfig {
  configCacheTtlMs: number;
  defaultSampleRateHz: number;
  defaultDeadband: number;
  defaultGraceMultiplier: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  configCacheTtlMs: 60000,
  defaultSampleRateHz: 1,
  defaultDeadband: 0,
  defaultGraceMultiplier: 1.5,
};

type ConfigLoader = (equipmentId: string, sensorType: string) => Promise<SensorRateConfig | null>;

export class TelemetryRateLimiter {
  private sensorStates = new Map<string, SensorState>();
  private config: RateLimiterConfig;
  private configLoader?: ConfigLoader;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfigLoader(loader: ConfigLoader): void {
    this.configLoader = loader;
  }

  private getSensorKey(equipmentId: string, sensorType: string): string {
    return `${equipmentId}:${sensorType}`;
  }

  private getDefaultConfig(equipmentId: string, sensorType: string): SensorRateConfig {
    return {
      equipmentId,
      sensorType,
      sampleRateHz: this.config.defaultSampleRateHz,
      expectedIntervalMs: 1000 / this.config.defaultSampleRateHz,
      deadband: this.config.defaultDeadband,
      graceMultiplier: this.config.defaultGraceMultiplier,
      enabled: true,
    };
  }

  async checkReading(
    equipmentId: string,
    sensorType: string,
    value: number,
    timestamp: number = Date.now()
  ): Promise<RateLimitResult> {
    const key = this.getSensorKey(equipmentId, sensorType);
    let state = this.sensorStates.get(key);

    if (!state || this.isConfigStale(state)) {
      const config = await this.loadConfig(equipmentId, sensorType);
      state = {
        lastValue: null,
        lastTimestamp: 0,
        config,
        configLoadedAt: Date.now(),
      };
      this.sensorStates.set(key, state);
    }

    if (!state.config.enabled) {
      return { allowed: false, reason: "disabled" };
    }

    const minIntervalMs = state.config.expectedIntervalMs * state.config.graceMultiplier;
    const timeSinceLastMs = timestamp - state.lastTimestamp;

    if (state.lastTimestamp > 0 && timeSinceLastMs < minIntervalMs) {
      return {
        allowed: false,
        reason: "rate_limited",
        nextAllowedMs: minIntervalMs - timeSinceLastMs,
      };
    }

    if (state.config.deadband > 0 && state.lastValue !== null) {
      const delta = Math.abs(value - state.lastValue);
      if (delta < state.config.deadband) {
        return { allowed: false, reason: "deadband_filtered" };
      }
    }

    state.lastValue = value;
    state.lastTimestamp = timestamp;
    return { allowed: true };
  }

  private isConfigStale(state: SensorState): boolean {
    return Date.now() - state.configLoadedAt > this.config.configCacheTtlMs;
  }

  private async loadConfig(equipmentId: string, sensorType: string): Promise<SensorRateConfig> {
    if (this.configLoader) {
      try {
        const config = await this.configLoader(equipmentId, sensorType);
        if (config) {
          return config;
        }
      } catch (err) {
        logger.warn("TelemetryRateLimiter", "Failed to load config, using defaults", {
          equipmentId,
          sensorType,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return this.getDefaultConfig(equipmentId, sensorType);
  }

  updateConfig(equipmentId: string, sensorType: string, config: Partial<SensorRateConfig>): void {
    const key = this.getSensorKey(equipmentId, sensorType);
    const state = this.sensorStates.get(key);

    if (state) {
      state.config = { ...state.config, ...config };
      state.configLoadedAt = Date.now();
    } else {
      const fullConfig = { ...this.getDefaultConfig(equipmentId, sensorType), ...config };
      this.sensorStates.set(key, {
        lastValue: null,
        lastTimestamp: 0,
        config: fullConfig,
        configLoadedAt: Date.now(),
      });
    }
  }

  getStats(): { totalSensors: number; configCacheHits: number } {
    return {
      totalSensors: this.sensorStates.size,
      configCacheHits: this.sensorStates.size,
    };
  }

  clearCache(): void {
    this.sensorStates.clear();
  }
}

export const telemetryRateLimiter = new TelemetryRateLimiter();
