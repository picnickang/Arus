# 🔄 Offline Sync Conflict Resolution Strategy

## 📋 The Problem

When multiple devices work offline and later sync to a shared database, **data conflicts are inevitable**:

### Example Scenario:
```
Initial State (All devices online):
Equipment #123: oilPressure = 45 PSI, lastUpdated = 10:00 AM

Device A (Captain's iPad) goes offline at 10:05 AM
Device B (Engineer's Phone) goes offline at 10:05 AM

Offline Changes:
Device A (10:30 AM): Updates oilPressure = 50 PSI
Device B (10:45 AM): Updates oilPressure = 48 PSI

Both devices reconnect at 11:00 AM and try to sync:
❌ Without conflict resolution: Last device wins, losing the other update
✅ With conflict resolution: System detects conflict and resolves intelligently
```

---

## 🎯 Conflict Resolution Strategies

### 1. **Last-Write-Wins (LWW)** ⚠️
**How it works:** Latest timestamp wins
```
Device A: oilPressure = 50 PSI (10:30 AM)
Device B: oilPressure = 48 PSI (10:45 AM) ← Wins (most recent)
Result: 48 PSI saved, 50 PSI lost
```

**Pros:**
- ✅ Simple to implement
- ✅ No user intervention needed
- ✅ Always converges to single value

**Cons:**
- ❌ Data loss (earlier updates discarded)
- ❌ No user control
- ❌ Dangerous for critical maritime data

**Use Case:** Non-critical settings, UI preferences

---

### 2. **Optimistic Locking with Version Numbers** ✅ (RECOMMENDED)
**How it works:** Each record has a version number, incremented on each update
```
Initial: Equipment #123 version = 5

Device A offline:
- Reads version = 5
- Updates oilPressure = 50 PSI
- Tries to save with version = 6

Device B offline:
- Reads version = 5
- Updates oilPressure = 48 PSI
- Tries to save with version = 6

When syncing:
1. Device A syncs first → Success (version 5 → 6)
2. Device B tries to sync → CONFLICT! (expects version 5, finds version 6)
3. System detects conflict and applies resolution strategy
```

**Pros:**
- ✅ Detects all conflicts reliably
- ✅ No data loss (conflicts are flagged)
- ✅ Can implement various resolution strategies
- ✅ Industry standard approach

**Cons:**
- ⚠️ Requires version tracking in database
- ⚠️ Needs conflict resolution UI

**Use Case:** Equipment data, work orders, critical settings

---

### 3. **Field-Level Versioning** ✅ (RECOMMENDED FOR COMPLEX DATA)
**How it works:** Each field has its own timestamp/version
```
Equipment #123:
- oilPressure: 45 PSI (updatedAt: 10:00 AM, updatedBy: "system")
- temperature: 180°F (updatedAt: 10:00 AM, updatedBy: "system")

Device A updates:
- oilPressure: 50 PSI (updatedAt: 10:30 AM, updatedBy: "captain")

Device B updates:
- temperature: 185°F (updatedAt: 10:45 AM, updatedBy: "engineer")

Sync result:
✅ oilPressure: 50 PSI (10:30 AM, captain)
✅ temperature: 185°F (10:45 AM, engineer)
No conflict! Different fields modified.
```

**Pros:**
- ✅ Merges non-conflicting changes automatically
- ✅ Reduces conflicts significantly
- ✅ Preserves more data
- ✅ Great for complex objects

**Cons:**
- ⚠️ Complex schema (timestamp per field)
- ⚠️ Still needs conflict resolution for same-field edits

**Use Case:** Equipment with many sensors, complex work orders

---

### 4. **Vector Clocks / Version Vectors** (Advanced)
**How it works:** Track causal relationships between updates
```
Device A: [A:2, B:1, C:0]
Device B: [A:1, B:3, C:0]

Can determine:
- Which updates are newer
- Which updates are concurrent (conflict)
- Causal ordering of events
```

**Pros:**
- ✅ Detects concurrent vs. sequential updates
- ✅ No central timestamp needed
- ✅ Works in fully distributed systems

**Cons:**
- ❌ Complex to implement
- ❌ Overhead grows with device count
- ❌ Overkill for most applications

**Use Case:** Highly distributed systems, multiple offices

---

### 5. **CRDTs (Conflict-free Replicated Data Types)** (Advanced)
**How it works:** Mathematical structures that always converge
```
Counter CRDT:
- Device A: increment by 5
- Device B: increment by 3
- Result: Always converges to +8 (order doesn't matter)

Set CRDT:
- Device A: adds item X
- Device B: removes item Y
- Result: Always converges to same set
```

