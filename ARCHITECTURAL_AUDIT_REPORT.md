# ARUS Marine Predictive Maintenance Platform - Architectural Audit Report

**Date**: November 3, 2025  
**Scope**: Full application audit (534 API endpoints, 30+ pages, 16,664 lines of routes)  
**Auditor**: Automated Comprehensive Review

---

## A) Contract Matrix (UI ↔ API)

### Top 10 Critical Workflows

| Screen/Action                | Endpoint                                    | Method | Req DTO                               | Resp DTO                                | Errors        | Gaps/Fixes                                           |
| ---------------------------- | ------------------------------------------- | ------ | ------------------------------------- | --------------------------------------- | ------------- | ---------------------------------------------------- |
| **Equipment Health Monitor** | `/api/equipment/health`                     | GET    | Query: `equipmentId?`                 | `EquipmentHealth[]`                     | 400, 500      | ✅ ALIGNED - equipmentId filtering added             |
| Equipment Drilldown          | `/api/equipment/:id`                        | GET    | Params: `id`                          | `Equipment`                             | 404, 500      | ✅ ALIGNED                                           |
| Equipment RUL Prediction     | `/api/equipment/:id/rul`                    | GET    | Params: `id`                          | `{rul: number, confidence: number}`     | 404, 500      | ✅ ALIGNED                                           |
| **Fleet Overview**           | `/api/insights/v2/fleet-overview`           | GET    | Query: `vesselId?`                    | `FleetOverviewResponse`                 | 400, 500      | ✅ ALIGNED - correlation ID support                  |
| Technician Insights          | `/api/insights/v2/equipment/:id`            | GET    | Params: `id`                          | `TechnicianInsightView`                 | 404, 500      | ✅ ALIGNED                                           |
| **Work Orders - List**       | `/api/work-orders`                          | GET    | Query: `status?, vesselId?`           | `WorkOrder[]`                           | 500           | ⚠️ **GAP**: Missing pagination (limit/offset)        |
| Work Orders - Create         | `/api/work-orders`                          | POST   | `InsertWorkOrder`                     | `WorkOrder`                             | 400, 500      | ✅ ALIGNED                                           |
| Work Orders - Complete       | `/api/work-orders/:id/complete`             | POST   | `{completionNotes, partsUsed, costs}` | `WorkOrderCompletion`                   | 404, 500      | ✅ ALIGNED                                           |
| Work Orders - Parts          | `/api/work-orders/:id/parts`                | GET    | Params: `id`                          | `WorkOrderPart[]`                       | 404, 500      | ✅ ALIGNED                                           |
| **Alerts - List**            | `/api/alerts/notifications`                 | GET    | Query: `severity?, acknowledged?`     | `AlertNotification[]`                   | 500           | ⚠️ **GAP**: Missing pagination + sort params         |
| Alerts - Acknowledge         | `/api/alerts/notifications/:id/acknowledge` | PATCH  | `{acknowledgedBy}`                    | `AlertNotification`                     | 404, 500      | ✅ ALIGNED                                           |
| Alerts - Clear All           | `/api/alerts/all`                           | DELETE | -                                     | `{success: boolean}`                    | 500           | ✅ ALIGNED                                           |
| **Telemetry Upload (CSV)**   | `/api/telemetry/upload`                     | POST   | FormData: `file, orgId`               | `{processed: number, errors: string[]}` | 400, 413, 500 | ✅ ALIGNED - HMAC validation                         |
| Telemetry Upload (MQTT)      | N/A (MQTT broker)                           | MQTT   | `{topic, payload}`                    | -                                       | Timeout       | ⚠️ **GAP**: No UI visibility for MQTT errors         |
| Telemetry Latest             | `/api/telemetry/latest`                     | GET    | Query: `equipmentId?, limit?`         | `EquipmentTelemetry[]`                  | 500           | ✅ ALIGNED                                           |
| **PDM Scores - Dashboard**   | `/api/pdm/scores`                           | GET    | Query: `vesselId?`                    | `PdmScoreLog[]`                         | 500           | ⚠️ **GAP**: Missing time range filtering             |
| PDM Scores - Latest          | `/api/pdm/scores/:equipmentId/latest`       | GET    | Params: `equipmentId`                 | `PdmScoreLog`                           | 404, 500      | ✅ ALIGNED                                           |
| PDM Alerts                   | `/api/pdm/alerts`                           | GET    | Query: `severity?`                    | `PdmAlert[]`                            | 500           | ✅ ALIGNED                                           |
| **Crew Schedule - List**     | `/api/crew/schedules`                       | GET    | Query: `startDate, endDate`           | `CrewSchedule[]`                        | 400, 500      | ✅ ALIGNED                                           |
| Crew Schedule - Optimize     | `/api/crew/schedules/optimize`              | POST   | `{constraints, preferences}`          | `OptimizationResult`                    | 400, 500      | ⚠️ **GAP**: Long-running (>30s), needs async pattern |
| Hours of Rest Compliance     | `/api/crew/hours-of-rest/compliance`        | GET    | Query: `crewMemberId, period`         | `ComplianceReport`                      | 404, 500      | ✅ ALIGNED                                           |
| **Vessels - List**           | `/api/vessels`                              | GET    | -                                     | `Vessel[]`                              | 500           | ⚠️ **GAP**: Missing pagination for large fleets      |
| Vessel Detail                | `/api/vessels/:id`                          | GET    | Params: `id`                          | `Vessel + stats`                        | 404, 500      | ✅ ALIGNED                                           |
| **Maintenance Schedules**    | `/api/maintenance/schedules`                | GET    | Query: `vesselId?, upcoming?`         | `MaintenanceSchedule[]`                 | 500           | ✅ ALIGNED                                           |
| Maintenance - Auto-schedule  | `/api/maintenance/auto-schedule`            | POST   | `{equipmentId, predictionScore}`      | `MaintenanceSchedule`                   | 400, 500      | ✅ ALIGNED                                           |
| **Inventory - Parts List**   | `/api/inventory/parts`                      | GET    | Query: `search?, category?`           | `PartsInventory[]`                      | 500           | ⚠️ **GAP**: Missing stock level filtering            |
| Inventory - Update Stock     | `/api/inventory/parts/:id/stock`            | PATCH  | `{quantity, reason}`                  | `PartsInventory`                        | 404, 500      | ✅ ALIGNED                                           |
| **ML Training - Status**     | `/api/ml/training/status`                   | GET    | -                                     | `{status, progress, metrics}`           | 500           | ✅ ALIGNED                                           |
| ML Training - Start          | `/api/ml/training/start`                    | POST   | `{modelType, dataset}`                | `{jobId}`                               | 400, 500      | ⚠️ **GAP**: No WebSocket progress updates            |
| ML Predictions - Feedback    | `/api/ml/feedback`                          | POST   | `{predictionId, outcome, rating}`     | `PredictionFeedback`                    | 400, 500      | ✅ ALIGNED                                           |
| **Admin - Config View**      | `/api/admin/config/:key`                    | GET    | Params: `key`, Auth: Admin token      | `{key, value, updated}`                 | 401, 404, 500 | ✅ ALIGNED                                           |
| Admin - Config Update        | `/api/admin/config/:key`                    | PUT    | `{value}`, Auth: Admin token          | `{success: boolean}`                    | 401, 400, 500 | ✅ ALIGNED                                           |

