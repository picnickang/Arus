/**
 * Cache Middleware for Express
 * Automatically caches GET responses and invalidates on updates
 */

import { Request, Response, NextFunction } from "express";
import { inventoryCache, cacheConfig } from "../lib/cache";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Middleware:CacheMiddleware");

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  enabled?: boolean;
}

export function cacheMiddleware(options: CacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if caching is disabled globally or for this route
    if (!cacheConfig.enabled || options.enabled === false) {
      return next();
    }

    // Skip cache for non-GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Check condition if provided
    if (options.condition && !options.condition(req)) {
      return next();
    }

    // Skip if cache is not healthy
    if (!inventoryCache.isHealthy()) {
      return next();
    }

    // Generate cache key
    const cacheKey = options.keyGenerator
      ? options.keyGenerator(req)
      : `${req.path}:${JSON.stringify(req.query)}:${req.headers["x-org-id"] || "default"}`;

    // Try to get from cache
    try {
      const cached = await inventoryCache.get(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cached);
      }
    } catch (error) {
      logger.error("[Cache Middleware] Error getting from cache:", undefined, error);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to cache the response
    res.json = function (body: any) {
      res.setHeader("X-Cache", "MISS");

      // Cache the response asynchronously (don't await)
      inventoryCache.set(cacheKey, body, options.ttl).catch((err) => {
        logger.error("[Cache Middleware] Failed to cache response:", undefined, err);
      });

      return originalJson(body);
    };

    next();
  };
}

/**
 * Helper function to invalidate cache for a specific organization
 */
export async function invalidateOrgCache(orgId: string, patterns: string[]) {
  try {
    for (const pattern of patterns) {
      await inventoryCache.invalidatePattern(`*${pattern}*${orgId}*`);
    }
  } catch (error) {
    logger.error("[Cache] Failed to invalidate org cache:", undefined, error);
  }
}
