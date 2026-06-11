# Long-File Burndown

Generated: 2026-06-11T21:50:05.706Z

## Policy

Long files are no longer treated as an all-at-once release blocker. They are a ratcheted burndown gate:

- Files over 500 lines are reported by `scripts/hygiene-dashboard.mjs`.
- CI fails when the counted long-file total increases above the committed ceiling.
- The temporary ceiling is `124` counted files.
- The current counted inventory is `124` files.
- The original release baseline was `52` files.
- The end-state target is `0` counted files.
- The ceiling should only decrease after safe refactors land.
- Production code is not excluded from the count.
- Test fixtures matching `server/tests/*/fixtures.ts` are excluded from the ratchet and tracked here as fixture debt.

## Current Count

| Area                      | Count |
| ------------------------- | ----: |
| Total counted long files  |   124 |
| Server                    |    44 |
| Server route-like files   |    10 |
| Server service-like files |    11 |
| Client                    |    73 |
| Client page files         |    28 |
| Shared                    |     7 |
| Counted tests             |     1 |
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

## Top 30 Longest Files

| Rank | Lines | File |
| ---: | ----: | ---- |
|    1 |  1111 | `client/src/pages/admin/equipment-dependencies.tsx` |
|    2 |  1095 | `client/src/components/crew-admin/SafetyTab.tsx` |
|    3 |  1090 | `client/src/components/scheduling/ScheduleGeneratorPanel.tsx` |
|    4 |  1073 | `client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx` |
|    5 |  1072 | `client/src/components/HoursOfRestGrid/index.tsx` |
|    6 |  1051 | `client/src/components/scheduling/SchedulePlanner.tsx` |
|    7 |   990 | `client/src/pages/ml-training.tsx` |
|    8 |   937 | `shared/schema/ml-analytics-advanced.ts` |
|    9 |   923 | `client/src/components/unified-crew-components.tsx` |
|   10 |   917 | `server/domains/agent/application/orchestrator.ts` |
|   11 |   899 | `client/src/pages/admin/3d-models.tsx` |
|   12 |   875 | `client/src/pages/copilot-admin.tsx` |
|   13 |   869 | `client/src/pages/system-administration.tsx` |
|   14 |   843 | `client/src/pages/findings.tsx` |
|   15 |   836 | `client/src/components/analytics/FinanceMode.tsx` |
|   16 |   832 | `shared/schema/logbooks.ts` |
|   17 |   832 | `client/src/pages/deck-logbook/index.tsx` |
|   18 |   831 | `client/src/features/crew/lib/crewManagementUtils.ts` |
|   19 |   820 | `client/src/features/serviceOrders/components/ServiceOrderFormDialog.tsx` |
|   20 |   819 | `client/src/pages/inventory-management.tsx` |
|   21 |   811 | `client/src/features/crew/hooks/useHoursOfRestData.ts` |
|   22 |   809 | `server/domains/equipment-intelligence/infrastructure/hub-repository.ts` |
|   23 |   809 | `client/src/pages/pdm-pack.tsx` |
|   24 |   791 | `server/routes/service-request-routes.ts` |
|   25 |   787 | `server/routes/rag-routes.ts` |
|   26 |   786 | `client/src/pages/maintenance-schedules.tsx` |
|   27 |   779 | `client/src/components/CrewDocumentsTab.tsx` |
|   28 |   768 | `client/src/components/CrewNotificationSettingsTab.tsx` |
|   29 |   755 | `client/src/pages/organization-management.tsx` |
|   30 |   755 | `client/src/pages/MaintenanceTemplatesPage.tsx` |

## Recommended Extraction Plan

1. Continue safety-first server splits.
   - Prioritize agent orchestration and equipment intelligence repositories.
   - Required proof: focused unit/integration suites for each touched subsystem plus `npm run check`.

2. Add client characterization tests before large UI splits.
   - Prioritize equipment dependencies, SafetyTab, scheduling, CrewFormDialog, HoursOfRestGrid, and ML/admin pages.
   - Required proof: focused component/source tests and Playwright smoke where routed UI already has coverage.

3. Split shared schema/runtime files by domain group.
   - Preserve existing barrels and exported names.
   - Required proof: typecheck and schema guard tests for touched schema surfaces.

4. Burn down the 501-649 tail with small colocated extractions.
   - Use hooks, helper modules, route groups, and constant modules to leave orchestration files with headroom under 450 lines where practical.

## Full Counted Inventory

