# ML/AI UI Refactor - API Endpoint Audit

**Date:** November 17, 2025  
**Purpose:** Comprehensive mapping of proposed features to existing backend endpoints  
**Status:** ✅ Pre-implementation Audit Complete

---

## Executive Summary

**Backend Readiness:** ~85% of required endpoints exist  
**Requires New Endpoints:** 15% (5 endpoints)  
**Critical Blocker:** None - all features can be implemented  

---

## Phase 1: AI Management Studio (Condition Monitoring AI Studio)

### Feature: Unified Model Table & Dashboard

| Frontend Need | Endpoint | Status | Notes |
|--------------|----------|--------|-------|
| List all models | `GET /api/analytics/ml-models` | ✅ EXISTS | Line 2615 |
| Get model details | `GET /api/analytics/ml-models/:id` | ✅ EXISTS | Line 2678 |
| Model performance metrics | `GET /api/analytics/model-performance/summary` | ✅ EXISTS | Via model-performance.tsx |
| Active models count | Derived from list | ✅ COMPUTED | Client-side aggregation |
| Models awaiting retraining | `GET /api/ml/retraining-triggers` | ✅ EXISTS | Line 12466 |
| Avg accuracy (30 days) | Derived from summary | ✅ COMPUTED | Client-side from performance data |
| Coverage (vessels/equipment) | Derived from models | ✅ COMPUTED | Client-side aggregation |

**Verdict:** ✅ **READY** - All data available

---

### Feature: Train New Model (Unified Form)

| Model Type | Endpoint | Status | Request Schema |
|-----------|----------|--------|----------------|
| LSTM | `POST /api/ml/train/lstm` | ✅ EXISTS | Line 12242 |
| Random Forest | `POST /api/ml/train/random-forest` | ✅ EXISTS | Line 12289 |
| XGBoost | `POST /api/ml/train/xgboost` | ✅ EXISTS | Line 12323 |
| Training window config | `GET /api/ml/training-window/:equipmentType?` | ✅ EXISTS | Line 12485 |

**Request Bodies (Current):**

**LSTM:**
```json
{
  "orgId": "string",
  "equipmentType": "string (optional)",
  "lstmConfig": {
    "sequenceLength": 10,
    "featureCount": 0,
    "lstmUnits": 64,
    "dropoutRate": 0.2,
    "learningRate": 0.001,
    "epochs": 50,
    "batchSize": 32
  }
}
```

**Random Forest:**
```json
{
  "orgId": "string",
  "equipmentType": "string (optional)",
  "rfConfig": {
    "numTrees": 50,
    "maxDepth": 10,
    "minSamplesSplit": 5,
    "maxFeatures": 8,
    "bootstrapSampleRatio": 0.8
  }
}
```

**XGBoost:**
```json
{
  "orgId": "string",
  "equipmentType": "string (optional)",
  "xgbConfig": {
    "numRounds": 100,
    "maxDepth": 6,
    "learningRate": 0.3,
    "subsample": 0.8,
    "colsampleByTree": 0.8,
    "minChildWeight": 1
  }
}
```

**Frontend Mapping Strategy:**
- Create unified form with model type radio
- Map UI "Data Window Presets" → `lookbackDays` parameter (Bronze=90, Silver=180, Gold=365, Platinum=730)
- Hide advanced params in collapsible section (maps directly to config objects above)
- Single submit handler that routes to correct endpoint based on model type selection

**Verdict:** ✅ **READY** - Endpoints exist, frontend mapping layer needed

---

### Feature: Model Actions (Deploy/Archive/Delete)

| Action | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| Deploy model | `PUT /api/analytics/ml-models/:id` | ✅ EXISTS | Line 2713 - Update status to "deployed" |
| Archive model | `PUT /api/analytics/ml-models/:id` | ✅ EXISTS | Line 2713 - Update status to "archived" |
| Delete model | `DELETE /api/analytics/ml-models/:id` | ✅ EXISTS | Line 2740 |

**Verdict:** ✅ **READY**

---

### Feature: Acoustic Diagnostics

| Frontend Need | Endpoint | Status | Implementation Notes |
|--------------|----------|--------|---------------------|
| Analyze acoustic data (CSV paste) | `POST /api/acoustic/analyze` | ✅ EXISTS | Line 12195 - Current implementation |
| Extract features | `POST /api/acoustic/features` | ✅ EXISTS | Line 12218 |
| File upload (.csv) | Client-side parsing → analyze endpoint | ✅ READY | Parse CSV in browser, send array |
| File upload (.wav) | ⚠️ **NEEDS ENDPOINT** | ❌ MISSING | Requires FFT extraction from WAV binary |

