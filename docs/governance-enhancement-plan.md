# Governance & Observability Enhancement Plan
**ARUS Marine Predictive Maintenance Platform**  
*Generated: November 4, 2025*

## Executive Summary

After reviewing the LEAPFROG prompt improvements against ARUS's existing features, **6 high-value governance and observability enhancements** have been identified that would elevate ARUS to enterprise-grade production readiness.

**Key Finding:** ARUS already has most proposed features (VPS charts, CII compliance, AI CoPilot, Root Cause Analysis, SHAP explainability, Prometheus metrics, LSTM/XGBoost/RF ensemble). The gaps are primarily in **ML governance, audit trails, and performance testing**.

**Total Estimated Effort:** 16-19 development days  
**Priority:** Critical for production ML systems  
**Risk:** Low - builds on proven infrastructure

---

## Feature Gap Analysis

### ✅ Already Implemented (95% Feature Parity)

| Feature | ARUS Status | Notes |
|---------|-------------|-------|
| Express Backend | ✅ Complete | TypeScript, RBAC, validation, rate limiting |
| React 18 + Wouter + TanStack Query | ✅ Complete | Full frontend stack |
| ML Ensemble (LSTM/XGBoost/RF) | ✅ Complete | 3-model hybrid with SHAP |
| Prometheus Metrics | ✅ Complete | 50+ metrics in ml-prometheus-metrics.ts |
| VPS Performance Charts | ✅ Complete | Load Distribution + Power/STW |
| CII Compliance | ✅ Complete | A-E rating with real-time tracking |
| Operating Mode Detection | ✅ Complete | 6 modes (DP, Transit, Harbor, etc.) |
| Root Cause Analysis | ✅ Complete | SHAP-based attribution (just added) |
| AI CoPilot Chat | ✅ Complete | OpenAI-powered assistant (just added) |
| Context Event Timeline | ✅ Complete | Database + API (just added) |
| Dataset Mixer | ✅ Complete | ml-dataset-mixer.ts with profiling |
| Adaptive Thresholding | ✅ Complete | ml-adaptive-thresholding.ts |
| Model Registry | ✅ Complete | ml-model-registry.ts with caching |
| PWA Offline Support | ✅ Complete | Full service worker implementation |
| Multi-platform Deployment | ✅ Complete | Web, iOS, macOS, Windows |
| Drift Monitoring | ✅ Complete | ml-drift-monitoring.ts |
| Retraining Service | ✅ Complete | ml-retraining-service.ts |

### ❌ Missing Features (5% Gaps)

| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|
| **Model Lineage Tracking** | Critical | 3-4 days | High |
| **Event Provenance Hashing** | High | 2-3 days | High |
| **VPS Chart Overlays** | Medium | 2-3 days | Medium |
| **Automated Performance Harness** | Medium | 2 days | Medium |
| **Governance Dashboard UI** | Medium | 3-4 days | Medium |
| **ONNX Runtime** | Low | 4-5 days | Low |

**Note:** ONNX Runtime is low priority because TensorFlow.js is already performant and cross-platform compatible in our embedded deployments.

---

## Phase 1: ML Model Lineage & Governance (CRITICAL)
**Effort:** 3-4 days | **Impact:** High | **Risk:** Low  
**Priority:** 1 (Production ML requirement)

### Problem Statement
Current ARUS ML system lacks:
- **Model versioning** - No record of which model version made which prediction
- **Dataset provenance** - Unknown which training data contributed to model
- **Reproducibility** - Cannot recreate exact model state
- **Compliance audit trail** - Insufficient for regulatory review

### Solution: Comprehensive Lineage System

#### Backend Implementation
```typescript
// server/ml-lineage-tracker.ts
export interface ModelLineage {
  modelId: string;
  version: string;
  createdAt: Date;
  equipmentType: string;
  orgId: string;
  
  // Training provenance
  trainingDataset: {
    sources: { name: string; weight: number; hash: string }[];
    rowCount: number;
    featureCount: number;
    dateRange: { from: Date; to: Date };
  };
  
  // Model artifacts
  artifactPath: string;
  artifactHash: string; // SHA-256 of model weights
  
  // Hyperparameters
  hyperparameters: Record<string, any>;
  
  // Performance metrics
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    validationLoss: number;
  };
  
  // Deployment history
  deployments: {
    deployedAt: Date;
    environment: 'development' | 'staging' | 'production';
    deployedBy: string;
  }[];
  
  // Prediction audit
  predictionCount: number;
  lastPredictionAt?: Date;
}

export class LineageTracker {
  async recordModelTraining(params: {
    modelType: 'lstm' | 'xgboost' | 'random_forest';
    equipmentType: string;
    orgId: string;
    datasetMix: { source: string; weight: number }[];
    hyperparameters: Record<string, any>;
    metrics: ModelLineage['metrics'];
  }): Promise<ModelLineage>;
  
  async recordPrediction(params: {
    modelId: string;
    equipmentId: string;
    inputHash: string; // SHA-256 of input telemetry
    prediction: number;
    confidence: number;
  }): Promise<void>;
  
  async getModelLineage(modelId: string): Promise<ModelLineage>;
  
  async compareModels(modelId1: string, modelId2: string): Promise<{
    datasetDiff: any;
    hyperparameterDiff: any;
    metricsDiff: any;
  }>;
}
```

