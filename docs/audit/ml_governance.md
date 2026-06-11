# ML Governance & Audit Trail Documentation

**Generated:** 2025-11-04  
**System:** ARUS Marine Predictive Maintenance Platform  
**Compliance:** SOC 2, ISO 27001, Maritime Regulatory Standards

---

## Executive Summary

The ARUS platform implements a comprehensive ML Governance & Audit Trail system designed for production deployments requiring full transparency, reproducibility, and regulatory compliance.

### Key Features

- ✅ **Model Lineage Tracking** - Complete dataset → training → promotion history
- ✅ **Event Provenance** - Cryptographically-linked prediction audit trail
- ✅ **Chain Verification** - SHA-256 hash chain for tamper detection
- ✅ **Tenant Isolation** - Multi-tenant security enforced at all layers
- ✅ **Immutable Logs** - JSONL append-only storage for archival

---

## Architecture Overview

### Storage Design

```
./checkpoints/
├── lineage_{orgId}.jsonl      # Model lineage records
├── provenance_{orgId}.jsonl   # Prediction provenance chain
└── audit_{orgId}.jsonl         # Governance audit events
```

**Design Rationale:**

- **File-based** - Easy export, archival, and forensic analysis
- **JSONL format** - Append-only, line-delimited for streaming
- **Org-scoped** - Tenant isolation at filesystem level
- **No database** - Eliminates UPDATE/DELETE risks

### Data Flow

```
┌─────────────────┐
│  ML Training    │
│   (LSTM/XGB/RF) │
└────────┬────────┘
         │
         ├──> Dataset Hash (SHA-256)
         ├──> Model Artifact Hash
         ├──> Hyperparameters
         ├──> Metrics (Accuracy, Loss)
         │
         v
┌─────────────────┐
│ Lineage Record  │ ──> lineage_{orgId}.jsonl
│  (Append-only)  │
└─────────────────┘

┌─────────────────┐
│  Prediction     │
│   /api/pdm/score│
└────────┬────────┘
         │
         ├──> Telemetry Slice Hash
         ├──> Model ID Reference
         ├──> Prediction Output
         ├──> Confidence Score
         ├──> Previous Event Hash (chain)
         │
         v
┌─────────────────┐
│Provenance Event │ ──> provenance_{orgId}.jsonl
│  (SHA-256 Chain)│
└─────────────────┘
```

---

## Model Lineage Tracking

### Lineage Record Schema

```typescript
interface LineageRecord {
  id: string; // UUID
  orgId: string; // Tenant isolation
  modelType: "lstm" | "xgboost" | "random_forest";
  modelVersion: string; // Semantic version (e.g., "1.2.3")
  modelId: string; // Unique model identifier

  // Dataset provenance
  datasetHash: string; // SHA-256 of training data
  datasetSize: number; // Row count
  datasetSources: string[]; // Source vessel IDs

  // Training metadata
  hyperparameters: Record<string, any>;
  trainingDuration: number; // Seconds
  trainedAt: string; // ISO 8601 timestamp
  trainedBy: string; // User ID

  // Performance metrics
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    mse?: number;
    mae?: number;
    rmse?: number;
  };

  // Model lifecycle
  status: "training" | "validation" | "promoted" | "deprecated";
  promotedAt?: string;
  promotedBy?: string;
  deprecatedAt?: string;

  // Artifact management
  artifactPath: string; // File path to saved model
  artifactHash: string; // SHA-256 of model file
  artifactSizeBytes: number;

  // Usage tracking
  predictionCount: number; // Cumulative predictions made

  // Audit
  createdAt: string;
  updatedAt: string;
}
```

