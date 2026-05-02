import { lazy } from "react";

const OperationsHub = lazy(() => import("@/pages/operations-hub"));
const Dashboard = lazy(() => import("@/pages/dashboard-improved"));
const Findings = lazy(() => import("@/pages/findings"));
const Briefing = lazy(() => import("@/pages/briefing"));
const AttentionInbox = lazy(() => import("@/features/workflow/pages/AttentionInboxPage"));
const OfflineOutbox = lazy(() => import("@/pages/offline-outbox"));

export const operationsRoutes = [
  { path: "/operations", component: OperationsHub },
  { path: "/dashboard", component: Dashboard },
  { path: "/findings", component: Findings },
  { path: "/briefing", component: Briefing },
  { path: "/attention-inbox", component: AttentionInbox },
  { path: "/offline-outbox", component: OfflineOutbox },
];
