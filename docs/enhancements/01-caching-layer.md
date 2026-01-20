# Enhancement: Redis-Backed Caching Layer

## Objective
Implement intelligent caching for frequently-accessed inventory data to reduce database load and improve API response times.

---

## Risk Assessment: **LOW** ✅

**Why Low Risk**:
- Additive feature (no existing functionality changes)
- Falls back to database if cache unavailable
- Can be disabled via feature flag
- Cache invalidation is explicit and deterministic

**Rollback Strategy**: 
- Disable feature flag
- Traffic automatically routes to database
- Zero data loss risk (cache is read-through)

---

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  Inventory API Endpoint     │
└──────┬──────────────────────┘
       │
       ▼
   ┌───────┐ Hit?
   │ Cache │────────Yes─────▶ Return cached data
   └───┬───┘
       │ Miss
       ▼
┌─────────────┐
│  Database   │
└──────┬──────┘
       │
       ▼
   Update cache + Return
```

**Cache Strategy**:
- **Pattern**: Read-through cache with explicit invalidation
- **TTL**: Varies by data volatility
- **Eviction**: LRU (Least Recently Used)

---

## Implementation Plan

### Step 1: Redis Client Setup (15 min)

```typescript
// server/lib/cache.ts
import Redis from 'ioredis';

interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  ttl: number; // seconds
  keyPrefix: string;
}

export class CacheClient {
  private redis: Redis;
  private defaultTTL: number;
  private keyPrefix: string;
  
  constructor(config: CacheConfig) {
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false, // Fail fast if Redis is down
    });
    
    this.defaultTTL = config.ttl;
    this.keyPrefix = config.keyPrefix;
    
    this.redis.on('error', (err) => {
      console.error('[Cache] Redis error:', err);
      // Don't crash the app - let requests fall through to DB
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(this.prefixKey(key));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[Cache] Get error:', error);
      return null; // Graceful degradation
    }
  }
  
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds ?? this.defaultTTL;
      await this.redis.setex(
        this.prefixKey(key),
        ttl,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error('[Cache] Set error:', error);
      // Continue - write-through cache failure shouldn't block
    }
  }
  
  async del(key: string | string[]): Promise<void> {
    try {
      const keys = Array.isArray(key) ? key : [key];
      const prefixedKeys = keys.map(k => this.prefixKey(k));
      await this.redis.del(...prefixedKeys);
    } catch (error) {
      console.error('[Cache] Delete error:', error);
    }
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(this.prefixKey(pattern));
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('[Cache] Pattern invalidation error:', error);
    }
  }
  
  private prefixKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}

// Initialize cache client
export const inventoryCache = new CacheClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  ttl: 900, // 15 minutes default
  keyPrefix: 'inventory',
});
```

### Step 2: Cache Middleware (20 min)

```typescript
// server/middleware/cache-middleware.ts
import { Request, Response, NextFunction } from 'express';
import { inventoryCache } from '../lib/cache';

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

export function cacheMiddleware(options: CacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Check condition if provided
    if (options.condition && !options.condition(req)) {
      return next();
    }
    
    // Generate cache key
    const cacheKey = options.keyGenerator 
      ? options.keyGenerator(req)
      : `${req.path}:${JSON.stringify(req.query)}:${req.headers['x-org-id']}`;
    
    // Try to get from cache
    const cached = await inventoryCache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }
    
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json to cache the response
    res.json = function(body: unknown) {
      res.setHeader('X-Cache', 'MISS');
      // Cache the response asynchronously (don't await)
      inventoryCache.set(cacheKey, body, options.ttl).catch(err => {
        console.error('[Cache Middleware] Failed to cache response:', err);
      });
      return originalJson(body);
    };
    
    next();
  };
}
```

### Step 3: Apply Caching to Substitutions Endpoint (10 min)

```typescript
// server/routes.ts (modifications)
import { cacheMiddleware } from './middleware/cache-middleware';
import { inventoryCache } from './lib/cache';