```text
1111 client/src/pages/admin/equipment-dependencies.tsx
1095 client/src/components/crew-admin/SafetyTab.tsx
1090 client/src/components/scheduling/ScheduleGeneratorPanel.tsx
1073 client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx
1072 client/src/components/HoursOfRestGrid/index.tsx
1051 client/src/components/scheduling/SchedulePlanner.tsx
990 client/src/pages/ml-training.tsx
937 shared/schema/ml-analytics-advanced.ts
923 client/src/components/unified-crew-components.tsx
917 server/domains/agent/application/orchestrator.ts
899 client/src/pages/admin/3d-models.tsx
875 client/src/pages/copilot-admin.tsx
869 client/src/pages/system-administration.tsx
843 client/src/pages/findings.tsx
836 client/src/components/analytics/FinanceMode.tsx
832 shared/schema/logbooks.ts
832 client/src/pages/deck-logbook/index.tsx
831 client/src/features/crew/lib/crewManagementUtils.ts
820 client/src/features/serviceOrders/components/ServiceOrderFormDialog.tsx
819 client/src/pages/inventory-management.tsx
811 client/src/features/crew/hooks/useHoursOfRestData.ts
809 server/domains/equipment-intelligence/infrastructure/hub-repository.ts
809 client/src/pages/pdm-pack.tsx
791 server/routes/service-request-routes.ts
787 server/routes/rag-routes.ts
786 client/src/pages/maintenance-schedules.tsx
779 client/src/components/CrewDocumentsTab.tsx
768 client/src/components/CrewNotificationSettingsTab.tsx
755 client/src/pages/organization-management.tsx
755 client/src/pages/MaintenanceTemplatesPage.tsx
748 client/src/components/ai-health/TrainingTab.tsx
744 client/src/pages/home.tsx
731 client/src/components/ai-health/PerformanceTab.tsx
718 server/scheduler/scheduler-controller.ts
717 server/db/checklists/db-checklists.ts
712 client/src/pages/equipment/index.tsx
711 client/src/components/work-orders/LinkedServiceOrdersPanel.tsx
704 client/src/pages/findings-cards.tsx
699 shared/schema-runtime.ts
697 client/src/components/crew-admin/RolesDashboardsTab.tsx
696 server/domains/agent/tools/enhanced-report-tools.ts
695 server/objectStorage.ts
691 server/db/analytics/db-analytics.ts
687 client/src/components/agent/AgentChatPanel/index.tsx
685 client/src/features/crew/hooks/useSchedulePlannerData.ts
683 client/src/pages/governance-dashboard.tsx
680 client/src/components/stormgeo-settings.tsx
677 client/src/components/CrewScheduler.tsx
672 client/src/components/equipment/EquipmentDecommissionDialog.tsx
659 client/src/components/vessel/VesselSchematic/SchematicConfigPanel.tsx
652 client/src/components/ai-health/InsightsTab.tsx
651 server/domains/crew-admin/infrastructure/crew-admin-repository-adapter.ts
647 client/src/pages/vessel-management/index.tsx
646 server/domains/permissions/repository.ts
643 client/src/pages/vessel-intelligence/registry-api.ts
638 client/src/pages/DiagnosticsDashboard.tsx
637 shared/schema/alerts.ts
636 server/import-adapters/shipmate/field-mapping.ts
633 client/src/components/sensors/SensorSetupWizard.tsx
632 server/db/ml-analytics/db-ml-analytics.ts
632 server/compliance/routes/data-privacy-routes.ts
632 client/src/components/crew-admin/UserAssignmentTab.tsx
631 client/src/features/crew/hooks/useUnifiedCrewData.ts
630 server/ml-routes/model-routes.ts
625 client/src/components/crew-admin/UserAccessEditor.tsx
623 client/src/components/work-orders/WorkOrderFormDialog.tsx
618 server/purchasing/po-routes.ts
617 client/src/components/analytics/OperationsMode.tsx
615 client/src/pages/scheduled-reports.tsx
614 client/src/components/crew/CrewComplianceDashboard.tsx
612 server/domains/me-portal/me-portal-service.ts
612 client/src/components/admin/SchedulingSettingsTab.tsx
611 client/src/pages/vessel-dashboard/index.tsx
608 shared/schema/crew.ts
607 server/domains/scheduling/routes.ts
606 server/lib/domain-event-bus/types.ts
604 server/domains/equipment/routes.ts
603 server/domains/agent/application/suggestion-engine.ts
598 client/src/lib/queryClient.ts
597 server/services/patch-applicator.ts
594 server/domains/vessel-diagram-registry/infrastructure/in-memory-store.ts
593 server/routes/wo-so-bridge-routes.ts
593 client/src/components/equipment/EquipmentFormDialog.tsx
591 server/pdm/adapters/pdm-postgres.repository.ts
589 server/compliance/data-anonymization/service.ts
589 client/src/pages/desktop-setup.tsx
588 server/domains/crew/application/crew-service.ts
588 client/src/config/navigationConfig.ts
584 server/domains/equipment-intelligence/infrastructure/postgres-repository.ts
581 client/src/components/work-orders/WorkOrderDetailDrawer.tsx
580 server/db/crew-extensions/db-crew-extensions.ts
577 client/src/pages/knowledge-base.tsx
573 client/src/components/admin/SystemSettingsTab.tsx
572 server/utils/statistics.ts
570 server/services/ml/prediction-calibration.ts
569 server/routes/kb-routes.ts
568 client/src/components/UnifiedCrewManagement/CrewRoleManager.tsx
564 client/src/components/scheduling/crew-scheduler-cards.tsx
561 client/src/pages/analytics-hub.tsx
559 server/scripts/migrate.ts
554 shared/schema/equipment.ts
554 server/services/ml/prediction-outcome-tracker.ts
548 server/services/anomaly-correlation/anomaly-correlator.ts
539 server/integrations/fmcc-types.ts
538 client/src/features/serviceRequests/pages/ServiceRequestsPage.tsx
537 client/src/features/crew/hooks/useShiftPlanning.ts
535 server/integrations/fmcc-polling-service.ts
533 client/src/pages/pdm-equipment-detail.tsx
532 server/db/equipment/db-equipment.ts
530 server/domains/crew-extensions/infrastructure/schedule-planner-read-model.ts
530 client/src/pages/agent-activity.tsx
530 client/src/features/work-orders/hooks/useWorkOrdersPageData.ts
528 client/src/pages/work-orders.tsx
527 client/src/components/engine-logbook/row-components.tsx
524 shared/schema/purchasing.ts
523 server/tests/pdm/get-schedule.test.ts
523 client/src/lib/offline-sync.ts
521 client/src/pages/logs-compliance-hub.tsx
519 server/services/ml/model-evaluation-gate.ts
515 server/services/rms/alert-service.ts
515 server/domains/agent/tools/weather-tools.ts
514 client/src/features/suppliers/components/SupplierForm.tsx
509 server/domains/rms/routes.ts
507 client/src/components/UnifiedCrewManagement/CurrentRoster.tsx
```
