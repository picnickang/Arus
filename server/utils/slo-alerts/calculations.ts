/**
 * SLO Alerts - Core Calculation Functions
 */

import type { BucketData } from "./types.js";
import { getBucketMinutes, getWindowMinutes } from "./config.js";

export const routeBuckets = new Map<string, BucketData[]>();

export function getBucketKey(timestamp: number, bucketMinutes: number): number {
  return Math.floor(timestamp / (bucketMinutes * 60 * 1000)) * (bucketMinutes * 60 * 1000);
}

export function normalizeRoute(route: string): string {
  return route
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:id");
}

export function calculatePercentile(samples: number[], percentile: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function getWindowBuckets(buckets: BucketData[], windowMinutes: number): BucketData[] {
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  return buckets.filter((b) => b.minuteStart >= cutoff);
}

export function calculateBurnRate(availability: number, availabilityTarget: number): number {
  const errorBudget = 1 - availabilityTarget;
  if (errorBudget === 0) {
    return availability < 1 ? Infinity : 0;
  }
  const actualErrorRate = 1 - availability;
  return actualErrorRate / errorBudget;
}

export function recordLatencySample(
  route: string,
  durationMs: number,
  isError: boolean = false
): void {
  const normalizedRoute = normalizeRoute(route);
  const now = Date.now();
  const bucketMinutes = getBucketMinutes();
  const bucketKey = getBucketKey(now, bucketMinutes);

  let buckets = routeBuckets.get(normalizedRoute);
  if (!buckets) {
    buckets = [];
    routeBuckets.set(normalizedRoute, buckets);
  }

  let currentBucket = buckets.find((b) => b.minuteStart === bucketKey);
  if (!currentBucket) {
    currentBucket = { minuteStart: bucketKey, totalCount: 0, errorCount: 0, latencies: [] };
    buckets.push(currentBucket);

    const windowMinutes = getWindowMinutes();
    const maxBuckets = Math.ceil(windowMinutes / bucketMinutes) + 2;
    if (buckets.length > maxBuckets) {
      buckets.sort((a, b) => a.minuteStart - b.minuteStart);
      buckets.splice(0, buckets.length - maxBuckets);
    }
  }

  currentBucket.totalCount++;
  if (isError) {
    currentBucket.errorCount++;
  }
  currentBucket.latencies.push(durationMs);

  if (currentBucket.latencies.length > 1000) {
    currentBucket.latencies = currentBucket.latencies.slice(-500);
  }
}

export function cleanupOldBuckets(): void {
  const windowMinutes = getWindowMinutes();
  const cutoff = Date.now() - windowMinutes * 60 * 1000 * 2;

  for (const [route, buckets] of routeBuckets) {
    const filtered = buckets.filter((b) => b.minuteStart > cutoff);
    if (filtered.length === 0) {
      routeBuckets.delete(route);
    } else {
      routeBuckets.set(route, filtered);
    }
  }
}
