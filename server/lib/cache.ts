/**
 * Redis Cache Client for Inventory Management
 * Provides intelligent caching with graceful degradation and observability
 * Uses shared Redis client factory to avoid multiple connection attempts
 */

import type Redis from "ioredis";
import { Counter, Histogram } from "prom-client";
import { getSharedRedisClient, isRedisEnabled } from "./redis-client.js";
import { createLogger } from "./structured-logger";
const logger = createLogger("Lib:Cache");

interface CacheConfig {
  ttl: number;
  keyPrefix: string;
}

export const cacheMetrics = {
  hits: new Counter({
    name: "cache_hits_total",
    help: "Total number of cache hits",
    labelNames: ["cache_type", "endpoint"],
  }),

  misses: new Counter({
    name: "cache_misses_total",
    help: "Total number of cache misses",
    labelNames: ["cache_type", "endpoint"],
  }),

  errors: new Counter({
    name: "cache_errors_total",
    help: "Total number of cache errors",
    labelNames: ["cache_type", "operation"],
  }),

  latency: new Histogram({
    name: "cache_operation_duration_seconds",
    help: "Cache operation duration",
    labelNames: ["operation"],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  }),
};

export class CacheClient {
  private redis: Redis | null = null;
  private defaultTTL: number;
  private keyPrefix: string;
  private enabled: boolean;

  constructor(config: CacheConfig, enabled: boolean = true) {
    this.defaultTTL = config.ttl;
    this.keyPrefix = config.keyPrefix;
    this.enabled = enabled && isRedisEnabled();
  }

  private async getRedis(): Promise<Redis | null> {
    if (!this.enabled) {
      return null;
    }
    if (this.redis) {
      return this.redis;
    }
    this.redis = await getSharedRedisClient();
    return this.redis;
  }

