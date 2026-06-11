# Sensor Management API

## Overview

The Sensor Management API provides comprehensive sensor configuration, bulk operations, and health monitoring capabilities for marine equipment. It enables efficient management of sensor configurations across equipment fleets with real-time health analytics.

**Base URL**: `/api/equipment/:equipmentId/sensors`

**Authentication**: All endpoints require `x-org-id` header for multi-tenant isolation.

---

## Endpoints

### 1. List Equipment Sensors

Retrieve all sensor configurations for specific equipment.

**Endpoint**: `GET /api/equipment/:equipmentId/sensors`

**Parameters**:

- `equipmentId` (path, required): Equipment UUID

**Response**: Array of sensor configurations

```json
[
  {
    "id": "sensor-uuid-1",
    "equipmentId": "equipment-uuid",
    "sensorType": "temperature",
    "sensorName": "Engine Oil Temperature",
    "normalMin": 70,
    "normalMax": 90,
    "warningMin": 60,
    "warningMax": 100,
    "criticalMin": 50,
    "criticalMax": 110,
    "unit": "celsius",
    "enabled": true,
    "createdAt": "2025-11-01T00:00:00Z"
  }
]
```

**Use Cases**:

- Equipment sensor configuration overview
- Sensor health monitoring dashboard data source
- Bulk operation target selection

---

### 2. Bulk Delete Sensors

Delete multiple sensor configurations in a single operation.

**Endpoint**: `DELETE /api/equipment/:equipmentId/sensors/bulk`

**Parameters**:

- `equipmentId` (path, required): Equipment UUID

**Request Body**:

```json
{
  "sensorIds": ["sensor-uuid-1", "sensor-uuid-2", "sensor-uuid-3"]
}
```

**Response**:

```json
{
  "success": true,
  "deleted": 3,
  "sensorIds": ["sensor-uuid-1", "sensor-uuid-2", "sensor-uuid-3"]
}
```

**Error Response** (if sensors not found):

```json
{
  "error": "One or more sensors not found",
  "code": "NOT_FOUND",
  "details": {
    "requestedCount": 3,
    "foundCount": 2,
    "missingSensorIds": ["sensor-uuid-3"]
  }
}
```

**Use Cases**:

- Decommissioning multiple sensors during equipment overhaul
- Removing duplicate or incorrect sensor configurations
- Bulk cleanup operations during system maintenance

**Safety Features**:

- Validates all sensor IDs before deletion
- Atomic operation (all or nothing)
- Returns detailed error on partial failures

---

### 3. Bulk Enable/Disable Sensors

Enable or disable multiple sensor configurations simultaneously.

**Endpoint**: `PATCH /api/equipment/:equipmentId/sensors/bulk`

**Parameters**:

- `equipmentId` (path, required): Equipment UUID

**Request Body**:

```json
{
  "sensorIds": ["sensor-uuid-1", "sensor-uuid-2"],
  "enabled": false
}
```

**Response**:

```json
{
  "success": true,
  "updated": 2,
  "sensorIds": ["sensor-uuid-1", "sensor-uuid-2"],
  "enabled": false
}
```

**Error Response** (if sensors not found):

```json
{
  "error": "One or more sensors not found",
  "code": "NOT_FOUND",
  "details": {
    "requestedCount": 2,
    "foundCount": 1,
    "missingSensorIds": ["sensor-uuid-2"]
  }
}
```

**Use Cases**:

- Temporarily disable sensors during equipment maintenance
- Enable sensors after installation or calibration
- Mass configuration changes during system testing
- Quick response to faulty sensor readings

**Safety Features**:

- Validates enabled field is boolean
- Validates all sensor IDs before update
- Atomic operation (all or nothing)

---

### 4. Sensor Health Metrics

Retrieve aggregated health metrics for all sensors on specific equipment.

**Endpoint**: `GET /api/equipment/:equipmentId/sensors/health`

**Parameters**:

- `equipmentId` (path, required): Equipment UUID

**Response**:

```json
{
  "totalSensors": 8,
  "activeSensors": 7,
  "normalSensors": 5,
  "warningSensors": 1,
  "criticalSensors": 1,
  "offlineSensors": 1,
  "overallHealthScore": 78,
  "dataQualityScore": 95,
  "recentAnomalies": 2,
  "uptimePercentage": 87
}
```

