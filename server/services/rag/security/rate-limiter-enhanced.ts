/**
 * Enhanced Rate Limiter for RAG
 * Redis-backed with fallback to in-memory, per-user rate limiting
 */

import { logger } from "../../../utils/logger.js";
import { getSharedRedisClient, isRedisEnabled } from "../../../lib/redis-client.js";
import type { RagSecurityConfig } from "./types.js";

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  requests: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export class EnhancedRateLimiter {
  private config: RagSecurityConfig["rateLimiting"];
  private memoryStore: Map<string, RateLimitEntry> = new Map();
  private redis: import("ioredis").Redis | null = null;
  private redisAvailable: boolean = false;

  constructor(config: RagSecurityConfig["rateLimiting"]) {
    this.config = config;
    if (config.useRedis && isRedisEnabled()) {
      this.initRedis();
    }

    setInterval(() => this.cleanupMemoryStore(), 60000);
  }

  private async initRedis(): Promise<void> {
    try {
      this.redis = await getSharedRedisClient();
      if (this.redis) {
        this.redisAvailable = true;
        logger.info("RateLimiter", "Using shared Redis client for rate limiting");
      } else {
        this.redisAvailable = false;
      }
    } catch (error) {
      logger.warn("RateLimiter", "Redis unavailable, falling back to in-memory", error);
      this.redisAvailable = false;
    }
  }

  /**
   * Check if request is allowed and consume a token
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: this.config.requestsPerMinute,
        resetAt: Date.now() + 60000,
      };
    }

    const key = `rag:ratelimit:${identifier}`;
    const now = Date.now();

    if (this.redisAvailable && this.redis) {
      return this.checkLimitRedis(key, now);
    }
    return this.checkLimitMemory(key, now);
  }

  private async checkLimitRedis(key: string, now: number): Promise<RateLimitResult> {
    try {
      const windowMs = this.config.windowSizeSeconds * 1000;
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const windowKey = `${key}:${windowStart}`;

      // Use Redis transaction for atomic operations
      if (!this.redis) {
        throw new Error("Redis client not initialized");
      }
      const redis = this.redis;
      const multi = redis.multi();
      multi.incr(windowKey);
      multi.pttl(windowKey);

      const results = await multi.exec();
      if (!results) {
        throw new Error("Redis multi.exec() returned null");
      }
      const count = results[0]![1] as number;
      const ttl = results[1]![1] as number;

      // Set expiry on first request
      if (count === 1) {
        await redis.pexpire(windowKey, windowMs);
      }

      const allowed = count <= this.config.requestsPerMinute;
      const remaining = Math.max(0, this.config.requestsPerMinute - count);
      const resetAt = windowStart + windowMs;

      if (!allowed) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter: Math.ceil((resetAt - now) / 1000),
        };
      }

      return { allowed, remaining, resetAt };
    } catch (error) {
      logger.error("RateLimiter", "Redis error, falling back to memory", error);
      this.redisAvailable = false;
      return this.checkLimitMemory(key, now);
    }
  }

  private checkLimitMemory(key: string, now: number): RateLimitResult {
    const windowMs = this.config.windowSizeSeconds * 1000;
    let entry = this.memoryStore.get(key);

    if (!entry || now - entry.lastRefill >= windowMs) {
      // New window
      entry = {
        tokens: this.config.requestsPerMinute - 1,
        lastRefill: now,
        requests: 1,
      };
      this.memoryStore.set(key, entry);
      return {
        allowed: true,
        remaining: entry.tokens,
        resetAt: now + windowMs,
      };
    }

    // Existing window
    entry.requests++;

    if (entry.requests > this.config.requestsPerMinute) {
      const resetAt = entry.lastRefill + windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      };
    }

    entry.tokens = this.config.requestsPerMinute - entry.requests;
    this.memoryStore.set(key, entry);

    return {
      allowed: true,
      remaining: entry.tokens,
      resetAt: entry.lastRefill + windowMs,
    };
  }

  /**
   * Get current limit status without consuming a token
   */
  async getStatus(identifier: string): Promise<{ remaining: number; resetAt: number }> {
    const key = `rag:ratelimit:${identifier}`;
    const now = Date.now();
    const windowMs = this.config.windowSizeSeconds * 1000;

    if (this.redisAvailable && this.redis) {
      try {
        const windowStart = Math.floor(now / windowMs) * windowMs;
        const windowKey = `${key}:${windowStart}`;
        const count = await this.redis.get(windowKey);
        const remaining = Math.max(0, this.config.requestsPerMinute - parseInt(count || "0", 10));
        return { remaining, resetAt: windowStart + windowMs };
      } catch {
        // Fall through to memory
      }
    }

    const entry = this.memoryStore.get(key);
    if (!entry) {
      return { remaining: this.config.requestsPerMinute, resetAt: now + windowMs };
    }

    if (now - entry.lastRefill >= windowMs) {
      return { remaining: this.config.requestsPerMinute, resetAt: now + windowMs };
    }

    return {
      remaining: Math.max(0, this.config.requestsPerMinute - entry.requests),
      resetAt: entry.lastRefill + windowMs,
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `rag:ratelimit:${identifier}`;
    this.memoryStore.delete(key);

    if (this.redisAvailable && this.redis) {
      try {
        const keys = await this.redis.keys(`${key}:*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        logger.error("RateLimiter", "Failed to reset Redis keys", error);
      }
    }
  }

  private cleanupMemoryStore(): void {
    const now = Date.now();
    const windowMs = this.config.windowSizeSeconds * 1000;

    for (const [key, entry] of this.memoryStore.entries()) {
      if (now - entry.lastRefill > windowMs * 2) {
        this.memoryStore.delete(key);
      }
    }
  }

  updateConfig(config: RagSecurityConfig["rateLimiting"]): void {
    this.config = config;
    if (config.useRedis && !this.redisAvailable) {
      this.initRedis();
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

let instance: EnhancedRateLimiter | null = null;

export function getEnhancedRateLimiter(
  config: RagSecurityConfig["rateLimiting"]
): EnhancedRateLimiter {
  if (!instance) {
    instance = new EnhancedRateLimiter(config);
  }
  return instance;
}

export function updateRateLimiterConfig(config: RagSecurityConfig["rateLimiting"]): void {
  if (instance) {
    instance.updateConfig(config);
  }
}
