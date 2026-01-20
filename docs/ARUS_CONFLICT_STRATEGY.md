# 🚢 ARUS Marine Conflict Resolution - Implementation Plan

## 📊 System Analysis

### Critical Safety Tables Identified:
1. **sensor_configurations** - Safety thresholds (critLo, critHi, warnLo, warnHi)
2. **alert_configurations** - Warning/critical thresholds  
3. **operating_parameters** - Critical operating limits
4. **work_orders** - Maintenance priority, status
5. **equipment** - isActive status
6. **crew_assignment** - Manning and duty assignments
7. **dtc_faults** - Diagnostic fault severity

### Existing Strengths:
✅ `syncJournal` table - Audit trail infrastructure
✅ `syncOutbox` table - Event publishing system
✅ WebSocket real-time sync
✅ Timestamps on all tables (createdAt, updatedAt)

---

## 🎯 Optimal Strategy for ARUS Marine

### **Hybrid 3-Layer Approach**

```
┌─────────────────────────────────────────────────────────┐
│           ARUS Marine Conflict Resolution                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: Optimistic Locking (Version Numbers)          │
│  ├─ Add version column to 7 critical tables             │
│  ├─ Increment on every update                           │
│  └─ Detect conflicts via version mismatch               │
│                                                          │
│  Layer 2: Field-Level Change Tracking                   │
│  ├─ Enhance syncJournal with field metadata             │
│  ├─ Track: field, oldValue, newValue, user, device      │
│  └─ Enable field-level conflict detection               │
│                                                          │
│  Layer 3: Safety-First Auto Resolution                  │
│  ├─ Safety thresholds → MANUAL resolution               │
│  ├─ Sensor readings → MAX value (conservative)          │
│  ├─ Work order status → Most progressed                 │
│  ├─ Notes/comments → APPEND both                        │
│  └─ WebSocket alerts for conflicts                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📐 Database Schema Changes

### 1. Add Version Tracking to Critical Tables

```sql
-- sensor_configurations
ALTER TABLE sensor_configurations 
  ADD COLUMN version INTEGER DEFAULT 1,
  ADD COLUMN last_modified_by VARCHAR(255),
  ADD COLUMN last_modified_device VARCHAR(255);

-- alert_configurations  
ALTER TABLE alert_configurations
  ADD COLUMN version INTEGER DEFAULT 1,
  ADD COLUMN last_modified_by VARCHAR(255),
  ADD COLUMN last_modified_device VARCHAR(255);

-- operating_parameters
ALTER TABLE operating_parameters
  ADD COLUMN version INTEGER DEFAULT 1,
  ADD COLUMN last_modified_by VARCHAR(255),
  ADD COLUMN last_modified_device VARCHAR(255);

-- work_orders (already has updatedAt)
ALTER TABLE work_orders
  ADD COLUMN version INTEGER DEFAULT 1,
  ADD COLUMN last_modified_by VARCHAR(255),
  ADD COLUMN last_modified_device VARCHAR(255);

-- equipment
ALTER TABLE equipment
  ADD COLUMN version INTEGER DEFAULT 1,
  ADD COLUMN last_modified_by VARCHAR(255),
  ADD COLUMN last_modified_device VARCHAR(255);

-- crew_assignment
ALTER TABLE crew_assignment
  ADD COLUMN version INTEGER DEFAULT 1,
  ADD COLUMN last_modified_by VARCHAR(255),
  ADD COLUMN last_modified_device VARCHAR(255);

-- dtc_faults
ALTER TABLE dtc_faults
  ADD COLUMN version INTEGER DEFAULT 1,
  ADD COLUMN last_modified_by VARCHAR(255),
  ADD COLUMN last_modified_device VARCHAR(255);
```

### 2. Create Conflict Tracking Table

```sql
CREATE TABLE sync_conflicts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id),
  
  -- Conflict identification
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  field_name VARCHAR(255),
  
  -- Local (device) values
  local_value TEXT,
  local_version INTEGER,
  local_timestamp TIMESTAMP,
  local_user VARCHAR(255),
  local_device VARCHAR(255),
  
  -- Server values
  server_value TEXT,
  server_version INTEGER,
  server_timestamp TIMESTAMP,
  server_user VARCHAR(255),
  server_device VARCHAR(255),
  
  -- Resolution
  resolution_strategy VARCHAR(50), -- 'manual', 'max', 'append', 'lww', 'priority'
  resolved BOOLEAN DEFAULT FALSE,
  resolved_value TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP,
  
  -- Safety classification
  is_safety_critical BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_conflicts_unresolved 
  ON sync_conflicts(org_id, resolved) WHERE resolved = FALSE;
