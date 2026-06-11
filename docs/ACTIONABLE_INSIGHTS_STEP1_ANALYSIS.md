# STEP 1: Current State Analysis - ARUS Marine Predictive Maintenance

**Date:** November 24, 2025  
**Analyst:** Replit AI  
**Objective:** Identify existing systems for actionable insights integration

---

## 📊 EXECUTIVE SUMMARY

**ARUS Marine is a HIGHLY mature predictive maintenance platform** with extensive ML infrastructure already in place. The missing piece is a lightweight **Actionable Insights Layer** that bridges ML predictions with operator actions.

**Current State:**

- ✅ Complete ML/RUL prediction pipeline
- ✅ Digital twin simulation
- ✅ Alert notification system
- ✅ Knowledge base with RAG
- ✅ Dual-mode database architecture
- ⚠️ **Gap:** No automated insight-to-action workflow

---

## 🔍 KEY FINDINGS BY SYSTEM

### 1. **Telemetry Ingestion & Simulators** ✅ COMPLETE

**Files Found:**

- `server/mqtt-ingestion-service.ts` - MQTT telemetry ingestion with QoS, buffering, retry logic
- `server/vessel-simulator.ts` - Physics-based vessel telemetry simulator
- `server/ml-dataset-mixer.ts` - Synthetic data generation for ML training
- `server/j1939-collector.ts` - J1939 CAN bus telemetry collection
- `server/tools/j1708-collector.ts` - J1708 marine protocol collector

**Capabilities:**

- Real-time MQTT ingestion with dead-letter logging
- Simulated telemetry for testing (operating modes, sensor types)
- Multi-protocol support (MQTT, HTTP, CAN bus, J1708/J1587)
- Automatic equipment mapping and validation

**Current Flow:**

```
Sensors → MQTT/HTTP → Telemetry Processor → Equipment Telemetry DB → ML Pipeline
```

**Actionable Insight Integration Point:**
✅ After telemetry is processed, trigger insight evaluation for equipment

---

### 2. **ML / Analytics Modules** ✅ COMPREHENSIVE

**Files Found:**

- `server/rul-engine.ts` - **997 lines** - Complete RUL calculation engine with:
  - ML-based predictions (LSTM, Random Forest, XGBoost)
  - Mode-aware predictions (DP/Transit/Harbor/Cargo)
  - Data quality scoring
  - Repair censoring
  - Calibrated probabilities
  - Component degradation tracking
- `server/ml-prediction-service.ts` - **1,347 lines** - ML prediction service:
  - Ensemble orchestration
  - LRU cache for models
  - Circuit breakers for stability
  - TensorFlow/ONNX inference
  - Preprocessing parity (train/infer)
- `server/ml-ensemble-orchestrator.ts` - Multi-model voting
- `server/ml-explainability-service.ts` - SHAP-based feature importance
- `server/ml-training-pipeline.ts` - Automated model training
- `server/ml-threshold-calibrator.ts` - Threshold optimization

**RUL Prediction Output:**

```typescript
interface RulPrediction {
  equipmentId: string;
  remainingDays: number; // ← KEY: Days until failure
  confidenceScore: number;
  healthIndex: number; // 0-100
  degradationRate: number;
  failureProbability: number; // 0-1
  riskLevel: "low" | "medium" | "high" | "critical";
  componentStatus: ComponentHealthStatus[];
  predictionMethod: "ml_lstm" | "ml_rf" | "statistical" | "hybrid";
  recommendations: string[]; // ← Currently generic
}
```

**Current State:** VISUALIZATION ONLY

- Predictions are calculated and stored
- Displayed in dashboards and equipment detail pages
- **Missing:** Automated action triggering based on predictions

**Actionable Insight Integration Point:**
✅ After RUL calculation, evaluate rules and create insights

---

### 3. **Digital Twin Modules** ✅ ADVANCED

**Files Found:**

- `server/digital-twin-service.ts` - **1,138 lines** - Complete digital twin:
  - Physics-based vessel simulation
  - Hydrodynamics modeling
  - Machinery simulation (engines, generators, pumps)
  - Environmental factors (wind, waves, current)
  - Scenario simulation (maintenance, failure, optimization)

