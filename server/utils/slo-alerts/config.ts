/**
 * SLO Alerts - Configuration Loading
 */

import type { SLOConfig } from "./types.js";

export function getSLOFromEnv(name: string, defaultValue: number): number {
  const envKey = `SLO_${name.toUpperCase()}_MS`;
  const envValue = process.env[envKey];
  return envValue ? Number.parseInt(envValue, 10) : defaultValue;
}

export function getAvailabilityTargetFromEnv(): number {
  const envValue = process.env["SLO_AVAILABILITY_TARGET"];
  return envValue ? Number.parseFloat(envValue) : 0.999;
}

export function getWindowMinutes(): number {
  return Number.parseInt(process.env["SLO_WINDOW_MINUTES"] || "15", 10);
}

export function getBucketMinutes(): number {
  return Number.parseInt(process.env["SLO_BUCKET_MINUTES"] || "1", 10);
}

export function loadSLOConfigs(): SLOConfig[] {
  const windowMinutes = getWindowMinutes();
  const bucketMinutes = getBucketMinutes();
  const availabilityTarget = getAvailabilityTargetFromEnv();

  return [
    {
      name: "dashboard_api",
      routePattern: "/api/dashboard",
      latencyP50Ms: getSLOFromEnv("DASHBOARD_P50", 100),
      latencyP95Ms: getSLOFromEnv("DASHBOARD_P95", 300),
      latencyP99Ms: getSLOFromEnv("DASHBOARD_P99", 500),
      availabilityTarget,
      windowMinutes,
      bucketMinutes,
    },
    {
      name: "stcw_api",
      routePattern: "/api/dashboard/stcw",
      latencyP50Ms: getSLOFromEnv("STCW_P50", 200),
      latencyP95Ms: getSLOFromEnv("STCW_P95", 500),
      latencyP99Ms: getSLOFromEnv("STCW_P99", 800),
      availabilityTarget,
      windowMinutes,
      bucketMinutes,
    },
    {
      name: "equipment_api",
      routePattern: "/api/equipment",
      latencyP50Ms: getSLOFromEnv("EQUIPMENT_P50", 100),
      latencyP95Ms: getSLOFromEnv("EQUIPMENT_P95", 250),
      latencyP99Ms: getSLOFromEnv("EQUIPMENT_P99", 300),
      availabilityTarget,
      windowMinutes,
      bucketMinutes,
    },
    {
      name: "work_orders_api",
      routePattern: "/api/work-orders",
      latencyP50Ms: getSLOFromEnv("WORK_ORDERS_P50", 150),
      latencyP95Ms: getSLOFromEnv("WORK_ORDERS_P95", 350),
      latencyP99Ms: getSLOFromEnv("WORK_ORDERS_P99", 400),
      availabilityTarget,
      windowMinutes,
      bucketMinutes,
    },
    {
      name: "telemetry_api",
      routePattern: "/api/telemetry",
      latencyP50Ms: getSLOFromEnv("TELEMETRY_P50", 50),
      latencyP95Ms: getSLOFromEnv("TELEMETRY_P95", 150),
      latencyP99Ms: getSLOFromEnv("TELEMETRY_P99", 200),
      availabilityTarget,
      windowMinutes,
      bucketMinutes,
    },
  ];
}

export const customSLOs: SLOConfig[] = [];

export function reloadSLOConfigs(): SLOConfig[] {
  return loadSLOConfigs();
}

export function addCustomSLO(config: SLOConfig): void {
  customSLOs.push(config);
}

export function getSLOConfigs(): SLOConfig[] {
  return [...loadSLOConfigs(), ...customSLOs];
}
