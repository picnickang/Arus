import { routeMigrations } from "@/config/navigationConfig";

const additionalRedirects: Array<{ from: string; to: string }> = [
  { from: "/cost-savings", to: "/analytics?tab=financial-reports" },
  { from: "/reports", to: "/analytics?tab=financial-reports" },
  { from: "/llm-costs", to: "/analytics?tab=financial-reports" },
  { from: "/ai-health", to: "/equipment-intelligence?system=true" },
  { from: "/ai-sensor-audits", to: "/equipment-intelligence?system=true" },
  { from: "/model-performance", to: "/equipment-intelligence?system=true" },
  { from: "/ml-explainability", to: "/equipment-intelligence?system=true" },
  { from: "/ai-insights", to: "/equipment-intelligence" },
  { from: "/prediction-feedback", to: "/equipment-intelligence" },
  { from: "/ml-training", to: "/equipment-intelligence?system=true" },
  { from: "/ml-ai", to: "/equipment-intelligence?system=true" },
  { from: "/sensor-config", to: "/sensors?tab=configuration" },
  { from: "/sensor-optimization", to: "/sensors?tab=optimization" },
  { from: "/sensor-management", to: "/sensors?tab=management" },
  { from: "/settings", to: "/configuration?tab=system-settings" },
  { from: "/transport-settings", to: "/configuration?tab=data-transport" },
  { from: "/storage-settings", to: "/configuration?tab=storage" },
  { from: "/operating-parameters", to: "/configuration?tab=operating-parameters" },
  { from: "/notification-settings", to: "/notifications" },
  { from: "/email-alerts-settings", to: "/notifications" },
  { from: "/suppliers", to: "/vendors" },
  { from: "/service-providers", to: "/vendors" },
  { from: "/purchase-requests", to: "/inventory-management?tab=purchasing" },
  { from: "/purchase-orders", to: "/inventory-management?tab=purchasing" },
  { from: "/purchase-orders/:id", to: "/inventory-management?tab=purchasing" },
  { from: "/schedule-generator", to: "/schedule-planner" },
  { from: "/equipment-registry", to: "/equipment" },
  { from: "/health-monitor", to: "/equipment" },
  { from: "/health", to: "/equipment" },
  { from: "/fleet-overview", to: "/vessel-management" },
  { from: "/bridge-view", to: "/fleet" },
  { from: "/alerts", to: "/dashboard" },
  { from: "/governance", to: "/governance-dashboard" },
];

export const legacyRedirects: Array<{ from: string; to: string }> = [
  ...additionalRedirects,
  ...Object.entries(routeMigrations || {}).map(([from, to]) => ({ from, to })),
].filter(
  (redirect, index, self) => index === self.findIndex((r) => r.from === redirect.from)
);