**Health Score Calculation**:

```
overallHealthScore = (normalSensors × 100 + warningSensors × 70 +
                      criticalSensors × 30 + offlineSensors × 0) / totalSensors

Weights:
- Normal sensors: 100 (fully healthy)
- Warning sensors: 70 (degraded)
- Critical sensors: 30 (severely degraded)
- Offline sensors: 0 (not contributing)
```

**Status Aggregation Logic**:

The health endpoint uses intelligent aggregation to prevent "status fan-out" when multiple sensor configurations exist for the same sensor type:

1. **Group by Sensor Type**: Sensors are first grouped by `sensorType` (e.g., temperature, pressure, vibration)

2. **One Status Per Type**: For each unique sensor type:
   - If ANY enabled sensor of that type has telemetry → ONE sensor gets the actual status
   - Additional sensor configs of the same type → marked as "offline" (no individual data)
   - All disabled sensors of a type → all marked as "offline"

3. **Guarantees**:
   - `normalSensors + warningSensors + criticalSensors + offlineSensors === totalSensors`
   - No double-counting across duplicate sensor types
   - Conservative counting (assumes lack of data = offline)

**Example Scenario**:

```
Equipment has 3 temperature sensor configs:
- Temperature telemetry shows "critical" status
- Result:
  - totalSensors: 3
  - criticalSensors: 1 (one temperature sensor with telemetry)
  - offlineSensors: 2 (other 2 temperature configs lack individual data)
```

**Telemetry Window**: Uses last 24 hours of telemetry data for status determination.

**Use Cases**:

- Equipment health dashboard visualization
- Predictive maintenance trigger evaluation
- Fleet-wide sensor health trending
- Compliance reporting for sensor coverage

**Performance**:

- Cached with 5-minute TTL
- Efficient Map-based aggregation
- Single database query for telemetry lookups

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

**Common Error Codes**:

- `VALIDATION_ERROR` (400): Invalid request data
- `NOT_FOUND` (404): Equipment or sensors not found
- `FORBIDDEN` (403): Organization mismatch or access denied
- `CONFLICT` (409): Concurrent modification detected
- `INTERNAL_ERROR` (500): Server error

**Bulk Operation Errors**:
Bulk operations fail atomically if ANY sensor ID is invalid. This prevents partial state changes and ensures data consistency.

---

## Rate Limiting

- **Rate Limit**: 100 requests per minute per organization
- **Burst Limit**: 20 requests per second

Headers returned:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699564800
```

---

## Performance Considerations

**Caching**:

- Sensor lists: Real-time (no cache)
- Health metrics: 5-minute cache TTL
- Telemetry data: Rolling 24-hour window

**Batch Limits**:

- Bulk delete: Max 100 sensors per request
- Bulk enable/disable: Max 100 sensors per request

**Concurrency**:

- Bulk operations use mutation guards on frontend
- Backend validates ownership before all operations
- TanStack Query cache invalidation ensures UI consistency

---

## Examples

### Example 1: Disable Sensors During Maintenance

```bash
# Disable multiple sensors before equipment maintenance
curl -X PATCH \
  -H "x-org-id: my-org-id" \
  -H "Content-Type: application/json" \
  -d '{
    "sensorIds": ["sensor-1", "sensor-2", "sensor-3"],
    "enabled": false
  }' \
  https://api.arus.com/api/equipment/eq-123/sensors/bulk
```

### Example 2: Re-enable Sensors After Maintenance

```bash
# Re-enable sensors after maintenance completion
curl -X PATCH \
  -H "x-org-id: my-org-id" \
  -H "Content-Type: application/json" \
  -d '{
    "sensorIds": ["sensor-1", "sensor-2", "sensor-3"],
    "enabled": true
  }' \
  https://api.arus.com/api/equipment/eq-123/sensors/bulk
