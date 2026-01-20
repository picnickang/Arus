# API Contract Verification Matrix

**Generated:** 2025-11-04T16:14:22.420Z

## Summary

- ✅ **Matched (with validation):** 40
- ⚠️ **Partial (missing validation):** 87
- ❌ **Missing:** 0
- **Total:** 127

**Pass Rate:** 31.5%

---

## ✅ Matched Endpoints (40)

| Method | Path | Client | Server | Validation |
|--------|------|--------|--------|------------|
| PUT | `/api/transport-settings` | [client/src/pages/transport-settings.tsx:56](../../client/src/pages/transport-settings.tsx#L56) | [server/routes.ts:9088](../../server/routes.ts#L9088) | ✅ |
| POST | `/api/storage/config` | [client/src/pages/storage-settings.tsx:63](../../client/src/pages/storage-settings.tsx#L63) | [server/routes.ts:14975](../../server/routes.ts#L14975) | ✅ |
| POST | `/api/storage/config/test` | [client/src/pages/storage-settings.tsx:83](../../client/src/pages/storage-settings.tsx#L83) | [server/routes.ts:15001](../../server/routes.ts#L15001) | ✅ |
| POST | `/api/reports/generate/pdf` | [client/src/pages/reports.tsx:57](../../client/src/pages/reports.tsx#L57) | [server/routes.ts:8139](../../server/routes.ts#L8139) | ✅ |
| GET | `/api/pdm/alerts` | [client/src/pages/pdm-pack.tsx:71](../../client/src/pages/pdm-pack.tsx#L71) | [server/routes.ts:1606](../../server/routes.ts#L1606) | ✅ |
| GET | `/api/pdm/baseline/:param/:param` | [client/src/pages/pdm-pack.tsx:91](../../client/src/pages/pdm-pack.tsx#L91) | [server/routes.ts:1634](../../server/routes.ts#L1634) | ✅ |
| POST | `/api/pdm/analyze/bearing` | [client/src/pages/pdm-pack.tsx:192](../../client/src/pages/pdm-pack.tsx#L192) | [server/routes.ts:1521](../../server/routes.ts#L1521) | ✅ |
| POST | `/api/pdm/analyze/pump` | [client/src/pages/pdm-pack.tsx:226](../../client/src/pages/pdm-pack.tsx#L226) | [server/routes.ts:1563](../../server/routes.ts#L1563) | ✅ |
| POST | `/api/organizations` | [client/src/pages/organization-management.tsx:88](../../client/src/pages/organization-management.tsx#L88) | [server/routes.ts:2218](../../server/routes.ts#L2218) | ✅ |
| POST | `/api/users` | [client/src/pages/organization-management.tsx:146](../../client/src/pages/organization-management.tsx#L146) | [server/routes.ts:2290](../../server/routes.ts#L2290) | ✅ |
| POST | `/api/optimization/run` | [client/src/pages/optimization-tools.tsx:252](../../client/src/pages/optimization-tools.tsx#L252) | [server/routes.ts:13906](../../server/routes.ts#L13906) | ✅ |
| POST | `/api/optimization/run` | [client/src/pages/optimization-tools.tsx:323](../../client/src/pages/optimization-tools.tsx#L323) | [server/routes.ts:13906](../../server/routes.ts#L13906) | ✅ |
| POST | `/api/beast/lp/optimize` | [client/src/pages/optimization-tools.tsx:374](../../client/src/pages/optimization-tools.tsx#L374) | [server/routes.ts:14020](../../server/routes.ts#L14020) | ✅ |
| POST | `/api/import/telemetry/json` | [client/src/pages/manual-telemetry-upload.tsx:104](../../client/src/pages/manual-telemetry-upload.tsx#L104) | [server/routes.ts:8671](../../server/routes.ts#L8671) | ✅ |
| POST | `/api/parts-inventory` | [client/src/pages/inventory-management.tsx:138](../../client/src/pages/inventory-management.tsx#L138) | [server/domains/inventory/routes.ts:151](../../server/domains/inventory/routes.ts#L151) | ✅ |
| GET | `/api/llm/vessel/:param/intelligence` | [client/src/pages/ai-insights.tsx:290](../../client/src/pages/ai-insights.tsx#L290) | [server/routes.ts:10216](../../server/routes.ts#L10216) | ✅ |
| POST | `/api/operating-parameters` | [client/src/pages/OperatingParametersPage.tsx:136](../../client/src/pages/OperatingParametersPage.tsx#L136) | [server/routes.ts:7697](../../server/routes.ts#L7697) | ✅ |
| POST | `/api/maintenance-templates` | [client/src/pages/MaintenanceTemplatesPage.tsx:121](../../client/src/pages/MaintenanceTemplatesPage.tsx#L121) | [server/domains/maintenance/routes.ts:211](../../server/domains/maintenance/routes.ts#L211) | ✅ |
| POST | `/api/error-logs` | [client/src/lib/errorHandler.ts:19](../../client/src/lib/errorHandler.ts#L19) | [server/routes.ts:17590](../../server/routes.ts#L17590) | ✅ |
| POST | `/api/devices` | [client/src/lib/api.ts:76](../../client/src/lib/api.ts#L76) | [server/domains/devices/routes.ts:59](../../server/domains/devices/routes.ts#L59) | ✅ |
| POST | `/api/edge/heartbeat` | [client/src/lib/api.ts:89](../../client/src/lib/api.ts#L89) | [server/routes.ts:1406](../../server/routes.ts#L1406) | ✅ |
| POST | `/api/pdm/scores` | [client/src/lib/api.ts:103](../../client/src/lib/api.ts#L103) | [server/routes.ts:1452](../../server/routes.ts#L1452) | ✅ |
| PUT | `/api/settings` | [client/src/lib/api.ts:159](../../client/src/lib/api.ts#L159) | [server/routes.ts:7356](../../server/routes.ts#L7356) | ✅ |
| GET | `/api/telemetry/trends` | [client/src/lib/api.ts:169](../../client/src/lib/api.ts#L169) | [server/routes.ts:4093](../../server/routes.ts#L4093) | ✅ |
| POST | `/api/telemetry/readings` | [client/src/lib/api.ts:173](../../client/src/lib/api.ts#L173) | [server/routes.ts:4114](../../server/routes.ts#L4114) | ✅ |
| POST | `/api/sensors/approve` | [client/src/hooks/useCrudMutations.ts:215](../../client/src/hooks/useCrudMutations.ts#L215) | [server/sensor-routes.ts:159](../../server/sensor-routes.ts#L159) | ✅ |
| POST | `/api/sensors/approve` | [client/src/components/UnknownSignals.tsx:57](../../client/src/components/UnknownSignals.tsx#L57) | [server/sensor-routes.ts:159](../../server/sensor-routes.ts#L159) | ✅ |
| POST | `/api/crew/:param/toggle-duty` | [client/src/components/UnifiedCrewManagement.tsx:155](../../client/src/components/UnifiedCrewManagement.tsx#L155) | [server/routes.ts:11746](../../server/routes.ts#L11746) | ✅ |
| POST | `/api/sensors/templates/apply` | [client/src/components/SensorTemplates.tsx:43](../../client/src/components/SensorTemplates.tsx#L43) | [server/sensor-routes.ts:225](../../server/sensor-routes.ts#L225) | ✅ |
| POST | `/api/expenses` | [client/src/components/ExpenseTrackingForm.tsx:137](../../client/src/components/ExpenseTrackingForm.tsx#L137) | [server/routes.ts:6327](../../server/routes.ts#L6327) | ✅ |
| POST | `/api/error-logs` | [client/src/components/ErrorBoundary.tsx:51](../../client/src/components/ErrorBoundary.tsx#L51) | [server/routes.ts:17590](../../server/routes.ts#L17590) | ✅ |
| POST | `/api/crew/schedule/plan` | [client/src/components/CrewScheduler.tsx:288](../../client/src/components/CrewScheduler.tsx#L288) | [server/routes.ts:11940](../../server/routes.ts#L11940) | ✅ |
| GET | `/api/telemetry/trends` | [client/src/components/analytics/OperationsMode.tsx:38](../../client/src/components/analytics/OperationsMode.tsx#L38) | [server/routes.ts:4093](../../server/routes.ts#L4093) | ✅ |
| GET | `/api/pdm/scores` | [client/src/components/analytics/OperationsMode.tsx:74](../../client/src/components/analytics/OperationsMode.tsx#L74) | [server/routes.ts:1420](../../server/routes.ts#L1420) | ✅ |
| GET | `/api/analytics/cost-trends` | [client/src/components/analytics/MissionOverview.tsx:47](../../client/src/components/analytics/MissionOverview.tsx#L47) | [server/routes.ts:9707](../../server/routes.ts#L9707) | ✅ |
| GET | `/api/pdm/scores` | [client/src/components/analytics/MaintenanceMode.tsx:22](../../client/src/components/analytics/MaintenanceMode.tsx#L22) | [server/routes.ts:1420](../../server/routes.ts#L1420) | ✅ |
| GET | `/api/cost-savings/summary` | [client/src/components/analytics/MaintenanceMode.tsx:70](../../client/src/components/analytics/MaintenanceMode.tsx#L70) | [server/routes.ts:7183](../../server/routes.ts#L7183) | ✅ |
| GET | `/api/analytics/cost-trends` | [client/src/components/analytics/FinanceMode.tsx:34](../../client/src/components/analytics/FinanceMode.tsx#L34) | [server/routes.ts:9707](../../server/routes.ts#L9707) | ✅ |
| GET | `/api/analytics/cost-summary` | [client/src/components/analytics/FinanceMode.tsx:46](../../client/src/components/analytics/FinanceMode.tsx#L46) | [server/routes.ts:9727](../../server/routes.ts#L9727) | ✅ |
| GET | `/api/cost-savings/summary` | [client/src/components/analytics/FinanceMode.tsx:58](../../client/src/components/analytics/FinanceMode.tsx#L58) | [server/routes.ts:7183](../../server/routes.ts#L7183) | ✅ |

## ⚠️ Partial Matches (No Validation) (87)

| Method | Path | Client | Server | Issue |
|--------|------|--------|--------|-------|
| DELETE | `/api/work-orders/clear` | [client/src/pages/work-orders.tsx:172](../../client/src/pages/work-orders.tsx#L172) | [server/routes.ts:13574](../../server/routes.ts#L13574) | Missing zod validation |
| GET | `/api/equipment` | [client/src/pages/vessel-management.tsx:74](../../client/src/pages/vessel-management.tsx#L74) | [server/domains/equipment/routes.ts:22](../../server/domains/equipment/routes.ts#L22) | Missing zod validation |
| GET | `/api/work-orders` | [client/src/pages/vessel-detail.tsx:43](../../client/src/pages/vessel-detail.tsx#L43) | [server/domains/work-orders/routes.ts:27](../../server/domains/work-orders/routes.ts#L27) | Missing zod validation |
| GET | `/api/crew` | [client/src/pages/vessel-detail.tsx:48](../../client/src/pages/vessel-detail.tsx#L48) | [server/domains/crew/routes.ts:30](../../server/domains/crew/routes.ts#L30) | Missing zod validation |
| GET | `/api/maintenance-schedules` | [client/src/pages/vessel-detail.tsx:53](../../client/src/pages/vessel-detail.tsx#L53) | [server/domains/maintenance/routes.ts:27](../../server/domains/maintenance/routes.ts#L27) | Missing zod validation |
| GET | `/api/transport-settings` | [client/src/pages/transport-settings.tsx:31](../../client/src/pages/transport-settings.tsx#L31) | [server/routes.ts:9070](../../server/routes.ts#L9070) | Missing zod validation |
| POST | `/api/storage/ops-db/stage` | [client/src/pages/storage-settings.tsx:98](../../client/src/pages/storage-settings.tsx#L98) | [server/routes.ts:15028](../../server/routes.ts#L15028) | Missing zod validation |
| POST | `/api/storage/ops-db/test` | [client/src/pages/storage-settings.tsx:108](../../client/src/pages/storage-settings.tsx#L108) | [server/routes.ts:15054](../../server/routes.ts#L15054) | Missing zod validation |
| POST | `/api/admin/factory-reset` | [client/src/pages/settings.tsx:39](../../client/src/pages/settings.tsx#L39) | [server/routes.ts:15151](../../server/routes.ts#L15151) | Missing zod validation |
| GET | `/api/reports/compliance/:param` | [client/src/pages/reports.tsx:88](../../client/src/pages/reports.tsx#L88) | [server/routes.ts:9948](../../server/routes.ts#L9948) | Missing zod validation |
| GET | `/api/reports/export/csv` | [client/src/pages/reports.tsx:105](../../client/src/pages/reports.tsx#L105) | [server/routes.ts:7919](../../server/routes.ts#L7919) | Missing zod validation |
| GET | `/api/reports/export/json` | [client/src/pages/reports.tsx:129](../../client/src/pages/reports.tsx#L129) | [server/routes.ts:8069](../../server/routes.ts#L8069) | Missing zod validation |
| GET | `/api/pdm/health` | [client/src/pages/pdm-pack.tsx:83](../../client/src/pages/pdm-pack.tsx#L83) | [server/routes.ts:1681](../../server/routes.ts#L1681) | Missing zod validation |
| GET | `/api/users` | [client/src/pages/organization-management.tsx:41](../../client/src/pages/organization-management.tsx#L41) | [server/routes.ts:2266](../../server/routes.ts#L2266) | Missing zod validation |
| GET | `/api/optimization/configurations` | [client/src/pages/optimization-tools.tsx:182](../../client/src/pages/optimization-tools.tsx#L182) | [server/routes.ts:13837](../../server/routes.ts#L13837) | Missing zod validation |
| GET | `/api/optimization/results` | [client/src/pages/optimization-tools.tsx:191](../../client/src/pages/optimization-tools.tsx#L191) | [server/routes.ts:13893](../../server/routes.ts#L13893) | Missing zod validation |
| GET | `/api/optimization/trend-insights` | [client/src/pages/optimization-tools.tsx:201](../../client/src/pages/optimization-tools.tsx#L201) | [server/routes.ts:14128](../../server/routes.ts#L14128) | Missing zod validation |
| GET | `/api/equipment` | [client/src/pages/optimization-tools.tsx:211](../../client/src/pages/optimization-tools.tsx#L211) | [server/domains/equipment/routes.ts:22](../../server/domains/equipment/routes.ts#L22) | Missing zod validation |
| GET | `/api/equipment/:param/rul` | [client/src/pages/optimization-tools.tsx:227](../../client/src/pages/optimization-tools.tsx#L227) | [server/domains/equipment/routes.ts:68](../../server/domains/equipment/routes.ts#L68) | Missing zod validation |
| GET | `/api/optimization/:param/download` | [client/src/pages/optimization-tools.tsx:288](../../client/src/pages/optimization-tools.tsx#L288) | [server/routes.ts:13972](../../server/routes.ts#L13972) | Missing zod validation |
| DELETE | `/api/optimization/results` | [client/src/pages/optimization-tools.tsx:312](../../client/src/pages/optimization-tools.tsx#L312) | [server/routes.ts:14007](../../server/routes.ts#L14007) | Missing zod validation |
| POST | `/api/crew/schedule/plan-enhanced` | [client/src/pages/optimization-tools.tsx:346](../../client/src/pages/optimization-tools.tsx#L346) | [server/routes.ts:12675](../../server/routes.ts#L12675) | Missing zod validation |
| GET | `/api/analytics/ml-models` | [client/src/pages/ml-training.tsx:81](../../client/src/pages/ml-training.tsx#L81) | [server/routes.ts:2339](../../server/routes.ts#L2339) | Missing zod validation |
| POST | `/api/ml/train/lstm` | [client/src/pages/ml-training.tsx:112](../../client/src/pages/ml-training.tsx#L112) | [server/routes.ts:10892](../../server/routes.ts#L10892) | Missing zod validation |
| POST | `/api/ml/train/random-forest` | [client/src/pages/ml-training.tsx:136](../../client/src/pages/ml-training.tsx#L136) | [server/routes.ts:10938](../../server/routes.ts#L10938) | Missing zod validation |
| POST | `/api/acoustic/analyze` | [client/src/pages/ml-training.tsx:159](../../client/src/pages/ml-training.tsx#L159) | [server/routes.ts:10845](../../server/routes.ts#L10845) | Missing zod validation |
| GET | `/api/raw-telemetry` | [client/src/pages/manual-telemetry-upload.tsx:57](../../client/src/pages/manual-telemetry-upload.tsx#L57) | [server/routes.ts:9119](../../server/routes.ts#L9119) | Missing zod validation |
| POST | `/api/import/telemetry/csv` | [client/src/pages/manual-telemetry-upload.tsx:79](../../client/src/pages/manual-telemetry-upload.tsx#L79) | [server/routes.ts:8820](../../server/routes.ts#L8820) | Missing zod validation |
| GET | `/api/maintenance-schedules/upcoming` | [client/src/pages/maintenance-schedules.tsx:165](../../client/src/pages/maintenance-schedules.tsx#L165) | [server/domains/maintenance/routes.ts:42](../../server/domains/maintenance/routes.ts#L42) | Missing zod validation |
| GET | `/api/equipment` | [client/src/pages/health-monitor.tsx:57](../../client/src/pages/health-monitor.tsx#L57) | [server/domains/equipment/routes.ts:22](../../server/domains/equipment/routes.ts#L22) | Missing zod validation |
| DELETE | `/api/alerts/all` | [client/src/pages/alerts.tsx:179](../../client/src/pages/alerts.tsx#L179) | [server/domains/alerts/routes.ts:324](../../server/domains/alerts/routes.ts#L324) | Missing zod validation |
| POST | `/api/ml/predict/failure` | [client/src/pages/advanced-analytics.tsx:165](../../client/src/pages/advanced-analytics.tsx#L165) | [server/routes.ts:11063](../../server/routes.ts#L11063) | Missing zod validation |
| GET | `/api/analytics/ml-models` | [client/src/pages/advanced-analytics.tsx:374](../../client/src/pages/advanced-analytics.tsx#L374) | [server/routes.ts:2339](../../server/routes.ts#L2339) | Missing zod validation |
| GET | `/api/analytics/anomaly-detections` | [client/src/pages/advanced-analytics.tsx:392](../../client/src/pages/advanced-analytics.tsx#L392) | [server/routes.ts:3774](../../server/routes.ts#L3774) | Missing zod validation |
| GET | `/api/analytics/failure-predictions` | [client/src/pages/advanced-analytics.tsx:410](../../client/src/pages/advanced-analytics.tsx#L410) | [server/routes.ts:3852](../../server/routes.ts#L3852) | Missing zod validation |
| GET | `/api/analytics/threshold-optimizations` | [client/src/pages/advanced-analytics.tsx:428](../../client/src/pages/advanced-analytics.tsx#L428) | [server/routes.ts:3909](../../server/routes.ts#L3909) | Missing zod validation |
| GET | `/api/analytics/digital-twins` | [client/src/pages/advanced-analytics.tsx:446](../../client/src/pages/advanced-analytics.tsx#L446) | [server/routes.ts:3984](../../server/routes.ts#L3984) | Missing zod validation |
| GET | `/api/analytics/insight-snapshots` | [client/src/pages/advanced-analytics.tsx:464](../../client/src/pages/advanced-analytics.tsx#L464) | [server/routes.ts:4055](../../server/routes.ts#L4055) | Missing zod validation |
| POST | `/api/work-orders` | [client/src/lib/queryClient.ts:156](../../client/src/lib/queryClient.ts#L156) | [server/domains/work-orders/routes.ts:98](../../server/domains/work-orders/routes.ts#L98) | Missing zod validation |
| POST | `/api/insights/generate` | [client/src/lib/api.ts:36](../../client/src/lib/api.ts#L36) | [server/routes.ts:15407](../../server/routes.ts#L15407) | Missing zod validation |
| GET | `/api/insights/jobs/stats` | [client/src/lib/api.ts:40](../../client/src/lib/api.ts#L40) | [server/routes.ts:15430](../../server/routes.ts#L15430) | Missing zod validation |
| GET | `/api/dashboard` | [client/src/lib/api.ts:53](../../client/src/lib/api.ts#L53) | [server/routes.ts:1294](../../server/routes.ts#L1294) | Missing zod validation |
| GET | `/api/dtc/dashboard-stats` | [client/src/lib/api.ts:63](../../client/src/lib/api.ts#L63) | [server/routes.ts:5144](../../server/routes.ts#L5144) | Missing zod validation |
| GET | `/api/devices` | [client/src/lib/api.ts:68](../../client/src/lib/api.ts#L68) | [server/domains/devices/routes.ts:23](../../server/domains/devices/routes.ts#L23) | Missing zod validation |
| GET | `/api/edge/heartbeats` | [client/src/lib/api.ts:85](../../client/src/lib/api.ts#L85) | [server/routes.ts:1397](../../server/routes.ts#L1397) | Missing zod validation |
| POST | `/api/work-orders` | [client/src/lib/api.ts:146](../../client/src/lib/api.ts#L146) | [server/domains/work-orders/routes.ts:98](../../server/domains/work-orders/routes.ts#L98) | Missing zod validation |
| GET | `/api/settings` | [client/src/lib/api.ts:155](../../client/src/lib/api.ts#L155) | [server/routes.ts:7347](../../server/routes.ts#L7347) | Missing zod validation |
| POST | `/api/sync/check-conflicts` | [client/src/hooks/useConflictResolution.ts:31](../../client/src/hooks/useConflictResolution.ts#L31) | [server/routes.ts:1067](../../server/routes.ts#L1067) | Missing zod validation |
| POST | `/api/sync/resolve-conflict` | [client/src/hooks/useConflictResolution.ts:52](../../client/src/hooks/useConflictResolution.ts#L52) | [server/routes.ts:1152](../../server/routes.ts#L1152) | Missing zod validation |
| POST | `/api/sync/auto-resolve` | [client/src/hooks/useConflictResolution.ts:70](../../client/src/hooks/useConflictResolution.ts#L70) | [server/routes.ts:1187](../../server/routes.ts#L1187) | Missing zod validation |
| POST | `/api/sync/reconcile` | [client/src/components/SyncAdmin.tsx:85](../../client/src/components/SyncAdmin.tsx#L85) | [server/routes.ts:926](../../server/routes.ts#L926) | Missing zod validation |
| POST | `/api/sync/reconcile/comprehensive` | [client/src/components/SyncAdmin.tsx:97](../../client/src/components/SyncAdmin.tsx#L97) | [server/routes.ts:1036](../../server/routes.ts#L1036) | Missing zod validation |
| POST | `/api/sync/process-events` | [client/src/components/SyncAdmin.tsx:112](../../client/src/components/SyncAdmin.tsx#L112) | [server/routes.ts:975](../../server/routes.ts#L975) | Missing zod validation |
| GET | `/api/equipment/health` | [client/src/components/QuickActionsFAB.tsx:17](../../client/src/components/QuickActionsFAB.tsx#L17) | [server/domains/equipment/routes.ts:34](../../server/domains/equipment/routes.ts#L34) | Missing zod validation |
| GET | `/api/operating-condition-alerts` | [client/src/components/OperatingConditionAlertsPanel.tsx:20](../../client/src/components/OperatingConditionAlertsPanel.tsx#L20) | [server/routes.ts:7779](../../server/routes.ts#L7779) | Missing zod validation |
| GET | `/api/crew` | [client/src/components/MultiPartSelector.tsx:73](../../client/src/components/MultiPartSelector.tsx#L73) | [server/domains/crew/routes.ts:30](../../server/domains/crew/routes.ts#L30) | Missing zod validation |
| POST | `/api/stcw/import` | [client/src/components/HoursOfRestGrid.tsx:298](../../client/src/components/HoursOfRestGrid.tsx#L298) | [server/routes.ts:13023](../../server/routes.ts#L13023) | Missing zod validation |
| GET | `/api/stcw/rest/:param/:param/:param` | [client/src/components/HoursOfRestGrid.tsx:343](../../client/src/components/HoursOfRestGrid.tsx#L343) | [server/routes.ts:13209](../../server/routes.ts#L13209) | Missing zod validation |
| POST | `/api/stcw/import` | [client/src/components/HoursOfRestGrid.tsx:682](../../client/src/components/HoursOfRestGrid.tsx#L682) | [server/routes.ts:13023](../../server/routes.ts#L13023) | Missing zod validation |
| POST | `/api/stcw/import` | [client/src/components/HoursOfRestGrid.tsx:731](../../client/src/components/HoursOfRestGrid.tsx#L731) | [server/routes.ts:13023](../../server/routes.ts#L13023) | Missing zod validation |
| POST | `/api/stcw/import` | [client/src/components/HoursOfRestGrid.tsx:771](../../client/src/components/HoursOfRestGrid.tsx#L771) | [server/routes.ts:13023](../../server/routes.ts#L13023) | Missing zod validation |
| GET | `/api/stcw/compliance/:param/:param/:param` | [client/src/components/HoursOfRestGrid.tsx:814](../../client/src/components/HoursOfRestGrid.tsx#L814) | [server/routes.ts:12990](../../server/routes.ts#L12990) | Missing zod validation |
| GET | `/api/stcw/export/:param/:param/:param` | [client/src/components/HoursOfRestGrid.tsx:831](../../client/src/components/HoursOfRestGrid.tsx#L831) | [server/routes.ts:13236](../../server/routes.ts#L13236) | Missing zod validation |
| GET | `/api/stcw/rest/:param/:param/:param` | [client/src/components/HoursOfRest.tsx:71](../../client/src/components/HoursOfRest.tsx#L71) | [server/routes.ts:13209](../../server/routes.ts#L13209) | Missing zod validation |
| POST | `/api/stcw/import` | [client/src/components/HoursOfRest.tsx:80](../../client/src/components/HoursOfRest.tsx#L80) | [server/routes.ts:13023](../../server/routes.ts#L13023) | Missing zod validation |
| GET | `/api/stcw/compliance/:param/:param/:param` | [client/src/components/HoursOfRest.tsx:103](../../client/src/components/HoursOfRest.tsx#L103) | [server/routes.ts:12990](../../server/routes.ts#L12990) | Missing zod validation |
| GET | `/api/stcw/export/:param/:param/:param` | [client/src/components/HoursOfRest.tsx:121](../../client/src/components/HoursOfRest.tsx#L121) | [server/routes.ts:13236](../../server/routes.ts#L13236) | Missing zod validation |
| GET | `/api/error-logs` | [client/src/components/ErrorLogsTab.tsx:51](../../client/src/components/ErrorLogsTab.tsx#L51) | [server/routes.ts:17569](../../server/routes.ts#L17569) | Missing zod validation |
| GET | `/api/error-logs/stats` | [client/src/components/ErrorLogsTab.tsx:61](../../client/src/components/ErrorLogsTab.tsx#L61) | [server/routes.ts:17616](../../server/routes.ts#L17616) | Missing zod validation |
| POST | `/api/digital-twins/:param/simulate` | [client/src/components/DigitalTwinViewer.tsx:150](../../client/src/components/DigitalTwinViewer.tsx#L150) | [server/routes.ts:16204](../../server/routes.ts#L16204) | Missing zod validation |
| POST | `/api/crew/schedule/plan-enhanced` | [client/src/components/CrewScheduler.tsx:323](../../client/src/components/CrewScheduler.tsx#L323) | [server/routes.ts:12675](../../server/routes.ts#L12675) | Missing zod validation |
| GET | `/api/equipment/health` | [client/src/components/analytics/OperationsMode.tsx:26](../../client/src/components/analytics/OperationsMode.tsx#L26) | [server/domains/equipment/routes.ts:34](../../server/domains/equipment/routes.ts#L34) | Missing zod validation |
| GET | `/api/analytics/anomalies` | [client/src/components/analytics/OperationsMode.tsx:50](../../client/src/components/analytics/OperationsMode.tsx#L50) | [server/routes.ts:9752](../../server/routes.ts#L9752) | Missing zod validation |
| GET | `/api/analytics/failure-predictions` | [client/src/components/analytics/OperationsMode.tsx:62](../../client/src/components/analytics/OperationsMode.tsx#L62) | [server/routes.ts:3852](../../server/routes.ts#L3852) | Missing zod validation |
| POST | `/api/analytics/narrative-summary` | [client/src/components/analytics/NarrativeSummaryCard.tsx:53](../../client/src/components/analytics/NarrativeSummaryCard.tsx#L53) | [server/routes.ts:12645](../../server/routes.ts#L12645) | Missing zod validation |
| GET | `/api/equipment/health` | [client/src/components/analytics/MissionOverview.tsx:23](../../client/src/components/analytics/MissionOverview.tsx#L23) | [server/domains/equipment/routes.ts:34](../../server/domains/equipment/routes.ts#L34) | Missing zod validation |
| GET | `/api/analytics/anomalies` | [client/src/components/analytics/MissionOverview.tsx:35](../../client/src/components/analytics/MissionOverview.tsx#L35) | [server/routes.ts:9752](../../server/routes.ts#L9752) | Missing zod validation |
| GET | `/api/work-orders` | [client/src/components/analytics/MissionOverview.tsx:59](../../client/src/components/analytics/MissionOverview.tsx#L59) | [server/domains/work-orders/routes.ts:27](../../server/domains/work-orders/routes.ts#L27) | Missing zod validation |
| GET | `/api/analytics/model-performance/summary` | [client/src/components/analytics/MissionOverview.tsx:71](../../client/src/components/analytics/MissionOverview.tsx#L71) | [server/routes.ts:2500](../../server/routes.ts#L2500) | Missing zod validation |
| GET | `/api/analytics/failure-predictions` | [client/src/components/analytics/MissionOverview.tsx:83](../../client/src/components/analytics/MissionOverview.tsx#L83) | [server/routes.ts:3852](../../server/routes.ts#L3852) | Missing zod validation |
| GET | `/api/work-orders` | [client/src/components/analytics/MaintenanceMode.tsx:34](../../client/src/components/analytics/MaintenanceMode.tsx#L34) | [server/domains/work-orders/routes.ts:27](../../server/domains/work-orders/routes.ts#L27) | Missing zod validation |
| GET | `/api/analytics/maintenance-records` | [client/src/components/analytics/MaintenanceMode.tsx:46](../../client/src/components/analytics/MaintenanceMode.tsx#L46) | [server/routes.ts:6813](../../server/routes.ts#L6813) | Missing zod validation |
| GET | `/api/analytics/failure-patterns` | [client/src/components/analytics/MaintenanceMode.tsx:58](../../client/src/components/analytics/MaintenanceMode.tsx#L58) | [server/routes.ts:9316](../../server/routes.ts#L9316) | Missing zod validation |
| GET | `/api/equipment/health` | [client/src/components/analytics/MaintenanceMode.tsx:82](../../client/src/components/analytics/MaintenanceMode.tsx#L82) | [server/domains/equipment/routes.ts:34](../../server/domains/equipment/routes.ts#L34) | Missing zod validation |
| GET | `/api/analytics/roi-analysis` | [client/src/components/analytics/FinanceMode.tsx:70](../../client/src/components/analytics/FinanceMode.tsx#L70) | [server/routes.ts:9430](../../server/routes.ts#L9430) | Missing zod validation |
| GET | `/api/insights/jobs/stats` | [client/src/components/analytics/FinanceMode.tsx:82](../../client/src/components/analytics/FinanceMode.tsx#L82) | [server/routes.ts:15430](../../server/routes.ts#L15430) | Missing zod validation |
| GET | `/api/work-orders` | [client/src/components/analytics/FinanceMode.tsx:94](../../client/src/components/analytics/FinanceMode.tsx#L94) | [server/domains/work-orders/routes.ts:27](../../server/domains/work-orders/routes.ts#L27) | Missing zod validation |

## ❌ Missing Server Routes (0)

| Method | Path | Client | Action Required |
|--------|------|--------|----------------|

---

## Recommendations

2. **Add zod validation** to 87 existing routes