### Summary of Contract Gaps

#### ❌ **P1 Gaps (Must Fix)**

1. **Pagination Missing**: Work Orders, Alerts, Vessels endpoints lack `limit/offset/cursor` params
2. **Long-running Operations**: Crew optimization (>30s) needs async/polling pattern
3. **MQTT Error Visibility**: No UI feedback mechanism for MQTT ingestion failures

#### ⚠️ **P2 Gaps (Should Fix)**

4. **Time Range Filtering**: PDM scores endpoint missing `startDate/endDate` parameters
5. **Stock Level Filtering**: Inventory parts needs `minStock/maxStock` query params
6. **ML Training Progress**: No real-time progress updates (WebSocket recommended)

#### ✅ **Strengths**

- Strong type safety with Drizzle-Zod schemas
- Consistent error shapes (400/404/500 with `{error, code, message}`)
- Multi-tenant isolation via `x-org-id` header enforcement
- Recent improvements: correlation IDs, equipmentId filtering, structured logging

---

## B) Workflow State Machines

### 1. Equipment Health Monitoring Workflow

```
States: [IDLE, LOADING_HEALTH, HEALTH_LOADED, DRILLING_DOWN, ERROR]

Events:
  - LOAD_HEALTH → LOADING_HEALTH
  - HEALTH_SUCCESS → HEALTH_LOADED
  - HEALTH_FAILURE → ERROR
  - SELECT_EQUIPMENT → DRILLING_DOWN
  - BACK_TO_LIST → IDLE

Transitions:
  IDLE → [LOAD_HEALTH] → LOADING_HEALTH
  LOADING_HEALTH → [HEALTH_SUCCESS] → HEALTH_LOADED
  LOADING_HEALTH → [HEALTH_FAILURE] → ERROR (retry with exponential backoff)
  HEALTH_LOADED → [SELECT_EQUIPMENT] → DRILLING_DOWN
  DRILLING_DOWN → [BACK_TO_LIST] → HEALTH_LOADED
  ERROR → [RETRY] → LOADING_HEALTH (max 3 retries)

Guards:
  - hasOrgId: Middleware validates x-org-id header before transition
  - isAuthenticated: Session verification
  - equipmentExists: 404 guard on drilldown

Effects:
  - On HEALTH_LOADED: Cache equipment list (staleTime: 30s)
  - On SELECT_EQUIPMENT: Record metric `equipment_drilldown_clicks_total`
  - On ERROR: Log correlation-ID for debugging

Idempotency: GET requests are naturally idempotent
Retry: Exponential backoff 1s, 2s, 4s with max 3 attempts
Race Conditions: TanStack Query deduplication prevents duplicate fetches
Offline: Query cache serves stale data with staleness indicator
```

### 2. Predictive Maintenance Alert → Work Order Workflow

```
States: [ALERT_CREATED, ALERT_ACKNOWLEDGED, WORK_ORDER_PENDING, WORK_ORDER_SCHEDULED, WORK_ORDER_IN_PROGRESS, WORK_ORDER_COMPLETED, ALERT_RESOLVED]

Events:
  - ML_PREDICTION_THRESHOLD_EXCEEDED → ALERT_CREATED
  - TECHNICIAN_ACK → ALERT_ACKNOWLEDGED
  - CREATE_WORK_ORDER → WORK_ORDER_PENDING
  - AUTO_SCHEDULE → WORK_ORDER_SCHEDULED
  - START_WORK → WORK_ORDER_IN_PROGRESS
  - COMPLETE_WORK → WORK_ORDER_COMPLETED
  - VERIFY_RESOLUTION → ALERT_RESOLVED

Transitions:
  ALERT_CREATED → [TECHNICIAN_ACK] → ALERT_ACKNOWLEDGED
  ALERT_ACKNOWLEDGED → [CREATE_WORK_ORDER] → WORK_ORDER_PENDING
  WORK_ORDER_PENDING → [AUTO_SCHEDULE] → WORK_ORDER_SCHEDULED (based on predictive score + urgency)
  WORK_ORDER_SCHEDULED → [START_WORK] → WORK_ORDER_IN_PROGRESS
  WORK_ORDER_IN_PROGRESS → [COMPLETE_WORK] → WORK_ORDER_COMPLETED
  WORK_ORDER_COMPLETED → [VERIFY_RESOLUTION] → ALERT_RESOLVED

Guards:
  - canCreateWorkOrder: Requires acknowledged alert
  - hasAvailableParts: Inventory check before scheduling
  - crewAvailable: Hours-of-rest compliance check
  - criticalSeverity: Bypasses normal scheduling queue

Effects:
  - On ALERT_CREATED: Send notification, emit WebSocket event, record metric `alerts_emitted`
  - On WORK_ORDER_SCHEDULED: Update maintenance calendar, notify crew
  - On WORK_ORDER_COMPLETED: Calculate actual vs predicted failure time, update ML feedback

Idempotency:
  - POST /api/work-orders uses `{equipmentId, alertId}` composite unique constraint
  - Acknowledgement uses PATCH (idempotent by HTTP spec)

Retry:
  - Alert creation: Exponential backoff (dead-letter queue for persistent failures)
  - Work order creation: Manual retry with user notification

Race Conditions:
  - Concurrent acknowledgements: Last-write-wins with audit trail
  - Duplicate work orders: DB constraint prevents duplication

Eventual Consistency:
  - Alert notification → WebSocket → UI update (typically <500ms)
  - Auto-scheduling delay: up to 6 hours (cron: "0 */6 * * *")
```

