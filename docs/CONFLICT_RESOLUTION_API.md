# Conflict Resolution API Documentation

## Overview

The Conflict Resolution API provides endpoints for detecting and resolving data conflicts when multiple devices sync offline changes to the server. The system uses a 3-layer hybrid strategy:

1. **Optimistic Locking** - Version-based conflict detection
2. **Field-Level Tracking** - Granular conflict identification
3. **Safety-First Rules** - Automatic vs. manual resolution strategies

## API Endpoints

### 1. Check for Conflicts

**Endpoint:** `POST /api/sync/check-conflicts`

**Description:** Detects conflicts between local changes and server state before applying updates.

**Request Body:**
```json
{
  "table": "sensor_configurations",
  "recordId": "uuid-here",
  "data": {
    "critLo": 50,
    "critHi": 100,
    "warnLo": 60,
    "warnHi": 90
  },
  "version": 1,
  "timestamp": "2025-10-10T16:00:00Z",
  "user": "john@example.com",
  "device": "tablet-001",
  "orgId": "default-org-id"
}
```

**Response (No Conflict):**
```json
{
  "hasConflict": false,
  "conflicts": [],
  "canAutoResolve": true,
  "requiresManualResolution": false
}
```

**Response (Conflict Detected):**
```json
{
  "hasConflict": true,
  "conflicts": [
    {
      "table": "sensor_configurations",
      "recordId": "uuid-here",
      "field": "critLo",
      "localValue": 50,
      "localVersion": 1,
      "localTimestamp": "2025-10-10T16:00:00Z",
      "serverValue": 45,
      "serverVersion": 2,
      "serverTimestamp": "2025-10-10T15:30:00Z",
      "isSafetyCritical": true,
      "strategy": "manual",
      "reason": "Critical low threshold - safety impact"
    }
  ],
  "canAutoResolve": false,
  "requiresManualResolution": true
}
```

---

### 2. Get Pending Conflicts

**Endpoint:** `GET /api/sync/pending-conflicts`

**Description:** Retrieves all unresolved conflicts for an organization.

**Headers:**
```
x-org-id: default-org-id
```

**Response:**
```json
{
  "conflicts": [
    {
      "id": "conflict-uuid",
      "orgId": "default-org-id",
      "tableName": "sensor_configurations",
      "recordId": "sensor-uuid",
      "fieldName": "critLo",
      "localValue": "50",
      "localVersion": 1,
      "localTimestamp": "2025-10-10T16:00:00Z",
      "localUser": "john@example.com",
      "localDevice": "tablet-001",
      "serverValue": "45",
      "serverVersion": 2,
      "serverTimestamp": "2025-10-10T15:30:00Z",
      "serverUser": "jane@example.com",
      "serverDevice": "desktop-002",
      "resolutionStrategy": "manual",
      "resolved": false,
      "isSafetyCritical": true,
      "createdAt": "2025-10-10T16:05:00Z"
    }
  ]
}
```

---

### 3. Manually Resolve Conflict

**Endpoint:** `POST /api/sync/resolve-conflict`

**Description:** Manually resolve a conflict with a chosen value.

**Request Body:**
```json
{
  "conflictId": "conflict-uuid",
  "resolvedValue": 48,
  "resolvedBy": "supervisor@example.com",
  "resolutionNotes": "Chose value based on manufacturer specs"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Conflict resolved successfully"
}
```

---

### 4. Auto-Resolve Conflicts

**Endpoint:** `POST /api/sync/auto-resolve`

**Description:** Automatically resolve non-safety-critical conflicts using predefined strategies.

**Request Body:**
```json
{
  "conflicts": [
    {
      "table": "work_orders",
      "recordId": "wo-uuid",
      "field": "status",
      "localValue": "completed",
      "serverValue": "in_progress",
      "suggestedResolution": "completed"
    }
  ],
  "user": "john@example.com",
  "device": "tablet-001",
  "orgId": "default-org-id"
}
```

**Response:**
```json
{
  "ok": true,
  "resolvedData": {
    "status": "completed",
    "priority": "high"
  },
  "resolvedCount": 2
}
```

---

## Resolution Strategies

### Safety-Critical Fields (Manual Resolution Required)

| Table | Field | Strategy | Reason |
|-------|-------|----------|--------|
| sensor_configurations | critLo, critHi | manual | Critical thresholds - safety impact |
| sensor_configurations | warnLo, warnHi | manual | Warning thresholds - safety impact |
| alert_configurations | warningThreshold | manual | Alert threshold - safety impact |
| alert_configurations | criticalThreshold | manual | Critical alert - safety impact |
| operating_parameters | criticalMin, criticalMax | manual | Critical operating limits |
| operating_parameters | optimalMin, optimalMax | manual | Optimal operating limits |
| equipment | isActive | manual | Equipment active status - operational safety |
| dtc_faults | active | manual | Fault active status - safety monitoring |

### Automatic Resolution Strategies

| Strategy | Description | Example Use Case |
|----------|-------------|------------------|
| **max** | Use maximum value | Sensor readings, priority levels |
| **min** | Use minimum value | Conservative threshold adjustments |
| **append** | Concatenate values | Notes, comments, descriptions |
| **lww** | Last Write Wins | Labels, non-critical metadata |
| **priority** | Most progressed status | Work order status, crew assignment status |
| **or** | Logical OR | Boolean flags (isActive) |
| **server** | Always prefer server | Reserved for specific cases |

---

## Work Order Status Priority

When using the `priority` strategy for work order status:

```
pending (1) → scheduled (2) → in_progress (3) → paused (4) → completed (5) → cancelled (6)
```

