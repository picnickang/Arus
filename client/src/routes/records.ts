import { lazy } from "react";

const LogsHub = lazy(() => import("@/pages/logs-hub"));
const DeckLogbook = lazy(() => import("@/pages/deck-logbook"));
const EngineLogbook = lazy(() => import("@/pages/engine-logbook"));
const LogsComplianceHub = lazy(() => import("@/pages/logs-compliance-hub"));
const ConditionMonitoringLog = lazy(() => import("@/pages/condition-monitoring-log"));
const RmsMonitoring = lazy(() => import("@/pages/rms-monitoring"));
const ComplianceConsolidated = lazy(() => import("@/pages/compliance-consolidated"));
const DeckLogConsolidated = lazy(() => import("@/pages/deck-log-consolidated"));
const EngineLogConsolidated = lazy(() => import("@/pages/engine-log-consolidated"));
const EquipmentLogConsolidated = lazy(() => import("@/pages/equipment-log-consolidated"));

// NOTE: /deck-logbook, /engine-logbook, /logs-compliance, /fuel-emissions-log,
// /vessel-track-log, and /condition-monitoring-log are NOT registered here.
// They live in `routeMigrations` (navigationConfig), whose redirects mount
// before these routes in App.tsx's <Switch> — a registration here can never
// match (see docs/UI-CONSOLIDATION-AUDIT.md §2.1).
export const recordsRoutes = [
  { path: "/logs", component: LogsHub },
  { path: "/logs/compliance", component: LogsComplianceHub },
  { path: "/logs/deck", component: DeckLogbook },
  { path: "/logs/engine", component: EngineLogbook },
  { path: "/logs/equipment", component: ConditionMonitoringLog },
  { path: "/rms-monitoring", component: RmsMonitoring },
  { path: "/compliance-consolidated", component: ComplianceConsolidated },
  { path: "/deck-log-consolidated", component: DeckLogConsolidated },
  { path: "/engine-log-consolidated", component: EngineLogConsolidated },
  { path: "/equipment-log-consolidated", component: EquipmentLogConsolidated },
];
