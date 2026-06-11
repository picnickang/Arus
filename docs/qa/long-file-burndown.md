# Long-File Burndown

Generated: 2026-06-11T16:23:25Z

## Policy

Long files are no longer treated as an all-at-once release blocker. They are a ratcheted burndown gate:

- Files over 500 lines are reported by `scripts/hygiene-dashboard.mjs`.
- CI fails when the counted long-file total increases above the committed ceiling.
- The temporary ceiling is `146` counted files.
- The current counted inventory is `142` files.
- The original release baseline was `52` files.
- The ceiling should only decrease after safe refactors land.
- Production code is not excluded from the count.
- Test fixtures matching `server/tests/*/fixtures.ts` are excluded from the ratchet and tracked here as fixture debt.

## Current Count

| Area                      | Count |
| ------------------------- | ----: |
| Total counted long files  |   142 |
| Server                    |    60 |
| Server route-like files   |    16 |
| Server service-like files |    16 |
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
- The vessel diagram registry pair was reduced by moving route helpers and persistence mappers, though `postgres-store.ts` and `interfaces/routes.ts` remain counted long files.

## Top 30 Longest Files

| Rank | Lines | File                                                                      | Owner/module                | Risk   | Suggested tests before refactor                |
| ---: | ----: | ------------------------------------------------------------------------- | --------------------------- | ------ | ---------------------------------------------- |
|    1 |  1168 | `server/domains/vessel-diagram-registry/infrastructure/postgres-store.ts` | Vessel registry persistence | High   | Vessel Diagram Registry store contract tests   |
|    2 |  1111 | `client/src/pages/admin/equipment-dependencies.tsx`                       | Admin equipment UI          | Medium | Equipment dependency page tests                |
|    3 |  1095 | `client/src/components/crew-admin/SafetyTab.tsx`                          | Crew admin safety UI        | Medium | Safety tab component tests                     |
|    4 |  1090 | `client/src/components/scheduling/ScheduleGeneratorPanel.tsx`             | Scheduling UI               | Medium | Scheduling component tests                     |
|    5 |  1081 | `server/routes/domain-router-registry.ts`                                 | Route registration          | High   | `npm run check:route-registration`, boot smoke |
|    6 |  1073 | `client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx`          | Crew UI                     | High   | Crew form validation tests                     |
|    7 |  1072 | `client/src/components/HoursOfRestGrid/index.tsx`                         | Hours of rest UI            | High   | Hours of rest unit and route tests             |
|    8 |  1064 | `server/domains/crew-extensions/interfaces/scheduler-routes.ts`           | Crew scheduler routes       | High   | Crew scheduler integration tests               |
|    9 |  1055 | `server/domains/crew-admin/application/crew-admin-service.ts`             | Crew admin service          | High   | Crew admin permission and CRUD tests           |
|   10 |  1051 | `client/src/components/scheduling/SchedulePlanner.tsx`                    | Scheduling UI               | Medium | Schedule planner tests                         |
|   11 |   990 | `client/src/pages/ml-training.tsx`                                        | ML training UI              | Medium | ML training page tests                         |
|   12 |   971 | `server/websocket.ts`                                                     | WebSocket runtime           | High   | WebSocket tenant propagation tests             |
|   13 |   951 | `server/telemetry-batch-writer.ts`                                        | Telemetry runtime           | High   | Telemetry batch writer tests                   |
|   14 |   940 | `server/domains/vessel-diagram-registry/interfaces/routes.ts`             | Vessel registry routes      | High   | Vessel Diagram Registry route tests            |
|   15 |   937 | `shared/schema/ml-analytics-advanced.ts`                                  | Shared ML schema            | High   | `npm run check:schema`, ML schema tests        |
|   16 |   923 | `client/src/components/unified-crew-components.tsx`                       | Crew UI shared components   | Medium | Crew component tests                           |
|   17 |   917 | `server/domains/agent/application/orchestrator.ts`                        | Agent orchestration         | High   | Agent orchestration unit tests                 |
|   18 |   915 | `server/import-adapters/amos/import-service.ts`                           | AMOS import                 | High   | AMOS import integration/unit tests             |
|   19 |   899 | `client/src/pages/admin/3d-models.tsx`                                    | Admin 3D models UI          | Medium | Admin 3D page tests                            |
|   20 |   889 | `server/domains/permissions/routes.ts`                                    | Permission routes           | High   | Permission matrix route tests                  |
|   21 |   880 | `server/services/domains/work-order-service.ts`                           | Work order service          | High   | Work order CRUD and completion tests           |
|   22 |   875 | `client/src/pages/copilot-admin.tsx`                                      | Copilot admin UI            | Medium | Copilot admin route tests                      |
|   23 |   869 | `client/src/pages/system-administration.tsx`                              | System admin UI             | Medium | System administration tests                    |
|   24 |   852 | `server/domains/workflow/application/attention-service.ts`                | Workflow attention service  | High   | Workflow attention unit tests                  |
|   25 |   843 | `client/src/pages/findings.tsx`                                           | Findings UI                 | Medium | Findings page tests                            |
|   26 |   836 | `client/src/components/analytics/FinanceMode.tsx`                         | Analytics UI                | Medium | Analytics component tests                      |
|   27 |   832 | `shared/schema/logbooks.ts`                                               | Shared logbook schema       | High   | Schema guard and logbook tests                 |
|   28 |   832 | `client/src/pages/deck-logbook/index.tsx`                                 | Deck logbook UI             | High   | Deck logbook unit and route tests              |
|   29 |   831 | `client/src/features/crew/lib/crewManagementUtils.ts`                     | Crew utilities              | Medium | Crew utility tests                             |
|   30 |   829 | `server/pdm/routes.ts`                                                    | PDM routes                  | High   | PDM route tests                                |

