# Long-File Burndown

Generated: 2026-06-07T21:58:29Z

## Policy

Long files are no longer treated as an all-at-once release blocker. They are a ratcheted burndown gate:

- Files over 500 lines are reported by `scripts/hygiene-dashboard.mjs`.
- CI fails when the counted long-file total increases above the committed ceiling.
- The temporary ceiling is `148` counted files.
- The original release baseline was `52` files.
- The ceiling should only decrease after safe refactors land.
- Production code is not excluded from the count.
- Test fixtures matching `server/tests/*/fixtures.ts` are excluded from the ratchet and tracked here as fixture debt.

## Current Count

| Area                      | Count |
| ------------------------- | ----: |
| Total counted long files  |   148 |
| Server                    |    60 |
| Server route-like files   |    16 |
| Server service-like files |    16 |
| Client                    |    79 |
| Client page files         |    31 |
| Shared                    |     9 |
| Counted tests             |     1 |
| Excluded test fixtures    |     1 |

Excluded fixture:

- `server/tests/telemetry-pipeline/fixtures.ts` - 735 lines

## Top 30 Longest Files

| Rank | Lines | File                                                                      | Owner/module                | Risk   | Suggested tests before refactor                           |
| ---: | ----: | ------------------------------------------------------------------------- | --------------------------- | ------ | --------------------------------------------------------- |
|    1 |  1527 | `client/src/pages/vessel-intelligence/registry-screens.tsx`               | Vessel Intelligence UI      | High   | Vessel Intelligence unit tests, registry Playwright smoke |
|    2 |  1290 | `client/src/components/UnifiedCrewManagement/CrewTaskTracker.tsx`         | Crew UI                     | High   | Crew unit tests, crew mobile smoke                        |
|    3 |  1177 | `shared/schema/admin.ts`                                                  | Shared admin schema         | High   | `npm run check:schema`, schema import guard               |
|    4 |  1132 | `server/import-adapters/shipmate/import-service.ts`                       | Shipmate import             | High   | Shipmate import integration/unit tests                    |
|    5 |  1127 | `server/db/inventory/index.ts`                                            | Inventory persistence       | High   | Inventory receive/reserve/consume tests                   |
|    6 |  1127 | `client/src/pages/admin/equipment-dependencies.tsx`                       | Admin equipment UI          | Medium | Equipment dependency page tests                           |
|    7 |  1111 | `server/domains/vessel-diagram-registry/infrastructure/postgres-store.ts` | Vessel registry persistence | High   | Vessel Diagram Registry API coverage                      |
|    8 |  1090 | `client/src/components/scheduling/ScheduleGeneratorPanel.tsx`             | Scheduling UI               | Medium | Scheduling component tests                                |
|    9 |  1077 | `client/src/components/HoursOfRestGrid/index.tsx`                         | Hours of rest UI            | High   | Hours of rest unit and route tests                        |
|   10 |  1065 | `server/domains/crew-extensions/interfaces/scheduler-routes.ts`           | Crew scheduler routes       | High   | Crew scheduler integration tests                          |
|   11 |  1062 | `server/routes/domain-router-registry.ts`                                 | Route registration          | High   | `npm run check:route-registration`, boot smoke            |
|   12 |  1042 | `server/domains/crew-admin/application/crew-admin-service.ts`             | Crew admin service          | High   | Crew admin permission and CRUD tests                      |
|   13 |  1040 | `client/src/components/scheduling/SchedulePlanner.tsx`                    | Scheduling UI               | Medium | Schedule planner tests                                    |
|   14 |  1026 | `client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx`          | Crew UI                     | High   | Crew form validation tests                                |
|   15 |  1017 | `client/src/components/crew-admin/SafetyTab.tsx`                          | Crew admin safety UI        | Medium | Safety tab component tests                                |
|   16 |  1008 | `shared/schema/ml-analytics-advanced.ts`                                  | Shared ML schema            | High   | `npm run check:schema`, ML schema tests                   |
|   17 |   998 | `server/domains/vessel-diagram-registry/interfaces/routes.ts`             | Vessel registry routes      | High   | Vessel Diagram Registry route tests                       |
|   18 |   987 | `shared/role-dashboard.ts`                                                | Role dashboard policy       | High   | Role dashboard and permission tests                       |
|   19 |   961 | `client/src/pages/ml-training.tsx`                                        | ML training UI              | Medium | ML training page tests                                    |
|   20 |   940 | `server/websocket.ts`                                                     | WebSocket runtime           | High   | WebSocket tenant propagation tests                        |
|   21 |   936 | `client/src/pages/admin/3d-models.tsx`                                    | Admin 3D models UI          | Medium | Admin 3D page tests                                       |
|   22 |   917 | `server/domains/permissions/routes.ts`                                    | Permission routes           | High   | Permission matrix route tests                             |
|   23 |   913 | `server/domains/agent/application/orchestrator.ts`                        | Agent orchestration         | High   | Agent orchestration unit tests                            |
|   24 |   910 | `server/import-adapters/amos/import-service.ts`                           | AMOS import                 | High   | AMOS import integration/unit tests                        |
|   25 |   885 | `server/services/domains/work-order-service.ts`                           | Work order service          | High   | Work order CRUD and completion tests                      |
|   26 |   885 | `client/src/components/unified-crew-components.tsx`                       | Crew UI shared components   | Medium | Crew component tests                                      |
|   27 |   872 | `client/src/pages/copilot-admin.tsx`                                      | Copilot admin UI            | Medium | Copilot admin route tests                                 |
|   28 |   869 | `client/src/pages/system-administration.tsx`                              | System admin UI             | Medium | System administration tests                               |
|   29 |   862 | `client/src/pages/engine-logbook.tsx`                                     | Engine logbook UI           | High   | Engine logbook unit and route tests                       |
|   30 |   841 | `client/src/pages/findings.tsx`                                           | Findings UI                 | Medium | Findings page tests                                       |

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
   - Required proof: focused unit/component tests and Playwright smoke for affected pages.

