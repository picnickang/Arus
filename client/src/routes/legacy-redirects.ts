import { routeMigrations } from "@/config/navigationConfig";

const additionalRedirects: Array<{ from: string; to: string }> = [
  { from: "/cost-savings", to: "/analytics?tab=financial-reports" },
  { from: "/reports", to: "/analytics?tab=financial-reports" },
  { from: "/llm-costs", to: "/analytics?tab=financial-reports" },
  { from: "/model-performance", to: "/ai-health?tab=performance" },
  { from: "/ml-explainability", to: "/ai-health?tab=performance" },
  { from: "/ai-insights", to: "/ai-health?tab=insights" },
  { from: "/prediction-feedback", to: "/ai-health?tab=insights" },
  { from: "/ml-training", to: "/ai-health?tab=training" },
  { from: "/ml-ai", to: "/ai-health?tab=training" },
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
  { from: "/purchase-orders", to: "/purchase-requests" },
  { from: "/purchase-orders/:id", to: "/purchase-requests" },
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