### Example Lineage Record

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "orgId": "default-org-id",
  "modelType": "lstm",
  "modelVersion": "1.2.3",
  "modelId": "lstm_v1.2.3_2025-11-04",
  "datasetHash": "a3d5e9f1b2c8d4e6f7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3",
  "datasetSize": 125000,
  "datasetSources": ["vessel-001", "vessel-002", "vessel-003"],
  "hyperparameters": {
    "epochs": 100,
    "batchSize": 32,
    "learningRate": 0.001,
    "hiddenLayers": [128, 64, 32],
    "dropout": 0.2,
    "optimizer": "adam"
  },
  "trainingDuration": 3600,
  "trainedAt": "2025-11-04T10:00:00Z",
  "trainedBy": "ml-engineer-001",
  "metrics": {
    "accuracy": 0.94,
    "precision": 0.92,
    "recall": 0.91,
    "f1Score": 0.915,
    "mse": 0.032
  },
  "status": "promoted",
  "promotedAt": "2025-11-04T11:00:00Z",
  "promotedBy": "manager-001",
  "artifactPath": "./ml-models/lstm_v1.2.3_2025-11-04.h5",
  "artifactHash": "b4e6f8a0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8",
  "artifactSizeBytes": 15728640,
  "predictionCount": 0,
  "createdAt": "2025-11-04T10:00:00Z",
  "updatedAt": "2025-11-04T11:00:00Z"
}
```

---

## Event Provenance (Prediction Audit Trail)

### Provenance Event Schema

```typescript
interface ProvenanceEvent {
  id: string; // Event UUID
  orgId: string; // Tenant isolation
  eventType: "prediction" | "alert" | "retrain_trigger";

  // Temporal ordering
  timestamp: string; // ISO 8601 with milliseconds
  sequenceNumber: number; // Monotonic counter per org

  // Model reference
  modelId: string; // Links to lineage record
  modelVersion: string;

  // Input data
  telemetrySlice: {
    vesselId: string;
    equipmentId: string;
    sensors: string[]; // Sensor names used
    timeWindow: {
      start: string;
      end: string;
      duration: number; // Seconds
    };
    dataHash: string; // SHA-256 of input telemetry
  };

  // Output data
  prediction: {
    anomalyScore: number;
    failureProbability: number;
    confidence: number;
    contributors: Array<{
      feature: string;
      contribution: number;
    }>;
    rul?: number; // Remaining Useful Life (days)
  };

  // User context
  requestedBy?: string; // User ID (if manual)
  automated: boolean; // True if cron job

  // Cryptographic chain
  previousEventHash?: string; // Hash of previous event
  currentEventHash: string; // SHA-256 of this event

