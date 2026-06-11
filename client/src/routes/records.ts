import { lazy } from "react";

const LogsHub = lazy(() => import("@/pages/logs-hub"));
const RmsMonitoring = lazy(() => import("@/pages/rms-monitoring"));
const ComplianceConsolidated = lazy(() => import("@/pages/compliance-consolidated"));
const DeckLogConsolidated = lazy(() => import("@/pages/deck-log-consolidated"));
const EngineLogConsolidated = lazy(() => import("@/pages/engine-log-consolidated"));
const EquipmentLogConsolidated = lazy(() => import("@/pages/equipment-log-consolidated"));

// One canonical surface per records destination. The nav's per-log paths render
// the same consolidated shells the /logs?tab=* hub loads, so every entry point
// shows identical content. Inner pages read their own ?tab= deep links (e.g.
// /logs/compliance?tab=findings) from the URL directly, which wrapping
// preserves. Legacy single-page paths (/deck-logbook, /fuel-emissions-log, …)
// are handled by routeMigrations redirects, not duplicate registrations here.
export const recordsRoutes = [
  { path: "/logs", component: LogsHub },
  { path: "/logs/compliance", component: ComplianceConsolidated },
  { path: "/logs/deck", component: DeckLogConsolidated },
  { path: "/logs/engine", component: EngineLogConsolidated },
  { path: "/logs/equipment", component: EquipmentLogConsolidated },
  { path: "/rms-monitoring", component: RmsMonitoring },
];