**Pros:**
- ✅ Mathematically guaranteed convergence
- ✅ No conflict resolution needed
- ✅ Excellent for collaborative editing

**Cons:**
- ❌ Limited data types
- ❌ Not suitable for all maritime data
- ❌ Complex to implement

**Use Case:** Collaborative notes, crew assignments

---

### 6. **Manual Conflict Resolution** ✅ (RECOMMENDED FOR CRITICAL DATA)
**How it works:** Present conflicts to user for decision
```
Conflict Detected:
┌─────────────────────────────────────────┐
│ Equipment #123 Oil Pressure Conflict    │
├─────────────────────────────────────────┤
│ Your Change (Captain, 10:30 AM):        │
│ 50 PSI                                  │
│                                         │
│ Other Change (Engineer, 10:45 AM):      │
│ 48 PSI                                  │
├─────────────────────────────────────────┤
│ [Keep Your Change] [Keep Other Change]  │
│ [Keep Both] [Enter New Value]           │
└─────────────────────────────────────────┘
```

**Pros:**
- ✅ User controls critical decisions
- ✅ No automatic data loss
- ✅ Audit trail maintained
- ✅ Best for safety-critical systems

**Cons:**
- ⚠️ Requires user intervention
- ⚠️ Can be tedious with many conflicts

**Use Case:** Critical equipment settings, safety thresholds

---

## 🚢 ARUS Marine Recommended Strategy

### **Hybrid Approach** (Multi-Layer Conflict Resolution)

```
┌─────────────────────────────────────────────────────────┐
│              Conflict Resolution Strategy                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: Optimistic Locking (Version Numbers)          │
│  ├─ Detect conflicts at record level                    │
│  └─ All critical tables have version column             │
│                                                          │
│  Layer 2: Field-Level Timestamps                        │
│  ├─ Merge non-conflicting field updates                 │
│  └─ Equipment sensors, work order fields                │
│                                                          │
│  Layer 3: Automatic Resolution Rules                    │
│  ├─ Last-Write-Wins for non-critical data               │
│  ├─ Max value for sensor readings (safety)              │
│  └─ Append for notes/comments                           │
│                                                          │
│  Layer 4: Manual Resolution                             │
│  ├─ Present conflicts to user                           │
│  ├─ For critical settings and thresholds                │
│  └─ Maintain full audit trail                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Plan

### Phase 1: Database Schema Enhancement

#### Add Version Tracking
```sql
-- Equipment table
ALTER TABLE equipment ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE equipment ADD COLUMN last_modified_at TIMESTAMP DEFAULT NOW();
ALTER TABLE equipment ADD COLUMN last_modified_by VARCHAR(255);

-- Work Orders table
ALTER TABLE work_orders ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE work_orders ADD COLUMN last_modified_at TIMESTAMP DEFAULT NOW();
ALTER TABLE work_orders ADD COLUMN last_modified_by VARCHAR(255);

-- Sensors Configuration table
ALTER TABLE sensor_configs ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE sensor_configs ADD COLUMN last_modified_at TIMESTAMP DEFAULT NOW();
ALTER TABLE sensor_configs ADD COLUMN last_modified_by VARCHAR(255);
```

#### Create Conflict Log Table
```sql
CREATE TABLE sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  field_name VARCHAR(255),
  local_value TEXT,
  local_version INTEGER,
  local_timestamp TIMESTAMP,
  local_user VARCHAR(255),
  server_value TEXT,
  server_version INTEGER,
  server_timestamp TIMESTAMP,
  server_user VARCHAR(255),
  resolution_strategy VARCHAR(50), -- 'manual', 'lww', 'max', 'merge'
  resolved BOOLEAN DEFAULT FALSE,
  resolved_value TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Create Audit Trail Table
```sql
CREATE TABLE change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  field_name VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  changed_by VARCHAR(255),
  changed_at TIMESTAMP DEFAULT NOW(),
  device_id VARCHAR(255),
  sync_source VARCHAR(50), -- 'online', 'offline_sync'
  conflict_id UUID REFERENCES sync_conflicts(id)
);
```

---

### Phase 2: Conflict Detection Logic

#### API Endpoint: `/api/sync/check-conflicts`
```typescript
// Check for conflicts before applying changes
POST /api/sync/check-conflicts
{
  "changes": [
    {
      "table": "equipment",
      "id": "123",
      "version": 5,
      "fields": {
        "oilPressure": 50,
        "lastModifiedAt": "2025-10-10T10:30:00Z",
        "lastModifiedBy": "captain"
      }
    }
  ]
}

// Response if conflict detected
{
  "conflicts": [
    {
      "table": "equipment",
      "id": "123",
      "conflictingFields": ["oilPressure"],
      "localVersion": 5,
      "serverVersion": 6,
      "localValue": 50,
      "serverValue": 48,
      "serverModifiedAt": "2025-10-10T10:45:00Z",
      "serverModifiedBy": "engineer"
    }
  ]
}
```