// Part Substitutions with caching
app.get(
  "/api/inventory/substitutions/:partNo",
  requireOrgId,
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: (req) => `substitutions:${req.params.partNo}:${req.headers['x-org-id']}`,
  }),
  async (req: Request, res: Response) => {
    // Existing implementation stays the same
    // Cache middleware handles caching automatically
  }
);

// Cache invalidation on inventory updates
app.post("/api/parts", requireOrgId, async (req: Request, res: Response) => {
  const orgId = (req as AuthRequest).orgId;
  
  // Create part (existing logic)
  const newPart = await storage.createPart(orgId, req.body);
  
  // Invalidate substitutions cache for affected parts
  await inventoryCache.invalidatePattern(`substitutions:*:${orgId}`);
  
  res.json(newPart);
});

app.patch("/api/parts/:id", requireOrgId, async (req: Request, res: Response) => {
  const orgId = (req as AuthRequest).orgId;
  const partId = req.params.id;
  
  // Update part (existing logic)
  const updatedPart = await storage.updatePart(orgId, partId, req.body);
  
  // Invalidate cache for this part and related substitutions
  await inventoryCache.del([
    `part:${partId}:${orgId}`,
    `substitutions:${updatedPart.partNo}:${orgId}`,
  ]);
  await inventoryCache.invalidatePattern(`substitutions:*:${orgId}`);
  
  res.json(updatedPart);
});
```

### Step 4: Prometheus Metrics (15 min)

```typescript
// server/observability/cache-metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

export const cacheMetrics = {
  hits: new Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type', 'endpoint'],
  }),
  
  misses: new Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_type', 'endpoint'],
  }),
  
  errors: new Counter({
    name: 'cache_errors_total',
    help: 'Total number of cache errors',
    labelNames: ['cache_type', 'operation'],
  }),
  
  latency: new Histogram({
    name: 'cache_operation_duration_seconds',
    help: 'Cache operation duration',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  }),
  
  size: new Gauge({
    name: 'cache_size_bytes',
    help: 'Approximate cache size in bytes',
    labelNames: ['cache_type'],
  }),
};

// Update cache client to record metrics
export class CacheClient {
  async get<T>(key: string): Promise<T | null> {
    const timer = cacheMetrics.latency.startTimer({ operation: 'get' });
    try {
      const data = await this.redis.get(this.prefixKey(key));
      const result = data ? JSON.parse(data) : null;
      
      if (result) {
        cacheMetrics.hits.inc({ cache_type: 'inventory', endpoint: key.split(':')[0] });
      } else {
        cacheMetrics.misses.inc({ cache_type: 'inventory', endpoint: key.split(':')[0] });
      }
      
      return result;
    } catch (error) {
      cacheMetrics.errors.inc({ cache_type: 'inventory', operation: 'get' });
      console.error('[Cache] Get error:', error);
      return null;
    } finally {
      timer();
    }
  }
  