```

### 3. Enhance syncJournal for Field-Level Tracking

```sql
-- Add field-level metadata to existing syncJournal
ALTER TABLE sync_journal
  ADD COLUMN field_name VARCHAR(255),
  ADD COLUMN old_value TEXT,
  ADD COLUMN new_value TEXT,
  ADD COLUMN device_id VARCHAR(255),
  ADD COLUMN version_before INTEGER,
  ADD COLUMN version_after INTEGER;

CREATE INDEX idx_sync_journal_field_changes 
  ON sync_journal(entity_type, entity_id, field_name, created_at);
```

---

## 🔧 Conflict Detection Logic

### Safety-First Resolution Matrix

| Table | Field | Conflict Strategy | Reason |
|-------|-------|------------------|--------|
| **sensor_configurations** | critLo, critHi | **MANUAL** | Safety-critical thresholds |
| **sensor_configurations** | warnLo, warnHi | **MANUAL** | Safety warning levels |
| **alert_configurations** | warningThreshold | **MANUAL** | Alert system integrity |
| **alert_configurations** | criticalThreshold | **MANUAL** | Safety-critical alerts |
| **operating_parameters** | criticalMin, criticalMax | **MANUAL** | Equipment safety limits |
| **work_orders** | status | **PRIORITY** | Most progressed wins |
| **work_orders** | priority | **MAX** | Higher priority wins |
| **work_orders** | description | **APPEND** | Preserve all info |
| **equipment** | isActive | **MANUAL** | Operational safety |
| **crew_assignment** | All fields | **MANUAL** | Manning safety |
| **dtc_faults** | severity | **MAX** | Higher severity wins |
| **dtc_faults** | active | **OR** | If either says active, it's active |

### Implementation Example

```typescript
interface ConflictResolutionRule {
  table: string;
  field: string;
  strategy: 'manual' | 'max' | 'append' | 'lww' | 'priority' | 'or';
  isSafetyCritical: boolean;
}

const RESOLUTION_RULES: ConflictResolutionRule[] = [
  // Safety-critical thresholds - ALWAYS manual
  { table: 'sensor_configurations', field: 'critLo', strategy: 'manual', isSafetyCritical: true },
  { table: 'sensor_configurations', field: 'critHi', strategy: 'manual', isSafetyCritical: true },
  { table: 'sensor_configurations', field: 'warnLo', strategy: 'manual', isSafetyCritical: true },
  { table: 'sensor_configurations', field: 'warnHi', strategy: 'manual', isSafetyCritical: true },
  { table: 'alert_configurations', field: 'warningThreshold', strategy: 'manual', isSafetyCritical: true },
  { table: 'alert_configurations', field: 'criticalThreshold', strategy: 'manual', isSafetyCritical: true },
  { table: 'operating_parameters', field: 'criticalMin', strategy: 'manual', isSafetyCritical: true },
  { table: 'operating_parameters', field: 'criticalMax', strategy: 'manual', isSafetyCritical: true },
  
  // Work orders - priority based
  { table: 'work_orders', field: 'status', strategy: 'priority', isSafetyCritical: false },
  { table: 'work_orders', field: 'priority', strategy: 'max', isSafetyCritical: false },
  { table: 'work_orders', field: 'description', strategy: 'append', isSafetyCritical: false },
  
  // Equipment status - manual (safety)
  { table: 'equipment', field: 'isActive', strategy: 'manual', isSafetyCritical: true },
  
  // DTC faults - safety priority
  { table: 'dtc_faults', field: 'severity', strategy: 'max', isSafetyCritical: true },
  { table: 'dtc_faults', field: 'active', strategy: 'or', isSafetyCritical: true },
  
  // Crew assignments - manual (safety)
  { table: 'crew_assignment', field: '*', strategy: 'manual', isSafetyCritical: true },
];