---

### Phase 3: Automatic Resolution Rules

#### Resolution Strategy Matrix

| Data Type | Conflict Type | Strategy | Reason |
|-----------|---------------|----------|--------|
| Equipment name | Same field edit | **Manual** | Critical identifier |
| Oil pressure threshold | Same field edit | **Manual** | Safety critical |
| Sensor reading (current) | Same field edit | **Max value** | Safety (higher pressure = alert) |
| Temperature threshold | Same field edit | **Manual** | Safety critical |
| Work order notes | Same field edit | **Append both** | Preserve all info |
| Work order status | Same field edit | **Most progressed** | In Progress > Scheduled |
| UI preferences | Same field edit | **LWW** | Non-critical |
| Equipment location | Same field edit | **LWW** | Likely sequential moves |
| Telemetry data | New records | **Merge all** | No conflict (different timestamps) |

#### Implementation Example
```typescript
function autoResolveConflict(conflict: Conflict): Resolution {
  const { tableName, fieldName, localValue, serverValue } = conflict;
  
  // Safety-critical fields: Manual resolution
  if (isSafetyCritical(tableName, fieldName)) {
    return { strategy: 'manual', requiresUserInput: true };
  }
  
  // Sensor readings: Use max value (safety)
  if (tableName === 'equipment' && fieldName.includes('Pressure')) {
    const maxValue = Math.max(localValue, serverValue);
    return { strategy: 'max', resolvedValue: maxValue };
  }
  
  // Notes/Comments: Append both
  if (fieldName.includes('notes') || fieldName.includes('comment')) {
    const merged = `${serverValue}\n---\n${localValue}`;
    return { strategy: 'append', resolvedValue: merged };
  }
  
  // Work order status: Most progressed
  if (tableName === 'work_orders' && fieldName === 'status') {
    const statusPriority = { 'completed': 3, 'in_progress': 2, 'scheduled': 1 };
    const winner = statusPriority[localValue] > statusPriority[serverValue] 
      ? localValue : serverValue;
    return { strategy: 'priority', resolvedValue: winner };
  }
  
  // Default: Last-Write-Wins
  const winner = conflict.localTimestamp > conflict.serverTimestamp 
    ? localValue : serverValue;
  return { strategy: 'lww', resolvedValue: winner };
}
```

---

### Phase 4: Manual Conflict Resolution UI

#### Conflict Resolution Modal
```typescript
// Component: ConflictResolutionDialog.tsx
interface ConflictDialogProps {
  conflicts: Conflict[];
  onResolve: (resolutions: Resolution[]) => void;
}

function ConflictResolutionDialog({ conflicts, onResolve }: ConflictDialogProps) {
  return (
    <Dialog open={conflicts.length > 0}>
      <DialogHeader>
        <AlertTriangle className="text-yellow-500" />
        <DialogTitle>
          Sync Conflict Detected
        </DialogTitle>
        <DialogDescription>
          Multiple devices modified the same data while offline. 
          Please choose which changes to keep.
        </DialogDescription>
      </DialogHeader>
      
      {conflicts.map(conflict => (
        <ConflictCard key={conflict.id}>
          <h3>{conflict.tableName} - {conflict.fieldName}</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4>Your Change</h4>
              <p>{conflict.localValue}</p>
              <small>
                by {conflict.localUser} at {conflict.localTimestamp}
              </small>
              <Button onClick={() => resolveWith('local')}>
                Keep Your Change
              </Button>
            </div>
            
            <div>
              <h4>Other Change</h4>
              <p>{conflict.serverValue}</p>
              <small>
                by {conflict.serverUser} at {conflict.serverTimestamp}
              </small>
              <Button onClick={() => resolveWith('server')}>
                Keep Other Change
              </Button>
            </div>
          </div>
          
          <div>
            <h4>Custom Resolution</h4>
            <Input 
              placeholder="Enter custom value" 
              onChange={(e) => resolveWith('custom', e.target.value)}
            />
          </div>
        </ConflictCard>
      ))}
      
      <DialogFooter>
        <Button onClick={() => onResolve(resolutions)}>
          Apply Resolution
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
```

---

### Phase 5: Service Worker Integration

