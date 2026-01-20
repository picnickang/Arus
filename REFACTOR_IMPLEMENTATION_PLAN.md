# ARUS System Refactoring - Comprehensive Implementation Plan

**Status**: Planning Phase  
**Target Completion**: 10 Phases  
**Estimated Total Effort**: 40-60 hours  
**Risk Level**: Medium (careful sequencing minimizes regression risk)

---

## Table of Contents

1. [Phase 1: Critical J1939 Collector Fixes](#phase-1-critical-j1939-collector-fixes)
2. [Phase 2: J1939 Collector Reliability](#phase-2-j1939-collector-reliability)
3. [Phase 3: Storage Layer Critical Deduplication](#phase-3-storage-layer-critical-deduplication)
4. [Phase 4: Storage Layer Multi-Tenant Security](#phase-4-storage-layer-multi-tenant-security)
5. [Phase 5: Storage Layer Reliability](#phase-5-storage-layer-reliability)
6. [Phase 6: Sensor Routes Validation & Atomicity](#phase-6-sensor-routes-validation--atomicity)
7. [Phase 7: Telemetry Pruning Service Enhancements](#phase-7-telemetry-pruning-service-enhancements)
8. [Phase 8: WorkOrders UI Hardening](#phase-8-workorders-ui-hardening)
9. [Phase 9: Analytics Pages Polish](#phase-9-analytics-pages-polish)
10. [Phase 10: Feature Flags & Enhanced Inventory](#phase-10-feature-flags--enhanced-inventory)

---

## Phase 1: Critical J1939 Collector Fixes

**Priority**: 🔴 CRITICAL  
**Effort**: 4-6 hours  
**Risk**: Low (bug fixes, no API changes)  
**Dependencies**: None

### Issues Addressed

1. **Incorrect PGN extraction formula** - Current implementation wrong for PDU1/PDU2 formats
2. **Memory leak** - Simulation timer not cleaned up in stop()
3. **Wrong PGN validation range** - Should be 0-262143 (18-bit), currently 0-131071

### Implementation Steps

#### 1.1: Fix PGN Extraction Math (1 hour)

**Current Code (WRONG):**

```typescript
private extractPGN(canId: number): number {
  const pf = (canId >> 16) & 0xFF;
  const ps = (canId >> 8) & 0xFF;

  if (pf < 240) {
    return ((canId >> 17) & 0x1) << 16 | pf << 8; // DP bit position wrong
  } else {
    return ((canId >> 17) & 0x1) << 16 | pf << 8 | ps;
  }
}
```

**Correct Implementation:**

```typescript
/**
 * J1939 29-bit CAN ID structure:
 * Bits 28-26: Priority (3 bits)
 * Bit 25: Reserved (1 bit)
 * Bit 24: Data Page (DP) (1 bit)
 * Bits 23-16: PDU Format (PF) (8 bits)
 * Bits 15-8: PDU Specific (PS) (8 bits)
 * Bits 7-0: Source Address (SA) (8 bits)
 *
 * PGN (18-bit) = (DP << 16) | (PF << 8) | (PS if PF >= 240 else 0)
 */
private extractPGN(canId: number): number {
  const DP = (canId >> 24) & 0x1;      // Bit 24
  const PF = (canId >> 16) & 0xFF;     // Bits 23-16
  const PS = (canId >> 8) & 0xFF;      // Bits 15-8

  // PDU1 format (PF < 240): PGN = (DP << 16) | (PF << 8)
  // PDU2 format (PF >= 240): PGN = (DP << 16) | (PF << 8) | PS
  const pgn = (DP << 16) | (PF << 8) | (PF >= 240 ? PS : 0);
  return pgn >>> 0; // Ensure unsigned
}
```

**Test Cases:**

```typescript
// Test PDU1 format (destination-specific)
// CAN ID: 0x0CF00400 -> PGN: 61444 (EEC1)
assert(extractPGN(0x0cf00400) === 61444);

// Test PDU2 format (broadcast)
// CAN ID: 0x18FEF200 -> PGN: 65266
assert(extractPGN(0x18fef200) === 65266);

// Test with DP bit set
// CAN ID: 0x19F00400 -> PGN: 126720 (DP=1, PF=240, PS=4)
assert(extractPGN(0x19f00400) === 126720);
```

#### 1.2: Fix PGN Validation Range (30 minutes)

**Current Code (WRONG):**

```typescript
private validatePgnSpn(pgn: number, spn: number | undefined): boolean {
  // PGN valid range: 0-131071 (17-bit) <- WRONG!
  if (pgn < 0 || pgn > 131071) {
    console.warn(`[J1939] Invalid PGN: ${pgn} (must be 0-131071)`);
    return false;
  }
  // ...
}
```

**Correct Implementation:**

```typescript
private validatePgnSpn(pgn: number, spn: number | undefined): boolean {
  // PGN valid range: 0-262143 (18-bit)
  if (pgn < 0 || pgn > 262143) {
    console.warn(`[J1939] Invalid PGN: ${pgn} (must be 0-262143)`);
    return false;
  }

  // SPN valid range: 0-524287 (19-bit) - already correct
  if (spn !== undefined && (spn < 0 || spn > 524287)) {
    console.warn(`[J1939] Invalid SPN: ${spn} (must be 0-524287)`);
    return false;
  }

  // ... rest of validation
}
```

#### 1.3: Add Simulation Timer Cleanup (30 minutes)

**Add Field:**

```typescript
export class J1939Collector {
  private config: J1939Configuration;
  private mapping: J1939Mapping;
  private batchBuffer: J1939TelemetryReading[] = [];
  private lastFlush = Date.now();
  private flushTimer?: NodeJS.Timeout;
  private canChannel?: any;
  private simulationTimer?: NodeJS.Timeout; // ADD THIS
  // ...
}
```

**Fix startSimulation():**

```typescript
private startSimulation(): void {
  if (!this.simulationFile) return;

  console.log(`[J1939] Starting simulation from ${this.simulationFile}`);

  try {
    const lines = fs.readFileSync(this.simulationFile, "utf8")
      .split(/\r?\n/)
      .filter(line => line.trim().length > 0);

    let lineIndex = 0;

    // Store the interval handle
    this.simulationTimer = setInterval(() => {
      const line = lines[lineIndex++ % lines.length];
      // ... existing parsing logic
    }, 100);

  } catch (error: any) {
    console.error(`[J1939] Failed to start simulation:`, error?.message || error);
  }
}
```

**Fix stop():**

```typescript
async stop(): Promise<void> {
  console.log(`[J1939] Stopping collector for device ${this.config.deviceId}`);

  // Clear all timers
  if (this.flushTimer) {
    clearTimeout(this.flushTimer);
  }

  // ADD THIS
  if (this.simulationTimer) {
    clearInterval(this.simulationTimer);
    this.simulationTimer = undefined;
  }

  // Stop CAN channel safely
  if (this.canChannel) {
    try {
      this.canChannel.stop?.();
      this.canChannel.removeAllListeners?.(); // ADD THIS
    } catch (error) {
      console.warn("[J1939] Error stopping CAN channel:", error);
    }
  }

  // Flush any remaining data
  await this.flush();
}
```

#### 1.4: Add Rate-Limited Logging (1 hour)

**Add Helper:**

```typescript
export class J1939Collector {
  // ... existing fields

  // Simple log throttler for noisy PGNs
  private lastPgnLog = new Map<number, number>();

  private shouldLogPgn(pgn: number, everyMs = 60_000): boolean {
    const now = Date.now();
    const last = this.lastPgnLog.get(pgn) ?? 0;
    if (now - last >= everyMs) {
      this.lastPgnLog.set(pgn, now);
      return true;
    }
    return false;
  }
}
```

**Update validatePgnSpn():**

```typescript
private validatePgnSpn(pgn: number, spn: number | undefined): boolean {
  // ... range checks

  const knownMarinePgns = [
    61444, 65262, 65263, 65270, 65271, 65272, 65276,
    61443, 61445, 65248, 65265, 65266
  ];

  // Rate-limit non-standard PGN warnings
  if (!knownMarinePgns.includes(pgn) && this.shouldLogPgn(pgn)) {
    console.log(`[J1939] Non-standard marine PGN detected: ${pgn}`);
  }

  return true;
}
```

#### 1.5: Progressive Buffer Pruning (1 hour)

**Current Code:**

```typescript
if (this.batchBuffer.length >= this.maxBufferSize) {
  console.warn(`[J1939] Buffer size limit (${this.maxBufferSize}) reached, forcing flush`);
  this.flush().catch((err) => console.error("[J1939] Emergency flush failed:", err));
  // Remove oldest 20% of buffer if flush fails
  const removeCount = Math.floor(this.maxBufferSize * 0.2);
  this.batchBuffer.splice(0, removeCount);
}
```

**Improved Implementation:**

```typescript
// In processCanFrame, after pushing new reading
if (this.batchBuffer.length > this.maxBufferSize) {
  // Calculate overshoot and remove at least that much + 20% headroom
  const overshoot = this.batchBuffer.length - this.maxBufferSize;
  const removeCount = Math.max(overshoot, Math.floor(this.maxBufferSize * 0.2));
  this.batchBuffer.splice(0, removeCount);
  console.warn(`[J1939] Buffer overshoot: dropped ${removeCount} oldest readings`);
}
```

### Testing Strategy

**Unit Tests (server/tests/j1939-collector.test.ts):**

```typescript
import { J1939Collector } from "../j1939-collector";

describe("J1939Collector", () => {
  describe("PGN Extraction", () => {
    it("should extract PGN correctly for PDU1 format (PF < 240)", () => {
      const collector = new J1939Collector(mockConfig, "test-org");
      // EEC1: CAN ID 0x0CF00400 -> PGN 61444
      expect(collector["extractPGN"](0x0cf00400)).toBe(61444);
    });

    it("should extract PGN correctly for PDU2 format (PF >= 240)", () => {
      const collector = new J1939Collector(mockConfig, "test-org");
      // CAN ID 0x18FEF200 -> PGN 65266
      expect(collector["extractPGN"](0x18fef200)).toBe(65266);
    });

    it("should handle DP bit correctly", () => {
      const collector = new J1939Collector(mockConfig, "test-org");
      // With DP=1: CAN ID 0x19F00400 -> PGN 126720
      expect(collector["extractPGN"](0x19f00400)).toBe(126720);
    });
  });

  describe("Memory Cleanup", () => {
    it("should clear simulation timer on stop", async () => {
      const collector = new J1939Collector(mockConfig, "test-org");
      await collector.start();
      await collector.stop();
      // Verify no memory leaks
      expect(collector["simulationTimer"]).toBeUndefined();
    });
  });
});
```

**Integration Test:**

```bash
# Create test simulation file
echo "0CF00400 00 00 00 34 12 FF FF FF" > /tmp/j1939-test.log

# Run with simulation
J1939_SIM_FILE=/tmp/j1939-test.log npm test
```

### Rollback Plan

If issues arise:

1. Revert `extractPGN()` to previous implementation
2. Keep timer cleanup (no harm)
3. Keep buffer pruning improvements (no harm)

---

## Phase 2: J1939 Collector Reliability

**Priority**: 🟠 HIGH  
**Effort**: 6-8 hours  
**Risk**: Low (additive changes)  
**Dependencies**: Phase 1 complete

### Issues Addressed

1. No retry logic in flush (transient network failures cause data loss)
2. No concurrency control (can overwhelm backend)
3. HMAC signature vulnerable to replay attacks (only signs payload)
4. Enhanced byte decoding for J1939 "Not Available" (0xFF) and "Error" (0xFE)

### Implementation Steps

#### 2.1: Add Backoff & Retry Helpers (1 hour)

```typescript
export class J1939Collector {
  // ... existing fields

  private flushInFlight = 0;
  private readonly maxConcurrentPosts = Number(process.env.J1939_MAX_CONCURRENCY || "6");

  // Backoff helper
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private backoffDelay(attempt: number): number {
    const base = 200; // ms
    return Math.min(5000, base * 2 ** Math.min(attempt, 5));
  }

  // Crypto helpers
  private sha256Hex(s: string): string {
    const h = crypto.createHash("sha256");
    h.update(s);
    return h.digest("hex");
  }
}
```

#### 2.2: Enhanced Flush with Retry & Concurrency (3 hours)

**Replace flush() method:**

```typescript
private async flush(): Promise<void> {
  if (this.batchBuffer.length === 0) return;

  const toSend = this.batchBuffer.splice(0, Math.min(this.batchBuffer.length, this.maxBatch));
  this.lastFlush = Date.now();
  console.log(`[J1939] Flushing ${toSend.length} readings for device ${this.config.deviceId}`);

  const postOne = async (reading: J1939TelemetryReading) => {
    const telemetryData: InsertTelemetry = {
      equipmentId: reading.equipmentId,
      sensorType: reading.sensorType,
      value: reading.value,
      unit: reading.unit || "",
      timestamp: reading.timestamp,
      status: reading.status,
      context: {
        source: reading.source,
        spn: reading.spn,
        protocol: "j1939",
        orgId: this.orgId
      }
    };

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-j1939-device": this.config.deviceId || "",
      "x-org-id": this.orgId
    };

    // ENHANCED HMAC: H(timestamp:deviceId:sha256(payload))
    if (this.hmacSecret) {
      const ts = Date.now().toString();
      const payload = JSON.stringify(telemetryData);
      const digest = this.sha256Hex(payload);
      const toSign = `${ts}:${this.config.deviceId || ""}:${digest}`;
      const h = crypto.createHmac('sha256', this.hmacSecret);
      h.update(toSign);
      headers["x-hmac-timestamp"] = ts;
      headers["x-hmac-signature"] = h.digest('hex');
    }

    // Retry with exponential backoff
    let attempt = 0;
    for (;;) {
      try {
        await axios.post(
          `${this.backendUrl}/api/telemetry/readings`,
          telemetryData,
          { headers, timeout: 5000 }
        );
        return; // Success
      } catch (e: any) {
        attempt++;
        const code = e?.response?.status;
        // Don't retry 4xx (except 408/429), retry network/5xx with backoff
        const retryable = !code || code >= 500 || code === 408 || code === 429;
        if (!retryable || attempt >= 3) {
          throw e; // Give up after 3 attempts or non-retryable error
        }
        await this.sleep(this.backoffDelay(attempt));
      }
    }
  };

  // Concurrency limiter
  const queue = [...toSend];
  const errors: any[] = [];
  const runners: Promise<void>[] = [];

  const runNext = async () => {
    while (queue.length) {
      const item = queue.shift()!;
      try {
        await postOne(item);
      } catch (e) {
        errors.push({ item, error: e });
      }
    }
  };

  // Start N concurrent workers
  for (let i = 0; i < this.maxConcurrentPosts; i++) {
    runners.push(runNext());
  }
  await Promise.allSettled(runners);

  if (errors.length === 0) {
    console.log(`[J1939] Successfully flushed ${toSend.length} readings`);
    return;
  }

  // Persist failures to disk and requeue within limits
  console.error(`[J1939] Flush partial failure: ${errors.length}/${toSend.length} failed`);
  const failed = errors.map(e => e.item);
  await this.persistFailedBatch(failed);

  const space = Math.max(0, this.maxBufferSize - this.batchBuffer.length);
  if (space > 0) {
    const retrySubset = failed.slice(0, space);
    this.batchBuffer.unshift(...retrySubset);
    const dropped = failed.length - retrySubset.length;
    if (dropped > 0) {
      console.warn(`[J1939] Dropped ${dropped} failed readings from memory (saved to disk)`);
    }
  } else {
    console.warn(`[J1939] Buffer full, kept failures on disk only: ${failed.length}`);
  }
}
```

#### 2.3: Enhanced Byte Decoding for NA/ERROR (2 hours)

**Replace readBytesFromFrame():**

```typescript
private readBytesFromFrame(frame: Buffer, byteIndices: number[], endian: 'LE' | 'BE'): number {
  if (!byteIndices || byteIndices.length === 0) return 0;

  // Bounds check and assemble as unsigned integer from selected bytes
  const bytes: number[] = [];
  for (const idx of byteIndices) {
    if (idx < 0 || idx >= frame.length) return 0;
    bytes.push(frame[idx]);
  }

  // Per-byte NA/ERROR detection: any 0xFF => NA, any 0xFE => ERROR (treat as NA)
  for (const b of bytes) {
    if (b === 0xFF || b === 0xFE) {
      return NaN; // Signal invalid so caller can drop
    }
  }

  let value = 0;
  if (endian === 'LE') {
    for (let i = 0; i < bytes.length; i++) {
      value |= (bytes[i] << (8 * i));
    }
  } else {
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
    }
  }
  return value >>> 0;
}
```

**Update decodeSPN():**

```typescript
private decodeSPN(spnRule: J1939SpnRule, data: Buffer, sourceAddress: number): J1939TelemetryReading | null {
  let rawValue = this.readBytesFromFrame(data, spnRule.bytes, spnRule.endian);

  // Drop invalid reads (NA or ERROR bytes detected)
  if (!Number.isFinite(rawValue)) return null;

  const scale = Number.isFinite(spnRule.scale) ? spnRule.scale : 1;
  const offset = Number.isFinite(spnRule.offset) ? spnRule.offset : 0;
  let processedValue = rawValue * scale + offset;

  if (spnRule.formula) {
    try {
      // Guard: only allow x, Math.*; 200 char limit to deter abuse
      const formula = String(spnRule.formula).slice(0, 200);
      const x = processedValue;
      // eslint-disable-next-line no-new-func
      const f = Function("x", "Math", `return (${formula});`);
      const out = f(x, Math);
      if (Number.isFinite(out)) processedValue = out;
    } catch {
      // Ignore formula errors, use pre-formula value
    }
  }

  return {
    equipmentId: this.config.deviceId!,
    sensorType: `j1939_${spnRule.sig}`,
    value: processedValue,
    unit: spnRule.unit,
    timestamp: new Date(),
    status: 'normal',
    source: spnRule.src,
    spn: spnRule.spn
  };
}
```

### Environment Variables

Add to `.env`:

```bash
# J1939 Collector Configuration
J1939_MAX_CONCURRENCY=6      # Concurrent POST requests
J1939_BATCH_MS=500           # Batch interval
J1939_FLUSH_MS=3000          # Flush timeout
J1939_MAX_BATCH=200          # Max readings per flush
J1939_MAX_BUFFER_SIZE=5000   # Max buffer before pruning
```

### Testing Strategy

**Load Test:**

```typescript
// Simulate 1000 CAN frames
for (let i = 0; i < 1000; i++) {
  collector["processCanFrame"](0x0cf00400, mockFrameData);
}
// Should flush in batches with concurrency limit
```

**Retry Test:**

```typescript
// Mock API with failures
mockAxios
  .onPost("/api/telemetry/readings")
  .replyOnce(500) // First attempt fails
  .replyOnce(500) // Second attempt fails
  .reply(200); // Third attempt succeeds

await collector["flush"]();
// Should retry with backoff and eventually succeed
```

---

## Phase 3: Storage Layer Critical Deduplication

**Priority**: 🔴 CRITICAL  
**Effort**: 3-4 hours  
**Risk**: Medium (large file, careful refactoring needed)  
**Dependencies**: None

### Issue Addressed

`getTelemetryHistory()` has duplicate implementations in `storage.ts` (15,934 lines).

### Implementation Steps

#### 3.1: Audit Duplicate Methods (1 hour)

**Search for duplicates:**

```bash
grep -n "getTelemetryHistory" server/storage.ts
```

**Expected findings:**

- Multiple `getTelemetryHistory` method definitions
- Different overload signatures
- Potentially inconsistent implementations

#### 3.2: Consolidate Implementation (2 hours)

**Create Single Implementation:**

```typescript
/**
 * Get telemetry history with flexible overloading:
 * - (equipmentId, sensorType, hours?) -> Last N hours for equipment
 * - (orgId, equipmentId, sensorType, startTime, endTime) -> Date range for equipment
 */
async getTelemetryHistory(
  arg1: string, // equipmentId or orgId
  arg2: string, // sensorType or equipmentId
  arg3?: number | string | Date, // hours or sensorType or startTime
  arg4?: Date, // undefined or endTime
  arg5?: Date  // undefined or undefined
): Promise<EquipmentTelemetry[]> {
  // Detect overload by argument count and types
  if (typeof arg3 === 'number' || arg3 === undefined) {
    // Overload 1: (equipmentId, sensorType, hours?)
    const equipmentId = arg1;
    const sensorType = arg2;
    const hours = arg3 ?? 24;

    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const endTime = new Date();

    return this._getTelemetryHistoryInternal(
      undefined, // orgId not provided in this overload
      equipmentId,
      sensorType,
      startTime,
      endTime
    );
  } else {
    // Overload 2: (orgId, equipmentId, sensorType, startTime, endTime)
    const orgId = arg1;
    const equipmentId = arg2;
    const sensorType = arg3 as string;
    const startTime = arg4 as Date;
    const endTime = arg5 as Date;

    return this._getTelemetryHistoryInternal(
      orgId,
      equipmentId,
      sensorType,
      startTime,
      endTime
    );
  }
}

/**
 * Internal implementation - single source of truth
 */
private async _getTelemetryHistoryInternal(
  orgId: string | undefined,
  equipmentId: string,
  sensorType: string,
  startTime: Date,
  endTime: Date
): Promise<EquipmentTelemetry[]> {
  const conditions = [
    eq(equipmentTelemetry.equipmentId, equipmentId),
    eq(equipmentTelemetry.sensorType, sensorType),
    gte(equipmentTelemetry.ts, startTime),
    lt(equipmentTelemetry.ts, endTime)
  ];

  // Add org filter if provided
  if (orgId) {
    // Join with equipment table to filter by org
    const results = await db
      .select()
      .from(equipmentTelemetry)
      .innerJoin(equipment, eq(equipment.id, equipmentTelemetry.equipmentId))
      .where(and(...conditions, eq(equipment.orgId, orgId)))
      .orderBy(asc(equipmentTelemetry.ts));

    return results.map(r => r.equipment_telemetry);
  } else {
    // No org filter
    return db
      .select()
      .from(equipmentTelemetry)
      .where(and(...conditions))
      .orderBy(asc(equipmentTelemetry.ts));
  }
}

/**
 * Convenience wrapper for date range queries
 */
async getTelemetryByEquipmentAndDateRange(
  equipmentId: string,
  startTime: Date,
  endTime: Date,
  orgId?: string
): Promise<EquipmentTelemetry[]> {
  // Delegate to main method with all sensor types
  // This requires fetching all sensor types, then filtering
  // Or we modify to accept sensorType as optional

  const conditions = [
    eq(equipmentTelemetry.equipmentId, equipmentId),
    gte(equipmentTelemetry.ts, startTime),
    lt(equipmentTelemetry.ts, endTime)
  ];

  if (orgId) {
    const results = await db
      .select()
      .from(equipmentTelemetry)
      .innerJoin(equipment, eq(equipment.id, equipmentTelemetry.equipmentId))
      .where(and(...conditions, eq(equipment.orgId, orgId)))
      .orderBy(asc(equipmentTelemetry.ts));

    return results.map(r => r.equipment_telemetry);
  } else {
    return db
      .select()
      .from(equipmentTelemetry)
      .where(and(...conditions))
      .orderBy(asc(equipmentTelemetry.ts));
  }
}
```

#### 3.3: Remove Duplicate Implementations (30 minutes)

Search for and remove:

- Any duplicate method bodies
- Commented-out old implementations
- Dead code paths

### Testing Strategy

**Unit Tests:**

```typescript
describe("getTelemetryHistory", () => {
  it("should handle overload 1: (equipmentId, sensorType, hours)", async () => {
    const result = await storage.getTelemetryHistory("equip-1", "temperature", 24);
    expect(result).toHaveLength(greaterThan(0));
  });

  it("should handle overload 2: (orgId, equipmentId, sensorType, startTime, endTime)", async () => {
    const start = new Date("2025-01-01");
    const end = new Date("2025-01-02");
    const result = await storage.getTelemetryHistory("org-1", "equip-1", "temperature", start, end);
    expect(result).toHaveLength(greaterThan(0));
  });

  it("should respect org isolation in overload 2", async () => {
    // Should not return data from other orgs
    const result = await storage.getTelemetryHistory(
      "org-1",
      "equip-in-org-2",
      "temperature",
      new Date(),
      new Date()
    );
    expect(result).toHaveLength(0);
  });
});
```

---

## Phase 4: Storage Layer Multi-Tenant Security

**Priority**: 🟠 HIGH  
**Effort**: 8-12 hours  
**Risk**: Medium (security-critical, requires thorough testing)  
**Dependencies**: Phase 3 complete

### Issue Addressed

Inconsistent `validateOrgId()` enforcement across org-scoped methods.

### Implementation Steps

#### 4.1: Audit All Org-Scoped Methods (2 hours)

**Create audit script:**

```typescript
// scripts/audit-org-scoping.ts
import fs from "fs";
import path from "path";

const storageFile = fs.readFileSync("server/storage.ts", "utf8");

// Find all method definitions
const methodRegex = /async\s+(\w+)\s*\([^)]*orgId[^)]*\)/g;
const methods: string[] = [];

let match;
while ((match = methodRegex.exec(storageFile)) !== null) {
  methods.push(match[1]);
}

console.log(`Found ${methods.length} org-scoped methods`);

// Check which ones call validateOrgId
for (const method of methods) {
  const methodBodyRegex = new RegExp(
    `async\\s+${method}\\s*\\([^)]*\\)\\s*:\\s*Promise<[^>]+>\\s*{([^}]+validateOrgId)?`,
    "s"
  );
  const bodyMatch = storageFile.match(methodBodyRegex);

  if (!bodyMatch || !bodyMatch[1]) {
    console.warn(`⚠️  ${method} does NOT call validateOrgId`);
  } else {
    console.log(`✅ ${method} calls validateOrgId`);
  }
}
```

**Run audit:**

```bash
tsx scripts/audit-org-scoping.ts > org-scoping-audit.txt
```

#### 4.2: Add validateOrgId to Missing Methods (4-6 hours)

**Pattern to follow:**

```typescript
async someOrgScopedMethod(
  id: string,
  orgId: string,
  data: SomeData
): Promise<SomeResult> {
  // ALWAYS start with validation
  this.validateOrgId(orgId, 'someOrgScopedMethod');

  // Then proceed with logic
  const result = await db
    .select()
    .from(someTable)
    .where(and(
      eq(someTable.id, id),
      eq(someTable.orgId, orgId) // Always filter by orgId
    ));

  if (result.length === 0) {
    throw new Error(`Resource ${id} not found or access denied`);
  }

  return result[0];
}
```

**Categories of methods to fix:**

1. **Device Methods:**
   - `getDevice()`
   - `updateDevice()`
   - `deleteDevice()`
   - `getDevicesByOrganization()`

2. **Telemetry Methods:**
   - `createTelemetryReading()`
   - `getLatestTelemetryReadings()`
   - `getTelemetryHistory()` (already fixed in Phase 3)

3. **Alert Methods:**
   - `getAlerts()`
   - `getAlertById()`
   - `updateAlert()`
   - `deleteAlert()`

4. **Inventory Methods:**
   - `getParts()`
   - `getPartById()`
   - `updatePart()`
   - `deletePart()`
   - `addPartToWorkOrder()`
   - `reservePartsForWorkOrder()`

5. **Knowledge Base Methods:**
   - `getKnowledgeBaseArticles()`
   - `getKnowledgeBaseArticle()`
   - `createKnowledgeBaseArticle()`

6. **Optimization Methods:**
   - `getOptimizationResults()`
   - `getOptimizationResult()`

7. **Crew Methods:**
   - `getCrewMembers()`
   - `getCrewMember()`
   - `updateCrewMember()`

8. **Vessel Methods:**
   - `getVessels()`
   - `getVessel()`
   - `updateVessel()`

#### 4.3: Add Helper for Equipment Validation (1 hour)

```typescript
/**
 * Assert that equipment exists and belongs to org
 * Used by telemetry creation to prevent orphan rows
 */
private async assertExistsEquipment(orgId: string, equipmentId: string): Promise<void> {
  this.validateOrgId(orgId, 'assertExistsEquipment');

  const result = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(
      eq(equipment.id, equipmentId),
      eq(equipment.orgId, orgId)
    ))
    .limit(1);

  if (result.length === 0) {
    throw new Error(
      `Equipment ${equipmentId} not found in organization ${orgId}`
    );
  }
}
```

**Use in createTelemetryReading:**

```typescript
async createTelemetryReading(
  reading: InsertEquipmentTelemetry,
  orgId: string
): Promise<EquipmentTelemetry> {
  this.validateOrgId(orgId, 'createTelemetryReading');

  // Validate equipment belongs to org
  await this.assertExistsEquipment(orgId, reading.equipmentId);

  const result = await db
    .insert(equipmentTelemetry)
    .values(reading)
    .returning();

  return result[0];
}
```

### Testing Strategy

**Security Tests:**

```typescript
describe("Multi-Tenant Isolation", () => {
  it("should prevent cross-org data access", async () => {
    // Create equipment in org-1
    const equip1 = await storage.createEquipment(
      {
        name: "Test Equipment",
        vesselId: "vessel-1",
        orgId: "org-1",
      },
      "org-1"
    );

    // Attempt to access from org-2 should fail
    await expect(storage.getEquipment(equip1.id, "org-2")).rejects.toThrow(
      "not found or access denied"
    );
  });

  it("should validate orgId before data operations", async () => {
    await expect(storage.getDevices("", "getDevices")).rejects.toThrow(
      "Organization ID cannot be empty"
    );
  });

  it("should prevent orphan telemetry creation", async () => {
    // Attempt to create telemetry for non-existent equipment
    await expect(
      storage.createTelemetryReading(
        {
          equipmentId: "non-existent",
          sensorType: "temp",
          value: 100,
          timestamp: new Date(),
        },
        "org-1"
      )
    ).rejects.toThrow("Equipment non-existent not found");
  });
});
```

---

## Phase 5: Storage Layer Reliability

**Priority**: 🟠 HIGH  
**Effort**: 6-8 hours  
**Risk**: Medium (transaction boundaries need careful design)  
**Dependencies**: Phase 4 complete

### Issues Addressed

1. System metrics/health methods throw instead of returning safe defaults
2. Inventory operations not atomic (partial commits possible)

### Implementation Steps

#### 5.1: Make Metrics/Health Non-Throwing (2-3 hours)

**Current problematic pattern:**

```typescript
async getSystemHealthCheck(id: string): Promise<SystemHealthCheck> {
  throw new Error("System health check not found");
}
```

**Fixed pattern:**

```typescript
async getSystemHealthCheck(id: string): Promise<SystemHealthCheck | null> {
  try {
    const result = await db
      .select()
      .from(systemHealthChecks)
      .where(eq(systemHealthChecks.id, id))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error('[Storage] Failed to get health check:', error);
    return null;
  }
}
```

**Methods to fix:**

1. `getSystemPerformanceMetrics()` -> Return `[]` instead of throwing
2. `getLatestMetricsByCategory()` -> Return `[]` instead of throwing
3. `getMetricTrends()` -> Return `[]` instead of throwing
4. `getSystemHealthChecks()` -> Return `[]` instead of throwing
5. `getSystemHealthCheck()` -> Return `null` instead of throwing
6. `getFailingHealthChecks()` -> Return `[]` instead of throwing
7. `getSystemHealth()` -> Return safe default state

**Safe default for system health:**

```typescript
async getSystemHealth(): Promise<SystemHealth> {
  try {
    const checks = await this.getSystemHealthChecks();
    const failing = checks.filter(c => c.status === 'failing');

    return {
      status: failing.length > 0 ? 'degraded' : 'healthy',
      checks: checks.length,
      failing: failing.length,
      lastCheck: new Date(),
      services: []
    };
  } catch (error) {
    console.error('[Storage] Failed to get system health:', error);
    // Return safe default - don't throw
    return {
      status: 'unknown',
      checks: 0,
      failing: 0,
      lastCheck: new Date(),
      services: []
    };
  }
}
```

#### 5.2: Atomic Inventory Transactions (4-5 hours)

**Current problematic pattern:**

```typescript
async addPartToWorkOrderWithValidation(
  workOrderId: string,
  partId: string,
  quantity: number,
  orgId: string
): Promise<void> {
  // Check stock
  const part = await this.getPartById(partId, orgId);
  if (!part || part.quantityAvailable < quantity) {
    throw new Error('Insufficient stock');
  }

  // Deduct stock (PROBLEM: not atomic!)
  await this.updatePart(partId, orgId, {
    quantityAvailable: part.quantityAvailable - quantity
  });

  // Add to work order (if this fails, stock is already deducted!)
  await db.insert(workOrderParts).values({
    workOrderId,
    partId,
    quantityUsed: quantity
  });
}
```

**Fixed atomic pattern:**

```typescript
async addPartToWorkOrderWithValidation(
  workOrderId: string,
  partId: string,
  quantity: number,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  this.validateOrgId(orgId, 'addPartToWorkOrderWithValidation');

  try {
    // Wrap in transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // 1. Lock and check part availability
      const parts = await tx
        .select()
        .from(inventoryParts)
        .where(and(
          eq(inventoryParts.id, partId),
          eq(inventoryParts.orgId, orgId)
        ))
        .for('update'); // Row-level lock

      const part = parts[0];
      if (!part) {
        throw new Error(`Part ${partId} not found`);
      }

      if (part.quantityAvailable < quantity) {
        throw new Error(
          `Insufficient stock: ${part.quantityAvailable} available, ${quantity} requested`
        );
      }

      // 2. Deduct stock atomically
      await tx
        .update(inventoryParts)
        .set({
          quantityAvailable: part.quantityAvailable - quantity,
          updatedAt: new Date()
        })
        .where(eq(inventoryParts.id, partId));

      // 3. Add to work order
      await tx.insert(workOrderParts).values({
        workOrderId,
        partId,
        quantityUsed: quantity,
        orgId
      });

      return { success: true };
    });

    return result;

  } catch (error: any) {
    console.error('[Storage] Failed to add part to work order:', error);
    return {
      success: false,
      error: error.message || 'Transaction failed'
    };
  }
}
```

**Methods to make atomic:**

1. `addPartToWorkOrder()`
2. `addPartToWorkOrderWithValidation()`
3. `reservePartsForWorkOrder()`
4. `releasePartsFromWorkOrder()`
5. `bulkUpdatePartQuantities()`
6. `transferPartsBetweenLocations()`

### Testing Strategy

**Concurrency Test:**

```typescript
describe("Atomic Inventory Operations", () => {
  it("should handle concurrent part reservations correctly", async () => {
    // Create part with quantity 10
    const part = await storage.createPart(
      {
        name: "Test Part",
        quantityAvailable: 10,
        orgId: "org-1",
      },
      "org-1"
    );

    // Try to reserve 10 parts concurrently (20 total requests)
    const promises = Array.from({ length: 20 }, () =>
      storage.addPartToWorkOrderWithValidation("wo-1", part.id, 10, "org-1")
    );

    const results = await Promise.allSettled(promises);
    const successful = results.filter((r) => r.status === "fulfilled" && r.value.success);

    // Only 1 should succeed (atomicity enforced)
    expect(successful).toHaveLength(1);

    // Verify final quantity is 0
    const finalPart = await storage.getPartById(part.id, "org-1");
    expect(finalPart.quantityAvailable).toBe(0);
  });

  it("should rollback on partial failure", async () => {
    // Create part with quantity 5
    const part = await storage.createPart(
      {
        name: "Test Part",
        quantityAvailable: 5,
        orgId: "org-1",
      },
      "org-1"
    );

    // Try to reserve more than available
    const result = await storage.addPartToWorkOrderWithValidation("wo-1", part.id, 10, "org-1");

    // Should fail
    expect(result.success).toBe(false);
    expect(result.error).toContain("Insufficient stock");

    // Quantity should remain unchanged
    const finalPart = await storage.getPartById(part.id, "org-1");
    expect(finalPart.quantityAvailable).toBe(5);
  });
});
```

---

## Phase 6: Sensor Routes Validation & Atomicity

**Priority**: 🟡 MEDIUM  
**Effort**: 5-7 hours  
**Risk**: Low (additive improvements)  
**Dependencies**: None

### Issues Addressed

1. Synchronous JSON file writes (race conditions)
2. No request validation (accepts arbitrary payloads)
3. Unknown signals use array index instead of stable IDs
4. Protocol naming inconsistency (j1708 vs j1587)

### Implementation Steps

#### 6.1: Create JsonStore Utility (1-2 hours)

**Create `server/lib/jsonStore.ts`:**

```typescript
import { promises as fsp } from "node:fs";
import path from "node:path";

export class JsonStore<T> {
  private static locks = new Map<string, Promise<void>>();

  constructor(
    private filePath: string,
    private defaultValue: T
  ) {}

  private async ensureDir(): Promise<void> {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
  }

  private async withLock<R>(fn: () => Promise<R>): Promise<R> {
    const prev = JsonStore.locks.get(this.filePath) ?? Promise.resolve();
    let release!: () => void;
    const p = new Promise<void>((res) => (release = res));
    JsonStore.locks.set(
      this.filePath,
      prev.then(() => p)
    );

    try {
      await prev;
      return await fn();
    } finally {
      release();
      if (JsonStore.locks.get(this.filePath) === p) {
        JsonStore.locks.delete(this.filePath);
      }
    }
  }

  async read(): Promise<T> {
    await this.ensureDir();
    try {
      const raw = await fsp.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return this.defaultValue;
    }
  }

  async write(obj: T): Promise<void> {
    await this.ensureDir();
    const tmp = `${this.filePath}.tmp`;
    const data = JSON.stringify(obj, null, 2);

    await this.withLock(async () => {
      await fsp.writeFile(tmp, data, "utf8");
      await fsp.rename(tmp, this.filePath);
    });
  }

  /**
   * Update with a transform function (atomic read-modify-write)
   */
  async update(fn: (current: T) => T | Promise<T>): Promise<void> {
    await this.withLock(async () => {
      const current = await this.read();
      const updated = await fn(current);
      await this.write(updated);
    });
  }
}
```

#### 6.2: Add Zod Validation Schemas (1 hour)

**Add to sensor routes file:**

```typescript
import { z } from "zod";

const UnknownSignalSchema = z.object({
  vessel: z.string().min(1, "Vessel ID required"),
  sig: z.string().min(1, "Signal name required"),
  src: z.string().optional(),
  unit: z.string().optional(),
  spn: z.number().int().optional(),
  pid: z.number().int().optional(),
});

const ApproveRuleSchema = z.object({
  protocol: z.enum(["j1939", "j1587"], {
    errorMap: () => ({ message: "Protocol must be j1939 or j1587" }),
  }),
  rule: z.object({
    sig: z.string().min(1),
    src: z.string().optional(),
    // J1939 fields
    pgn: z.number().int().min(0).max(262143).optional(),
    name: z.string().optional(),
    spnRule: z
      .object({
        spn: z.number().int().min(0).max(524287),
        name: z.string().optional(),
        scale: z.number().optional(),
        offset: z.number().optional(),
        unit: z.string().optional(),
        formula: z.string().max(200).optional(),
      })
      .optional(),
    // J1587 fields
    pidRule: z
      .object({
        pid: z.number().int().min(0).max(255),
        name: z.string().optional(),
        unit: z.string().optional(),
        scale: z.number().optional(),
        offset: z.number().optional(),
        formula: z.string().max(200).optional(),
      })
      .optional(),
  }),
});

const ApplyTemplateSchema = z.object({
  vessel_id: z.string().min(1),
  sensor_id: z.string().min(1),
  template_id: z.string().min(1),
});
```

#### 6.3: Refactor Routes to Use JsonStore (2-3 hours)

**Initialize stores:**

```typescript
import { JsonStore } from "./lib/jsonStore";
import { randomUUID } from "node:crypto";

const CFG_DIR = process.env.J1939_CONFIG_DIR || path.join(process.cwd(), "config", "j1939");
const DATA_DIR = process.env.J1939_DATA_DIR || path.join(process.cwd(), "data", "j1939");

const unknownStore = new JsonStore<{ items: any[] }>(path.join(DATA_DIR, "unknown_signals.json"), {
  items: [],
});

const j1939Store = new JsonStore<{ signals: any[] }>(path.join(CFG_DIR, "j1939_mapping.json"), {
  signals: [],
});

const j1587Store = new JsonStore<{ signals: any[] }>(path.join(CFG_DIR, "j1587_mapping.json"), {
  signals: [],
});
```

**Refactor unknown signal capture:**

```typescript
app.post("/api/sensors/unknown", async (req, res) => {
  try {
    // Validate request
    const parsed = UnknownSignalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.flatten(),
      });
    }

    const body = parsed.data;

    // Atomic update
    await unknownStore.update(async (doc) => {
      // Check for duplicate (per vessel)
      const key = JSON.stringify({
        vessel: body.vessel,
        sig: body.sig,
        src: body.src ?? null,
      });

      const exists = doc.items.some(
        (x) =>
          JSON.stringify({
            vessel: x.vessel,
            sig: x.sig,
            src: x.src ?? null,
          }) === key
      );

      if (!exists) {
        const guess =
          classifySignal({
            sig: body.sig,
            unit: body.unit,
            spn: body.spn,
            pid: body.pid,
          }) ?? null;

        doc.items.push({
          id: randomUUID(),
          ...body,
          guess,
          timestamp: new Date().toISOString(),
        });
      }

      return doc;
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[Sensors] op=captureUnknown error=", error);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});
```

**Add stable ID deletion:**

```typescript
// DELETE by ID (preferred)
app.delete("/api/sensors/unknown/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await unknownStore.update(async (doc) => {
      const index = doc.items.findIndex((x) => x.id === id);
      if (index >= 0) {
        doc.items.splice(index, 1);
      }
      return doc;
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[Sensors] op=deleteUnknown error=", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// DELETE by index (deprecated, kept for backward compatibility)
app.delete("/api/sensors/unknown/index/:index", async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);

    await unknownStore.update(async (doc) => {
      if (index >= 0 && index < doc.items.length) {
        doc.items.splice(index, 1);
      }
      return doc;
    });

    res.json({ ok: true, warning: "Index-based deletion is deprecated. Use ID-based deletion." });
  } catch (error: any) {
    console.error("[Sensors] op=deleteUnknownByIndex error=", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});
```

#### 6.4: Protocol Naming Consistency (30 minutes)

**Normalize to j1587:**

```typescript
app.post("/api/sensors/approve", async (req, res) => {
  try {
    const parsed = ApproveRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.flatten(),
      });
    }

    const { protocol, rule } = parsed.data;

    // Normalize protocol name
    const normalizedProtocol = protocol === "j1708" ? "j1587" : protocol;

    if (normalizedProtocol === "j1939") {
      await j1939Store.update(async (doc) => {
        // Find or create PGN entry
        let pgnEntry = doc.signals.find((s) => s.pgn === rule.pgn);
        if (!pgnEntry) {
          pgnEntry = {
            pgn: rule.pgn,
            name: rule.name || `PGN_${rule.pgn}`,
            spns: [],
          };
          doc.signals.push(pgnEntry);
        }

        // Add SPN if not duplicate
        if (rule.spnRule) {
          const spnExists = pgnEntry.spns.some((s: any) => s.spn === rule.spnRule!.spn);
          if (!spnExists) {
            pgnEntry.spns.push(rule.spnRule);
          }
        }

        return doc;
      });
    } else if (normalizedProtocol === "j1587") {
      await j1587Store.update(async (doc) => {
        // Check for duplicate PID
        if (rule.pidRule) {
          const pidExists = doc.signals.some((s: any) => s.pid === rule.pidRule!.pid);
          if (!pidExists) {
            doc.signals.push(rule.pidRule);
          }
        }
        return doc;
      });
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[Sensors] op=approve error=", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});
```

### Testing Strategy

**Concurrency Test:**

```typescript
describe("JsonStore Atomicity", () => {
  it("should handle concurrent writes without corruption", async () => {
    const store = new JsonStore<{ count: number }>("/tmp/test.json", { count: 0 });

    // 100 concurrent increments
    await Promise.all(
      Array.from({ length: 100 }, () =>
        store.update(async (doc) => ({
          count: doc.count + 1,
        }))
      )
    );

    const final = await store.read();
    expect(final.count).toBe(100);
  });
});
```

---

## Phase 7: Telemetry Pruning Service Enhancements

**Priority**: 🟡 MEDIUM  
**Effort**: 2-3 hours  
**Risk**: Low (scheduling improvements)  
**Dependencies**: None

### Implementation Steps

#### 7.1: Add Cron Scheduling (1 hour)

**Install dependency:**

```bash
# node-cron already in package.json
```

**Update TelemetryPruningService:**

```typescript
import cron from "node-cron";

export class TelemetryPruningService {
  private cronJob?: cron.ScheduledTask;
  private readonly cronSchedule: string;
  private readonly timezone: string;

  constructor() {
    this.cronSchedule = process.env.PRUNE_CRON || "0 2 * * *"; // 02:00 daily
    this.timezone = process.env.TZ || "UTC";
    // ... existing constructor
  }

  start(): void {
    console.log(
      `[TelemetryPruning] Starting service (schedule: ${this.cronSchedule}, timezone: ${this.timezone})`
    );

    // Schedule pruning with cron
    this.cronJob = cron.schedule(
      this.cronSchedule,
      () => {
        this.performPruning().catch((error) => {
          console.error("[TelemetryPruning] Scheduled pruning failed:", error);
        });
      },
      {
        scheduled: true,
        timezone: this.timezone,
      }
    );
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
    }
    console.log("[TelemetryPruning] Service stopped");
  }
}
```

#### 7.2: Structured Result Object (1 hour)

**Update performPruning():**

```typescript
interface PruningResult {
  success: boolean;
  telemetryDeleted: number;
  aggregatesDeleted: number;
  dataQualityDeleted: number;
  durationMs: number;
  error?: string;
}

async performPruning(): Promise<PruningResult> {
  const startTime = Date.now();
  const result: PruningResult = {
    success: false,
    telemetryDeleted: 0,
    aggregatesDeleted: 0,
    dataQualityDeleted: 0,
    durationMs: 0
  };

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    console.log(`[TelemetryPruning] Starting pruning (retention: ${this.retentionDays} days, cutoff: ${cutoffDate.toISOString()})`);

    // Prune telemetry
    const telemetryResult = await db
      .delete(equipmentTelemetry)
      .where(lt(equipmentTelemetry.ts, cutoffDate));

    result.telemetryDeleted = telemetryResult.rowCount || 0;

    // Prune aggregates
    const aggregateResult = await db
      .delete(telemetryAggregates)
      .where(lt(telemetryAggregates.windowStart, cutoffDate));

    result.aggregatesDeleted = aggregateResult.rowCount || 0;

    // Prune data quality logs
    const dataQualityResult = await db
      .delete(dataQualityLogs)
      .where(lt(dataQualityLogs.timestamp, cutoffDate));

    result.dataQualityDeleted = dataQualityResult.rowCount || 0;

    // VACUUM if significant deletions (PostgreSQL)
    const totalDeleted = result.telemetryDeleted + result.aggregatesDeleted + result.dataQualityDeleted;
    if (totalDeleted >= 1000) {
      console.log('[TelemetryPruning] Running VACUUM ANALYZE');
      await db.execute(sql`VACUUM ANALYZE equipment_telemetry`);
      await db.execute(sql`VACUUM ANALYZE telemetry_aggregates`);
    }

    result.success = true;
    result.durationMs = Date.now() - startTime;

    console.log(`[TelemetryPruning] Completed successfully`, result);

  } catch (error: any) {
    result.error = error.message || String(error);
    result.durationMs = Date.now() - startTime;
    console.error('[TelemetryPruning] Failed:', result);
  }

  return result;
}
```

#### 7.3: SQLite WAL Checkpoint (30 minutes)

**For SQLite mode:**

```typescript
async performPruning(): Promise<PruningResult> {
  // ... existing pruning logic

  // SQLite-specific optimizations
  if (process.env.DATABASE_PROVIDER === 'sqlite') {
    try {
      // WAL checkpoint
      await db.execute(sql`PRAGMA wal_checkpoint(TRUNCATE)`);

      // Only VACUUM if significant deletions
      if (totalDeleted >= 1000) {
        await db.execute(sql`VACUUM`);
      }
    } catch (error) {
      console.warn('[TelemetryPruning] SQLite optimization failed:', error);
    }
  }

  return result;
}
```

### Environment Variables

Add to `.env`:

```bash
# Telemetry Pruning Configuration
PRUNE_CRON="0 2 * * *"           # Daily at 02:00
TELEMETRY_RETENTION_DAYS=90      # Keep 90 days
TZ="America/New_York"            # Timezone for scheduling
```

---

## Phase 8: WorkOrders UI Hardening

**Priority**: 🟢 LOW  
**Effort**: 3-4 hours  
**Risk**: Very Low (UI-only changes)  
**Dependencies**: None

### Implementation Steps

#### 8.1: Add QueryFns (1 hour)

**Add fetchers:**

```typescript
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

// Fetcher helpers
const fetchJSON = <T>(url: string) => apiRequest<T>("GET", url);

const fetchWorkOrders = () => fetchJSON<WorkOrder[]>("/api/work-orders");
const fetchVessels = () => fetchJSON<Vessel[]>("/api/vessels");
const fetchEquipment = () => fetchJSON<Equipment[]>("/api/equipment");
const fetchCrew = (vesselId?: string) =>
  vesselId
    ? fetchJSON<CrewMember[]>(`/api/crew?vessel_id=${vesselId}`)
    : fetchJSON<CrewMember[]>("/api/crew");
```

**Update useQuery calls:**

```typescript
export function WorkOrdersPage() {
  const queryClient = useQueryClient();

  const {
    data: workOrders = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/work-orders"],
    queryFn: fetchWorkOrders,
    refetchInterval: 30000,
  });

  const { data: vessels = [] } = useQuery({
    queryKey: ["/api/vessels"],
    queryFn: fetchVessels,
    refetchInterval: 60000,
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["/api/equipment"],
    queryFn: fetchEquipment,
    refetchInterval: 60000,
  });

  const crewQueryKey = selectedVesselIdForCreate
    ? ["/api/crew", { vessel_id: selectedVesselIdForCreate }]
    : ["/api/crew"];

  const { data: crewMembers = [] } = useQuery({
    queryKey: crewQueryKey,
    queryFn: () => fetchCrew(selectedVesselIdForCreate),
    enabled: !!selectedVesselIdForCreate,
    refetchInterval: 60000,
  });

  // ... rest of component
}
```

#### 8.2: Guard Window Usage (30 minutes)

**SSR-safe URL parameter handling:**

```typescript
useEffect(() => {
  if (typeof window === "undefined") return;

  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get("action") === "create") {
    const equipmentId = searchParams.get("equipmentId") ?? "";
    const rawPriority = searchParams.get("priority");
    const priorityNum = [1, 2, 3].includes(Number(rawPriority)) ? Number(rawPriority) : 2;

    if (equipmentId && equipment.length > 0) {
      const selectedEquipment = equipment.find((eq) => eq.id === equipmentId);
      if (selectedEquipment) {
        setSelectedVesselIdForCreate(selectedEquipment.vesselId || "");
        setCreateForm((prev) => ({
          ...prev,
          equipmentId,
          vesselId: selectedEquipment.vesselId || "",
          priority: priorityNum,
        }));
      }
    }
    setCreateModalOpen(true);

    // Clean URL
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/work-orders");
      }
    }, 100);
  }
}, [location, equipment]);
```

#### 8.3: Memoize Sorted Data (1 hour)

**Add useMemo:**

```typescript
import { useMemo } from "react";

const sortedWorkOrders = useMemo(() => {
  const orders = workOrders ?? [];
  const sorted = [...orders].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case "orderId":
        aValue = a.woNumber || a.id;
        bValue = b.woNumber || b.id;
        break;
      case "equipment":
        aValue = getEquipmentName(a.equipmentId);
        bValue = getEquipmentName(b.equipmentId);
        break;
      case "priority":
        aValue = a.priority;
        bValue = b.priority;
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
      case "created":
        aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
}, [workOrders, sortColumn, sortDirection, equipment]);
```

#### 8.4: Type Safety Improvements (30 minutes)

**Safe error handling:**

```typescript
if (error) {
  const message = (error as any)?.message ?? "Unknown error";
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-destructive">
        Error loading work orders: {message}
      </div>
    </div>
  );
}
```

**Safe duration calculation:**

```typescript
const getWorkOrderDuration = (order: WorkOrder): string => {
  if (order.status === "completed") {
    if (typeof (order as any).actualDuration === "number") {
      const m = (order as any).actualDuration;
      const h = Math.floor(m / 60);
      const minutes = m % 60;
      return `${h}h ${minutes}m`;
    }
    if (order.actualStartDate && order.completedAt) {
      const start = new Date(order.actualStartDate).getTime();
      const end = new Date(order.completedAt).getTime();
      const m = Math.max(0, Math.round((end - start) / (1000 * 60)));
      const h = Math.floor(m / 60);
      const minutes = m % 60;
      return `${h}h ${minutes}m`;
    }
  }
  if (order.actualStartDate && order.status !== "completed") {
    const start = new Date(order.actualStartDate).getTime();
    const now = Date.now();
    const m = Math.max(0, Math.round((now - start) / (1000 * 60)));
    const h = Math.floor(m / 60);
    const minutes = m % 60;
    return `${h}h ${minutes}m (in progress)`;
  }
  return "Not started";
};
```

---

## Phase 9: Analytics Pages Polish

**Priority**: 🔵 POLISH  
**Effort**: 2-4 hours  
**Risk**: Very Low  
**Dependencies**: None

### Implementation Steps

#### 9.1: Check for Actual Corruption (30 minutes)

**Inspect files:**

```bash
# Check for common corruption patterns
grep -E "tran\s*sition|bord\s*er|dat.*tid|lookback\s*Days" client/src/pages/analytics*.tsx

# Check for broken JSX tags
grep -E "<[A-Z][a-zA-Z]*\s*$|^\s*>" client/src/pages/analytics*.tsx

# Check for ellipsis artifacts
grep -E "\.\.\." client/src/pages/analytics*.tsx
```

**If no corruption found:**

- Skip repair steps
- Proceed directly to lazy loading and type safety

**If corruption found:**

- Follow repair specification from attached document
- Fix split identifiers, broken JSX, ellipsis

#### 9.2: Add Lazy Loading (1 hour)

**Update analytics-hub.tsx:**

```typescript
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const AIPerformance = lazy(() => import("./ai-performance"));
const MLAIConsolidated = lazy(() => import("./ml-ai-consolidated"));
const MLTraining = lazy(() => import("./ml-ai-consolidated/MLTrainingPage"));
const AIInsights = lazy(() => import("./ml-ai-consolidated/AIInsights"));

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[400px] w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    </div>
  );
}

export function AnalyticsHub() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="ai-performance">AI Performance</TabsTrigger>
        {/* ... */}
      </TabsList>

      <TabsContent value="overview">
        <Suspense fallback={<PageLoader />}>
          <AIInsights />
        </Suspense>
      </TabsContent>

      <TabsContent value="ai-performance">
        <Suspense fallback={<PageLoader />}>
          <AIPerformance />
        </Suspense>
      </TabsContent>

      {/* ... */}
    </Tabs>
  );
}
```

#### 9.3: Type Safety (1 hour)

**Add type definitions:**

```typescript
interface TrainingWindowConfig {
  lookbackDays: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  confidenceMultiplier: number;
  warnings: string[];
  recommendations: string[];
  metadata: {
    availableDays: number;
    usedDays: number;
    failureCount: number;
    equipmentType: string;
  };
}

interface MlModel {
  id: string;
  orgId: string;
  name: string;
  algorithm: "LSTM" | "RandomForest" | "XGBoost";
  tier?: "bronze" | "silver" | "gold" | "platinum";
  createdAt?: string;
  equipmentId?: string;
  performance?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
  };
  hyperparameters?: {
    lookbackDays?: number;
    [k: string]: number | string | boolean | undefined;
  };
}

function getTierBadge(tier?: "bronze" | "silver" | "gold" | "platinum") {
  if (!tier) {
    return {
      label: "—",
      className: "px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs",
    };
  }

  const map = {
    bronze: {
      label: "Bronze",
      className: "px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-xs",
    },
    silver: {
      label: "Silver",
      className: "px-2 py-0.5 rounded bg-gray-200 text-gray-900 text-xs",
    },
    gold: {
      label: "Gold",
      className: "px-2 py-0.5 rounded bg-yellow-200 text-yellow-900 text-xs",
    },
    platinum: {
      label: "Platinum",
      className: "px-2 py-0.5 rounded bg-slate-200 text-slate-900 text-xs",
    },
  } as const;

  return map[tier];
}
```

**Safe rendering:**

```typescript
<TableCell>{model.performance?.accuracy?.toFixed(2) ?? "—"}</TableCell>
<TableCell>{model.performance?.precision?.toFixed(2) ?? "—"}</TableCell>
<TableCell>
  <span className={getTierBadge(model.tier).className}>
    {getTierBadge(model.tier).label}
  </span>
</TableCell>
```

---

## Phase 10: Feature Flags & Enhanced Inventory (Previously Deferred)

**Priority**: 🟡 MEDIUM  
**Effort**: 4-6 hours  
**Risk**: Low (feature-gated)  
**Dependencies**: Phase 5 complete

### Why This Was Initially Deferred

The `INVENTORY_ENHANCED` feature flag was suggested to be skipped because:

1. If we make inventory operations atomic (Phase 5), we don't need a flag
2. Feature flags add complexity for minimal benefit

### How to Implement Anyway

**Reasons you might still want this:**

1. Gradual rollout of advanced inventory features
2. A/B testing different inventory strategies
3. Org-specific feature access (premium tier gets enhanced features)

### Implementation Steps

#### 10.1: Define Feature Scope (1 hour)

**Determine what "enhanced" means:**

```typescript
// Enhanced inventory features (behind flag)
interface EnhancedInventoryFeatures {
  // Advanced stock management
  autoReorderPoints: boolean; // Auto-create POs when stock low
  predictiveStocking: boolean; // ML-based stock predictions
  batchTracking: boolean; // Track parts by batch number
  expirationTracking: boolean; // Track expiration dates

  // Advanced reporting
  costAnalytics: boolean; // Detailed cost breakdowns
  usageForecasting: boolean; // Predict future part usage
  supplierPerformance: boolean; // Track supplier metrics

  // Workflow automation
  autoApproval: boolean; // Auto-approve low-risk requisitions
  smartAllocations: boolean; // ML-based part allocation
  integrationSync: boolean; // Sync with external ERP systems
}
```

#### 10.2: Create Feature Flag System (2 hours)

**Add to shared/schema.ts:**

```typescript
export const featureFlags = pgTable(
  "feature_flags",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    flagName: varchar("flag_name").notNull(),
    enabled: boolean("enabled").default(false),
    config: jsonb("config"), // Feature-specific configuration
    enabledAt: timestamp("enabled_at", { withTimezone: true }),
    enabledBy: varchar("enabled_by"), // User who enabled it
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    orgFlagIdx: uniqueIndex("idx_org_flag").on(table.orgId, table.flagName),
  })
);
```

**Create feature flag service:**

```typescript
// server/feature-flags.ts
import { db } from "./db";
import { featureFlags } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class FeatureFlagService {
  private cache = new Map<string, boolean>();
  private cacheExpiry = new Map<string, number>();
  private readonly cacheTTL = 60000; // 1 minute

  /**
   * Check if a feature is enabled for an organization
   */
  async isEnabled(orgId: string, flagName: string): Promise<boolean> {
    const cacheKey = `${orgId}:${flagName}`;
    const now = Date.now();

    // Check cache
    const cached = this.cache.get(cacheKey);
    const expiry = this.cacheExpiry.get(cacheKey);
    if (cached !== undefined && expiry && expiry > now) {
      return cached;
    }

    // Query database
    const result = await db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(and(eq(featureFlags.orgId, orgId), eq(featureFlags.flagName, flagName)))
      .limit(1);

    // Default to environment variable if not in DB
    const enabled = result[0]?.enabled ?? this.getEnvDefault(flagName);

    // Cache result
    this.cache.set(cacheKey, enabled);
    this.cacheExpiry.set(cacheKey, now + this.cacheTTL);

    return enabled;
  }

  /**
   * Get default from environment variable
   */
  private getEnvDefault(flagName: string): boolean {
    const envKey = `FEATURE_${flagName.toUpperCase()}`;
    return process.env[envKey] === "true";
  }

  /**
   * Enable a feature for an organization
   */
  async enable(orgId: string, flagName: string, enabledBy: string, config?: any): Promise<void> {
    await db
      .insert(featureFlags)
      .values({
        orgId,
        flagName,
        enabled: true,
        enabledAt: new Date(),
        enabledBy,
        config,
      })
      .onConflictDoUpdate({
        target: [featureFlags.orgId, featureFlags.flagName],
        set: {
          enabled: true,
          enabledAt: new Date(),
          enabledBy,
          config,
          updatedAt: new Date(),
        },
      });

    // Invalidate cache
    this.cache.delete(`${orgId}:${flagName}`);
  }

  /**
   * Disable a feature for an organization
   */
  async disable(orgId: string, flagName: string): Promise<void> {
    await db
      .update(featureFlags)
      .set({
        enabled: false,
        updatedAt: new Date(),
      })
      .where(and(eq(featureFlags.orgId, orgId), eq(featureFlags.flagName, flagName)));

    // Invalidate cache
    this.cache.delete(`${orgId}:${flagName}`);
  }
}

export const featureFlagService = new FeatureFlagService();
```

#### 10.3: Guard Enhanced Inventory Methods (2 hours)

**Pattern for feature-gated methods:**

```typescript
async advancedStockAnalysis(
  orgId: string
): Promise<StockAnalysisResult | { enabled: false }> {
  this.validateOrgId(orgId, 'advancedStockAnalysis');

  // Check feature flag
  const hasEnhanced = await featureFlagService.isEnabled(
    orgId,
    'INVENTORY_ENHANCED'
  );

  if (!hasEnhanced) {
    return { enabled: false };
  }

  // Feature is enabled, proceed with enhanced logic
  const analysis = await this.performAdvancedAnalysis(orgId);
  return { enabled: true, ...analysis };
}

async predictPartUsage(
  partId: string,
  orgId: string,
  forecastDays: number
): Promise<PartUsageForecast | { enabled: false }> {
  this.validateOrgId(orgId, 'predictPartUsage');

  const hasEnhanced = await featureFlagService.isEnabled(
    orgId,
    'INVENTORY_ENHANCED'
  );

  if (!hasEnhanced) {
    return { enabled: false };
  }

  // ML-based prediction logic
  const forecast = await this.mlPredictUsage(partId, forecastDays);
  return { enabled: true, ...forecast };
}
```

**API routes with feature checks:**

```typescript
app.get("/api/inventory/analytics/advanced", async (req, res) => {
  try {
    const orgId = getCurrentOrgId(req);
    const result = await storage.advancedStockAnalysis(orgId);

    if ("enabled" in result && !result.enabled) {
      return res.status(403).json({
        error: "Enhanced inventory features not enabled for this organization",
        upgrade: "/pricing", // Link to upgrade page
      });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

**Frontend feature detection:**

```typescript
// client/src/hooks/useFeatureFlag.ts
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function useFeatureFlag(flagName: string) {
  return useQuery({
    queryKey: ['/api/feature-flags', flagName],
    queryFn: () => apiRequest<{ enabled: boolean }>('GET', `/api/feature-flags/${flagName}`),
    staleTime: 60000, // Cache for 1 minute
  });
}

// Usage in component
function InventoryPage() {
  const { data: enhanced } = useFeatureFlag('INVENTORY_ENHANCED');

  return (
    <div>
      <h1>Inventory</h1>

      {enhanced?.enabled ? (
        <AdvancedInventoryPanel />
      ) : (
        <BasicInventoryPanel />
      )}

      {!enhanced?.enabled && (
        <UpgradeBanner feature="Enhanced Inventory" />
      )}
    </div>
  );
}
```

### Environment Variables

Add to `.env`:

```bash
# Feature Flags (global defaults)
FEATURE_INVENTORY_ENHANCED=false
FEATURE_PREDICTIVE_MAINTENANCE_V2=false
FEATURE_ADVANCED_ANALYTICS=false
```

### Testing Strategy

**Feature flag tests:**

```typescript
describe("Feature Flags", () => {
  it("should respect database settings over env defaults", async () => {
    // Enable in database
    await featureFlagService.enable("org-1", "INVENTORY_ENHANCED", "admin");

    const enabled = await featureFlagService.isEnabled("org-1", "INVENTORY_ENHANCED");
    expect(enabled).toBe(true);

    // Different org should not have it
    const other = await featureFlagService.isEnabled("org-2", "INVENTORY_ENHANCED");
    expect(other).toBe(false);
  });

  it("should cache results for performance", async () => {
    const start = Date.now();
    await featureFlagService.isEnabled("org-1", "INVENTORY_ENHANCED");
    const firstCall = Date.now() - start;

    const start2 = Date.now();
    await featureFlagService.isEnabled("org-1", "INVENTORY_ENHANCED");
    const secondCall = Date.now() - start2;

    // Second call should be much faster (cached)
    expect(secondCall).toBeLessThan(firstCall / 10);
  });
});
```

---

## Summary & Sequencing

### Critical Path (Must Complete)

1. **Phase 1**: J1939 Critical Fixes (4-6 hours)
2. **Phase 3**: Storage Deduplication (3-4 hours)
3. **Phase 4**: Multi-Tenant Security (8-12 hours)
4. **Phase 5**: Atomic Transactions (6-8 hours)

**Total Critical Path**: 21-30 hours

### High-Value Optional (Strong ROI)

5. **Phase 2**: J1939 Reliability (6-8 hours)
6. **Phase 6**: Sensor Routes Validation (5-7 hours)

**Total with Optional**: 32-45 hours

### Polish & Enhancement (Nice-to-Have)

7. **Phase 7**: Pruning Enhancements (2-3 hours)
8. **Phase 8**: WorkOrders UI (3-4 hours)
9. **Phase 9**: Analytics Polish (2-4 hours)
10. **Phase 10**: Feature Flags (4-6 hours)

**Total All Phases**: 43-62 hours

### Recommended Sequence

**Week 1** (Critical Fixes):

- Day 1-2: Phase 1 (J1939 critical)
- Day 3: Phase 3 (Storage dedupe)
- Day 4-5: Phase 4 (Multi-tenant security)

**Week 2** (Reliability):

- Day 1-2: Phase 5 (Atomic transactions)
- Day 3-4: Phase 2 (J1939 reliability)
- Day 5: Phase 6 (Sensor validation)

**Week 3** (Polish):

- Day 1: Phase 7 (Pruning)
- Day 2: Phase 8 (WorkOrders UI)
- Day 3: Phase 9 (Analytics)
- Day 4-5: Phase 10 (Feature flags) OR Buffer/Testing

---

## Risk Mitigation

### Rollback Procedures

Each phase includes:

1. Git branch per phase
2. Database migrations are reversible (or use `npm run db:push --force`)
3. Feature flags allow gradual rollout
4. Comprehensive test suites

### Testing Requirements

- Unit tests for all business logic
- Integration tests for multi-tenant isolation
- Load tests for concurrent operations
- End-to-end tests for critical user flows

### Monitoring

Add observability for:

- J1939 collector: flush success rate, buffer size, PGN distribution
- Storage layer: query latencies, transaction rollback rate
- Feature flags: adoption rate, performance impact

---

## Next Steps

**After reviewing this plan, you should:**

1. Approve the overall sequencing
2. Identify any phases to skip or prioritize differently
3. Set a target completion timeline
4. Allocate development resources

**Would you like me to:**

1. Start with Phase 1 (J1939 critical fixes)?
2. Create a detailed test plan for any specific phase?
3. Provide code examples for any phase?
4. Something else?
