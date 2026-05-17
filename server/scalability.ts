/**
 * Legacy scalability shim. Real load balancer / cache moved to lib/cache and infra.
 */

export interface LoadBalancerHealth {
  status: "active" | "degraded" | "down";
  workers: number;
  timestamp: string;
}

export function getLoadBalancerHealth(): LoadBalancerHealth {
  return { status: "active", workers: 1, timestamp: new Date().toISOString() };
}

export const cache = {
  size: 0,
  hits: 0,
  misses: 0,
  status: "active" as const,
};
