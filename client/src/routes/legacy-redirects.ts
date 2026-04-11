/**
 * Legacy Redirects — Consolidated redirect map with expiration tracking.
 *
 * This is the single source of truth for backward-compatible route redirects.
 * The `routeMigrations` map in navigationConfig.ts is used by programmatic
 * helpers (migrateRoute) and does NOT need to duplicate entries here.
 *
 * Rules:
 * - additionalRedirects entries override routeMigrations when both define the same `from`.
 * - additionalRedirects has more specific targets (e.g. ?tab=...) so it takes priority.
 * - Only add new entries here when retiring a client-side route.
 * - Each entry has an `expires` tier: "30d" | "60d" | "90d" | "keep" indicating retirement urgency.
 */
import { routeMigrations } from "@/config/navigationConfig";

export type RedirectExpiry = "30d" | "60d" | "90d" | "keep";

export interface LegacyRedirect {
  from: string;
  to: string;
  expires: RedirectExpiry;
}

const additionalRedirects: LegacyRedirect[] = [
  { from: "/cost-savings", to: "/analytics?tab=financial-reports", expires: "30d" },
  { from: "/reports", to: "/analytics?tab=financial-reports", expires: "30d" },
  { from: "/llm-costs", to: "/analytics?tab=financial-reports", expires: "30d" },
  { from: "/ai-health", to: "/equipment-intelligence", expires: "30d" },
  { from: "/ai-health-dashboard", to: "/equipment-intelligence", expires: "30d" },
  { from: "/ai-sensor-audits", to: "/equipment-intelligence?system=true", expires: "30d" },
  { from: "/model-performance", to: "/equipment-intelligence?system=true", expires: "60d" },
  { from: "/ml-explainability", to: "/equipment-intelligence?system=true", expires: "30d" },
  { from: "/ai-insights", to: "/equipment-intelligence", expires: "30d" },
  { from: "/prediction-feedback", to: "/equipment-intelligence", expires: "60d" },
  { from: "/ml-training", to: "/equipment-intelligence?system=true", expires: "30d" },
  { from: "/ml-ai", to: "/equipment-intelligence?system=true", expires: "30d" },
  { from: "/sensor-config", to: "/sensors?tab=configuration", expires: "60d" },
  { from: "/sensor-optimization", to: "/sensors?tab=optimization", expires: "60d" },
  { from: "/sensor-management", to: "/sensors?tab=management", expires: "60d" },
  { from: "/settings", to: "/configuration?tab=system-settings", expires: "90d" },
  { from: "/transport-settings", to: "/configuration?tab=data-transport", expires: "60d" },
  { from: "/storage-settings", to: "/configuration?tab=storage", expires: "60d" },
  { from: "/operating-parameters", to: "/configuration?tab=operating-parameters", expires: "60d" },
  { from: "/notification-settings", to: "/notifications", expires: "60d" },
  { from: "/email-alerts-settings", to: "/notifications", expires: "60d" },
  { from: "/suppliers", to: "/vendors", expires: "90d" },
  { from: "/service-providers", to: "/vendors", expires: "90d" },
  { from: "/purchase-requests", to: "/inventory-management?tab=purchasing", expires: "60d" },
  { from: "/purchase-orders", to: "/inventory-management?tab=purchasing", expires: "60d" },
  { from: "/purchase-orders/:id", to: "/inventory-management?tab=purchasing", expires: "60d" },
  { from: "/schedule-generator", to: "/schedule-planner", expires: "90d" },
  { from: "/equipment", to: "/fleet?tab=equipment", expires: "90d" },
  { from: "/equipment-registry", to: "/fleet?tab=equipment", expires: "90d" },
  { from: "/health-monitor", to: "/fleet?tab=equipment", expires: "60d" },
  { from: "/health", to: "/fleet?tab=equipment", expires: "60d" },
  { from: "/vessel-management", to: "/fleet", expires: "90d" },
  { from: "/fleet-overview", to: "/fleet", expires: "90d" },
  { from: "/bridge-view", to: "/fleet", expires: "90d" },
  { from: "/alerts", to: "/dashboard", expires: "keep" },
  { from: "/active-telemetry", to: "/dashboard?tab=telemetry", expires: "keep" },
  { from: "/actionable-insights", to: "/dashboard?tab=insights", expires: "keep" },
  { from: "/governance", to: "/governance-dashboard", expires: "90d" },
  { from: "/kb-chat", to: "/knowledge-base", expires: "90d" },
];

const migrationRedirects: LegacyRedirect[] = Object.entries(routeMigrations || {}).map(
  ([from, to]) => ({ from, to, expires: "90d" as RedirectExpiry })
);

export const legacyRedirects: LegacyRedirect[] = [
  ...additionalRedirects,
  ...migrationRedirects,
].filter(
  (redirect, index, self) => index === self.findIndex((r) => r.from === redirect.from)
);

const STORAGE_KEY = "arus:redirect_usage";

export function trackRedirectUsage(from: string, to: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const usage: Record<string, { count: number; lastUsed: string }> = raw ? JSON.parse(raw) : {};
    const entry = usage[from] || { count: 0, lastUsed: "" };
    entry.count += 1;
    entry.lastUsed = new Date().toISOString();
    usage[from] = entry;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
  }
}

export function getRedirectUsageStats(): Record<string, { count: number; lastUsed: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
