import { lazy } from "react";

const OperationsHub = lazy(() => import("@/pages/operations-hub"));
const Findings = lazy(() => import("@/pages/findings"));
const Briefing = lazy(() => import("@/pages/briefing"));
const AttentionInbox = lazy(() => import("@/features/workflow/pages/AttentionInboxPage"));
const OfflineOutbox = lazy(() => import("@/pages/offline-outbox"));
const SafetyBulletins = lazy(() => import("@/pages/safety-bulletins"));

export const operationsRoutes = [
  { path: "/operations", component: OperationsHub },
  { path: "/findings", component: Findings },
  { path: "/briefing", component: Briefing },
  { path: "/attention-inbox", component: AttentionInbox },
  { path: "/offline-outbox", component: OfflineOutbox },
  { path: "/safety-bulletins", component: SafetyBulletins },
];