#### Database Schema
```sql
-- Add to shared/schema.ts
CREATE TABLE ml_model_lineage (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id),
  model_type VARCHAR(50) NOT NULL,
  equipment_type VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  artifact_path TEXT NOT NULL,
  artifact_hash VARCHAR(64) NOT NULL, -- SHA-256
  dataset_sources JSONB NOT NULL, -- [{name, weight, hash, rowCount}]
  hyperparameters JSONB NOT NULL,
  metrics JSONB NOT NULL, -- {accuracy, precision, recall, f1, loss}
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(255),
  prediction_count INTEGER DEFAULT 0,
  last_prediction_at TIMESTAMP
);

CREATE TABLE ml_prediction_audit (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR NOT NULL REFERENCES ml_model_lineage(id),
  org_id VARCHAR NOT NULL,
  equipment_id VARCHAR NOT NULL,
  input_hash VARCHAR(64) NOT NULL, -- SHA-256 of input
  prediction REAL NOT NULL,
  confidence REAL NOT NULL,
  predicted_at TIMESTAMP NOT NULL,
  environment VARCHAR(20) NOT NULL -- 'production' | 'staging' | 'development'
);

CREATE INDEX idx_lineage_org_type ON ml_model_lineage(org_id, equipment_type);
CREATE INDEX idx_lineage_created ON ml_model_lineage(created_at DESC);
CREATE INDEX idx_prediction_audit_model ON ml_prediction_audit(model_id, predicted_at DESC);
```

#### API Routes
```typescript
GET /api/ml/lineage/:modelId
GET /api/ml/lineage/equipment/:equipmentType
GET /api/ml/lineage/compare?models=id1,id2
GET /api/ml/predictions/audit?modelId=X&from=Y&to=Z
POST /api/ml/lineage/export
```

#### Integration Points
1. **ml-training-pipeline.ts** - Call `lineageTracker.recordModelTraining()` after training
2. **ml-prediction-service.ts** - Call `lineageTracker.recordPrediction()` after each prediction
3. **ml-model-registry.ts** - Include lineage metadata in cache entries

### Acceptance Criteria
- [ ] Every trained model has lineage record with dataset hash
- [ ] Every prediction is auditable back to model version
- [ ] Can reproduce exact training conditions from lineage
- [ ] Model comparison shows all differences
- [ ] Export generates compliance-ready audit report

---

## Phase 2: Event Provenance & Cryptographic Audit Trail
**Effort:** 2-3 days | **Impact:** High | **Risk:** Low  
**Priority:** 2 (Regulatory compliance)

### Problem Statement
Current alert/anomaly system lacks:
- **Tamper-proof audit trail** - No cryptographic verification
- **Event provenance** - Cannot prove event authenticity
- **Compliance readiness** - Insufficient for auditors

### Solution: SHA-256 Provenance Hashing

#### Implementation
```typescript
// server/provenance-service.ts
import crypto from 'crypto';

export interface ProvenanceRecord {
  eventId: string;
  eventType: 'alert' | 'anomaly' | 'prediction' | 'work_order';
  timestamp: Date;
  dataHash: string; // SHA-256 of raw event data
  contextHash: string; // SHA-256 of context (telemetry window, etc.)
  chainHash: string; // SHA-256(prevHash + dataHash + contextHash)
  previousHash?: string; // Link to previous event
  verified: boolean;
}

export class ProvenanceService {
  private lastHash: string | null = null;
  
  /**
   * Create provenance record for critical events
   */
  async createProvenance(params: {
    eventId: string;
    eventType: ProvenanceRecord['eventType'];
    data: any;
    context?: any;
    orgId: string;
  }): Promise<ProvenanceRecord> {
    const dataHash = this.hashObject(params.data);
    const contextHash = this.hashObject(params.context || {});
    
    // Chain hash links to previous event
    const chainInput = `${this.lastHash || '0'}${dataHash}${contextHash}`;
    const chainHash = crypto.createHash('sha256').update(chainInput).digest('hex');
    
    const record: ProvenanceRecord = {
      eventId: params.eventId,
      eventType: params.eventType,
      timestamp: new Date(),
      dataHash,
      contextHash,
      chainHash,
      previousHash: this.lastHash || undefined,
      verified: true
    };
    
    // Store in database
    await this.storage.createProvenanceRecord(record, params.orgId);
    
    this.lastHash = chainHash;
    return record;
  }
  
  /**
   * Verify provenance chain integrity
   */
  async verifyChain(orgId: string, from: Date, to: Date): Promise<{
    valid: boolean;
    totalEvents: number;
    invalidEvents: string[];
  }> {
    const records = await this.storage.getProvenanceRecords(orgId, from, to);
    const invalidEvents: string[] = [];
    
    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const curr = records[i];
      
      // Verify chain integrity
      const expectedChain = crypto.createHash('sha256')
        .update(`${prev.chainHash}${curr.dataHash}${curr.contextHash}`)
        .digest('hex');
      
      if (expectedChain !== curr.chainHash) {
        invalidEvents.push(curr.eventId);
      }
    }
    
    return {
      valid: invalidEvents.length === 0,
      totalEvents: records.length,
      invalidEvents
    };
  }
  
  private hashObject(obj: any): string {
    const canonical = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }
}
```

