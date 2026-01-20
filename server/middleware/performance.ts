/**
 * ARUS Performance Monitoring Middleware
 * 
 * Lightweight request timing and logging for Express routes.
 * Enable verbose mode via: PERF_DEBUG=true environment variable
 * 
 * Features:
 * - Request duration tracking
 * - Slow request highlighting (> 200ms default)
 * - Per-route timing statistics
 * - Prometheus histogram integration
 * 
 * Usage:
 *   import { performanceMiddleware } from './middleware/performance';
 *   app.use(performanceMiddleware);
 */

import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import { recordLatencySample } from '../utils/slo-alerts';

// Environment configuration
const PERF_DEBUG = process.env.PERF_DEBUG === 'true';
const SLOW_REQUEST_THRESHOLD_MS = Number.parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '200', 10);

// Prometheus metrics
const httpRequestDuration = new client.Histogram({
  name: 'arus_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000],
});

const slowRequestCounter = new client.Counter({
  name: 'arus_slow_requests_total',
  help: 'Total number of slow requests (> threshold)',
  labelNames: ['method', 'route'],
});

// Route timing statistics (in-memory, for debugging)
interface RouteStats {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  p95Buffer: number[];
}

const routeStats: Map<string, RouteStats> = new Map();

function updateRouteStats(route: string, durationMs: number): void {
  const existing = routeStats.get(route) || {
    count: 0,
    totalMs: 0,
    minMs: Infinity,
    maxMs: 0,
    p95Buffer: [],
  };
  
  existing.count++;
  existing.totalMs += durationMs;
  existing.minMs = Math.min(existing.minMs, durationMs);
  existing.maxMs = Math.max(existing.maxMs, durationMs);
  
  // Keep last 100 samples for P95 calculation
  existing.p95Buffer.push(durationMs);
  if (existing.p95Buffer.length > 100) {
    existing.p95Buffer.shift();
  }
  
  routeStats.set(route, existing);
}

function getRouteKey(req: Request): string {
  // Normalize route to avoid cardinality explosion
  // e.g., /api/equipment/abc123 -> /api/equipment/:id
  let route = req.route?.path || req.path;
  
  // Replace UUIDs with :id
  route = route.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
  
  // Replace numeric IDs with :id
  route = route.replace(/\/\d+(?=\/|$)/g, '/:id');
  
  return `${req.method} ${route}`;
}

/**
 * Performance monitoring middleware
 * Tracks request duration and logs slow requests
 */
export function performanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  const startMs = Date.now();
  
  // Skip static files and health checks for performance
  if (req.path.startsWith('/assets') || req.path === '/livez' || req.path === '/readyz') {
    return next();
  }
  
  // Capture original end function
  const originalEnd = res.end;
  
  res.end = function(this: Response, ...args: any[]): Response {
    const durationNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(durationNs) / 1_000_000;
    const routeKey = getRouteKey(req);
    
    // Update Prometheus metrics
    httpRequestDuration.observe(
      {
        method: req.method,
        route: routeKey.split(' ')[1] || req.path,
        status_code: res.statusCode.toString(),
      },
      durationMs
    );
    
    // Record sample for SLO tracking
    const routePath = routeKey.split(' ')[1] || req.path;
    const isError = res.statusCode >= 400;
    recordLatencySample(routePath, durationMs, isError);
    
    // Track slow requests
    if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
      slowRequestCounter.inc({
        method: req.method,
        route: routePath,
      });
      
      // Log slow request with context
      console.warn(
        `[PERF:SLOW] ${routeKey} - ${durationMs.toFixed(2)}ms (status: ${res.statusCode})`,
        PERF_DEBUG ? { query: req.query, body: typeof req.body === 'object' ? '[object]' : undefined } : ''
      );
    } else if (PERF_DEBUG && durationMs > 50) {
      // In debug mode, log all requests > 50ms
      console.log(`[PERF] ${routeKey} - ${durationMs.toFixed(2)}ms (status: ${res.statusCode})`);
    }
    
    // Update route statistics
    updateRouteStats(routeKey, durationMs);
    
    return originalEnd.apply(this, args as any);
  } as typeof res.end;
  
  next();
}

/**
 * Get performance statistics for all routes
 */
export function getRoutePerformanceStats(): Record<string, {
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
}> {
  const result: Record<string, any> = {};
  
  routeStats.forEach((stats, route) => {
    const avgMs = stats.count > 0 ? stats.totalMs / stats.count : 0;
    
    // Calculate P95
    const sorted = [...stats.p95Buffer].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95Ms = sorted[p95Index] || 0;
    
    result[route] = {
      count: stats.count,
      avgMs: Number(avgMs.toFixed(2)),
      minMs: stats.minMs === Infinity ? 0 : Number(stats.minMs.toFixed(2)),
      maxMs: Number(stats.maxMs.toFixed(2)),
      p95Ms: Number(p95Ms.toFixed(2)),
    };
  });
  
  return result;
}

/**
 * Get slow routes (sorted by average duration)
 */
export function getSlowRoutes(limit = 10): Array<{
  route: string;
  avgMs: number;
  count: number;
  maxMs: number;
}> {
  const stats = getRoutePerformanceStats();
  
  return Object.entries(stats)
    .map(([route, data]) => ({ route, ...data }))
    .filter(r => r.avgMs > SLOW_REQUEST_THRESHOLD_MS / 2) // Filter to potentially slow routes
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, limit);
}

/**
 * Reset performance statistics
 */
export function resetPerformanceStats(): void {
  routeStats.clear();
  console.log('[PERF] Performance statistics reset');
}

/**
 * Database query timing wrapper
 */
export function timeDbQuery<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  
  return queryFn().then(result => {
    const duration = Date.now() - start;
    
    if (duration > 100) {
      console.warn(`[PERF:DB] ${queryName} - ${duration}ms (slow)`);
    } else if (PERF_DEBUG && duration > 20) {
      console.log(`[PERF:DB] ${queryName} - ${duration}ms`);
    }
    
    return result;
  }).catch(error => {
    const duration = Date.now() - start;
    console.error(`[PERF:DB] ${queryName} - ${duration}ms (error)`, error.message);
    throw error;
  });
}

/**
 * Express route handler for performance stats endpoint
 */
export function performanceStatsHandler(req: Request, res: Response): void {
  const stats = getRoutePerformanceStats();
  const slowRoutes = getSlowRoutes(20);
  
  res.json({
    slowRoutes,
    allRoutes: stats,
    config: {
      slowThresholdMs: SLOW_REQUEST_THRESHOLD_MS,
      debugEnabled: PERF_DEBUG,
    },
    timestamp: new Date().toISOString(),
  });
}
