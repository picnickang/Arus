# Long-File Burndown

Generated: 2026-06-11T18:09:45Z

## Policy

Long files are no longer treated as an all-at-once release blocker. They are a ratcheted burndown gate:

- Files over 500 lines are reported by `scripts/hygiene-dashboard.mjs`.
- CI fails when the counted long-file total increases above the committed ceiling.
- The temporary ceiling is `138` counted files.
- The current counted inventory is `138` files.
- The original release baseline was `52` files.
- The end-state target is `0` counted files.
- The ceiling should only decrease after safe refactors land.
- Production code is not excluded from the count.
- Test fixtures matching `server/tests/*/fixtures.ts` are excluded from the ratchet and tracked here as fixture debt.

## Current Count

| Area                      | Count |
| ------------------------- | ----: |
| Total counted long files  |   138 |
| Server                    |    56 |
| Server route-like files   |    14 |
| Server service-like files |    17 |
| Client                    |    74 |
| Client page files         |    28 |
| Shared                    |     8 |
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

## Top 30 Longest Files

| Rank | Lines | File |
| ---: | ----: | ---- |
|    1 |  1111 | `client/src/pages/admin/equipment-dependencies.tsx` |
|    2 |  1095 | `client/src/components/crew-admin/SafetyTab.tsx` |
|    3 |  1090 | `client/src/components/scheduling/ScheduleGeneratorPanel.tsx` |
|    4 |  1073 | `client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx` |
|    5 |  1072 | `client/src/components/HoursOfRestGrid/index.tsx` |
|    6 |  1064 | `server/domains/crew-extensions/interfaces/scheduler-routes.ts` |
|    7 |  1055 | `server/domains/crew-admin/application/crew-admin-service.ts` |
|    8 |  1051 | `client/src/components/scheduling/SchedulePlanner.tsx` |
|    9 |   990 | `client/src/pages/ml-training.tsx` |
|   10 |   971 | `server/websocket.ts` |
|   11 |   951 | `server/telemetry-batch-writer.ts` |
|   12 |   937 | `shared/schema/ml-analytics-advanced.ts` |
|   13 |   923 | `client/src/components/unified-crew-components.tsx` |
|   14 |   917 | `server/domains/agent/application/orchestrator.ts` |
|   15 |   899 | `client/src/pages/admin/3d-models.tsx` |
|   16 |   889 | `server/domains/permissions/routes.ts` |
|   17 |   880 | `server/services/domains/work-order-service.ts` |
|   18 |   875 | `client/src/pages/copilot-admin.tsx` |
|   19 |   869 | `client/src/pages/system-administration.tsx` |
|   20 |   852 | `server/domains/workflow/application/attention-service.ts` |
|   21 |   843 | `client/src/pages/findings.tsx` |
|   22 |   836 | `client/src/components/analytics/FinanceMode.tsx` |
|   23 |   832 | `shared/schema/logbooks.ts` |
|   24 |   832 | `client/src/pages/deck-logbook/index.tsx` |
|   25 |   831 | `client/src/features/crew/lib/crewManagementUtils.ts` |
|   26 |   829 | `server/pdm/routes.ts` |
|   27 |   820 | `client/src/features/serviceOrders/components/ServiceOrderFormDialog.tsx` |
|   28 |   819 | `client/src/pages/inventory-management.tsx` |
|   29 |   811 | `client/src/features/crew/hooks/useHoursOfRestData.ts` |
|   30 |   809 | `server/domains/equipment-intelligence/infrastructure/hub-repository.ts` |

## Recommended Extraction Plan

1. Continue safety-first server splits.
   - Prioritize crew extensions scheduler routes, crew admin service, WebSocket, telemetry batch writer, permissions routes, work-order service, PDM routes, and workflow attention service.
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
1064 server/domains/crew-extensions/interfaces/scheduler-routes.ts
1055 server/domains/crew-admin/application/crew-admin-service.ts
1051 client/src/components/scheduling/SchedulePlanner.tsx
990 client/src/pages/ml-training.tsx
971 server/websocket.ts
951 server/telemetry-batch-writer.ts
937 shared/schema/ml-analytics-advanced.ts
923 client/src/components/unified-crew-components.tsx
917 server/domains/agent/application/orchestrator.ts
899 client/src/pages/admin/3d-models.tsx
889 server/domains/permissions/routes.ts
880 server/services/domains/work-order-service.ts
875 client/src/pages/copilot-admin.tsx
869 client/src/pages/system-administration.tsx
852 server/domains/workflow/application/attention-service.ts
843 client/src/pages/findings.tsx
836 client/src/components/analytics/FinanceMode.tsx
832 shared/schema/logbooks.ts
832 client/src/pages/deck-logbook/index.tsx
831 client/src/features/crew/lib/crewManagementUtils.ts
829 server/pdm/routes.ts
820 client/src/features/serviceOrders/components/ServiceOrderFormDialog.tsx
819 client/src/pages/inventory-management.tsx
811 client/src/features/crew/hooks/useHoursOfRestData.ts
809 server/domains/equipment-intelligence/infrastructure/hub-repository.ts
809 client/src/pages/pdm-pack.tsx
791 server/routes/service-request-routes.ts
787 server/routes/rag-routes.ts
786 client/src/pages/maintenance-schedules.tsx
782 server/domains/crew-admin/interfaces/routes.ts
779 client/src/components/CrewDocumentsTab.tsx
770 server/config/default-role-templates.ts
768 client/src/components/CrewNotificationSettingsTab.tsx
758 shared/schema/admin.ts
755 client/src/pages/organization-management.tsx
755 client/src/pages/MaintenanceTemplatesPage.tsx
748 client/src/components/ai-health/TrainingTab.tsx
744 client/src/pages/home.tsx
731 client/src/components/ai-health/PerformanceTab.tsx
725 server/domains/vessel-diagram-registry/application/service.ts
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
652 server/config/permission-registry.ts
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
596 server/services/patch-applicator.ts
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
503 client/src/components/scheduling/schedule-planner-dialogs.tsx
```
