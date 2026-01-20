/**
 * SLO Alerts - Status Queries
 */

import type { SLOStatusResponse } from "./types.js";
import { loadSLOConfigs, customSLOs } from "./config.js";
import { routeBuckets, getWindowBuckets, calculatePercentile, calculateBurnRate } from "./calculations.js";
import { recentViolations } from "./violations.js";

export function getSLOStatus(): SLOStatusResponse {
  const sloConfigs = [...loadSLOConfigs(), ...customSLOs];
  
  const sloStatuses = sloConfigs.map((slo) => {
    let p50 = 0, p95 = 0, p99 = 0, availability = 1, sampleCount = 0, burnRate = 0;
    
    for (const [route, buckets] of routeBuckets) {
      if (!route.startsWith(slo.routePattern)) { continue; }
      
      const windowBuckets = getWindowBuckets(buckets, slo.windowMinutes);
      if (windowBuckets.length === 0) { continue; }
      
      const allLatencies: number[] = [];
      let totalCount = 0, errorCount = 0;
      
      for (const bucket of windowBuckets) {
        allLatencies.push(...bucket.latencies);
        totalCount += bucket.totalCount;
        errorCount += bucket.errorCount;
      }
      
      sampleCount += totalCount;
      availability = totalCount > 0 ? (totalCount - errorCount) / totalCount : 1;
      burnRate = calculateBurnRate(availability, slo.availabilityTarget);
      
      p50 = Math.max(p50, calculatePercentile(allLatencies, 50));
      p95 = Math.max(p95, calculatePercentile(allLatencies, 95));
      p99 = Math.max(p99, calculatePercentile(allLatencies, 99));
    }
    
    let status: "healthy" | "warning" | "critical" = "healthy";
    if (p99 > slo.latencyP99Ms || burnRate > 10 || availability < (slo.availabilityTarget - (1 - slo.availabilityTarget))) {
      status = "critical";
    } else if (p95 > slo.latencyP95Ms || burnRate > 2 || availability < slo.availabilityTarget) {
      status = "warning";
    }
    
    const errorBudget = 1 - slo.availabilityTarget;
    const errorBudgetRemaining = Math.max(0, Math.min(1, (availability - slo.availabilityTarget) / errorBudget + 1));
    
    return {
      name: slo.name,
      routePattern: slo.routePattern,
      status,
      metrics: {
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99),
        availability: Number.parseFloat(availability.toFixed(6)),
        sampleCount,
        burnRate: Number.parseFloat(burnRate.toFixed(2)),
        errorBudgetRemaining: Number.parseFloat(errorBudgetRemaining.toFixed(4)),
      },
      config: {
        windowMinutes: slo.windowMinutes,
        bucketMinutes: slo.bucketMinutes,
        latencyTargets: { p50: slo.latencyP50Ms, p95: slo.latencyP95Ms, p99: slo.latencyP99Ms },
        availabilityTarget: slo.availabilityTarget,
      },
    };
  });
  
  return {
    slos: sloStatuses,
    violations: recentViolations.slice(-20),
  };
}
