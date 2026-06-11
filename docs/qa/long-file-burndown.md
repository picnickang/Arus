# Long-File Burndown

Generated: 2026-06-11T04:57:34Z

## Policy

Long files are no longer treated as an all-at-once release blocker. They are a ratcheted burndown gate:

- Files over 500 lines are reported by `scripts/hygiene-dashboard.mjs`.
- CI fails when the counted long-file total increases above the committed ceiling.
- The temporary ceiling is `146` counted files.
- The original release baseline was `52` files.
- The ceiling should only decrease after safe refactors land.
- Production code is not excluded from the count.
- Test fixtures matching `server/tests/*/fixtures.ts` are excluded from the ratchet and tracked here as fixture debt.

## Current Count

| Area                      | Count |
| ------------------------- | ----: |
| Total counted long files  |   146 |
| Server                    |    62 |
| Server route-like files   |    16 |
| Server service-like files |    17 |
| Client                    |    75 |
| Client page files         |    28 |
| Shared                    |     9 |
| Counted tests             |     1 |
| Excluded test fixtures    |     1 |

Excluded fixture:

- `server/tests/telemetry-pipeline/fixtures.ts` - 735 lines

Completed splits: `client/src/pages/vessel-intelligence/registry-screens.tsx` (former rank 1,
1,766 lines) was split 2026-06-11 into a 111-line dispatcher plus per-screen files under
`registry-screens/` following the `equipment-hub/` template.

## Top 30 Longest Files

| Rank | Lines | File                                                                      | Owner/module                | Risk   | Suggested tests before refactor                |
| ---: | ----: | ------------------------------------------------------------------------- | --------------------------- | ------ | ---------------------------------------------- |
|    1 |  1290 | `client/src/components/UnifiedCrewManagement/CrewTaskTracker.tsx`         | Crew UI                     | High   | Crew unit tests, crew mobile smoke             |
|    2 |  1261 | `server/domains/vessel-diagram-registry/infrastructure/postgres-store.ts` | Vessel registry persistence | High   | Vessel Diagram Registry API coverage           |
|    3 |  1147 | `server/import-adapters/shipmate/import-service.ts`                       | Shipmate import             | High   | Shipmate import integration/unit tests         |
|    4 |  1137 | `server/db/inventory/index.ts`                                            | Inventory persistence       | High   | Inventory receive/reserve/consume tests        |
|    5 |  1112 | `client/src/pages/admin/equipment-dependencies.tsx`                       | Admin equipment UI          | Medium | Equipment dependency page tests                |
|    6 |  1090 | `client/src/components/scheduling/ScheduleGeneratorPanel.tsx`             | Scheduling UI               | Medium | Scheduling component tests                     |
|    7 |  1077 | `client/src/components/HoursOfRestGrid/index.tsx`                         | Hours of rest UI            | High   | Hours of rest unit and route tests             |
|    8 |  1073 | `client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx`          | Crew UI                     | High   | Crew form validation tests                     |
|    9 |  1065 | `server/domains/crew-extensions/interfaces/scheduler-routes.ts`           | Crew scheduler routes       | High   | Crew scheduler integration tests               |
|   10 |  1062 | `server/routes/domain-router-registry.ts`                                 | Route registration          | High   | `npm run check:route-registration`, boot smoke |
|   11 |  1051 | `server/domains/vessel-diagram-registry/interfaces/routes.ts`             | Vessel registry routes      | High   | Vessel Diagram Registry route tests            |
|   12 |  1042 | `server/domains/crew-admin/application/crew-admin-service.ts`             | Crew admin service          | High   | Crew admin permission and CRUD tests           |
|   13 |  1040 | `client/src/components/scheduling/SchedulePlanner.tsx`                    | Scheduling UI               | Medium | Schedule planner tests                         |
|   14 |  1017 | `client/src/components/crew-admin/SafetyTab.tsx`                          | Crew admin safety UI        | Medium | Safety tab component tests                     |
|   15 |   990 | `client/src/pages/ml-training.tsx`                                        | ML training UI              | Medium | ML training page tests                         |
|   16 |   987 | `shared/role-dashboard.ts`                                                | Role dashboard policy       | High   | Role dashboard and permission tests            |
|   17 |   971 | `server/websocket.ts`                                                     | WebSocket runtime           | High   | WebSocket tenant propagation tests             |
|   18 |   941 | `client/src/pages/admin/3d-models.tsx`                                    | Admin 3D models UI          | Medium | Admin 3D page tests                            |
|   19 |   932 | `shared/schema/ml-analytics-advanced.ts`                                  | Shared ML schema            | High   | `npm run check:schema`, ML schema tests        |
|   20 |   913 | `server/domains/agent/application/orchestrator.ts`                        | Agent orchestration         | High   | Agent orchestration unit tests                 |
|   21 |   910 | `server/import-adapters/amos/import-service.ts`                           | AMOS import                 | High   | AMOS import integration/unit tests             |
|   22 |   889 | `server/domains/permissions/routes.ts`                                    | Permission routes           | High   | Permission matrix route tests                  |
|   23 |   885 | `server/services/domains/work-order-service.ts`                           | Work order service          | High   | Work order CRUD and completion tests           |
|   24 |   885 | `client/src/components/unified-crew-components.tsx`                       | Crew UI shared components   | Medium | Crew component tests                           |
|   25 |   872 | `client/src/pages/copilot-admin.tsx`                                      | Copilot admin UI            | Medium | Copilot admin route tests                      |
|   26 |   869 | `client/src/pages/system-administration.tsx`                              | System admin UI             | Medium | System administration tests                    |
|   27 |   852 | `server/domains/workflow/application/attention-service.ts`                | Workflow attention service  | High   | Workflow attention unit tests                  |
|   28 |   841 | `client/src/pages/findings.tsx`                                           | Findings UI                 | Medium | Findings page tests                            |
|   29 |   838 | `client/src/pages/deck-logbook/index.tsx`                                 | Deck logbook UI             | High   | Deck logbook unit and route tests              |
|   30 |   836 | `client/src/components/analytics/FinanceMode.tsx`                         | Analytics UI                | Medium | Analytics component tests                      |

