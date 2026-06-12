# Long-File Burndown

Generated: 2026-06-12T07:50:14.217Z

## Policy

Long files are no longer treated as an all-at-once release blocker. They are a ratcheted burndown gate:

- Files over 500 lines are reported by `scripts/hygiene-dashboard.mjs`.
- CI fails when the counted long-file total increases above the committed ceiling.
- The temporary ceiling is `50` counted files.
- The current counted inventory is `50` files.
- The original release baseline was `52` files.
- The end-state target is `0` counted files.
- The ceiling should only decrease after safe refactors land.
- Production code is not excluded from the count.
- Test fixtures matching `server/tests/*/fixtures.ts` are excluded from the ratchet and tracked here as fixture debt.

## Current Count

| Area                      | Count |
| ------------------------- | ----: |
| Total counted long files  |    50 |
| Server                    |     0 |
| Server route-like files   |     0 |
| Server service-like files |     0 |
| Client                    |    50 |
| Client page files         |    19 |
| Shared                    |     0 |
| Counted tests             |     0 |
| Excluded test fixtures    |     1 |

Excluded fixture:

- `server/tests/telemetry-pipeline/fixtures.ts` - 735 lines

Completed splits:

- `client/src/pages/vessel-intelligence/registry-screens.tsx` was previously split into a dispatcher plus per-screen files under `registry-screens/`.
- `client/src/components/UnifiedCrewManagement/CrewRegistryLanding.tsx` dropped below the threshold by moving `CounterTile` to `CrewRegistryLandingCounterTile.tsx`.
- `client/src/components/UnifiedCrewManagement/CrewTaskTracker.tsx` dropped below the threshold by moving rows, dialogs, stats, presentation helpers, and overlay/activity pieces to `CrewTaskTrackerParts/`.
- `server/import-adapters/shipmate/import-service.ts` dropped below the threshold by moving types, vessel resolution, row upserts, running-hour sync, and RAG document helpers to sibling modules.
- `server/db/inventory/index.ts` dropped below the threshold by moving projection, reservation-ledger, work-order-part mutation, and parts/stock query helpers to sibling modules.
- `shared/role-dashboard.ts` dropped below the threshold by moving access policy, default configs, and safety alarm constants to sibling modules.
- `server/routes/domain-router-registry.ts` dropped below the threshold by moving declarative router inventory to config modules.
- `server/import-adapters/amos/import-service.ts` dropped below the threshold by moving AMOS types, row upserts, and RAG document helpers to sibling modules.
- The vessel diagram registry route file dropped below the threshold by moving schemas, context, and route groups to focused modules.
- The vessel diagram Postgres store dropped below the threshold by moving diagram, section-map, section, assignment, validation, thumbnail, and helper persistence groups to focused modules.
- `server/domains/crew-extensions/interfaces/scheduler-routes.ts` dropped below the threshold by moving schemas and endpoint groups to focused scheduler route modules.
- `server/domains/crew-admin/application/crew-admin-service.ts` dropped below the threshold by moving role, dashboard, readiness, credential, and account/offboarding workflows to internal helper modules.
- `server/telemetry-batch-writer.ts` dropped below the threshold by moving buffer management, metrics, persistence, post-flush work, quota checks, and direct-write orchestration to sibling modules.
- `server/websocket.ts` dropped below the threshold by moving upgrade auth, telemetry throttling, fanout delivery/replay, shared types, and broadcast payload helpers to sibling modules.
- `server/domains/permissions/routes.ts` dropped below the threshold by moving role, user-admin/setup, and dev diagnostic route groups plus shared schemas to focused modules.
- `server/pdm/routes.ts` dropped below the threshold by moving export, equipment/telemetry, analysis, and shared filter/CSV helpers to focused modules.
- `server/config/default-role-templates.ts` dropped below the threshold by moving role-template groups and types to focused config modules.
- `server/config/permission-registry.ts` dropped below the threshold by moving action, resource, category, and type definitions to focused config modules.
- `server/domains/crew-admin/interfaces/routes.ts` dropped below the threshold by moving role, dashboard, user, credential, and account route groups to focused modules.
- `server/services/domains/work-order-service.ts` dropped below the threshold by moving query, lifecycle, clone, completion, and shared type operations to focused service modules.
- `shared/schema/admin.ts` dropped below the threshold by moving admin schema table groups to focused schema modules while preserving the public barrel.
- `server/domains/workflow/application/attention-service.ts` dropped below the threshold by moving exported types, state helpers, formatting helpers, and workflow aggregation to focused modules.
- `server/domains/vessel-diagram-registry/application/service.ts` dropped below the threshold by moving section-map templates, media helpers, and replacement behavior orchestration to focused modules.
- `shared/schema/logbooks.ts` dropped below the threshold by moving deck, engine, automation, fuel, track, and condition table groups to focused schema modules while preserving the public barrel.
- `shared/schema/ml-analytics-advanced.ts` dropped below the threshold by moving validation/vibration/PdM, realtime/retraining, and registry/runtime table groups to internal schema modules while preserving public insert schemas and types.
- `shared/schema/alerts.ts` dropped below the threshold by moving core alert, settings, and queue table groups to focused schema modules while preserving the public barrel.
- `shared/schema-runtime.ts` dropped below the threshold by moving mode-aware table groups to focused runtime modules while preserving public schema-runtime table names.
- `shared/schema/crew.ts` dropped below the threshold by moving people and operations table groups to focused schema modules while preserving the public barrel.
- `shared/schema/equipment.ts` dropped below the threshold by moving registry/lifecycle and analytics table groups to focused schema modules while preserving the public barrel.
- `shared/schema/purchasing.ts` dropped below the threshold by moving procurement and service-order table groups to focused schema modules while preserving the public barrel.
- `server/lib/domain-event-bus/types.ts` dropped below the threshold by moving event envelopes, payloads, and event map types to internal modules while preserving the public factory/barrel.
- `server/integrations/fmcc-types.ts` dropped below the threshold by moving FMCC snapshot/polling types and register maps to internal modules while preserving the public barrel.
- `server/tests/pdm/get-schedule.test.ts` dropped below the threshold by moving local fixture builders to a counted helper module while preserving the test coverage.
- `server/services/rms/alert-service.ts` dropped below the threshold by moving alert config and row helpers to a sibling module while preserving `rmsAlertService`.
- `server/domains/rms/routes.ts` dropped below the threshold by moving route schemas and request/row helpers to a sibling module while preserving `rmsRouter`.
- `server/utils/statistics.ts` dropped below the threshold by moving signal-processing, time-series, correlation, forecasting, and error helpers to focused utility modules while preserving the public barrel.
- `server/services/ml/model-evaluation-gate.ts` dropped below the threshold by moving gate config, types, and metric helpers to a sibling support module while preserving `ModelEvaluationGate`.
- `server/domains/agent/tools/weather-tools.ts` dropped below the threshold by moving weather schemas, types, and fetch helpers to a sibling support module while preserving registered tool names.
- `client/src/lib/offline-sync.ts` dropped below the threshold by moving offline sync public types and IndexedDB schema typing to a sibling type module while preserving the public runtime entry point.
- `client/src/components/UnifiedCrewManagement/CurrentRoster.tsx` dropped below the threshold by moving current roster row and group-section rendering to a sibling component module while preserving roster grouping controls and test IDs.
- `client/src/features/suppliers/components/SupplierForm.tsx` dropped below the threshold by moving supplier form schema/default-value helpers to a sibling module while preserving the public form component.
- `client/src/components/engine-logbook/row-components.tsx` dropped below the threshold by moving event/watch card rendering to a sibling module while preserving the existing row-components import path.
- `client/src/pages/work-orders.tsx` remains below the threshold after the current mainline replacement route delegates to `MobileWorkOrdersPage`.
- `client/src/pages/logs-compliance-hub.tsx` dropped below the threshold by moving logbook status cards to a sibling page-parts module while preserving the route component and tab IDs.
- `client/src/features/work-orders/hooks/useWorkOrdersPageData.ts` dropped below the threshold by moving work-order page formatters to a sibling lib module while preserving public exports from the hook module.
- `client/src/pages/agent-activity.tsx` dropped below the threshold by moving activity rows, summary metrics, and activity types to a sibling page-parts module while preserving the route component and test IDs.
- `server/domains/crew-extensions/infrastructure/schedule-planner-read-model.ts` dropped below the threshold by moving vessel summary/count query helpers to a sibling infrastructure module while preserving the adapter and `schedulePlannerReadModel` exports.
- `client/src/features/serviceRequests/pages/ServiceRequestsPage.tsx` dropped below the threshold by moving convert/reject dialog controls to a sibling page dialog module while preserving the exported page component.
- `client/src/features/crew/hooks/useShiftPlanning.ts` dropped below the threshold by moving scheduling payload and data-shape types to a sibling hook type module while preserving the exported hook and return type.
- `client/src/pages/pdm-equipment-detail.tsx` dropped below the threshold by moving anomaly and maintenance history tab rendering to a sibling tab module while preserving the route component.
- `server/integrations/fmcc-polling-service.ts` dropped below the threshold by moving FMCC raw poll normalization to a pure snapshot builder while preserving the polling service exports.
- `server/services/anomaly-correlation/anomaly-correlator.ts` dropped below the threshold by moving sensor normalization and failure-signature matching to a pure helper module while preserving `AnomalyCorrelator`.
- `server/services/ml/prediction-outcome-tracker.ts` dropped below the threshold by moving tracker config and payload/data-shape types to a sibling type module while preserving `PredictionOutcomeTracker`.
- `server/db/equipment/db-equipment.ts` dropped below the threshold by moving graph projection/retraction side effects to a sibling helper while preserving `DatabaseEquipmentStorage`.
- `server/scripts/migrate.ts` dropped below the threshold by moving critical post-migration object metadata to a sibling script module while preserving `runBootMigrations` and CLI behavior.
- `server/services/ml/prediction-calibration.ts` dropped below the threshold by moving calibration math/types to a sibling helper while preserving `PredictionCalibrator`.
- `client/src/components/scheduling/crew-scheduler-cards.tsx` dropped below the threshold by moving certification/qualification helpers to a sibling component module while preserving the existing scheduler cards export surface.
- `client/src/pages/analytics-hub.tsx` dropped below the threshold by moving predictive insights, metric cards, domain strips, findings, and response types to a sibling page-parts module while preserving the route component.
- `client/src/components/UnifiedCrewManagement/CrewRoleManager.tsx` dropped below the threshold by moving role default fields and payload helpers to a sibling component module while preserving `CrewRoleManager`.
- `client/src/components/admin/SystemSettingsTab.tsx` dropped below the threshold by moving OpenAI API key controls to a sibling card module while preserving the exported settings tab.
- `client/src/pages/knowledge-base.tsx` dropped below the threshold by moving upload, filter, and semantic-search widgets to a sibling page-parts module while preserving the route component.
- `client/src/pages/desktop-setup.tsx` dropped below the threshold by moving setup progress and backend connection controls to a sibling steps module while keeping real account sign-in in the route file.
- `client/src/config/navigationConfig.ts` dropped below the threshold by moving the route-to-resource map to a sibling config module while preserving the original public export.
- `server/routes/kb-routes.ts` dropped below the threshold by moving KB upload storage, MIME filtering, and multer error normalization to a sibling route middleware module while preserving route URLs.
- `server/db/crew-extensions/db-crew-extensions.ts` dropped below the threshold by moving notification/alert and port/drydock scheduling persistence helpers to sibling modules while preserving `DbCrewExtensionsStorage`.
- `server/compliance/data-anonymization/service.ts` dropped below the threshold by moving field-name and likely-contact classification helpers to a sibling pure module while preserving `DataAnonymizationService`.
- `server/services/patch-applicator.ts` dropped below the threshold by moving backup creation, rollback, listing, and cleanup lifecycle helpers to a sibling module while preserving `PatchApplicator`.
- `server/domains/crew/application/crew-service.ts` dropped below the threshold by moving crew application port contracts to a sibling type module while preserving public type exports from `crew-service`.
- `server/domains/vessel-diagram-registry/infrastructure/in-memory-store.ts` dropped below the threshold by moving in-memory record builders and mutation helpers to a sibling module while preserving `InMemoryVesselDiagramRegistryStore`.
- `server/pdm/adapters/pdm-postgres.repository.ts` dropped below the threshold by moving risk queue presentation mappers and relative-time helpers to a sibling module while preserving `pdmPostgresRepository`.
- `server/domains/equipment-intelligence/infrastructure/postgres-repository.ts` dropped below the threshold by moving risk/trend/status, signal parsing, work-order summary, and label helpers to a sibling module while preserving `PostgresEquipmentIntelligenceRepository`.
- `server/routes/wo-so-bridge-routes.ts` dropped below the threshold by moving create/sync bridge operations to a sibling module while preserving route URLs and compatibility exports.
- `server/domains/agent/application/suggestion-engine.ts` dropped below the threshold by moving preference/severity helpers, prediction cost formatting, AI summarization, and notification queueing to a sibling support module while preserving `SuggestionEngine`.
- `server/domains/equipment/routes.ts` dropped below the threshold by moving lifecycle, sensor setup, and parts lookup endpoints to a sibling route group while preserving `registerEquipmentRoutes` and route URLs.
- `server/domains/scheduling/routes.ts` dropped below the threshold by moving scheduling-settings endpoints to a sibling route group while preserving `registerSchedulingRoutes` and route URLs.
- `server/domains/me-portal/me-portal-service.ts` dropped below the threshold by moving personal task-feed assembly to a sibling helper while preserving `MePortalService.getTasks`.
- `server/purchasing/po-routes.ts` dropped below the threshold by moving purchase-order fulfillment and events endpoints to a sibling route group while preserving the default router and route URLs.
- `server/ml-routes/model-routes.ts` dropped below the threshold by moving ML promotion approval, promote, and rollback routes to a sibling route group while preserving `modelRoutes` and route URLs.
- `server/compliance/routes/data-privacy-routes.ts` dropped below the threshold by moving DSAR list, detail, state transition, collection, erasure, and statistics endpoints to a sibling route group while preserving `complianceDataPrivacyRouter` and route URLs.
- `server/db/ml-analytics/db-ml-analytics.ts` dropped below the threshold by moving feature importance, calibration, engineer override, and RUL model helpers to a sibling cloud helper while preserving `DatabaseMlAnalyticsStorage`.
- `server/import-adapters/shipmate/field-mapping.ts` dropped below the threshold by moving Shipmate value transforms and CSV header normalization to sibling helper modules while preserving the public mapping exports.
- `server/domains/permissions/repository.ts` dropped below the threshold by moving access, dashboard seeding, and permissions diagnostic queries to a sibling repository query module while preserving the public repository exports.
- `server/domains/crew-admin/infrastructure/crew-admin-repository-adapter.ts` dropped below the threshold by moving crew user access, assignment, credential, session, and crew-login link persistence to a sibling infrastructure module while preserving `CrewAdminRepositoryAdapter`.
- `server/db/analytics/db-analytics.ts` dropped below the threshold by moving finance/inventory helpers and metrics history/insight snapshot persistence to sibling modules while preserving `DatabaseAnalyticsStorage`.
- `server/objectStorage.ts` dropped below the threshold by moving lazy client initialization, MIME content-type policy, and object path signing helpers to sibling modules while preserving `ObjectStorageService` and public helper exports.
- `server/domains/agent/tools/enhanced-report-tools.ts` dropped below the threshold by moving report artifact persistence and report formatting/export helpers to sibling modules while preserving registered tool names and `getReportArtifact`.
- `server/db/checklists/db-checklists.ts` dropped below the threshold by moving template workflow and work-order task/checklist/worklog record groups to sibling storage base classes while preserving `DatabaseChecklistsStorage`.
- `server/scheduler/scheduler-controller.ts` dropped below the threshold by moving scheduler input loading, simulation/apply/revert helpers, and run lifecycle actions to sibling modules while preserving the public controller exports.
- `server/domains/agent/application/orchestrator.ts` dropped below the threshold by moving shared run/context types, message/context assembly, and the unified iteration loop to orchestrator helper modules while preserving `AgentOrchestrator`.
- `server/domains/equipment-intelligence/infrastructure/hub-repository.ts` dropped below the threshold by moving hub summary/fetch helpers and activity timeline assembly to sibling modules while preserving `PostgresEquipmentHubRepository`.
- `server/routes/service-request-routes.ts` dropped below the threshold by moving read, edit/create, and review/convert route groups plus shared request helpers to sibling route modules while preserving `registerServiceRequestRoutes`.
- `server/routes/rag-routes.ts` dropped below the threshold by moving ask/streaming, conversation/feedback/cache, extended export/analytics/compare/alert route groups, and shared RAG route helpers to sibling modules while preserving `registerRagRoutes`.
- `client/src/lib/queryClient.ts` dropped below the threshold by moving request, header, envelope, timeout, quota-error, and query function mechanics to `queryClient-request.ts` while preserving the public `queryClient` import path.
- `client/src/pages/vessel-intelligence/registry-api.ts` dropped below the threshold by moving registry API types, shared query/invalidation/upload helpers, and diagram/version hooks to sibling modules while preserving the public `registry-api` import path.
- `client/src/features/crew/hooks/useUnifiedCrewData.ts` dropped below the threshold by moving aggregate/access queries, access indexes, roster filtering, and photo upload mechanics to a sibling hook-parts module while preserving the public `useUnifiedCrewData` import path.
- `client/src/features/mobile-readiness/mobile-readiness-model.ts` dropped below the threshold by moving model types, navigation, queue/fleet data, machinery/work data, and support screen builders to sibling modules while preserving the public model import path.
- `client/src/components/work-orders/WorkOrderDetailDrawer.tsx` dropped below the threshold by moving detail tabs and drawer actions to sibling modules while preserving the public drawer export and test IDs.