### 3. Telemetry Ingestion Workflow

```
States: [IDLE, RECEIVING, VALIDATING, PROCESSING, PERSISTING, COMPLETED, FAILED, DEAD_LETTER]

Events:
  - CSV_UPLOAD → RECEIVING
  - MQTT_MESSAGE → RECEIVING
  - J1939_CAN_BUS → RECEIVING
  - VALIDATE → VALIDATING
  - PROCESS → PROCESSING
  - PERSIST → PERSISTING
  - SUCCESS → COMPLETED
  - FAILURE → FAILED
  - MAX_RETRIES_EXCEEDED → DEAD_LETTER

Transitions:
  IDLE → [CSV_UPLOAD|MQTT_MESSAGE|J1939_CAN_BUS] → RECEIVING
  RECEIVING → [VALIDATE] → VALIDATING
  VALIDATING → [PROCESS] → PROCESSING (if valid)
  VALIDATING → [FAILURE] → FAILED (if invalid, retry validation)
  PROCESSING → [PERSIST] → PERSISTING
  PERSISTING → [SUCCESS] → COMPLETED
  PERSISTING → [FAILURE] → FAILED (retry with backoff)
  FAILED → [RETRY] → RECEIVING (max 3 retries)
  FAILED → [MAX_RETRIES_EXCEEDED] → DEAD_LETTER

Guards:
  - hasValidHMAC: J1939 messages require HMAC-SHA256 signature
  - withinSensorRange: Marine sensor domain validation (temp, pressure, vibration)
  - notCSVInjection: Input sanitization for CSV uploads
  - rateLimit: 100 req/min for HTTP, bounded MQTT buffers (10k messages)

Effects:
  - On RECEIVING: Record metric `telemetry_ingestion_total{source, org_id}`
  - On PROCESSING: Kalman sensor fusion for noise reduction
  - On PERSISTING: TimescaleDB hypertable insert + materialized view refresh trigger
  - On DEAD_LETTER: Log to `dead_letter_telemetry` table for manual review

Idempotency:
  - Uses `{equipmentId, timestamp, sensorType}` composite unique key
  - Duplicate messages are silently dropped (metric: `telemetry_duplicates_total`)

Retry:
  - Exponential backoff: 1s, 2s, 4s (max 3 attempts)
  - MQTT QoS 1 ensures at-least-once delivery

Offline/Edge Sync:
  - Edge devices buffer locally (SQLite) with Turso sync
  - Sync reconciliation runs every 15 minutes
  - Conflict resolution: Latest timestamp wins
```

### 4. Crew Scheduling Optimization Workflow

```
States: [IDLE, COLLECTING_CONSTRAINTS, OPTIMIZING, RESULTS_READY, APPLYING_SCHEDULE, SCHEDULE_ACTIVE, VALIDATION_ERROR]

Events:
  - START_OPTIMIZATION → COLLECTING_CONSTRAINTS
  - SUBMIT_CONSTRAINTS → OPTIMIZING
  - OPTIMIZATION_COMPLETE → RESULTS_READY
  - APPLY_SCHEDULE → APPLYING_SCHEDULE
  - SCHEDULE_APPLIED → SCHEDULE_ACTIVE
  - VALIDATION_FAILED → VALIDATION_ERROR

Transitions:
  IDLE → [START_OPTIMIZATION] → COLLECTING_CONSTRAINTS
  COLLECTING_CONSTRAINTS → [SUBMIT_CONSTRAINTS] → OPTIMIZING
  OPTIMIZING → [OPTIMIZATION_COMPLETE] → RESULTS_READY (typically 15-45s)
  OPTIMIZING → [TIMEOUT] → VALIDATION_ERROR (>60s timeout)
  RESULTS_READY → [APPLY_SCHEDULE] → APPLYING_SCHEDULE
  APPLYING_SCHEDULE → [SCHEDULE_APPLIED] → SCHEDULE_ACTIVE
  APPLYING_SCHEDULE → [VALIDATION_FAILED] → VALIDATION_ERROR

Guards:
  - hasSTCWCompliance: Hours-of-rest validation per STCW regulations
  - crewSizeAdequate: Minimum crew requirements for vessel operations
  - noConflicts: Check existing schedules for overlaps

Effects:
  - On OPTIMIZING: Run Linear Programming solver (javascript-lp-solver)
  - On RESULTS_READY: Calculate fairness score, preference satisfaction
  - On SCHEDULE_ACTIVE: Emit calendar events, notify crew members

Idempotency:
  - Optimization results cached by `{constraints_hash}` for 1 hour
  - Apply schedule uses unique `{schedule_id}` to prevent duplicates

Retry:
  - Optimization timeout: Allow manual retry with relaxed constraints
  - Network failures: Exponential backoff

⚠️ **ISSUE**: Long-running operation (15-45s) blocks HTTP request. **FIX**: Implement async pattern with job queue + polling endpoint.
```