**Current Request Schema:**
```json
{
  "acousticData": [float array],
  "sampleRate": 44100,
  "rpm": 1800 (optional)
}
```

**What Works Today:**
- CSV paste (existing)
- CSV file upload (parse client-side)

**What Needs Backend Work:**
- WAV file processing (requires audio decoder + FFT extraction)

**Recommendation:** 
- Phase 1: Ship with CSV file upload only (works with existing endpoint)
- Future enhancement: Add WAV support with new `/api/acoustic/analyze-wav` endpoint

**Verdict:** ✅ **READY** (CSV), ⚠️ **FUTURE** (WAV)

---

### Feature: Data & Export

| Export Type | Endpoint | Status |
|------------|----------|--------|
| Complete ML/PDM Package | ❌ **NEEDS ENDPOINT** | `/api/ml/export/package` (new) |
| ML Models Only | ❌ **NEEDS ENDPOINT** | `/api/ml/export/models` (new) |
| Predictions & History | Existing analytics endpoints | ✅ Use GET /api/analytics/model-performance |
| Telemetry Data | `GET /api/telemetry` | ✅ EXISTS |

**Missing Endpoints Required:**
1. `GET /api/ml/export/package` - ZIP with models + predictions + config
2. `GET /api/ml/export/models` - Model files in ONNX/JSON format

**Workaround for Phase 1:**
- Use existing analytics endpoints to fetch JSON data
- Client-side bundle into downloadable files
- Defer native model file export to future phase

**Verdict:** ⚠️ **PARTIAL** - Can ship with JSON exports, native model export is future work

---

## Phase 2: AI Performance Dashboards

### Tab 1: Performance Metrics

| Frontend Need | Endpoint | Status |
|--------------|----------|--------|
| Active AI Models count | Derived | ✅ COMPUTED |
| Total Predictions | Derived | ✅ COMPUTED |
| Validated % | Derived | ✅ COMPUTED |
| Avg Accuracy | `GET /api/analytics/model-performance/summary` | ✅ EXISTS |
| Accuracy over time chart | Derived from validations | ✅ COMPUTED |
| Model performance by equipment | `GET /api/analytics/model-performance/by-equipment-type` | ✅ EXISTS |

**Verdict:** ✅ **READY**

---

### Tab 2: AI Explanations

| Frontend Need | Endpoint | Status |
|--------------|----------|--------|
| Recent predictions list | `GET /api/ml/realtime-predictions` | ✅ EXISTS | Line 3619 |
| Explanation for prediction | `GET /api/ml/explainability/predictions/:predictionId` | ✅ EXISTS | Line 3483 |
| Feature importances | `GET /api/ml/explainability/feature-importances` | ✅ EXISTS | Line 3563 |

**Verdict:** ✅ **READY** - Already implemented in ml-explainability.tsx

---

### Tab 3: User Feedback

| Frontend Need | Endpoint | Status |
|--------------|----------|--------|
| Feedback summary | `GET /api/analytics/prediction-feedback/summary` | ✅ EXISTS |
| Recent feedback list | `GET /api/analytics/prediction-feedback` | ✅ EXISTS |
| Submit feedback | Assumed to exist | ⚠️ **VERIFY** |

**Action Required:** Verify POST endpoint for feedback submission

**Verdict:** ✅ **READY** (read), ⚠️ **VERIFY** (write)

---

## Phase 3: AI Insights/RAG

### Tab 1: AI Reports (Existing)

| Frontend Need | Endpoint | Status |
|--------------|----------|--------|
| Generate vessel health report | `POST /api/llm/reports/vessel-health` | ✅ EXISTS |
| Generate fleet summary | `POST /api/llm/reports/fleet-summary` | ✅ EXISTS |
| Generate maintenance report | `POST /api/llm/reports/maintenance` | ✅ EXISTS |
| Generate compliance report | `POST /api/llm/reports/compliance` | ✅ EXISTS |
| Available models | `GET /api/llm/models` | ✅ EXISTS |

**Verdict:** ✅ **READY** - Already implemented in ai-insights.tsx

---

### Tab 2: Vessel Intelligence (New)

| Frontend Need | Endpoint | Status |
|--------------|----------|--------|
| Vessel intelligence | `GET /api/llm/vessel/:vesselId/intelligence` | ✅ EXISTS | Line 11445 |
| Equipment insights | `GET /api/llm/equipment/:equipmentId/insights` | ✅ EXISTS | Line 11365 |