  // ... similar for set, del, etc.
}
```

---

## Testing Strategy

### Unit Tests
```typescript
// server/tests/cache.test.ts
describe('CacheClient', () => {
  let cache: CacheClient;
  
  beforeEach(() => {
    cache = new CacheClient({
      host: 'localhost',
      port: 6379,
      ttl: 60,
      keyPrefix: 'test',
    });
  });
  
  afterEach(async () => {
    await cache.invalidatePattern('*');
  });
  
  test('should cache and retrieve data', async () => {
    await cache.set('key1', { data: 'value' });
    const result = await cache.get('key1');
    expect(result).toEqual({ data: 'value' });
  });
  
  test('should expire after TTL', async () => {
    await cache.set('key2', { data: 'value' }, 1);
    await new Promise(resolve => setTimeout(resolve, 1100));
    const result = await cache.get('key2');
    expect(result).toBeNull();
  });
  
  test('should handle Redis errors gracefully', async () => {
    // Disconnect Redis
    await cache.redis.disconnect();
    
    // Should not throw
    const result = await cache.get('key3');
    expect(result).toBeNull();
  });
  
  test('should invalidate by pattern', async () => {
    await cache.set('user:123', { name: 'Alice' });
    await cache.set('user:456', { name: 'Bob' });
    await cache.set('order:789', { total: 100 });
    
    await cache.invalidatePattern('user:*');
    
    expect(await cache.get('user:123')).toBeNull();
    expect(await cache.get('user:456')).toBeNull();
    expect(await cache.get('order:789')).not.toBeNull();
  });
});
```

### Integration Tests
```typescript
// server/tests/inventory-cache.test.ts
describe('Inventory API Caching', () => {
  test('should cache substitutions response', async () => {
    const res1 = await request(app)
      .get('/api/inventory/substitutions/PUMP-100')
      .set('x-org-id', 'test-org');
    
    expect(res1.headers['x-cache']).toBe('MISS');
    
    const res2 = await request(app)
      .get('/api/inventory/substitutions/PUMP-100')
      .set('x-org-id', 'test-org');
    
    expect(res2.headers['x-cache']).toBe('HIT');
    expect(res2.body).toEqual(res1.body);
  });
  
  test('should invalidate cache on part update', async () => {
    // Warm cache
    await request(app)
      .get('/api/inventory/substitutions/PUMP-100')
      .set('x-org-id', 'test-org');
    
    // Update part
    await request(app)
      .patch('/api/parts/part-id')
      .set('x-org-id', 'test-org')
      .send({ name: 'Updated Name' });
    
    // Next request should be cache miss
    const res = await request(app)
      .get('/api/inventory/substitutions/PUMP-100')
      .set('x-org-id', 'test-org');
    
    expect(res.headers['x-cache']).toBe('MISS');
  });
});
```

---

## Rollout Plan

### Phase 1: Infrastructure (Day 1)
1. Provision Redis instance (Replit/Cloud provider)
2. Add Redis connection string to environment variables
3. Deploy cache client code (no endpoints using it yet)
4. Verify health checks pass

**Acceptance**: Redis is accessible, health endpoint returns OK

### Phase 2: Canary (Day 2-3)
1. Enable caching for 10% of traffic via feature flag
2. Monitor cache hit rate, latency, errors
3. Verify cache invalidation works correctly

**Acceptance**: 
- Cache hit rate > 60% after 1 hour
- No increase in error rates
- P95 latency < 50ms

### Phase 3: Gradual Rollout (Day 4-7)
1. 25% traffic → monitor 24 hours
2. 50% traffic → monitor 24 hours
3. 100% traffic → monitor 48 hours

**Acceptance**:
- Cache hit rate stabilizes at 70-80%
- P95 API latency reduced by 30%+
- Zero cache-related errors

### Phase 4: Optimization (Week 2)
1. Tune TTL values based on usage patterns
2. Add caching to additional endpoints (supplier data)
3. Implement cache warming for critical data

---

## Monitoring & Alerts

### Grafana Dashboard Queries

```promql
# Cache Hit Rate
sum(rate(cache_hits_total[5m])) /
(sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))

# Cache Latency P95
histogram_quantile(0.95, cache_operation_duration_seconds)

# Cache Error Rate
rate(cache_errors_total[5m])

# API Latency Improvement (before/after caching)
http_request_duration_seconds{endpoint="/api/inventory/substitutions"}
```

### Alert Rules

```yaml
- alert: CacheLowHitRate
  expr: cache_hit_rate < 0.5
  for: 30m
  labels:
    severity: warning
  annotations:
    summary: "Cache hit rate below 50% for 30 minutes"

- alert: CacheHighErrorRate
  expr: rate(cache_errors_total[5m]) > 0.01
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Cache error rate above 1%"
```

---

## Expected Outcomes

**Performance**:
- 70-80% cache hit rate for substitutions endpoint
- 200ms → 50ms P95 latency (75% reduction)
- 50% reduction in database load

**Cost Savings**:
- Reduced database I/O = lower cloud costs
- Improved user experience = higher adoption

**Risks Mitigated**:
- Graceful degradation if Redis fails
- Cache stampede prevention via TTL jitter
- Multi-tenant isolation via key prefixing

---

## Future Enhancements

1. **Cache Warming**: Pre-populate cache with critical data on startup
2. **Distributed Caching**: Redis Cluster for horizontal scaling
3. **Cache Analytics**: Track which data is most frequently accessed
4. **Smart Invalidation**: Use database triggers for automatic invalidation