function getResolutionStrategy(table: string, field: string): ConflictResolutionRule {
  const rule = RESOLUTION_RULES.find(r => 
    r.table === table && (r.field === field || r.field === '*')
  );
  
  // Default: safety-critical fields require manual resolution
  return rule || { 
    table, 
    field, 
    strategy: 'manual', 
    isSafetyCritical: true 
  };
}
```

---

## 🔄 API Endpoints

### 1. Check for Conflicts
```typescript
POST /api/sync/check-conflicts
{
  "changes": [
    {
      "table": "sensor_configurations",
      "id": "sensor-123",
      "version": 5,
      "fields": {
        "critHi": 220,
        "warnHi": 200
      },
      "user": "captain",
      "device": "iPad-bridge"
    }
  ]
}

Response:
{
  "conflicts": [
    {
      "id": "conflict-uuid",
      "table": "sensor_configurations",
      "recordId": "sensor-123",
      "field": "critHi",
      "localValue": 220,
      "localVersion": 5,
      "serverValue": 200,
      "serverVersion": 6,
      "strategy": "manual",
      "isSafetyCritical": true,
      "serverUser": "engineer",
      "serverDevice": "Phone-engine-room"
    }
  ],
  "safeChanges": [
    {
      "table": "work_orders",
      "id": "wo-456",
      "fields": { "description": "Added notes" }
    }
  ]
}
```

### 2. Resolve Conflict
```typescript
POST /api/sync/resolve-conflict
{
  "conflictId": "conflict-uuid",
  "resolution": "local", // or "server" or custom value
  "resolvedBy": "captain",
  "comment": "Used higher threshold for safety"
}
```

### 3. Get Pending Conflicts
```typescript
GET /api/sync/pending-conflicts?orgId=xxx

Response:
{
  "conflicts": [
    {
      "id": "conflict-uuid",
      "table": "sensor_configurations",
      "field": "critHi",
      "isSafetyCritical": true,
      "requiresImmediate": true,
      "createdAt": "2025-10-10T15:30:00Z"
    }
  ],
  "total": 5,
  "critical": 2
}
```

---

## 🎨 UI Component

### Conflict Resolution Modal

```typescript
// Components: ConflictResolutionModal.tsx
interface ConflictModalProps {
  conflicts: SyncConflict[];
  onResolve: (resolutions: Resolution[]) => void;
}