  async get<T>(key: string): Promise<T | null> {
    const redis = await this.getRedis();
    if (!redis) {
      return null;
    }

    const timer = cacheMetrics.latency.startTimer({ operation: "get" });
    try {
      const data = await redis.get(this.prefixKey(key));
      const result = data ? JSON.parse(data) : null;

      const endpoint = key.split(":")[0];
      if (result) {
        cacheMetrics.hits.inc({ cache_type: this.keyPrefix, endpoint });
      } else {
        cacheMetrics.misses.inc({ cache_type: this.keyPrefix, endpoint });
      }

      return result;
    } catch (error) {
      cacheMetrics.errors.inc({ cache_type: this.keyPrefix, operation: "get" });
      return null;
    } finally {
      timer();
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const redis = await this.getRedis();
    if (!redis) {
      return;
    }

    const timer = cacheMetrics.latency.startTimer({ operation: "set" });
    try {
      const ttl = ttlSeconds ?? this.defaultTTL;
      await redis.setex(this.prefixKey(key), ttl, JSON.stringify(value));
    } catch (error) {
      cacheMetrics.errors.inc({ cache_type: this.keyPrefix, operation: "set" });
    } finally {
      timer();
    }
  }

  async del(key: string | string[]): Promise<void> {
    const redis = await this.getRedis();
    if (!redis) {
      return;
    }

    const timer = cacheMetrics.latency.startTimer({ operation: "del" });
    try {
      const keys = Array.isArray(key) ? key : [key];
      const prefixedKeys = keys.map((k) => this.prefixKey(k));
      if (prefixedKeys.length > 0) {
        await redis.del(...prefixedKeys);
      }
    } catch (error) {
      cacheMetrics.errors.inc({ cache_type: this.keyPrefix, operation: "del" });
    } finally {
      timer();
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const redis = await this.getRedis();
    if (!redis) {
      return;
    }

    const timer = cacheMetrics.latency.startTimer({ operation: "invalidate_pattern" });
    try {
      const keys = await redis.keys(this.prefixKey(pattern));
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      cacheMetrics.errors.inc({ cache_type: this.keyPrefix, operation: "invalidate_pattern" });
    } finally {
      timer();
    }
  }

  private prefixKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  async healthCheck(): Promise<boolean> {
    const redis = await this.getRedis();
    if (!redis) {
      return false;
    }

    try {
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  isHealthy(): boolean {
    return this.redis !== null;
  }
}

const cacheEnabled = process.env.ENABLE_INVENTORY_CACHE !== "false";
const analyticsCacheEnabled = process.env.ENABLE_ANALYTICS_CACHE !== "false";

export const inventoryCache = new CacheClient({ ttl: 900, keyPrefix: "inventory" }, cacheEnabled);

export const analyticsCache = new CacheClient(
  { ttl: 300, keyPrefix: "analytics" },
  analyticsCacheEnabled
);

export const cacheConfig = {
  enabled: cacheEnabled && isRedisEnabled(),
  analyticsEnabled: analyticsCacheEnabled && isRedisEnabled(),
};

if (isRedisEnabled()) {
  logger.info(`[Cache] Inventory cache ${cacheEnabled ? "enabled" : "disabled"} (using shared Redis client)`);
  logger.info(`[Cache] Analytics cache ${analyticsCacheEnabled ? "enabled" : "disabled"} (using shared Redis client)`);
}

/**
 * Org-Scoped Cache Key Builders for Analytics
 * Ensures multi-tenant isolation at cache layer
 */
export const analyticsCacheKeys = {
  equipmentHealth: (orgId: string, equipmentId?: string) =>
    equipmentId ? `${orgId}:equipment-health:${equipmentId}` : `${orgId}:equipment-health:all`,

  rulPredictions: (orgId: string, equipmentId?: string) =>
    equipmentId ? `${orgId}:rul:${equipmentId}` : `${orgId}:rul:all`,

  sensorCoverage: (orgId: string, equipmentId: string) => `${orgId}:sensor-coverage:${equipmentId}`,

  mlModels: (orgId: string, modelType?: string) =>
    modelType ? `${orgId}:ml-models:${modelType}` : `${orgId}:ml-models:all`,

  modelPerformance: (orgId: string, modelId?: string) =>
    modelId ? `${orgId}:model-performance:${modelId}` : `${orgId}:model-performance:all`,

  anomalies: (orgId: string, equipmentId?: string, severity?: string) => {
    if (equipmentId && severity) {
      return `${orgId}:anomalies:${equipmentId}:${severity}`;
    }

    if (equipmentId) {
      return `${orgId}:anomalies:${equipmentId}`;
    }
    return `${orgId}:anomalies:all`;
  },

  failurePredictions: (orgId: string, equipmentId?: string, riskLevel?: string) => {
    if (equipmentId && riskLevel) {
      return `${orgId}:failure-predictions:${equipmentId}:${riskLevel}`;
    }

    if (equipmentId) {
      return `${orgId}:failure-predictions:${equipmentId}`;
    }
    return `${orgId}:failure-predictions:all`;
  },

  realtimePredictions: (orgId: string) => `${orgId}:realtime-predictions`,

  predictionExplainability: (orgId: string, predictionId: string) =>
    `${orgId}:explainability:${predictionId}`,

  featureImportance: (orgId: string, modelId?: string) =>
    modelId ? `${orgId}:feature-importance:${modelId}` : `${orgId}:feature-importance`,

  modelDrift: (orgId: string, modelId?: string) =>
    modelId ? `${orgId}:model-drift:${modelId}` : `${orgId}:model-drift:all`,

  predictionFeedback: (orgId: string, equipmentId?: string) =>
    equipmentId ? `${orgId}:feedback:${equipmentId}` : `${orgId}:feedback:all`,

  llmCosts: (orgId: string, period?: string) =>
    period ? `${orgId}:llm-costs:${period}` : `${orgId}:llm-costs:all`,
};

/**
 * Cache Invalidation Helpers
 * Invalidates related cache entries on data mutations
 */
export const invalidateAnalyticsCache = {
  async equipmentHealth(orgId: string, equipmentId?: string) {
    if (!cacheConfig.analyticsEnabled) {
      return;
    }
    if (equipmentId) {
      await analyticsCache.del(analyticsCacheKeys.equipmentHealth(orgId, equipmentId));
    }
    await analyticsCache.del(analyticsCacheKeys.equipmentHealth(orgId));
  },

  async rulPredictions(orgId: string, equipmentId?: string) {
    if (!cacheConfig.analyticsEnabled) {
      return;
    }
    if (equipmentId) {
      await analyticsCache.del(analyticsCacheKeys.rulPredictions(orgId, equipmentId));
    }
    await analyticsCache.del(analyticsCacheKeys.rulPredictions(orgId));
  },

  async anomalies(orgId: string, equipmentId?: string) {
    if (!cacheConfig.analyticsEnabled) {
      return;
    }
    if (equipmentId) {
      await analyticsCache.invalidatePattern(`${orgId}:anomalies:${equipmentId}*`);
    } else {
      await analyticsCache.invalidatePattern(`${orgId}:anomalies*`);
    }
  },

  async failurePredictions(orgId: string, equipmentId?: string) {
    if (!cacheConfig.analyticsEnabled) {
      return;
    }
    if (equipmentId) {
      await analyticsCache.invalidatePattern(`${orgId}:failure-predictions:${equipmentId}*`);
    } else {
      await analyticsCache.invalidatePattern(`${orgId}:failure-predictions*`);
    }
  },

  async mlModels(orgId: string) {
    if (!cacheConfig.analyticsEnabled) {
      return;
    }
    await analyticsCache.invalidatePattern(`${orgId}:ml-models*`);
  },

  async allForOrg(orgId: string) {
    if (!cacheConfig.analyticsEnabled) {
      return;
    }
    await analyticsCache.invalidatePattern(`${orgId}:*`);
  },
};

/**
 * Generic caching wrapper for analytics functions
 * Provides automatic cache-aside pattern with graceful degradation
 */
export async function cachedAnalytics<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  if (!cacheConfig.analyticsEnabled) {
    return fetchFn();
  }

  try {
    const cached = await analyticsCache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const result = await fetchFn();
    await analyticsCache.set(cacheKey, result, ttlSeconds);
    return result;
  } catch (error) {
    logger.error("[Cache] Analytics caching error, falling back to direct fetch:", undefined, error);
    return fetchFn();
  }
}