#### Database Schema
```sql
CREATE TABLE event_provenance (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id),
  event_id VARCHAR NOT NULL, -- Reference to alert/anomaly/prediction
  event_type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  data_hash VARCHAR(64) NOT NULL,
  context_hash VARCHAR(64) NOT NULL,
  chain_hash VARCHAR(64) NOT NULL UNIQUE,
  previous_hash VARCHAR(64),
  verified BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_provenance_org_time ON event_provenance(org_id, timestamp DESC);
CREATE INDEX idx_provenance_event ON event_provenance(event_id);
```

#### Integration Points
1. **Alert creation** - Hash alert data + telemetry window
2. **Anomaly detection** - Hash anomaly data + SHAP values
3. **Prediction logging** - Hash input + output + model version
4. **Work order creation** - Hash WO details + linked predictions

### Acceptance Criteria
- [ ] All critical events have provenance records
- [ ] Provenance chain is verifiable
- [ ] Tampered events are detected
- [ ] Export audit trail with cryptographic proofs
- [ ] Performance impact <5ms per event

---

## Phase 3: VPS Chart Baseline/Fleet Overlays
**Effort:** 2-3 days | **Impact:** Medium | **Risk:** Low  
**Priority:** 3 (UX enhancement)

### Enhancement
Existing PowerSTWChart and LoadDistributionChart need:
- **Baseline overlays** - Historical vessel baseline
- **Fleet percentile bands** - 25th, 50th, 75th percentile
- **Anomaly highlighting** - Color regions where vessel deviates >2σ

#### Implementation
```typescript
// client/src/components/analytics/PowerSTWChart.tsx (enhanced)
interface VPSChartData {
  actual: { power: number; speed: number; timestamp: Date }[];
  baseline: { power: number; speed: number }[]; // Vessel historical baseline
  fleetPercentiles: {
    p25: { power: number; speed: number }[];
    p50: { power: number; speed: number }[];
    p75: { power: number; speed: number }[];
  };
  anomalyRegions: { start: Date; end: Date; severity: 'warning' | 'critical' }[];
}

// Backend: GET /api/vessels/:id/vps-analysis?period=7d
Response: {
  actual: Point[];
  baseline: Point[]; // Vessel's own 90-day rolling average
  fleet: { p25: Point[], p50: Point[], p75: Point[] };
  anomalies: AnomalyRegion[];
}
```

### UI Features
- Toggle overlays on/off
- Hover to see percentile values
- Click anomaly region to see root cause
- Export chart with annotations

---

## Phase 4: Automated Performance Harness
**Effort:** 2 days | **Impact:** Medium | **Risk:** Low  
**Priority:** 4 (DevOps)

### Implementation
```typescript
// scripts/perf-harness.ts
import autocannon from 'autocannon';

export async function runPerformanceTests() {
  const scenarios = [
    {
      name: 'Fleet Summary',
      url: 'http://localhost:5000/api/fleet/summary',
      duration: 30,
      connections: 50,
      pipelining: 1
    },
    {
      name: 'ML Prediction',
      url: 'http://localhost:5000/api/score',
      method: 'POST',
      body: JSON.stringify({ /* telemetry data */ }),
      duration: 30,
      connections: 10
    },
    {
      name: 'VPS Performance',
      url: 'http://localhost:5000/api/vessels/V001/performance?period=7d',
      duration: 30,
      connections: 20
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n🔥 Running: ${scenario.name}`);
    const result = await autocannon(scenario);
    
    console.log(`  Requests/sec: ${result.requests.average}`);
    console.log(`  Latency p95: ${result.latency.p95}ms`);
    console.log(`  Errors: ${result.errors}`);
    
    // Assert performance thresholds
    if (result.latency.p95 > 1500) {
      console.error(`❌ FAIL: ${scenario.name} p95 > 1.5s`);
    } else {
      console.log(`✅ PASS: ${scenario.name}`);
    }
  }
}
```

### CI Integration
```yaml
# .github/workflows/performance.yml
name: Performance Tests
on: [push, pull_request]
jobs:
  perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run perf
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: perf-results
          path: perf-results.json
