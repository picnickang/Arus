import { lazy } from "react";

const LogsHub = lazy(() => import("@/pages/logs-hub"));
const RmsMonitoring = lazy(() => import("@/pages/rms-monitoring"));

// One canonical surface per records destination. The nav's per-log paths render
// the same consolidated shells the /logs?tab=* hub loads, so every entry point
// shows identical content. Inner pages read their own ?tab= deep links (e.g.
// /logs/compliance?tab=findings) from the URL directly, which wrapping
// preserves. Legacy single-page paths (/deck-logbook, /fuel-emissions-log, …)
// are handled by routeMigrations redirects, not duplicate registrations here.
export const recordsRoutes = [
  { path: "/logs", component: LogsHub },
  { path: "/logs/compliance", component: LogsHub },
  { path: "/logs/deck", component: LogsHub },
  { path: "/logs/engine", component: LogsHub },
  { path: "/logs/equipment", component: LogsHub },
  { path: "/rms-monitoring", component: RmsMonitoring },
];