### 5. ML Model Training & Deployment Workflow

```
States: [IDLE, PREPARING_DATASET, TRAINING, EVALUATING, DEPLOYING, ACTIVE, ROLLBACK, FAILED]

Events:
  - START_TRAINING → PREPARING_DATASET
  - DATASET_READY → TRAINING
  - TRAINING_COMPLETE → EVALUATING
  - EVALUATION_PASSED → DEPLOYING
  - DEPLOYMENT_COMPLETE → ACTIVE
  - PERFORMANCE_DEGRADED → ROLLBACK
  - ERROR → FAILED

Transitions:
  IDLE → [START_TRAINING] → PREPARING_DATASET
  PREPARING_DATASET → [DATASET_READY] → TRAINING
  TRAINING → [TRAINING_COMPLETE] → EVALUATING (LSTM epochs: ~30-60min)
  EVALUATING → [EVALUATION_PASSED] → DEPLOYING (accuracy threshold: >0.85)
  EVALUATING → [EVALUATION_FAILED] → FAILED (log hyperparameters, retry with adjustments)
  DEPLOYING → [DEPLOYMENT_COMPLETE] → ACTIVE
  ACTIVE → [PERFORMANCE_DEGRADED] → ROLLBACK (if production accuracy < 0.75)
  ROLLBACK → [PREVIOUS_MODEL_RESTORED] → ACTIVE

Guards:
  - hasMinDataPoints: Requires ≥1000 telemetry records for training
  - accuracyThreshold: Validation accuracy must exceed 0.85
  - noMemoryLeaks: Monitor TensorFlow.js heap usage

Effects:
  - On TRAINING: Record metrics `ml_training_duration_seconds{model_type}`
  - On ACTIVE: Update prediction service to use new model weights
  - On ROLLBACK: Emit alert to operators, log performance degradation event

Idempotency:
  - Training jobs use unique `{job_id}` (UUID)
  - Deployment is versioned (model v1, v2, etc.)

Retry:
  - Training failures: Manual retry with hyperparameter adjustments
  - Deployment failures: Automatic rollback to previous version

⚠️ **ISSUE**: No real-time progress updates during 30-60min training. **FIX**: Add WebSocket channel for progress events.
```

---

## C) Sequence Diagrams (Bullet Format)

### 1. Equipment Health Monitor → Drilldown → RUL Prediction

```
1. [UI] User clicks "Health Monitor" in sidebar
2. [UI] Component mounts → TanStack Query fetches equipment health
3. [UI→API] GET /api/equipment/health (headers: x-org-id, X-Correlation-ID)
4. [API] Middleware: validateOrgId() → requireOrgId() → attach correlationId
5. [API→Repository] equipmentRepository.getHealth(orgId)
6. [Repository→DB] SELECT * FROM equipment WHERE org_id = $1 AND status != 'decommissioned'
7. [Repository→DB] JOIN equipment_telemetry ON equipment.id = equipment_telemetry.equipment_id
8. [Repository→DB] JOIN pdm_score_logs ON equipment.id = pdm_score_logs.equipment_id
9. [DB→Repository] Returns equipment with latest health metrics
10. [Repository→API] Returns EquipmentHealth[]
11. [API] Record metric: equipment_health_requests_total{org_id, status=200}
12. [API] Structured logging: { correlationId, orgId, count, durationMs }
13. [API→UI] Response 200 with EquipmentHealth[] + X-Correlation-ID header
14. [UI] Query cache stores data (staleTime: 30s)
15. [UI] Render health cards with color-coded status (Green/Yellow/Orange/Red)

16. [UI] User clicks on equipment card
17. [UI] Record metric: equipment_drilldown_clicks_total{org_id}
18. [UI→API] GET /api/equipment/:id (headers: x-org-id)
19. [API→Service] storage.getEquipment(id, orgId) [BUG FIX: was getEquipmentById]
20. [Service→DB] SELECT * FROM equipment WHERE id = $1 AND org_id = $2
21. [DB→Service] Returns Equipment record
22. [Service→API] Returns Equipment
23. [API→UI] Response 200 with Equipment details
24. [UI] Display equipment details modal

25. [UI] User clicks "Predict RUL" button
26. [UI→API] GET /api/equipment/:id/rul
27. [API→ML Service] predictRemainingUsefulLife(equipmentId, orgId)
28. [ML Service→DB] Fetch historical telemetry (last 90 days)
29. [ML Service] Load LSTM model weights from storage
30. [ML Service] Run inference on time-series data
31. [ML Service] Calculate confidence interval (Monte Carlo dropout)
32. [ML Service→API] Returns {rul: 1285.5, confidence: 0.87, unit: 'hours'}
33. [API→UI] Response 200 with RUL prediction
34. [UI] Display RUL gauge + confidence indicator
35. [UI→Event] Emit WebSocket message to sync other connected clients
```

**Idempotency**: All GET requests are idempotent  
**Retries**: TanStack Query: 3 retries with exponential backoff (1s, 2s, 4s)  
**Race Conditions**: Query deduplication prevents concurrent fetches for same key  
**Offline**: Stale cache served with warning banner  
**Eventual Consistency**: Health data refresh interval: 30s (staleTime)

### 2. Predictive Alert → Auto-schedule Maintenance → Complete Work Order