  // Audit
  createdAt: string;
}
```

### SHA-256 Chain Hashing

**Hash Calculation:**

```typescript
function calculateEventHash(event: Omit<ProvenanceEvent, "currentEventHash">): string {
  const hashInput = JSON.stringify({
    id: event.id,
    orgId: event.orgId,
    eventType: event.eventType,
    timestamp: event.timestamp,
    sequenceNumber: event.sequenceNumber,
    modelId: event.modelId,
    telemetryDataHash: event.telemetrySlice.dataHash,
    predictionOutput: event.prediction,
    previousEventHash: event.previousEventHash || "GENESIS",
  });

  return crypto.createHash("sha256").update(hashInput).digest("hex");
}
```

**Chain Verification:**

```typescript
async function verifyProvenanceChain(orgId: string): Promise<VerificationResult> {
  const events = await loadProvenanceEvents(orgId);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedPrevHash = i > 0 ? events[i - 1].currentEventHash : undefined;

    // Verify chain linkage
    if (event.previousEventHash !== expectedPrevHash) {
      return {
        valid: false,
        brokenAt: event.id,
        reason: "Chain linkage broken",
        sequenceNumber: event.sequenceNumber,
      };
    }

    // Verify hash integrity
    const recalculatedHash = calculateEventHash(event);
    if (event.currentEventHash !== recalculatedHash) {
      return {
        valid: false,
        brokenAt: event.id,
        reason: "Hash mismatch (tampered event)",
        sequenceNumber: event.sequenceNumber,
      };
    }
  }

  return {
    valid: true,
    totalEvents: events.length,
    lastEventHash: events[events.length - 1]?.currentEventHash,
  };
}
```

### Example Provenance Event

```json
{
  "id": "7f3e5d1c-9b2a-4e6f-8c0d-1a2b3c4d5e6f",
  "orgId": "default-org-id",
  "eventType": "prediction",
  "timestamp": "2025-11-04T14:30:45.123Z",
  "sequenceNumber": 42,
  "modelId": "lstm_v1.2.3_2025-11-04",
  "modelVersion": "1.2.3",
  "telemetrySlice": {
    "vesselId": "vessel-001",
    "equipmentId": "main-engine-001",
    "sensors": ["rpm", "oil_temp", "coolant_temp", "vibration_x", "vibration_y", "vibration_z"],
    "timeWindow": {
      "start": "2025-11-04T14:25:00Z",
      "end": "2025-11-04T14:30:00Z",
      "duration": 300
    },
    "dataHash": "c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1"
  },
  "prediction": {
    "anomalyScore": 0.78,
    "failureProbability": 0.12,
    "confidence": 0.94,
    "contributors": [
      { "feature": "vibration_x", "contribution": 0.45 },
      { "feature": "oil_temp", "contribution": 0.32 },
      { "feature": "rpm", "contribution": 0.18 }
    ],
    "rul": 45
  },
  "requestedBy": null,
  "automated": true,
  "previousEventHash": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
  "currentEventHash": "d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8",
  "createdAt": "2025-11-04T14:30:45.123Z"
}
```

---

## Governance API Routes

### 1. Model Lineage Query

**Endpoint:** `GET /api/governance/lineage`

**Query Parameters:**

- `modelType` - Filter by model type (lstm, xgboost, random_forest)
- `status` - Filter by status (training, validation, promoted, deprecated)
- `trainedAfter` - ISO date filter
- `trainedBefore` - ISO date filter
- `limit` - Max records to return (default: 100)
- `offset` - Pagination offset

**Response:**

```json
{
  "records": [LineageRecord],
  "total": 250,
  "page": 1,
  "pageSize": 100
}
```

**Implementation Status:** ✅ Complete  
**File:** `server/governance/lineage.ts`

---

### 2. Provenance Events Query

**Endpoint:** `GET /api/governance/events`

**Query Parameters:**

- `eventType` - Filter by type (prediction, alert, retrain_trigger)
- `modelId` - Filter by model
- `vesselId` - Filter by vessel
- `equipmentId` - Filter by equipment
- `startDate` - ISO date filter
- `endDate` - ISO date filter
- `limit` - Max events (default: 100)
- `offset` - Pagination

**Response:**

```json
{
  "events": [ProvenanceEvent],
  "total": 1500,
  "page": 1,
  "pageSize": 100
}
```

**Implementation Status:** ✅ Complete  
**File:** `server/governance/provenance.ts`

---

### 3. Chain Verification

**Endpoint:** `POST /api/governance/verify-provenance`

**Request Body:**

```json
{
  "orgId": "default-org-id"
}
```

**Response (Valid Chain):**

```json
{
  "valid": true,
  "totalEvents": 1500,
  "lastEventHash": "d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8",
  "verifiedAt": "2025-11-04T15:00:00Z"
}
```

**Response (Broken Chain):**

```json
{
  "valid": false,
  "brokenAt": "7f3e5d1c-9b2a-4e6f-8c0d-1a2b3c4d5e6f",
  "reason": "Hash mismatch (tampered event)",
  "sequenceNumber": 42,
  "verifiedAt": "2025-11-04T15:00:00Z"
}
```

**Implementation Status:** ✅ Complete  
**File:** `server/governance/verify-chain.ts`

---

## Security & Compliance

### Multi-Tenant Isolation

**Session-Based Org Derivation:**

```typescript
// ✅ CORRECT: Always derive orgId from authenticated session
app.post("/api/governance/lineage", requireAuthentication, async (req, res) => {
  const orgId = req.user.orgId; // From session, never from client
  const records = await governanceService.getLineage(orgId, req.query);
  res.json(records);
});