## Top 30 Longest Files

| Rank | Lines | File                                                                      |
| ---: | ----: | ------------------------------------------------------------------------- |
|    1 |  1786 | `client/src/features/mobile-readiness/MobileReadinessScreens.tsx`         |
|    2 |  1111 | `client/src/pages/admin/equipment-dependencies.tsx`                       |
|    3 |  1095 | `client/src/components/crew-admin/SafetyTab.tsx`                          |
|    4 |  1090 | `client/src/components/scheduling/ScheduleGeneratorPanel.tsx`             |
|    5 |  1073 | `client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx`          |
|    6 |  1072 | `client/src/components/HoursOfRestGrid/index.tsx`                         |
|    7 |  1051 | `client/src/components/scheduling/SchedulePlanner.tsx`                    |
|    8 |   990 | `client/src/pages/ml-training.tsx`                                        |
|    9 |   923 | `client/src/components/unified-crew-components.tsx`                       |
|   10 |   899 | `client/src/pages/admin/3d-models.tsx`                                    |
|   11 |   875 | `client/src/pages/copilot-admin.tsx`                                      |
|   12 |   869 | `client/src/pages/system-administration.tsx`                              |
|   13 |   843 | `client/src/pages/findings.tsx`                                           |
|   14 |   836 | `client/src/components/analytics/FinanceMode.tsx`                         |
|   15 |   832 | `client/src/pages/deck-logbook/index.tsx`                                 |
|   16 |   831 | `client/src/features/crew/lib/crewManagementUtils.ts`                     |
|   17 |   820 | `client/src/features/serviceOrders/components/ServiceOrderFormDialog.tsx` |
|   18 |   819 | `client/src/pages/inventory-management.tsx`                               |
|   19 |   811 | `client/src/features/crew/hooks/useHoursOfRestData.ts`                    |
|   20 |   809 | `client/src/pages/pdm-pack.tsx`                                           |
|   21 |   786 | `client/src/pages/maintenance-schedules.tsx`                              |
|   22 |   779 | `client/src/components/CrewDocumentsTab.tsx`                              |
|   23 |   768 | `client/src/components/CrewNotificationSettingsTab.tsx`                   |
|   24 |   755 | `client/src/pages/organization-management.tsx`                            |
|   25 |   755 | `client/src/pages/MaintenanceTemplatesPage.tsx`                           |
|   26 |   748 | `client/src/components/ai-health/TrainingTab.tsx`                         |
|   27 |   731 | `client/src/components/ai-health/PerformanceTab.tsx`                      |
|   28 |   712 | `client/src/pages/equipment/index.tsx`                                    |
|   29 |   711 | `client/src/components/work-orders/LinkedServiceOrdersPanel.tsx`          |
|   30 |   704 | `client/src/pages/findings-cards.tsx`                                     |