**Current State:** SIMULATION ONLY

- Can model equipment behavior under different scenarios
- **Missing:** Insight generation from simulation results

**Actionable Insight Integration Point:**
✅ After simulation, generate "what-if" insights (e.g., "If bearing fails, expect 12h downtime")

---

### 4. **Alerts + Notifications** ✅ ROBUST

**Files Found:**

- `server/domains/alerts/service.ts` - Alert service with:
  - Alert configurations (threshold-based)
  - Alert notifications (with WebSocket broadcast)
  - Alert suppressions
  - Alert comments
  - MQTT reliable sync (QoS 2)
- `server/domains/alerts/repository.ts` - Data access layer
- `server/mqtt-reliable-sync.ts` - MQTT sync for offline/online modes

**Database Schema:**

```typescript
// alert_configurations: Define thresholds
// alert_notifications: Active alerts
// alert_suppressions: Temporarily disable alerts
// alert_comments: Operator notes
```

**Current State:** THRESHOLD-BASED ONLY

- Alerts trigger when sensor values exceed thresholds
- **Missing:** Trend-based alerts, multi-signal fusion, predictive alerts

**Actionable Insight Integration Point:**
✅ Use existing alert notification system for insight delivery

---

### 5. **Knowledge Base / RAG / Embeddings** ✅ IMPLEMENTED

**Files Found:**

- `server/embedding-service.ts` - Text embedding generation
- `server/vector-index-service.ts` - pgvector-based vector search
- `server/vector-search-service.ts` - Semantic search over knowledge base
- `server/document-ingestion-service.ts` - Document processing
- `client/src/pages/knowledge-base.tsx` - Frontend interface

**Capabilities:**

- Equipment manuals and procedures stored with embeddings
- Semantic search for troubleshooting
- Context-aware recommendations

**Current State:** SEARCH ONLY

- Users manually search knowledge base
- **Missing:** Automatic knowledge retrieval for insights

**Actionable Insight Integration Point:**
✅ Enrich insights with relevant procedures from knowledge base

---

### 6. **Sync Layer & Database** ✅ DUAL-MODE

**Files Found:**

- `server/mqtt-reliable-sync.ts` - MQTT-based cloud ↔ vessel sync
- `server/sync-jobs.ts` - Background synchronization jobs
- `server/sync-events.ts` - Event-driven sync
- `server/sqlite-init.ts` - **3,000+ lines** - SQLite schema initialization
- `shared/schema.ts` - **296KB** - PostgreSQL schema
- `shared/schema-sqlite-vessel.ts` - **129KB** - SQLite schema
- `shared/schema-runtime.ts` - **31KB** - Mode-aware runtime schema

**Architecture:**

```
Cloud Mode: PostgreSQL (Neon) with TimescaleDB
↕ MQTT Sync
Vessel Mode: SQLite (libSQL/Turso) - Offline-first
```

**Current State:** FULLY FUNCTIONAL

- Dual-mode database working
- Sync layer operational
- Tenant isolation (x-org-id) implemented

**Actionable Insight Integration Point:**
✅ Insights must support both PostgreSQL and SQLite schemas

---

### 7. **Frontend Views** ✅ COMPREHENSIVE

**Key Pages Found:**

- `client/src/pages/dashboard.tsx` - Main dashboard with metrics
- `client/src/pages/health-monitor.tsx` - Equipment health overview
- `client/src/pages/pdm-equipment-detail.tsx` - Detailed equipment view with RUL
- `client/src/pages/alerts.tsx` - Alert configurations and notifications
- `client/src/pages/advanced-analytics.tsx` - Analytics dashboards
- `client/src/pages/schedule-board.tsx` - Maintenance scheduling
- `client/src/pages/sensors-hub.tsx` - Sensor management
- `client/src/pages/ml-training.tsx` - ML model management

**Components:**

- `client/src/components/InsightsOverview.tsx` - Fleet insights panel
- `client/src/components/OperatingConditionAlertsPanel.tsx` - Alert panel
- `client/src/components/CrewScheduler.tsx` - Maintenance scheduling
- `client/src/components/ml/MLHealthDashboard.tsx` - ML monitoring

**Current State:** VISUALIZATION + MANUAL ACTIONS