## Recommended Extraction Plan

1. Route registry and route files
   - Split declarative route configuration from registration runtime.
   - Start with `server/routes/domain-router-registry.ts`, then domain route files over 800 lines.
   - Required proof: route-registration guard, boot health, focused integration tests for touched domains.

2. Server persistence stores and services
   - Extract mappers, query builders, DTO adapters, validation helpers, and mutation groups.
   - Prioritize inventory, vessel registry, crew admin, work orders, imports, permissions, and WebSocket.
   - Required proof: focused integration tests plus domain-specific unit tests.

3. Shared schema files
   - Split by table group or exported policy surface without changing public barrels.
   - Required proof: dual schema guard, schema-import guard, stale type guard.

4. Client page components
   - Extract colocated subcomponents and hooks. Preserve route behavior, query keys, and test IDs.
   - The completed `registry-screens.tsx` split (dispatcher + one file per screen + `shared.tsx`,
     mirroring `equipment-hub/`) is the template; `vessel-intelligence-hub-v2.test.ts` shows how
     to keep test-id pins across a split.
   - Required proof: focused unit/component tests and Playwright smoke for affected pages.

5. Counted test files
   - Split only after production risks are under control.
   - Required proof: the split test file still exercises the same behavior.

## Full Counted Inventory

```text
1290 client/src/components/UnifiedCrewManagement/CrewTaskTracker.tsx
1261 server/domains/vessel-diagram-registry/infrastructure/postgres-store.ts
1147 server/import-adapters/shipmate/import-service.ts
1137 server/db/inventory/index.ts
1112 client/src/pages/admin/equipment-dependencies.tsx
1090 client/src/components/scheduling/ScheduleGeneratorPanel.tsx
1077 client/src/components/HoursOfRestGrid/index.tsx
1073 client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx
1065 server/domains/crew-extensions/interfaces/scheduler-routes.ts
1062 server/routes/domain-router-registry.ts
1051 server/domains/vessel-diagram-registry/interfaces/routes.ts
1042 server/domains/crew-admin/application/crew-admin-service.ts
1040 client/src/components/scheduling/SchedulePlanner.tsx
1017 client/src/components/crew-admin/SafetyTab.tsx
990 client/src/pages/ml-training.tsx
987 shared/role-dashboard.ts
971 server/websocket.ts
941 client/src/pages/admin/3d-models.tsx
932 shared/schema/ml-analytics-advanced.ts
913 server/domains/agent/application/orchestrator.ts
910 server/import-adapters/amos/import-service.ts
889 server/domains/permissions/routes.ts
885 server/services/domains/work-order-service.ts
885 client/src/components/unified-crew-components.tsx
872 client/src/pages/copilot-admin.tsx
869 client/src/pages/system-administration.tsx
852 server/domains/workflow/application/attention-service.ts
841 client/src/pages/findings.tsx
838 client/src/pages/deck-logbook/index.tsx
836 client/src/components/analytics/FinanceMode.tsx
832 shared/schema/logbooks.ts
828 server/pdm/routes.ts
821 client/src/features/crew/lib/crewManagementUtils.ts
817 client/src/pages/inventory-management.tsx
815 client/src/pages/pdm-pack.tsx
815 client/src/features/serviceOrders/components/ServiceOrderFormDialog.tsx
811 client/src/features/crew/hooks/useHoursOfRestData.ts
809 server/domains/equipment-intelligence/infrastructure/hub-repository.ts
791 server/routes/service-request-routes.ts
787 server/routes/rag-routes.ts
785 client/src/pages/maintenance-schedules.tsx
782 client/src/components/CrewDocumentsTab.tsx
768 server/telemetry-batch-writer.ts
765 server/config/default-role-templates.ts
765 client/src/components/CrewNotificationSettingsTab.tsx
757 client/src/pages/governance-dashboard.tsx
756 shared/schema/admin.ts
755 client/src/pages/MaintenanceTemplatesPage.tsx
753 client/src/pages/organization-management.tsx
744 client/src/pages/home.tsx
744 client/src/components/ai-health/TrainingTab.tsx
728 server/domains/crew-admin/interfaces/routes.ts
725 client/src/components/ai-health/PerformanceTab.tsx
711 client/src/pages/equipment/index.tsx
711 client/src/components/work-orders/LinkedServiceOrdersPanel.tsx
708 client/src/components/crew-admin/RolesDashboardsTab.tsx
707 shared/schema-runtime.ts
706 server/domains/vessel-diagram-registry/application/service.ts
703 server/db/checklists/db-checklists.ts
703 client/src/pages/findings-cards.tsx
692 client/src/components/agent/AgentChatPanel/index.tsx
690 server/domains/agent/tools/enhanced-report-tools.ts
685 client/src/components/CrewScheduler.tsx
681 server/db/analytics/db-analytics.ts
681 client/src/features/crew/hooks/useSchedulePlannerData.ts
680 server/scheduler/scheduler-controller.ts
680 client/src/components/stormgeo-settings.tsx
671 client/src/components/equipment/EquipmentDecommissionDialog.tsx
655 client/src/components/vessel/VesselSchematic/SchematicConfigPanel.tsx
654 client/src/components/ai-health/InsightsTab.tsx
652 server/domains/crew-admin/infrastructure/crew-admin-repository-adapter.ts
652 server/config/permission-registry.ts
646 server/domains/permissions/repository.ts
645 server/objectStorage.ts
641 client/src/pages/vessel-management/index.tsx
639 server/db/ml-analytics/db-ml-analytics.ts
638 client/src/pages/vessel-intelligence/registry-api.ts
638 client/src/pages/DiagnosticsDashboard.tsx
637 shared/schema/alerts.ts
636 server/import-adapters/shipmate/field-mapping.ts
631 client/src/features/crew/hooks/useUnifiedCrewData.ts
628 client/src/components/crew-admin/UserAccessEditor.tsx
625 server/compliance/routes/data-privacy-routes.ts
623 client/src/components/work-orders/WorkOrderFormDialog.tsx
622 client/src/components/sensors/SensorSetupWizard.tsx
620 server/domains/scheduling/routes.ts
617 client/src/components/analytics/OperationsMode.tsx
614 server/domains/equipment/routes.ts
614 client/src/components/crew/CrewComplianceDashboard.tsx
612 server/domains/me-portal/me-portal-service.ts
612 client/src/components/admin/SchedulingSettingsTab.tsx
610 client/src/pages/vessel-dashboard/index.tsx
608 shared/schema/crew.ts
607 client/src/pages/scheduled-reports.tsx
606 server/lib/domain-event-bus/types.ts
596 server/domains/vessel-diagram-registry/infrastructure/in-memory-store.ts
594 client/src/components/equipment/EquipmentFormDialog.tsx
593 server/routes/wo-so-bridge-routes.ts
593 client/src/components/crew-admin/UserAssignmentTab.tsx
592 server/purchasing/po-routes.ts
591 server/pdm/adapters/pdm-postgres.repository.ts
591 client/src/pages/desktop-setup.tsx
590 client/src/lib/queryClient.ts
589 server/compliance/data-anonymization/service.ts
586 server/services/patch-applicator.ts
586 client/src/components/admin/SystemSettingsTab.tsx
584 server/domains/equipment-intelligence/infrastructure/postgres-repository.ts
581 server/domains/agent/application/suggestion-engine.ts
577 client/src/pages/knowledge-base.tsx
574 client/src/components/work-orders/WorkOrderDetailDrawer.tsx
571 client/src/config/navigationConfig.ts
570 server/services/ml/prediction-calibration.ts
569 server/routes/kb-routes.ts
566 client/src/components/scheduling/crew-scheduler-cards.tsx
562 client/src/components/UnifiedCrewManagement/CrewRoleManager.tsx
559 server/db/crew-extensions/db-crew-extensions.ts
550 server/utils/statistics.ts
550 client/src/pages/analytics-hub.tsx
547 server/services/ml/prediction-outcome-tracker.ts
547 client/src/pages/pdm-equipment-detail.tsx
546 server/ml-routes/model-routes.ts
544 server/services/anomaly-correlation/anomaly-correlator.ts
539 server/integrations/fmcc-types.ts
538 client/src/features/serviceRequests/pages/ServiceRequestsPage.tsx
534 shared/schema/equipment.ts
532 server/background-jobs.ts
532 client/src/features/crew/hooks/useShiftPlanning.ts
530 server/domains/crew-extensions/infrastructure/schedule-planner-read-model.ts
530 client/src/pages/agent-activity.tsx
530 client/src/features/work-orders/hooks/useWorkOrdersPageData.ts
527 server/integrations/fmcc-polling-service.ts
527 client/src/components/engine-logbook/row-components.tsx
523 server/tests/pdm/get-schedule.test.ts
522 client/src/lib/offline-sync.ts
521 server/db/equipment/db-equipment.ts
521 client/src/pages/logs-compliance-hub.tsx
520 server/domains/crew/application/crew-service.ts
519 server/services/ml/model-evaluation-gate.ts
516 shared/schema/purchasing.ts
515 server/domains/agent/tools/weather-tools.ts
512 client/src/features/suppliers/components/SupplierForm.tsx
511 server/services/rms/alert-service.ts
507 client/src/components/UnifiedCrewManagement/CurrentRoster.tsx
506 client/src/pages/work-orders.tsx
504 server/domains/rms/routes.ts
503 client/src/components/scheduling/schedule-planner-dialogs.tsx
```