function ConflictResolutionModal({ conflicts, onResolve }: ConflictModalProps) {
  const criticalConflicts = conflicts.filter(c => c.isSafetyCritical);
  
  return (
    <Dialog open={conflicts.length > 0}>
      <DialogHeader className="border-b border-red-200 bg-red-50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <div>
            <DialogTitle className="text-red-900">
              Sync Conflict Detected - Action Required
            </DialogTitle>
            <DialogDescription className="text-red-700">
              {criticalConflicts.length} safety-critical conflicts require manual resolution
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      
      <div className="max-h-[600px] overflow-y-auto p-6 space-y-6">
        {conflicts.map(conflict => (
          <ConflictCard 
            key={conflict.id} 
            conflict={conflict}
            onResolve={(resolution) => handleResolve(conflict.id, resolution)}
          />
        ))}
      </div>
      
      <DialogFooter className="border-t bg-gray-50">
        <Button variant="outline" onClick={onCancel}>
          Cancel Sync
        </Button>
        <Button onClick={() => onResolve(resolutions)}>
          Apply Resolutions ({resolutions.length})
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function ConflictCard({ conflict, onResolve }: ConflictCardProps) {
  const isCritical = conflict.isSafetyCritical;
  
  return (
    <Card className={isCritical ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isCritical && <AlertCircle className="h-5 w-5 text-red-600" />}
          {conflict.table} - {conflict.field}
          {isCritical && (
            <Badge variant="destructive">Safety Critical</Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Your Change */}
          <div className="border rounded p-4 bg-white">
            <h4 className="font-medium mb-2">Your Change</h4>
            <div className="text-2xl font-bold">{conflict.localValue}</div>
            <div className="text-sm text-gray-600 mt-2">
              by {conflict.localUser} • {conflict.localDevice}
            </div>
            <div className="text-xs text-gray-500">
              {formatDistanceToNow(conflict.localTimestamp, { addSuffix: true })}
            </div>
            <Button 
              onClick={() => onResolve('local')}
              className="mt-3 w-full"
              variant={isCritical ? "default" : "outline"}
            >
              Keep Your Change
            </Button>
          </div>
          
          {/* Server Change */}
          <div className="border rounded p-4 bg-white">
            <h4 className="font-medium mb-2">Other Change</h4>
            <div className="text-2xl font-bold">{conflict.serverValue}</div>
            <div className="text-sm text-gray-600 mt-2">
              by {conflict.serverUser} • {conflict.serverDevice}
            </div>
            <div className="text-xs text-gray-500">
              {formatDistanceToNow(conflict.serverTimestamp, { addSuffix: true })}
            </div>
            <Button 
              onClick={() => onResolve('server')}
              className="mt-3 w-full"
              variant="outline"
            >
              Keep Other Change
            </Button>
          </div>
        </div>
        
        {/* Custom Resolution */}
        {isCritical && (
          <div className="border-t pt-4">
            <Label htmlFor={`custom-${conflict.id}`}>
              Enter Custom Value (Safety Review Required)
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                id={`custom-${conflict.id}`}
                type="number"
                placeholder="Enter custom value"
                onChange={(e) => setCustomValue(e.target.value)}
              />
              <Button 
                onClick={() => onResolve('custom', customValue)}
                disabled={!customValue}
              >
                Use Custom
              </Button>
            </div>
          </div>
        )}
        
        {/* Conflict History */}
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-600">
            View Change History
          </summary>
          <div className="mt-2 space-y-1 pl-4 border-l-2">
            {conflict.history?.map(h => (
              <div key={h.id} className="text-xs text-gray-600">
                {h.value} by {h.user} - {format(h.timestamp, 'PPpp')}
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
```

---

## 🔔 WebSocket Integration

### Real-Time Conflict Notifications

```typescript
// Server: Broadcast conflict detected
function broadcastConflict(conflict: SyncConflict) {
  const message = {
    type: 'SYNC_CONFLICT',
    payload: {
      conflictId: conflict.id,
      table: conflict.table,
      field: conflict.field,
      isSafetyCritical: conflict.isSafetyCritical,
      affectedUsers: [conflict.localUser, conflict.serverUser]
    }
  };
  
  // Broadcast to affected users
  wss.clients.forEach(client => {
    if (message.payload.affectedUsers.includes(client.userId)) {
      client.send(JSON.stringify(message));
    }
  });
}

// Client: Handle conflict notification
useEffect(() => {
  if (!ws) return;
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'SYNC_CONFLICT') {
      // Show toast notification
      toast({
        title: "Sync Conflict Detected",
        description: `Conflict in ${message.payload.table}.${message.payload.field}`,
        variant: message.payload.isSafetyCritical ? "destructive" : "warning",
        action: (
          <Button onClick={() => openConflictDialog(message.payload.conflictId)}>
            Resolve Now
          </Button>
        )
      });
      
      // Refresh pending conflicts
      queryClient.invalidateQueries(['pending-conflicts']);
    }
  };
}, [ws]);
```

---

## 📊 Implementation Phases

### Phase 1: Database Schema (Week 1)
- ✅ Add version columns to 7 critical tables
- ✅ Create sync_conflicts table
- ✅ Enhance syncJournal for field tracking
- ✅ Run migrations with `npm run db:push --force`

### Phase 2: Conflict Detection API (Week 2)
- ✅ Implement /api/sync/check-conflicts
- ✅ Build resolution rules engine
- ✅ Add conflict logging to syncJournal
- ✅ Create /api/sync/resolve-conflict endpoint

### Phase 3: UI Components (Week 3)
- ✅ Build ConflictResolutionModal
- ✅ Create ConflictCard component
- ✅ Add conflict badge to navigation
- ✅ Implement toast notifications

### Phase 4: WebSocket Integration (Week 4)
- ✅ Add conflict broadcasting
- ✅ Real-time UI updates
- ✅ Conflict resolution sync

### Phase 5: Testing & Monitoring (Week 5)
- ✅ Test maritime scenarios
- ✅ Conflict analytics dashboard
- ✅ Performance optimization

---

## ✅ Success Criteria

1. ✅ All safety-critical fields protected by manual resolution
2. ✅ Zero data loss during offline sync
3. ✅ Conflicts detected within 100ms
4. ✅ UI response time < 200ms
5. ✅ Complete audit trail maintained
6. ✅ WebSocket notifications < 500ms latency
7. ✅ 99.9% conflict resolution accuracy

---

*Ready to implement Phase 1: Database Schema*