## Recommended Extraction Plan

1. Vessel diagram registry follow-up
   - Continue the store split by extracting mutation/query groups from `postgres-store.ts`.
   - Continue the route split by extracting upload/version/thumbnail route groups from `interfaces/routes.ts`.
   - Required proof: `vessel-diagram-postgres-store-contract.test.ts` and `vessel-diagram-registry-routes.test.ts`.

2. Route registry and route files
   - Split declarative route configuration from registration runtime.
   - Start with `server/routes/domain-router-registry.ts`, then domain route files over 800 lines.
   - Required proof: route-registration guard, boot health, focused integration tests for touched domains.

3. Server persistence stores and services
   - Extract mappers, query builders, DTO adapters, validation helpers, and mutation groups.
   - Prioritize crew admin, work orders, imports, permissions, telemetry, WebSocket, and remaining vessel registry work.
   - Required proof: focused integration tests plus domain-specific unit tests.

4. Shared schema files
   - Split by table group or exported policy surface without changing public barrels.
   - Required proof: dual schema guard, schema-import guard, stale type guard.

5. Client page components
   - Extract colocated subcomponents and hooks. Preserve route behavior, query keys, and test IDs.
   - The completed `registry-screens.tsx` split (dispatcher + one file per screen + `shared.tsx`, mirroring `equipment-hub/`) is the template.
   - Required proof: focused unit/component tests and Playwright smoke for affected pages.

6. Counted test files
   - Split only after production risks are under control.
   - Required proof: the split test file still exercises the same behavior.

## Full Counted Inventory

```text
1168 server/domains/vessel-diagram-registry/infrastructure/postgres-store.ts
1111 client/src/pages/admin/equipment-dependencies.tsx
1095 client/src/components/crew-admin/SafetyTab.tsx
1090 client/src/components/scheduling/ScheduleGeneratorPanel.tsx
1081 server/routes/domain-router-registry.ts
1073 client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx
1072 client/src/components/HoursOfRestGrid/index.tsx
1064 server/domains/crew-extensions/interfaces/scheduler-routes.ts
1055 server/domains/crew-admin/application/crew-admin-service.ts
1051 client/src/components/scheduling/SchedulePlanner.tsx
990 client/src/pages/ml-training.tsx
971 server/websocket.ts
951 server/telemetry-batch-writer.ts
940 server/domains/vessel-diagram-registry/interfaces/routes.ts
937 shared/schema/ml-analytics-advanced.ts
923 client/src/components/unified-crew-components.tsx
917 server/domains/agent/application/orchestrator.ts
915 server/import-adapters/amos/import-service.ts
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
