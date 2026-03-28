import { lazy } from "react";

const LogsHub = lazy(() => import("@/pages/logs-hub"));
const DeckLogbook = lazy(() => import("@/pages/deck-logbook"));
const EngineLogbook = lazy(() => import("@/pages/engine-logbook"));
const LogsComplianceHub = lazy(() => import("@/pages/logs-compliance-hub"));
const FuelEmissionsLog = lazy(() => import("@/pages/fuel-emissions-log"));
const VesselTrackLog = lazy(() => import("@/pages/vessel-track-log"));
const ConditionMonitoringLog = lazy(() => import("@/pages/condition-monitoring-log"));

export const recordsRoutes = [
  { path: "/logs", component: LogsHub },
  { path: "/logs/compliance", component: LogsComplianceHub },
  { path: "/logs/deck", component: DeckLogbook },
  { path: "/logs/engine", component: EngineLogbook },
  { path: "/logs/equipment", component: ConditionMonitoringLog },
  { path: "/deck-logbook", component: DeckLogbook },
  { path: "/engine-logbook", component: EngineLogbook },
  { path: "/logs-compliance", component: LogsComplianceHub },
  { path: "/fuel-emissions-log", component: FuelEmissionsLog },
  { path: "/vessel-track-log", component: VesselTrackLog },
  { path: "/condition-monitoring-log", component: ConditionMonitoringLog },
];