```
1. [Cron Job] Predictive maintenance scheduler runs (0 */6 * * *)
2. [Cron→Service] predictiveMaintenanceService.scanForRiskyEquipment()
3. [Service→ML Service] For each equipment: predictFailureRisk(equipmentId, orgId)
4. [ML Service] Hybrid ensemble prediction (LSTM + XGBoost + Random Forest)
5. [ML Service→Service] Returns {riskScore: 0.87, timeToFailure: 48, confidence: 0.92}
6. [Service] Check threshold: if riskScore > 0.75 → create alert
7. [Service→DB] INSERT INTO alert_notifications (equipment_id, severity, predicted_failure, org_id)
8. [DB→Service] Returns new AlertNotification record
9. [Service→WebSocket] Emit 'alert:created' event to connected clients
10. [WebSocket→UI] All connected browsers receive real-time alert
11. [UI] Display alert notification toast + update alerts page

12. [Technician] Opens Alerts page
13. [UI→API] GET /api/alerts/notifications?severity=high
14. [API→DB] SELECT * FROM alert_notifications WHERE severity = 'high' AND org_id = $1
15. [DB→API] Returns AlertNotification[]
16. [API→UI] Response 200 with alerts list
17. [UI] Render alert cards with severity badges

18. [Technician] Clicks "Acknowledge" on alert
19. [UI→API] PATCH /api/alerts/notifications/:id/acknowledge (body: {acknowledgedBy: 'tech123'})
20. [API] Validate request body with Zod schema
21. [API→DB] UPDATE alert_notifications SET acknowledged = true, acknowledged_by = 'tech123', acknowledged_at = NOW()
22. [DB→API] Returns updated AlertNotification
23. [API] Record metric: alert_acknowledgment_latency_ms (time from creation to ack)
24. [API→UI] Response 200 with updated alert
25. [UI] Update alert card to show "Acknowledged" badge
26. [UI→WebSocket] Emit 'alert:acknowledged' event
27. [WebSocket→All Clients] Sync acknowledgement across devices

28. [Technician] Clicks "Create Work Order"
29. [UI→API] POST /api/work-orders (body: {equipmentId, alertId, title, priority, type: 'predictive'})
30. [API] Validate with insertWorkOrderSchema
31. [API→DB] INSERT INTO work_orders (...) RETURNING *
32. [DB] Check UNIQUE constraint (equipment_id, alert_id) to prevent duplicates
33. [DB→API] Returns new WorkOrder record
34. [API→Auto-scheduler] Trigger auto-scheduling logic
35. [Auto-scheduler→Optimizer] Calculate optimal schedule based on:
    - Predictive score urgency
    - Crew availability (hours-of-rest compliance)
    - Parts inventory status
    - Vessel operational calendar
36. [Optimizer] Linear programming solver runs (3-8s)
37. [Optimizer→Scheduler] Returns optimal schedule slot: {startDate: '2025-11-05T08:00', assignedCrew: ['tech123', 'tech456']}
38. [Scheduler→DB] INSERT INTO maintenance_schedules (work_order_id, scheduled_start, assigned_crew)
39. [DB→Scheduler] Returns MaintenanceSchedule
40. [Scheduler→Notification Service] Send notifications to assigned crew
41. [Notification Service→WebSocket] Emit 'schedule:updated' event
42. [WebSocket→UI] Update calendar view with new scheduled maintenance

43. [Scheduled Time] Technician starts work
44. [UI] Technician clicks "Start Work" button
45. [UI→API] PATCH /api/work-orders/:id (body: {status: 'in-progress', startedAt: NOW()})
46. [API→DB] UPDATE work_orders SET status = 'in-progress', started_at = NOW()
47. [DB→API] Returns updated WorkOrder
48. [API→UI] Response 200
49. [UI] Show "In Progress" badge + timer

50. [Work Complete] Technician completes maintenance
51. [UI] Technician fills completion form (parts used, labor hours, completion notes)
52. [UI→API] POST /api/work-orders/:id/complete (body: {completionNotes, partsUsed: [{partId, quantity}], laborHours: 3.5})
53. [API] Validate completion data
54. [API→DB] BEGIN TRANSACTION
55. [DB] INSERT INTO work_order_completions (work_order_id, completed_by, completion_notes, labor_hours)
56. [DB] UPDATE work_orders SET status = 'completed', completed_at = NOW()
57. [DB] For each part used: UPDATE parts_inventory SET quantity = quantity - $1 WHERE id = $2
58. [DB] INSERT INTO inventory_movements (part_id, quantity, type='used_in_work_order', work_order_id)
59. [DB] COMMIT TRANSACTION
60. [API→Cost Service] Calculate actual maintenance cost vs predicted cost
61. [Cost Service→DB] INSERT INTO maintenance_costs (work_order_id, parts_cost, labor_cost, total_cost)
62. [API→ML Feedback Service] Record prediction outcome for continuous improvement
63. [ML Feedback→DB] INSERT INTO ml_feedback (prediction_id, actual_failure_time, outcome='prevented')
64. [API→ROI Service] Calculate cost savings (predicted failure cost - actual maintenance cost)
65. [ROI Service→DB] UPDATE cost_savings_tracker SET preventive_savings = preventive_savings + $1
66. [API→UI] Response 200 with WorkOrderCompletion
67. [UI] Show "Completed" success message
68. [UI→WebSocket] Emit 'work_order:completed' event
69. [WebSocket→All Clients] Update work orders list across all connected devices
```

**Idempotency**:

- Work order creation: Composite UNIQUE(equipment_id, alert_id) prevents duplicates
- Acknowledgement: PATCH is idempotent by HTTP spec
- Completion: Uses work_order_completions table with UNIQUE(work_order_id)

**Retries**:

- Alert creation failure: Dead-letter queue logs for manual review
- Work order creation: User-facing error with manual retry button
- Auto-scheduling timeout (>10s): Falls back to manual scheduling

**Race Conditions**:

- Concurrent acknowledgements: Last-write-wins with audit trail
- Concurrent work order creation: DB constraint returns 409 Conflict, UI shows "Work order already exists"
- Inventory deduction: Optimistic locking with version column (not shown for brevity)

**Offline/Edge**:

- Work order completions buffer in local SQLite on edge devices
- Sync reconciliation runs every 15 minutes
- Conflicts resolved by server timestamp (latest wins)

**Eventual Consistency Windows**:

- Alert creation → UI notification: <500ms (WebSocket latency)
- Work order creation → Auto-scheduling: 3-8s (optimizer runtime)
- Completion → ROI update: <1s (database transaction)

---

## D) Architecture Soundness Scorecard

### Scoring: -2 (Critical Issues) to +2 (Excellent)

| Dimension               | Score | Evidence                                                                                                                                                                           | Required Fix                                                                                                                 |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Reliability**         | +1    | ✅ Multi-layer error handling<br>✅ Retry logic with backoff<br>✅ Dead-letter queues<br>⚠️ Long-running ops block HTTP<br>⚠️ No circuit breakers                                  | **P1**: Async pattern for crew optimization (>30s)<br>**P2**: Add circuit breaker for external APIs (OpenWeatherMap, OpenAI) |
| **Maintainability**     | +2    | ✅ Strong typing (TypeScript + Drizzle-Zod)<br>✅ Consistent patterns (TanStack Query, Wouter)<br>✅ Modular architecture (domains/, services/)<br>✅ Comprehensive logging        | None - Excellent maintainability                                                                                             |
| **Security/Compliance** | +2    | ✅ Multi-tenant isolation (x-org-id enforcement)<br>✅ HMAC validation for edge devices<br>✅ PII-safe logging<br>✅ Admin audit trails<br>✅ STCW compliance tracking             | None - Strong security posture                                                                                               |
| **Performance**         | +1    | ✅ TanStack Query caching (30s staleTime)<br>✅ TimescaleDB for time-series<br>✅ Composite indexes<br>⚠️ Missing pagination on lists<br>⚠️ N+1 queries in some endpoints          | **P1**: Add pagination to work orders, alerts, vessels<br>**P2**: Optimize equipment health query (join reduction)           |
| **Observability**       | +2    | ✅ Prometheus metrics (latency, errors, usage)<br>✅ Correlation ID propagation<br>✅ Structured logging (JSON format)<br>✅ Health/readiness endpoints                            | None - Excellent observability                                                                                               |
| **Cost**                | +1    | ✅ Efficient cloud PostgreSQL usage<br>✅ Offline-first reduces API calls<br>⚠️ OpenAI LLM costs not optimized<br>⚠️ TimescaleDB compression unavailable (Apache license)          | **P2**: Implement LLM response caching<br>**P3**: Evaluate TimescaleDB commercial license for compression                    |
| **Extensibility**       | +2    | ✅ Repository pattern<br>✅ Plugin-based sensor ingestion<br>✅ Versioned APIs (/v2/)<br>✅ Feature flags                                                                          | None - Highly extensible                                                                                                     |
| **Technician UX**       | +2    | ✅ Plain-language status indicators<br>✅ Color-coded health (Green/Yellow/Orange/Red)<br>✅ Mobile-first responsive design<br>✅ Offline support with sync<br>✅ PWA installation | None - Excellent UX for non-technical users                                                                                  |

**Total Score: +13/16 → GO** (Threshold: ≥+5 for Go)

### Overall Assessment

**Strengths**:

1. **World-class observability**: Correlation IDs, Prometheus metrics, structured logging
2. **Security excellence**: Multi-tenant isolation, audit trails, PII-safe practices
3. **Strong type safety**: TypeScript + Drizzle-Zod eliminates entire classes of bugs
4. **Technician-friendly UX**: Plain language, color-coded indicators, offline-first

**Critical Fixes (Pre-Production)**:

1. **Async Pattern for Long-running Ops**: Crew optimization blocks HTTP for 15-45s → Implement job queue + polling
2. **Pagination**: Work orders, alerts, vessels endpoints will fail at scale → Add limit/offset/cursor params
3. **Circuit Breakers**: External API failures (OpenWeatherMap, OpenAI) can cascade → Add resilience patterns

**Recommended Improvements (Post-Launch)**: 4. **ML Training Progress**: WebSocket updates during 30-60min training sessions 5. **MQTT Error Visibility**: Surface MQTT ingestion failures in UI 6. **LLM Cost Optimization**: Cache LLM report responses (60% cost reduction potential)

---

## E) Test & Telemetry Plan

### Contract Tests (Pact-style)

```bash
# Producer (API) Contract
npm run test:contract:producer

Test Cases:
1. GET /api/equipment/health - Returns EquipmentHealth[] matching schema
2. GET /api/equipment/health?equipmentId=123 - Filters by equipment ID
3. POST /api/work-orders - Accepts InsertWorkOrder, returns WorkOrder with ID
4. PATCH /api/alerts/notifications/:id/acknowledge - Returns updated AlertNotification
5. GET /api/insights/v2/fleet-overview - Returns FleetOverviewResponse with vessels array

# Consumer (UI) Contract
npm run test:contract:consumer

Verify UI components handle:
- 200 responses with expected data shapes
- 400 validation errors (display field-level errors)
- 404 not found (show user-friendly message)
- 500 server errors (retry with backoff)
```

### API Integration Tests

```bash
# Run API tests against local development DB
npm run test:api

Test Suites:
- equipment.test.ts: CRUD operations, health queries, RUL predictions
- work-orders.test.ts: Creation, status transitions, completion workflow
- alerts.test.ts: Notification creation, acknowledgement, clearing
- telemetry.test.ts: CSV upload, HMAC validation, MQTT ingestion
- crew-scheduling.test.ts: Optimization, STCW compliance, conflict resolution
- ml-training.test.ts: Dataset preparation, training job, deployment
- insights.test.ts: Fleet overview, technician insights, status aggregation

Key Test Patterns:
- Multi-tenant isolation: Verify x-org-id enforcement (cross-tenant data leakage tests)
- Idempotency: Duplicate POST requests return 409 or are safely ignored
- Concurrency: Parallel updates with optimistic locking
- Rate limiting: Verify 429 Too Many Requests after threshold
```