- Dashboards show health scores, RUL predictions, alerts
- Operators must manually:
  - Interpret data
  - Decide on actions
  - Create work orders
  - Schedule maintenance

**Missing UI:**

- ❌ Actionable Insights panel with one-click actions
- ❌ Insight filtering (severity, equipment, status)
- ❌ Insight acknowledgment workflow
- ❌ Automatic work order creation from insights

---

## 🎯 EXISTING "INSIGHTS" vs VISUALIZATION-ONLY

### What's Already "Actionable Logic":

1. **Alert Notifications** (`server/domains/alerts/service.ts`)
   - ✅ Threshold-based triggering
   - ✅ Email/in-app notifications
   - ✅ WebSocket real-time updates
   - ⚠️ **Limitation:** Simple threshold-only, no trend analysis

2. **Threshold Calibrator** (`server/ml-threshold-calibrator.ts`)
   - ✅ Automatic threshold optimization
   - ✅ Based on historical data
   - ⚠️ **Limitation:** Not integrated with insight generation

3. **Auto-Fix Service** (`server/auto-fix-service.ts`)
   - ✅ Automatic remediation for known issues
   - ⚠️ **Limitation:** Limited scope

### What's Currently "Just Data/Visualization":

1. **RUL Predictions** (`server/rul-engine.ts`)
   - ❌ Predictions calculated but not acted upon
   - ❌ No automatic maintenance scheduling
   - ❌ No proactive alerts based on trends

2. **Equipment Health Scores** (`/api/equipment/health`)
   - ❌ Health scores displayed but no actions triggered
   - ❌ Degradation trends not monitored

3. **ML Predictions** (`server/ml-prediction-service.ts`)
   - ❌ Failure probabilities calculated but not used for decisions
   - ❌ No automatic watchlist generation

4. **Digital Twin Simulations** (`server/digital-twin-service.ts`)
   - ❌ Simulations run but results not used for insights
   - ❌ No "what-if" scenario recommendations

5. **Knowledge Base** (`server/vector-search-service.ts`)
   - ❌ Manually searched, not automatically surfaced
   - ❌ No context-aware procedure recommendations

---

## 🔗 INTEGRATION POINTS FOR ACTIONABLE INSIGHTS

### 1. **After RUL Calculation** ✅

**File:** `server/rul-engine.ts` (line ~89: `calculateRul()`)

**Trigger Point:**

```typescript
async calculateRul(equipmentId: string, orgId: string): Promise<RulPrediction | null> {
  // ... calculation logic ...

  // ✅ INSERT HERE: Evaluate insights after RUL calculated
  // await insightEngine.evaluateEquipment(equipmentId, orgId, rulPrediction);

  return rulPrediction;
}
```

### 2. **After ML Prediction** ✅

**File:** `server/ml-prediction-service.ts` (line ~400+: prediction results)

**Trigger Point:**

```typescript
const prediction: MLPredictionResult = {
  method: "ml_lstm",
  failureProbability: 0.87,
  remainingDays: 6,
  // ...
};

// ✅ INSERT HERE: Trigger insight evaluation
// await insightEngine.evaluatePrediction(equipmentId, orgId, prediction);

return prediction;
```

### 3. **After Alert Configuration Triggered** ✅

**File:** `server/domains/alerts/service.ts` (line ~112: `createNotification()`)

**Trigger Point:**

```typescript
async createNotification(notification: InsertAlertNotification) {
  const alertNotification = await alertsRepository.createNotification(notification);

  // ✅ INSERT HERE: Create insight from alert
  // await insightEngine.createFromAlert(alertNotification);

  return alertNotification;
}
```

### 4. **Scheduled Evaluation (Cron)** ✅

**New Cron Job:** Run every hour to evaluate all equipment

```typescript
// server/cron-jobs/insight-evaluation.ts
cron.schedule("0 * * * *", async () => {
  // Evaluate all active equipment for insights
  await insightEngine.evaluateAll();
});
```

---

## 📋 WHAT'S NEEDED: THE INSIGHT GAP

### Missing Components:

1. **Insight Engine Module** ❌
   - Central rule evaluation logic
   - Multi-signal fusion (RUL + trends + sensor quality)
   - Structured insight generation