## Recommended Extraction Plan

1. Continue with client characterization before large UI splits.
   - Server and shared counted sources are now under the threshold.
   - Prioritize equipment dependencies, SafetyTab, scheduling, CrewFormDialog, HoursOfRestGrid, and ML/admin pages.
   - Required proof: focused unit/integration suites for each touched subsystem plus `npm run check`.

2. Split client route pages and components by stable UI sub-surfaces.
   - Preserve exported route components, test IDs, query keys, and existing import paths.
   - Required proof: focused component/source tests and Playwright smoke where routed UI already has coverage.

3. Keep shared schema/runtime and server files below the threshold.
   - Preserve existing barrels and exported names for any future touch-ups.
   - Required proof: typecheck, strict hygiene, and focused guard tests for touched surfaces.

4. Burn down the 501-649 tail with small colocated extractions.
   - Use hooks, helper modules, route groups, and constant modules to leave orchestration files with headroom under 450 lines where practical.

## Full Counted Inventory

```text
1786 client/src/features/mobile-readiness/MobileReadinessScreens.tsx
1111 client/src/pages/admin/equipment-dependencies.tsx
1095 client/src/components/crew-admin/SafetyTab.tsx
1090 client/src/components/scheduling/ScheduleGeneratorPanel.tsx
1073 client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx
1072 client/src/components/HoursOfRestGrid/index.tsx
1051 client/src/components/scheduling/SchedulePlanner.tsx
990 client/src/pages/ml-training.tsx
923 client/src/components/unified-crew-components.tsx
899 client/src/pages/admin/3d-models.tsx
875 client/src/pages/copilot-admin.tsx
869 client/src/pages/system-administration.tsx
843 client/src/pages/findings.tsx
836 client/src/components/analytics/FinanceMode.tsx
832 client/src/pages/deck-logbook/index.tsx
831 client/src/features/crew/lib/crewManagementUtils.ts
820 client/src/features/serviceOrders/components/ServiceOrderFormDialog.tsx
819 client/src/pages/inventory-management.tsx
811 client/src/features/crew/hooks/useHoursOfRestData.ts
809 client/src/pages/pdm-pack.tsx
786 client/src/pages/maintenance-schedules.tsx
779 client/src/components/CrewDocumentsTab.tsx
768 client/src/components/CrewNotificationSettingsTab.tsx
755 client/src/pages/organization-management.tsx
755 client/src/pages/MaintenanceTemplatesPage.tsx
748 client/src/components/ai-health/TrainingTab.tsx
731 client/src/components/ai-health/PerformanceTab.tsx
712 client/src/pages/equipment/index.tsx
711 client/src/components/work-orders/LinkedServiceOrdersPanel.tsx
704 client/src/pages/findings-cards.tsx
697 client/src/components/crew-admin/RolesDashboardsTab.tsx
687 client/src/components/agent/AgentChatPanel/index.tsx
685 client/src/features/crew/hooks/useSchedulePlannerData.ts
683 client/src/pages/governance-dashboard.tsx
680 client/src/components/stormgeo-settings.tsx
677 client/src/components/CrewScheduler.tsx
672 client/src/components/equipment/EquipmentDecommissionDialog.tsx
659 client/src/components/vessel/VesselSchematic/SchematicConfigPanel.tsx
652 client/src/components/ai-health/InsightsTab.tsx
647 client/src/pages/vessel-management/index.tsx
638 client/src/pages/DiagnosticsDashboard.tsx
633 client/src/components/sensors/SensorSetupWizard.tsx
632 client/src/components/crew-admin/UserAssignmentTab.tsx
625 client/src/components/crew-admin/UserAccessEditor.tsx
623 client/src/components/work-orders/WorkOrderFormDialog.tsx
617 client/src/components/analytics/OperationsMode.tsx
615 client/src/pages/scheduled-reports.tsx
612 client/src/components/admin/SchedulingSettingsTab.tsx
611 client/src/pages/vessel-dashboard/index.tsx
593 client/src/components/equipment/EquipmentFormDialog.tsx
```