// ❌ WRONG: Never trust client-provided orgId
app.post("/api/governance/lineage", async (req, res) => {
  const orgId = req.body.orgId; // SECURITY VIOLATION
  // ...
});
```

**Delta Replay Protection:**

```typescript
// Validate that delta.orgId matches record.orgId before applying changes
function applyDelta(delta: LineageDelta, existingRecord: LineageRecord): void {
  if (delta.orgId !== existingRecord.orgId) {
    throw new SecurityError("Cross-tenant tampering attempt blocked");
  }
  // Safe to apply delta
}
```

### Audit Logging

All governance operations are logged to `audit_{orgId}.jsonl`:

```json
{
  "timestamp": "2025-11-04T15:00:00Z",
  "operation": "lineage_query",
  "userId": "engineer-001",
  "orgId": "default-org-id",
  "filters": { "modelType": "lstm", "status": "promoted" },
  "resultCount": 5,
  "ip": "10.0.0.1",
  "userAgent": "Mozilla/5.0..."
}
```

---

## Compliance Readiness

### SOC 2 Type II

- ✅ **Change Control** - Model lineage tracks all training/promotion events
- ✅ **Audit Trail** - Immutable provenance chain with tamper detection
- ✅ **Access Control** - Tenant isolation enforced at all layers
- ✅ **Data Integrity** - SHA-256 hash verification

### ISO 27001

- ✅ **Information Security** - Cryptographic chain prevents unauthorized modifications
- ✅ **Access Management** - Session-based authentication
- ✅ **Incident Detection** - Chain verification detects tampering

### Maritime Regulations

- ✅ **Traceability** - Complete prediction → decision audit trail
- ✅ **Reproducibility** - Dataset + hyperparameters enable retraining
- ✅ **Evidence Preservation** - JSONL logs for regulatory review

---

## Operational Procedures

### Model Promotion Workflow

1. **Training** → Lineage record created with status: "training"
2. **Validation** → Update status to "validation" with test metrics
3. **Approval** → Manager/Admin promotes to production
4. **Deployment** → Status set to "promoted", previous model deprecated
5. **Tracking** → Prediction count incremented on each inference

### Chain Verification Schedule

- **Daily** - Automated verification at 03:00 UTC
- **On Demand** - Via governance UI or API
- **Pre-Audit** - Before regulatory review
- **Post-Incident** - After security event

### Backup & Archival

- **Hourly** - Incremental backup of JSONL files
- **Daily** - Full snapshot to object storage
- **Monthly** - Archive to cold storage
- **Retention** - 7 years for regulatory compliance

---

## Appendix: Sample Verification Results

### Successful Verification

```bash
$ curl -X POST http://localhost:5000/api/governance/verify-provenance \
  -H "Content-Type: application/json" \
  -d '{"orgId": "default-org-id"}'

{
  "valid": true,
  "totalEvents": 1847,
  "chainIntegrity": "OK",
  "lastEventHash": "d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8",
  "verifiedAt": "2025-11-04T15:30:00.000Z",
  "performanceMs": 12
}
```

### Failed Verification

```bash
{
  "valid": false,
  "brokenAt": "event-42",
  "reason": "Hash mismatch detected",
  "sequenceNumber": 42,
  "expectedHash": "a1b2c3d4...",
  "actualHash": "x9y8z7w6...",
  "recommendation": "Review security logs and investigate potential tampering"
}
```

---

**Document Version:** 1.0  
**Classification:** Internal  
**Owner:** ARUS ML Governance Team  
**Next Review:** 2025-12-04