2. **Insights Database Schema** ❌
   - `actionable_insights` table (PostgreSQL + SQLite)
   - Fields: id, equipmentId, type, severity, message, recommendedAction, supportingSignals, acknowledged, resolved

3. **API Endpoints** ❌
   - `GET /api/insights` - List insights
   - `GET /api/insights/:id` - Get insight details
   - `POST /api/insights/:id/acknowledge` - Mark as acknowledged
   - `POST /api/insights/:id/schedule-maintenance` - Create work order

4. **Frontend UI** ❌
   - Actionable Insights panel (similar to `OperatingConditionAlertsPanel`)
   - Filtering by severity, equipment, vessel, status
   - One-click action buttons

5. **Rule Engine** ❌
   - JSON-based rules or lightweight custom engine
   - Examples:
     - `if (rul < 7 days && vibration_trend > 30%) → create insight`
     - `if (health < 70 && sensor_quality < 0.8) → create insight`

---

## 🏗️ EXISTING INFRASTRUCTURE TO LEVERAGE

### Strengths to Build Upon:

1. ✅ **Mature ML Pipeline**
   - RUL engine with mode-awareness
   - Ensemble predictions with circuit breakers
   - Explainability (SHAP)

2. ✅ **Robust Alert System**
   - WebSocket real-time delivery
   - MQTT reliable sync
   - Tenant isolation

3. ✅ **Dual-Mode Database**
   - PostgreSQL + SQLite parity
   - Sync infrastructure ready

4. ✅ **Rich Frontend**
   - React + TypeScript + shadcn/ui
   - TanStack Query for state management
   - WebSocket integration

5. ✅ **Domain-Driven Design**
   - Clean separation (service/repository layers)
   - Event-driven architecture
   - Tenant-scoped operations

---

## 🎯 RECOMMENDED APPROACH

### Phase 1: Core Insight Engine (15-20 hours)

1. Create `server/core/insights/insightEngine.ts`
2. Add `actionable_insights` table (PostgreSQL + SQLite)
3. Implement 3-5 basic rules (RUL threshold, trend-based, sensor quality)
4. Integrate with RUL engine and ML prediction service

### Phase 2: API & Frontend (10-15 hours)

1. Create REST endpoints (`/api/insights`)
2. Build `ActionableInsightsPanel.tsx` component
3. Add to dashboard and equipment detail pages
4. Implement acknowledgment workflow

### Phase 3: Advanced Features (10-15 hours)

1. Knowledge base integration (auto-fetch procedures)
2. Automatic work order creation
3. Digital twin scenario insights
4. Multi-signal fusion rules

---

## 📊 SUMMARY STATISTICS

| Category                | Files Scanned | Lines of Code | Status         |
| ----------------------- | ------------- | ------------- | -------------- |
| **Telemetry**           | 8 files       | ~5,000 LOC    | ✅ Complete    |
| **ML/Analytics**        | 25+ files     | ~15,000 LOC   | ✅ Complete    |
| **Digital Twin**        | 3 files       | ~1,500 LOC    | ✅ Complete    |
| **Alerts**              | 6 files       | ~1,000 LOC    | ✅ Complete    |
| **Knowledge Base**      | 5 files       | ~2,000 LOC    | ✅ Complete    |
| **Sync/DB**             | 10+ files     | ~10,000 LOC   | ✅ Complete    |
| **Frontend**            | 30+ files     | ~20,000 LOC   | ✅ Complete    |
| **Actionable Insights** | 0 files       | 0 LOC         | ❌ **MISSING** |

**Total Codebase:** ~200+ TypeScript files, ~50,000+ lines of production code

---

## ✅ CONCLUSION

**ARUS Marine has a world-class predictive maintenance infrastructure.** The missing piece is a lightweight **Actionable Insights Layer** that:

1. Consumes ML predictions and RUL calculations
2. Applies business rules and thresholds
3. Generates structured, operator-friendly recommendations
4. Enables one-click actions (schedule maintenance, create work orders)
5. Tracks acknowledgment and resolution

**Estimated Effort:** 35-50 hours for full implementation

**Next Step:** Design the actionable insights pipeline architecture (Step 2)
