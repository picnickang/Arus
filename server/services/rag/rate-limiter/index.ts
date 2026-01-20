/**
 * RAG Rate Limiter Service
 * User-level rate limiting with Redis sliding window
 */

import { Request, Response, NextFunction } from "express";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxTokensPerMinute: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

interface RateLimitEntry {
  count: number;
  tokens: number;
  windowStart: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 20,
  maxTokensPerMinute: 50000,
  keyPrefix: "rag:ratelimit:",
};

class InMemoryRateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_CONFIG) {
    this.config = config;
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart > this.config.windowMs * 2) {
        this.entries.delete(key);
      }
    }
  }

  async checkLimit(userId: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}${userId}`;
    const now = Date.now();

    let entry = this.entries.get(key);

    if (!entry || now - entry.windowStart > this.config.windowMs) {
      entry = { count: 0, tokens: 0, windowStart: now };
      this.entries.set(key, entry);
    }

    const remaining = this.config.maxRequests - entry.count;
    const resetAt = new Date(entry.windowStart + this.config.windowMs);

    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: entry.windowStart + this.config.windowMs - now,
      };
    }

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
    };
  }

  async recordRequest(userId: string, tokensUsed: number = 0): Promise<void> {
    const key = `${this.config.keyPrefix}${userId}`;
    const now = Date.now();

    let entry = this.entries.get(key);

    if (!entry || now - entry.windowStart > this.config.windowMs) {
      entry = { count: 0, tokens: 0, windowStart: now };
    }

    entry.count++;
    entry.tokens += tokensUsed;
    this.entries.set(key, entry);
  }

  async checkTokenLimit(userId: string, estimatedTokens: number): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}tokens:${userId}`;
    const now = Date.now();

    let entry = this.entries.get(key);

    if (!entry || now - entry.windowStart > this.config.windowMs) {
      entry = { count: 0, tokens: 0, windowStart: now };
      this.entries.set(key, entry);
    }

    const remainingTokens = this.config.maxTokensPerMinute - entry.tokens;
    const resetAt = new Date(entry.windowStart + this.config.windowMs);

    if (entry.tokens + estimatedTokens > this.config.maxTokensPerMinute) {
      return {
        allowed: false,
        remaining: remainingTokens,
        resetAt,
        retryAfterMs: entry.windowStart + this.config.windowMs - now,
      };
    }

    return {
      allowed: true,
      remaining: remainingTokens - estimatedTokens,
      resetAt,
    };
  }

  getConfig(): RateLimitConfig {
    return this.config;
  }

  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const rateLimiter = new InMemoryRateLimiter();

export function createRateLimitMiddleware(
  config?: Partial<RateLimitConfig>
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const limiter = config ? new InMemoryRateLimiter({ ...DEFAULT_CONFIG, ...config }) : rateLimiter;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).user?.id || (req as any).session?.userId || req.ip || "anonymous";

    try {
      const result = await limiter.checkLimit(userId);

      res.setHeader("X-RateLimit-Limit", limiter.getConfig().maxRequests.toString());
      res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
      res.setHeader("X-RateLimit-Reset", result.resetAt.toISOString());

      if (!result.allowed) {
        res.setHeader("Retry-After", Math.ceil((result.retryAfterMs || 0) / 1000).toString());
        res.status(429).json({
          success: false,
          error: "Rate limit exceeded",
          message: `Too many requests. Please try again in ${Math.ceil((result.retryAfterMs || 0) / 1000)} seconds.`,
          retryAfter: result.retryAfterMs,
        });
        return;
      }

      await limiter.recordRequest(userId);
      next();
    } catch (error) {
      console.error("[RateLimiter] Error checking rate limit:", error);
      next();
    }
  };
}

export { InMemoryRateLimiter };