**Current Response Schema:**
```json
{
  "success": true,
  "intelligence": {
    "vesselId": "string",
    "vesselName": "string",
    "patterns": {
      "historicalPatterns": [...],
      "anomalies": [...],
      "seasonalTrends": [...],
      "equipmentCorrelations": [...]
    },
    "predictions": {
      "failureRisk": 0.15,
      "nextMaintenanceWindow": "2025-12-15",
      "criticalEquipment": ["engine-1", "pump-3"]
    },
    "confidence": 0.85
  }
}
```

**Verdict:** ✅ **READY** - Endpoint exists, just needs UI restructuring

---

### Tab 3: Equipment Knowledge (RAG/Chat)

| Frontend Need | Endpoint | Status | Notes |
|--------------|----------|--------|-------|
| Semantic search | ❌ **NEEDS ENDPOINT** | pgvector search integration required |
| Chat-style Q&A | `POST /api/llm/equipment/analyze` | ✅ EXISTS | Line 11262 |
| Document retrieval | ❌ **NEEDS ENDPOINT** | RAG context retrieval |

**Current Capability:**
- Equipment analysis via LLM (exists)
- No semantic search over knowledge base yet

**Missing Infrastructure:**
- pgvector semantic search endpoint
- Document chunking & embedding pipeline
- RAG context retrieval API

**Recommendation:**
- Phase 1: Use existing LLM analyze endpoint for Q&A
- Show TODO/placeholder for "related documents" panel
- Future: Add full RAG pipeline with pgvector search

**Verdict:** ⚠️ **PARTIAL** - Chat works, semantic search is future work

---

## Summary: Endpoint Readiness Matrix

| Phase | Feature | Status | Blockers |
|-------|---------|--------|----------|
| **Phase 1** | Model Management Table | ✅ READY | None |
| | Unified Training Form | ✅ READY | Frontend mapping only |
| | Model Actions | ✅ READY | None |
| | Acoustic Diagnostics (CSV) | ✅ READY | None |
| | Acoustic Diagnostics (WAV) | ⚠️ FUTURE | New endpoint needed |
| | Data Export (JSON) | ✅ READY | None |
| | Data Export (Native Models) | ⚠️ FUTURE | New endpoints needed |
| **Phase 2** | Performance Metrics | ✅ READY | None |
| | AI Explanations | ✅ READY | None |
| | User Feedback | ⚠️ VERIFY | Check write endpoint |
| **Phase 3** | AI Reports | ✅ READY | None |
| | Vessel Intelligence | ✅ READY | None |
| | Equipment Knowledge (Chat) | ✅ READY | None |
| | Equipment Knowledge (RAG) | ⚠️ FUTURE | pgvector integration |

**Critical Path Items:**
1. ✅ Phase 1 can ship with existing endpoints (CSV acoustic only)
2. ⚠️ Verify feedback submission endpoint exists
3. ⚠️ Document "Coming Soon" features: WAV upload, RAG search, native model export

**Risk Assessment:** **LOW** - 85% of functionality ready, no critical blockers

---

## Recommended New Endpoints (Future Phases)

### Priority 1 (Post-Launch Enhancement)
```
GET  /api/ml/export/package       # Complete ML/PDM export as ZIP
GET  /api/ml/export/models        # Model files in ONNX/JSON format
POST /api/acoustic/analyze-wav    # Accept WAV binary, extract FFT
```

### Priority 2 (RAG Implementation)
```
POST /api/kb/search               # Semantic search via pgvector
GET  /api/kb/documents/:id        # Retrieve document by ID
POST /api/kb/chat                 # RAG-enabled chat with citations
GET  /api/kb/embeddings/:query    # Get embeddings for query
```

### Priority 3 (Nice-to-Have)
```
POST /api/ml/feedback             # Submit prediction feedback (if missing)
GET  /api/ml/drift                # Model drift alerts (already exists at /api/analytics/model-drift)
POST /api/ml/deploy/:modelId      # One-click model deployment
```

---

## Backend Files Reference

**ML Training:**
- `server/ml-training-pipeline.ts` - Orchestrates training
- `server/ml-lstm-model.ts` - LSTM implementation
- `server/ml-random-forest.ts` - Random Forest
- `server/ml-xgboost-model.ts` - XGBoost

**Acoustic:**
- `server/acoustic-monitoring.ts` - FFT analysis

**LLM/RAG:**
- `server/enhanced-llm.ts` - LLM service
- `server/enhanced-llm-routes.ts` - LLM endpoints
- `server/llm-sensor-tuning.ts` - Sensor optimization

**ML Services:**
- `server/ml-realtime-prediction.ts` - Real-time predictions
- `server/ml-explainability-service.ts` - SHAP explanations
- `server/ml-analytics-service.ts` - Performance analytics

---

**Next Step:** Proceed to Component Inventory