#### Background Sync with Conflict Detection
```javascript
// public/service-worker.js - Enhanced sync
self.addEventListener('sync', async (event) => {
  if (event.tag === 'sync-offline-changes') {
    event.waitUntil(syncWithConflictDetection());
  }
});

async function syncWithConflictDetection() {
  try {
    // 1. Get pending changes from IndexedDB
    const pendingChanges = await getPendingChanges();
    
    // 2. Check for conflicts with server
    const conflictCheck = await fetch('/api/sync/check-conflicts', {
      method: 'POST',
      body: JSON.stringify({ changes: pendingChanges })
    });
    
    const { conflicts, safeChanges } = await conflictCheck.json();
    
    // 3. Apply safe changes automatically
    if (safeChanges.length > 0) {
      await fetch('/api/sync/apply', {
        method: 'POST',
        body: JSON.stringify({ changes: safeChanges })
      });
    }
    
    // 4. Store conflicts for user resolution
    if (conflicts.length > 0) {
      await storeConflictsForResolution(conflicts);
      
      // Notify user
      await self.registration.showNotification('Sync Conflict', {
        body: `${conflicts.length} conflict(s) need your attention`,
        icon: '/icon-192x192.png',
        tag: 'sync-conflict',
        requireInteraction: true
      });
    }
    
    console.log('[SW] Sync completed:', {
      applied: safeChanges.length,
      conflicts: conflicts.length
    });
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    throw error; // Retry sync
  }
}
```

---

## 📊 Monitoring & Reporting

### Conflict Analytics Dashboard

Track conflict metrics:
- **Conflict rate**: Conflicts per sync operation
- **Resolution time**: How long conflicts take to resolve
- **Auto-resolution success**: % of conflicts resolved automatically
- **Common conflict types**: Most frequent conflicting fields
- **User resolution patterns**: Which options users choose

### Alerts for Critical Conflicts
```
🚨 CRITICAL CONFLICT DETECTED
Equipment: Main Engine #1
Field: Max Temperature Threshold
Your Value: 220°F (Engineer A, 10:30 AM)
Other Value: 200°F (Engineer B, 10:45 AM)

Action Required: Manual resolution needed for safety-critical setting
```

---

## 🔒 Security Considerations

### Conflict Resolution Permissions
- Only authorized users can resolve conflicts
- Safety-critical fields require higher permissions
- All resolutions logged in audit trail
- Tamper-proof conflict records

### Data Integrity
- Version numbers prevent race conditions
- Transactions ensure atomic updates
- Rollback capability for bad resolutions
- Checksums verify data consistency

---

## 📚 Best Practices for Maritime Operations

### 1. **Minimize Offline Edits**
- Encourage online work when possible
- Batch offline changes to reduce conflicts
- Use real-time collaboration when in port

### 2. **Clear Ownership**
- Assign equipment to specific crew members
- Reduce overlapping responsibilities
- Use locking mechanism for critical edits

### 3. **Training**
- Train crew on conflict resolution
- Emphasize importance of timestamps
- Document standard resolution procedures

### 4. **Regular Sync Schedule**
- Sync devices every 4-6 hours at sea
- Immediate sync when reaching port
- Automated sync during satellite windows

### 5. **Conflict Prevention**
- Read-only access for non-critical users
- Reserved fields for specific roles
- Clear data ownership policies

---

## ✅ Summary

### Current State (Phase 0)
- ✅ Offline caching (read-only)
- 🚧 Background sync (scaffolded, not implemented)

### Recommended Implementation

**Phase 1: Foundation** (1-2 weeks)
- Add version tracking to database
- Create conflict log tables
- Implement basic conflict detection

**Phase 2: Auto-Resolution** (2-3 weeks)
- Implement resolution strategies
- Build conflict detection API
- Add service worker sync logic

**Phase 3: Manual Resolution** (2-3 weeks)
- Build conflict resolution UI
- Implement user resolution flow
- Add notification system

**Phase 4: Monitoring** (1-2 weeks)
- Conflict analytics dashboard
- Alert system
- Audit trail reporting

### Key Decisions Needed
1. Which tables need version tracking?
2. Which fields are safety-critical (require manual resolution)?
3. What automatic resolution rules to apply?
4. Conflict resolution timeout (how long before forcing decision)?

---

*This strategy ensures data integrity while supporting offline operations in maritime environments.*

**Next Steps:**
1. Review and approve conflict resolution strategy
2. Prioritize which tables to implement first
3. Begin Phase 1: Database schema enhancement
4. Create conflict resolution UI mockups

---

*Last Updated: October 2025*  
*ARUS Marine Predictive Maintenance System*