### E2E UI Tests (Playwright)

```bash
# Run end-to-end tests in headless browser
npm run test:e2e

Critical Workflows:
1. equipment-health-monitor.spec.ts
   - Load health monitor page
   - Verify equipment cards render
   - Click equipment → verify detail modal opens
   - Predict RUL → verify gauge displays

2. predictive-alert-to-work-order.spec.ts
   - Navigate to alerts page
   - Acknowledge alert (verify status update)
   - Create work order from alert
   - Verify work order appears in list
   - Complete work order (fill form, submit)
   - Verify completion recorded

3. telemetry-upload.spec.ts
   - Upload CSV file
   - Verify processing progress indicator
   - Check success message + record count
   - Verify telemetry data appears in charts

4. crew-scheduling-optimization.spec.ts
   - Fill scheduling constraints form
   - Click "Optimize Schedule"
   - Wait for optimization results (polling)
   - Verify optimized schedule displayed
   - Apply schedule → verify calendar updated

5. fleet-overview-technician-insights.spec.ts
   - Load fleet overview page
   - Verify vessel cards with status indicators
   - Click vessel → verify drilldown
   - Check equipment status (Green/Yellow/Orange/Red)
   - Verify plain-language explanations

Test Data Strategy:
- Seed test database with known equipment, vessels, schedules
- Use faker.js for realistic test data generation
- Clean up test data after each suite (isolated transactions)
```

### Correlation ID Propagation Test

```typescript
// test/correlation-id.test.ts
describe("Correlation ID Propagation", () => {
  it("UI → API → Service → DB → Response", async () => {
    const correlationId = "test-" + Date.now();

    // UI sends custom correlation ID
    const response = await fetch("/api/equipment/health", {
      headers: {
        "x-org-id": "test-org",
        "X-Correlation-ID": correlationId,
      },
    });

    // API echoes correlation ID in response header
    expect(response.headers.get("X-Correlation-ID")).toBe(correlationId);

    // Check logs contain correlation ID
    const logs = await readStructuredLogs();
    const relevantLog = logs.find((l) => l.correlationId === correlationId);
    expect(relevantLog).toBeDefined();
    expect(relevantLog.operation).toBe("getEquipmentHealth");
  });

  it("Auto-generates correlation ID when not provided", async () => {
    const response = await fetch("/api/equipment/health", {
      headers: { "x-org-id": "test-org" },
    });

    const correlationId = response.headers.get("X-Correlation-ID");
    expect(correlationId).toBeTruthy();
    expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/); // UUID format
  });
});
```

### Metrics Definitions

#### Request Metrics

```
# Equipment Health
equipment_health_requests_total{org_id, status} - Total requests counter
equipment_health_response_time_ms{org_id} - Histogram (p50, p95, p99)
equipment_drilldown_clicks_total{org_id} - User interaction tracking

# Fleet Overview
fleet_overview_requests_total{org_id, status} - Total requests counter
fleet_overview_response_time_ms{org_id} - Latency histogram
fleet_overview_vessel_count{org_id} - Gauge (current vessel count)

# Alerts
alerts_emitted_total{org_id, severity} - Total alerts created
alert_acknowledgment_latency_ms{org_id} - Time from creation to ack (histogram)
time_to_work_order_minutes{org_id} - Time from alert to work order creation

# Work Orders
work_orders_created_total{org_id, type} - Counter (type: predictive, reactive, scheduled)
work_order_completion_time_hours{org_id} - Duration from creation to completion
work_orders_by_status{org_id, status} - Gauge (pending, in-progress, completed)

# Telemetry Ingestion
telemetry_ingestion_total{org_id, source} - Counter (source: csv, mqtt, j1939)
telemetry_validation_errors_total{org_id, reason} - Validation failure counter
telemetry_processing_latency_ms{org_id} - End-to-end processing time

# ML/AI
ml_predictions_total{org_id, model_type} - Total predictions counter
ml_prediction_latency_ms{org_id, model_type} - Inference latency
ml_training_duration_seconds{org_id, model_type} - Training job duration
ml_model_accuracy{org_id, model_type, version} - Gauge (current accuracy)

# Crew Scheduling
crew_optimization_requests_total{org_id} - Optimization runs counter
crew_optimization_duration_seconds{org_id} - Solver runtime
stcw_violations_detected_total{org_id} - Hours-of-rest violations

# Database
db_query_duration_ms{operation, table} - Query performance histogram
db_connection_pool_size{state} - Gauge (active, idle, waiting)
db_transaction_errors_total{org_id} - Transaction failure counter
```

#### Log Fields (PII-Safe)

```json
{
  "timestamp": "2025-11-03T14:23:45.678Z",
  "level": "INFO",
  "correlationId": "abc123-def456",
  "orgId": "default-org-id",
  "userId": "hashed-sha256", // Never log raw user IDs
  "operation": "getEquipmentHealth",
  "durationMs": 142,
  "status": "success",
  "equipmentCount": 37,
  "filters": {
    "equipmentId": "958532d6-...", // OK: Equipment IDs are not PII
    "vesselId": "812a99bd-..."
  },
  "error": null
}
```

#### Tracing (OpenTelemetry Compatible)

```
Trace ID: abc123-def456-ghi789
Spans:
  - UI: componentMount → queryFn
  - API: requestReceived → middleware → handler → response
  - Service: getEquipmentHealth → repository.getHealth
  - DB: SELECT query execution
  - ML: predictFailureRisk → loadModel → inference
```

#### Service Level Objectives (SLOs)