5. Counted test files
   - Split only after production risks are under control.
   - Required proof: the split test file still exercises the same behavior.

## Full Counted Inventory

```text
1527 client/src/pages/vessel-intelligence/registry-screens.tsx
1290 client/src/components/UnifiedCrewManagement/CrewTaskTracker.tsx
1177 shared/schema/admin.ts
1132 server/import-adapters/shipmate/import-service.ts
1127 server/db/inventory/index.ts
1127 client/src/pages/admin/equipment-dependencies.tsx
1111 server/domains/vessel-diagram-registry/infrastructure/postgres-store.ts
1090 client/src/components/scheduling/ScheduleGeneratorPanel.tsx
1077 client/src/components/HoursOfRestGrid/index.tsx
1065 server/domains/crew-extensions/interfaces/scheduler-routes.ts
1062 server/routes/domain-router-registry.ts
1042 server/domains/crew-admin/application/crew-admin-service.ts
1040 client/src/components/scheduling/SchedulePlanner.tsx
1026 client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx
1017 client/src/components/crew-admin/SafetyTab.tsx
1008 shared/schema/ml-analytics-advanced.ts
998 server/domains/vessel-diagram-registry/interfaces/routes.ts
987 shared/role-dashboard.ts
961 client/src/pages/ml-training.tsx
940 server/websocket.ts
936 client/src/pages/admin/3d-models.tsx
917 server/domains/permissions/routes.ts
913 server/domains/agent/application/orchestrator.ts
910 server/import-adapters/amos/import-service.ts
885 server/services/domains/work-order-service.ts
885 client/src/components/unified-crew-components.tsx
872 client/src/pages/copilot-admin.tsx
869 client/src/pages/system-administration.tsx
862 client/src/pages/engine-logbook.tsx
841 client/src/pages/findings.tsx
838 client/src/pages/deck-logbook/index.tsx
836 client/src/components/analytics/FinanceMode.tsx
832 shared/schema/logbooks.ts
828 server/pdm/routes.ts
821 client/src/features/crew/lib/crewManagementUtils.ts
818 client/src/features/crew/hooks/useHoursOfRestData.ts
817 client/src/pages/inventory-management.tsx
817 client/src/pages/equipment-hub.tsx
815 client/src/pages/pdm-pack.tsx
815 client/src/features/serviceOrders/components/ServiceOrderFormDialog.tsx
787 server/domains/equipment-intelligence/infrastructure/hub-repository.ts
785 client/src/pages/maintenance-schedules.tsx
784 server/domains/workflow/application/attention-service.ts
783 server/routes/service-request-routes.ts
782 client/src/components/CrewDocumentsTab.tsx
768 server/telemetry-batch-writer.ts
765 server/config/default-role-templates.ts
765 client/src/components/CrewNotificationSettingsTab.tsx
757 client/src/pages/governance-dashboard.tsx
755 client/src/pages/MaintenanceTemplatesPage.tsx
753 client/src/pages/organization-management.tsx
744 server/routes/rag-routes.ts
744 client/src/components/ai-health/TrainingTab.tsx
728 server/domains/crew-admin/interfaces/routes.ts
727 client/src/pages/home.tsx
725 client/src/components/ai-health/PerformanceTab.tsx
711 client/src/pages/equipment/index.tsx
711 client/src/components/work-orders/LinkedServiceOrdersPanel.tsx
708 client/src/components/crew-admin/RolesDashboardsTab.tsx
704 shared/schema-runtime.ts
703 server/db/checklists/db-checklists.ts
703 client/src/pages/findings-cards.tsx
692 client/src/components/agent/AgentChatPanel/index.tsx
690 server/domains/agent/tools/enhanced-report-tools.ts
685 client/src/features/crew/hooks/useSchedulePlannerData.ts
685 client/src/components/CrewScheduler.tsx
681 server/db/analytics/db-analytics.ts
680 server/scheduler/scheduler-controller.ts
680 client/src/components/stormgeo-settings.tsx
671 client/src/components/equipment/EquipmentDecommissionDialog.tsx
669 server/domains/vessel-diagram-registry/application/service.ts
655 client/src/components/vessel/VesselSchematic/SchematicConfigPanel.tsx
653 client/src/components/ai-health/InsightsTab.tsx
652 server/domains/crew-admin/infrastructure/crew-admin-repository-adapter.ts
652 server/config/permission-registry.ts
645 server/objectStorage.ts
641 client/src/pages/vessel-management/index.tsx
639 server/db/ml-analytics/db-ml-analytics.ts
638 client/src/pages/DiagnosticsDashboard.tsx
636 server/import-adapters/shipmate/field-mapping.ts
628 client/src/components/crew-admin/UserAccessEditor.tsx
625 server/compliance/routes/data-privacy-routes.ts
622 client/src/components/sensors/SensorSetupWizard.tsx
619 client/src/features/crew/hooks/useUnifiedCrewData.ts
617 client/src/components/analytics/OperationsMode.tsx
615 client/src/components/work-orders/WorkOrderFormDialog.tsx
614 server/domains/equipment/routes.ts
614 client/src/components/crew/CrewComplianceDashboard.tsx
612 client/src/components/admin/SchedulingSettingsTab.tsx
610 client/src/pages/vessel-dashboard/index.tsx
607 client/src/pages/scheduled-reports.tsx
606 server/lib/domain-event-bus/types.ts
602 shared/schema/crew.ts
598 client/src/components/work-orders/EnhancedServiceRequestDialog.tsx
596 server/purchasing/po-routes.ts
594 server/domains/me-portal/me-portal-service.ts
594 client/src/components/equipment/EquipmentFormDialog.tsx
593 client/src/components/crew-admin/UserAssignmentTab.tsx
591 server/pdm/adapters/pdm-postgres.repository.ts
586 client/src/components/admin/SystemSettingsTab.tsx
584 server/routes/wo-so-bridge-routes.ts
584 client/src/pages/desktop-setup.tsx
581 server/domains/agent/application/suggestion-engine.ts
577 server/routes/kb-routes.ts
574 client/src/components/work-orders/WorkOrderDetailDrawer.tsx
574 client/src/components/work-orders/MultiLinePartsRequestDialog.tsx
572 server/compliance/data-anonymization/service.ts
571 client/src/pages/knowledge-base.tsx
570 server/services/ml/prediction-calibration.ts
568 server/domains/scheduling/routes.ts
566 client/src/components/scheduling/crew-scheduler-cards.tsx
562 client/src/components/UnifiedCrewManagement/CrewRoleManager.tsx
559 server/db/crew-extensions/db-crew-extensions.ts
550 server/utils/statistics.ts
550 server/domains/equipment-intelligence/infrastructure/postgres-repository.ts
547 server/services/ml/prediction-outcome-tracker.ts
546 server/ml-routes/model-routes.ts
544 server/services/anomaly-correlation/anomaly-correlator.ts
539 server/integrations/fmcc-types.ts
539 server/domains/vessel-diagram-registry/infrastructure/in-memory-store.ts
539 client/src/lib/offline-sync.ts
538 client/src/pages/analytics-hub.tsx
538 client/src/features/serviceRequests/pages/ServiceRequestsPage.tsx
537 client/src/pages/pdm-equipment-detail.tsx
537 client/src/config/navigationConfig.ts
534 server/domains/permissions/repository.ts
533 shared/schema/equipment.ts
532 client/src/features/crew/hooks/useShiftPlanning.ts
530 server/domains/crew-extensions/infrastructure/schedule-planner-read-model.ts
530 client/src/pages/agent-activity.tsx
527 server/integrations/fmcc-polling-service.ts
527 client/src/components/engine-logbook/row-components.tsx
525 client/src/pages/vessel-intelligence/registry-api.ts
524 client/src/features/work-orders/hooks/useWorkOrdersPageData.ts
523 server/tests/pdm/get-schedule.test.ts
521 server/db/equipment/db-equipment.ts
521 client/src/pages/logs-compliance-hub.tsx
520 server/domains/crew/application/crew-service.ts
515 shared/schema/purchasing.ts
515 server/domains/agent/tools/weather-tools.ts
512 client/src/features/suppliers/components/SupplierForm.tsx
511 server/services/rms/alert-service.ts
507 client/src/components/UnifiedCrewManagement/CurrentRoster.tsx
506 shared/schema/alerts.ts
506 server/services/ml/model-evaluation-gate.ts
506 client/src/pages/work-orders.tsx
504 server/domains/rms/routes.ts
503 client/src/components/scheduling/schedule-planner-dialogs.tsx
```