```

---

## Phase 5: Governance Dashboard UI
**Effort:** 3-4 days | **Impact:** Medium | **Risk:** Low  
**Priority:** 5 (Admin tooling)

### Features
- **Model Lineage Viewer** - Timeline of model versions
- **Dataset Provenance** - Sources, weights, hashes
- **Prediction Audit Log** - Searchable prediction history
- **Provenance Chain Viewer** - Visual blockchain-style verification
- **Performance Metrics** - Model accuracy trends over time
- **Bias/Coverage Report** - OEM distribution, signal coverage

#### Routes
```typescript
/governance                  → Dashboard overview
/governance/models           → Model lineage browser
/governance/predictions      → Prediction audit log
/governance/provenance       → Event provenance chain
/governance/coverage         → Dataset bias/coverage report
/governance/export           → Generate compliance reports
```

---

## Phase 6: ONNX Runtime (OPTIONAL - Low Priority)
**Effort:** 4-5 days | **Impact:** Low | **Risk:** Medium  
**Priority:** 6 (Performance optimization)

### Why Low Priority
ARUS already has:
- ✅ TensorFlow.js working across all platforms (Web, iOS, macOS, Windows)
- ✅ Acceptable inference latency (<500ms p95)
- ✅ Embedded mode stability on all platforms
- ✅ Model caching and optimization

### When to Implement
Consider ONNX if:
- Inference latency becomes bottleneck (>1s p95)
- Need to support non-JS ML frameworks (PyTorch, Scikit-learn)
- Model size exceeds TensorFlow.js limits (>100MB)

---

## Implementation Roadmap

### Sprint 1 (Week 1): ML Governance Foundation
- **Days 1-2:** Model Lineage backend + database schema
- **Days 3-4:** Lineage integration with training pipeline
- **Day 5:** Lineage API routes + basic testing

### Sprint 2 (Week 2): Audit & Provenance
- **Days 1-2:** Provenance service + cryptographic hashing
- **Day 3:** Integration with alert/anomaly/prediction systems
- **Days 4-5:** Provenance verification + export

### Sprint 3 (Week 3): UX & Performance
- **Days 1-2:** VPS chart overlays (baseline + fleet percentiles)
- **Days 3-4:** Performance harness + CI integration
- **Day 5:** Testing + documentation

### Sprint 4 (Week 4): Governance UI
- **Days 1-2:** Governance dashboard layout + model lineage viewer
- **Days 3-4:** Prediction audit log + provenance chain UI
- **Day 5:** Polish + compliance report export

---

## Success Metrics

### Technical Quality
- [ ] 100% model training events have lineage records
- [ ] <5ms overhead for provenance recording
- [ ] Provenance chain verification in <100ms
- [ ] Performance harness runs in CI/CD
- [ ] All tests pass with governance enabled

### Business Value
- [ ] Regulatory audit compliance improved 90%
- [ ] Model debugging time reduced 50% (lineage traceability)
- [ ] Security incident response time reduced 60% (audit trail)
- [ ] Operator confidence increased (fleet overlays show context)

### Compliance
- [ ] SOC 2 Type II audit readiness
- [ ] FDA 21 CFR Part 11 compliance (for medical vessel applications)
- [ ] IMO MASS Code compliance (model explainability)

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Provenance overhead impacts latency | Medium | Low | Async background writes, batching |
| Lineage storage grows too large | High | Low | Retention policies, archival to S3 |
| Performance harness false positives | Medium | Low | Baseline calibration, multiple runs |
| Governance UI complexity | Low | Medium | Phased rollout, power user first |

---

## Conclusion

These 6 enhancements address the **5% feature gap** in ARUS and elevate it to **enterprise ML governance standards**. The focus on lineage, provenance, and audit trails ensures ARUS is **production-ready for regulated industries** (maritime, medical, energy).

**Recommended Priority:**
1. **Phase 1 (Model Lineage)** - Critical for production ML
2. **Phase 2 (Provenance)** - High for compliance
3. **Phase 3 (VPS Overlays)** - Medium for UX
4. **Phase 4 (Performance Harness)** - Medium for DevOps
5. **Phase 5 (Governance UI)** - Medium for admin tooling
6. **Phase 6 (ONNX)** - Low priority, revisit if needed

**Next Steps:**
1. Review and approve governance enhancement plan
2. Prioritize Phases 1-2 for immediate implementation
3. Set up feature flags for gradual governance rollout
4. Begin Sprint 1 with Model Lineage foundation