```

### Example 3: Remove Duplicate Sensor Configurations

```bash
# Delete duplicate or incorrect sensor configs
curl -X DELETE \
  -H "x-org-id: my-org-id" \
  -H "Content-Type: application/json" \
  -d '{
    "sensorIds": ["duplicate-sensor-1", "duplicate-sensor-2"]
  }' \
  https://api.arus.com/api/equipment/eq-123/sensors/bulk
```

### Example 4: Monitor Equipment Sensor Health

```bash
# Get real-time health metrics for equipment sensors
curl -X GET \
  -H "x-org-id: my-org-id" \
  https://api.arus.com/api/equipment/eq-123/sensors/health
```

### Example 5: Fleet-Wide Health Monitoring

```bash
# Script to monitor health across multiple equipment
for equipment_id in eq-1 eq-2 eq-3; do
  echo "Checking $equipment_id..."
  curl -s -H "x-org-id: my-org-id" \
    https://api.arus.com/api/equipment/$equipment_id/sensors/health \
    | jq '.healthScore'
done
```

---

## Integration Patterns

### Frontend Integration (React + TanStack Query)

```typescript
// Bulk delete sensors
const deleteMutation = useMutation({
  mutationFn: async (sensorIds: string[]) => {
    return apiRequest(`/api/equipment/${equipmentId}/sensors/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ sensorIds }),
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/equipment", equipmentId, "sensors"],
    });
    toast({ title: "Sensors deleted successfully" });
  },
});

// Fetch health metrics
const { data: healthMetrics } = useQuery({
  queryKey: ["/api/equipment", equipmentId, "sensors", "health"],
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Backend Integration (Express)

```typescript
// Register sensor management routes
app.delete("/api/equipment/:equipmentId/sensors/bulk", async (req, res) => {
  const { equipmentId } = req.params;
  const { sensorIds } = req.body;
  const orgId = req.headers["x-org-id"];

  // Validate ownership
  const sensors = await db.query.sensorConfigs.findMany({
    where: and(
      eq(sensorConfigs.equipmentId, equipmentId),
      inArray(sensorConfigs.id, sensorIds),
      eq(sensorConfigs.orgId, orgId)
    ),
  });

  if (sensors.length !== sensorIds.length) {
    return res.status(404).json({
      error: "One or more sensors not found",
    });
  }

  // Atomic delete
  await db.delete(sensorConfigs).where(inArray(sensorConfigs.id, sensorIds));

  res.json({ success: true, deleted: sensors.length });
});
```

---

## Schema Reference

### SensorConfig Table

```typescript
export const sensorConfigs = pgTable("sensor_configs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  equipmentId: varchar("equipment_id")
    .notNull()
    .references(() => equipment.id),
  sensorType: text("sensor_type").notNull(),
  sensorName: text("sensor_name"),
  normalMin: real("normal_min"),
  normalMax: real("normal_max"),
  warningMin: real("warning_min"),
  warningMax: real("warning_max"),
  criticalMin: real("critical_min"),
  criticalMax: real("critical_max"),
  unit: text("unit"),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### EquipmentTelemetry Table (Telemetry Source)

```typescript
export const equipmentTelemetry = pgTable("equipment_telemetry", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  ts: timestamp("ts").notNull().defaultNow(),
  equipmentId: varchar("equipment_id").notNull(),
  sensorType: text("sensor_type").notNull(), // Links to sensorConfig.sensorType
  value: real("value").notNull(),
  unit: text("unit"),
  threshold: real("threshold"),
  status: text("status").notNull().default("normal"), // normal, warning, critical
});
```

**Important**: Telemetry is tracked by `(equipmentId, sensorType)`, not individual sensor config IDs. This design choice enables efficient time-series queries but limits per-config status tracking when multiple configs share the same sensor type.

---

## Changelog

### Version 1.0.0 (2025-11-11)

- Initial release with 4 core endpoints
- Bulk sensor delete operations
- Bulk sensor enable/disable operations
- Real-time sensor health metrics with intelligent aggregation
- Map-based status aggregation to prevent fan-out
- Weighted health score calculation
- 24-hour telemetry window for status determination

---

## Support

For API issues or feature requests:

- GitHub Issues: https://github.com/your-org/arus/issues
- Email: api-support@arus.com
- Documentation: https://docs.arus.com/api/sensor-management