**Higher number = more progressed = wins in conflict**

---

## Crew Assignment Status Priority

```
scheduled (1) → completed (2) → cancelled (3)
```

---

## Integration Guide

### Client-Side Workflow

1. **Before Syncing:**
   ```javascript
   // Check for conflicts first
   const conflictCheck = await fetch('/api/sync/check-conflicts', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       table: 'sensor_configurations',
       recordId: sensorId,
       data: localChanges,
       version: localVersion,
       timestamp: new Date().toISOString(),
       user: currentUser.email,
       device: deviceId,
       orgId: orgId
     })
   });
   
   const result = await conflictCheck.json();
   ```

2. **Handle Conflict Response:**
   ```javascript
   if (!result.hasConflict) {
     // Safe to apply changes
     await applyChanges(localChanges);
   } else if (result.canAutoResolve) {
     // Auto-resolve non-critical conflicts
     await fetch('/api/sync/auto-resolve', {
       method: 'POST',
       body: JSON.stringify({
         conflicts: result.conflicts,
         user: currentUser.email,
         device: deviceId,
         orgId: orgId
       })
     });
   } else {
     // Show conflict resolution UI for manual resolution
     showConflictResolutionModal(result.conflicts);
   }
   ```

3. **Manual Resolution:**
   ```javascript
   async function resolveConflict(conflictId, chosenValue) {
     await fetch('/api/sync/resolve-conflict', {
       method: 'POST',
       body: JSON.stringify({
         conflictId: conflictId,
         resolvedValue: chosenValue,
         resolvedBy: currentUser.email,
         resolutionNotes: 'User selected server value after review'
       })
     });
   }
   ```

4. **Monitor Pending Conflicts:**
   ```javascript
   // Periodic check for pending conflicts
   const response = await fetch('/api/sync/pending-conflicts', {
     headers: { 'x-org-id': orgId }
   });
   
   const { conflicts } = await response.json();
   
   if (conflicts.length > 0) {
     // Show notification to user
     showConflictAlert(`${conflicts.length} conflicts require attention`);
   }
   ```

---

## WebSocket Integration (Phase 4)

Future enhancement: Real-time conflict notifications

```javascript
// Subscribe to conflict events
ws.on('conflict:detected', (conflict) => {
  console.log('New conflict detected:', conflict);
  showConflictNotification(conflict);
});

ws.on('conflict:resolved', (conflictId) => {
  console.log('Conflict resolved:', conflictId);
  refreshData();
});
```

---

## Error Handling

### Error Response Format
```json
{
  "message": "Conflict detection failed",
  "error": "Unknown table: invalid_table_name"
}
```

### Common Errors

- **400 Bad Request**: Missing required fields
- **404 Not Found**: Record or conflict not found
- **500 Internal Server Error**: Database or service error

---

## Security Considerations

1. **Authentication**: All endpoints require valid user authentication
2. **Authorization**: Users can only access conflicts for their organization
3. **Audit Trail**: All conflict resolutions are logged in sync_conflicts table
4. **Rate Limiting**: 
   - Read operations: 100 requests/min
   - Write operations: 20 requests/min
   - Critical operations: 10 requests/min

---

## Database Schema

### sync_conflicts Table

```sql
CREATE TABLE sync_conflicts (
  id VARCHAR PRIMARY KEY,
  org_id VARCHAR NOT NULL,
  
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
  resolution_strategy VARCHAR(50),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_value TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP,
  
  -- Safety classification
  is_safety_critical BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Version-Tracked Tables

All safety-critical tables include:
- `version INTEGER DEFAULT 1`
- `last_modified_by VARCHAR(255)`
- `last_modified_device VARCHAR(255)`

**Tables with version tracking:**
1. sensor_configurations
2. alert_configurations
3. work_orders
4. operating_parameters
5. equipment
6. crew_assignment
7. dtc_faults

---

## Testing

### Manual Testing with curl

```bash
# Check for conflicts
curl -X POST http://localhost:5000/api/sync/check-conflicts \
  -H "Content-Type: application/json" \
  -d '{
    "table": "sensor_configurations",
    "recordId": "test-sensor-1",
    "data": {"critLo": 50},
    "version": 1,
    "timestamp": "2025-10-10T16:00:00Z",
    "user": "test@example.com",
    "device": "test-device",
    "orgId": "default-org-id"
  }'

# Get pending conflicts
curl http://localhost:5000/api/sync/pending-conflicts \
  -H "x-org-id: default-org-id"

# Resolve conflict
curl -X POST http://localhost:5000/api/sync/resolve-conflict \
  -H "Content-Type: application/json" \
  -d '{
    "conflictId": "uuid-here",
    "resolvedValue": 48,
    "resolvedBy": "supervisor@example.com"
  }'
```

---

## Next Steps (Phase 3-5)

1. **Phase 3: Conflict Resolution UI**
   - ConflictResolutionModal component
   - Conflict notification badges
   - Side-by-side comparison view
   - Manual resolution interface

2. **Phase 4: WebSocket Integration**
   - Real-time conflict notifications
   - Automatic UI updates
   - Multi-device sync alerts

3. **Phase 5: Testing & Monitoring**
   - Maritime scenario testing
   - Conflict analytics dashboard
   - Performance optimization

---

## Support

For issues or questions about the Conflict Resolution API, refer to:
- ARUS_CONFLICT_STRATEGY.md - Implementation strategy
- CONFLICT_RESOLUTION.md - General conflict resolution theory
- IMPLEMENTATION_SUMMARY.md - Phase 1 summary

---

*API Documentation - ARUS Marine Predictive Maintenance System*
*Last Updated: October 2025*