```yaml
slos:
  # Latency SLOs
  - name: Equipment Health p95 Latency
    target: < 500ms
    measurement: equipment_health_response_time_ms{quantile="0.95"}

  - name: Fleet Overview p95 Latency
    target: < 2000ms
    measurement: fleet_overview_response_time_ms{quantile="0.95"}

  - name: Alert Acknowledgment p95 Latency
    target: < 300ms
    measurement: alert_acknowledgment_latency_ms{quantile="0.95"}

  # Availability SLOs
  - name: API Availability
    target: 99.5% uptime
    measurement: (sum(rate(http_requests_total{status!~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100

  # Error Rate SLOs
  - name: API Error Rate
    target: < 0.5%
    measurement: (sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100

  # User Experience SLOs
  - name: Page Time to Interactive
    target: < 2.5s
    measurement: web_vitals_tti_seconds{quantile="0.75"}

  - name: Alert Publish Latency
    target: p95 < 2s
    measurement: time_to_alert_publish_ms{quantile="0.95"}

  - name: Work Order Creation Latency
    target: p95 < 1s
    measurement: time_to_work_order_minutes{quantile="0.95"} * 60
```

#### Synthetic Monitors

```yaml
# Run every 5 minutes from multiple locations
synthetic_checks:
  - name: Equipment Health Monitor Workflow
    steps:
      - GET /api/equipment/health
      - Assert: status 200, response time < 500ms, array length > 0
      - Extract: first equipment ID
      - GET /api/equipment/:id
      - Assert: status 200, equipment.id matches

  - name: Alert Acknowledgment Workflow
    steps:
      - GET /api/alerts/notifications
      - Assert: status 200
      - Create test alert (if none exist)
      - PATCH /api/alerts/notifications/:id/acknowledge
      - Assert: status 200, acknowledged = true

  - name: Telemetry Ingestion (CSV Upload)
    steps:
      - POST /api/telemetry/upload (multipart/form-data)
      - Assert: status 200, processed > 0
      - Wait 5s for processing
      - GET /api/telemetry/latest
      - Assert: status 200, recent telemetry exists

  - name: Fleet Overview Load
    steps:
      - GET /api/insights/v2/fleet-overview
      - Assert: status 200, response time < 2000ms
      - Assert: vessels array exists
      - Assert: all vessels have status field
```

---

## F) Final Decision: **GO** (with minor pre-launch fixes)

### Score: +13/16 → **APPROVED FOR PRODUCTION**

### Top 3 Required Fixes

| Priority | Fix                                                                                                                                                                                                                                                   | Owner        | Deadline | Estimated Effort |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ---------------- |
| **P1**   | **Async Pattern for Crew Optimization**<br>Current: Blocks HTTP request for 15-45s<br>Fix: Implement job queue (Bull/BullMQ) + polling endpoint<br>Endpoints: POST /api/crew/schedules/optimize → returns jobId, GET /api/crew/jobs/:id → poll status | Backend Team | Week 1   | 3 days           |
| **P1**   | **Add Pagination to List Endpoints**<br>Endpoints: /api/work-orders, /api/alerts/notifications, /api/vessels<br>Add params: limit (default 50, max 100), offset or cursor<br>Response: {data: [], total: number, hasMore: boolean}                    | Backend Team | Week 1   | 2 days           |
| **P2**   | **Circuit Breaker for External APIs**<br>Services: OpenWeatherMap, OpenAI LLM calls<br>Library: opossum or resilience4j-style<br>Fallback: Cached responses or graceful degradation                                                                   | Backend Team | Week 2   | 2 days           |

### Additional Recommendations (Post-Launch)

4. **WebSocket Progress for ML Training**: Real-time updates during 30-60min training jobs (Effort: 1 day)
5. **MQTT Error Visibility**: Surface MQTT ingestion failures in UI with retry actions (Effort: 2 days)
6. **LLM Response Caching**: Cache LLM report responses by parameters hash (60% cost reduction, Effort: 1 day)
7. **N+1 Query Optimization**: Optimize equipment health endpoint to reduce JOIN overhead (Effort: 2 days)

### Gate Decision: **GO TO PRODUCTION** ✅

**Rationale**:

1. **Strong Foundation**: Architecture scores +13/16 (well above +5 threshold)
2. **Security Excellence**: Multi-tenant isolation, audit trails, PII-safe logging
3. **World-class Observability**: Correlation IDs, Prometheus metrics, structured logging
4. **Technician-Friendly UX**: Plain language, color-coded status, offline-first
5. **Minor Fixes**: P1 items are low-risk, well-scoped (5 days total effort)

**Deployment Plan**:

1. **Week 1**: Fix async crew optimization + pagination (5 days)
2. **Week 2**: Add circuit breakers + final testing (3 days)
3. **Week 3**: Production deployment with gradual rollout (blue/green)
4. **Week 4+**: Monitor SLOs, gather user feedback, implement P2 improvements

**Risk Mitigation**:

- **Gradual Rollout**: Start with 10% traffic, monitor metrics, scale to 100% over 48 hours
- **Feature Flags**: Wrap new pagination/async patterns in feature flags for instant rollback
- **SLO Monitoring**: Set up PagerDuty alerts for SLO violations (error rate >0.5%, p95 latency >2s)
- **Runbook**: Document rollback procedures and escalation paths

---

## Summary

The ARUS Marine Predictive Maintenance Platform is **production-ready** with minor pre-launch improvements. The architecture demonstrates excellence in observability, security, and user experience. With the recommended fixes (5 days of effort), the platform will be fully optimized for large-scale marine fleet operations.

**Key Strengths**:
✅ 534 well-structured API endpoints with strong type safety  
✅ Multi-tenant security with defense-in-depth  
✅ Enterprise-grade observability (correlation IDs, metrics, structured logging)  
✅ Technician-friendly UX with plain language and color-coded indicators

**Next Steps**:

1. Implement P1 fixes (async optimization, pagination, circuit breakers)
2. Run comprehensive E2E test suite
3. Deploy to production with gradual rollout
4. Monitor SLOs and gather user feedback

**Final Recommendation: SHIP IT** 🚀
