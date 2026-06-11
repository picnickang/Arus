# ARUS Marine Equipment Registry API Documentation

Minimal API reference for ARUS Marine Predictive Maintenance system. **This documentation only includes verified, production-ready endpoints.**

**Base URL**: `http://localhost:5000/api`

**Last Updated**: November 2025

---

## Authentication

All endpoints require organization identification. Telemetry ingestion endpoints additionally require HMAC authentication.

### Standard Authentication

**Required Headers**:

```http
x-org-id: <organization-uuid>
```

### Telemetry HMAC Authentication

**Applies to**:

- `POST /api/import/telemetry/json`
- `POST /api/import/telemetry/csv`
- `POST /api/telemetry/readings`
- `POST /api/edge/heartbeat`

**Required Headers**:

```http
x-org-id: <organization-uuid>
x-hmac-signature: <hex-encoded-hmac-sha256-signature>
```

**Alternative Authorization Header**:

```http
Authorization: HMAC <hex-encoded-hmac-sha256-signature>
```

**HMAC Signature Calculation**:

```javascript
const crypto = require("crypto");
const payload = JSON.stringify(requestBody);
const signature = crypto.createHmac("sha256", deviceHmacKey).update(payload).digest("hex");
```

**HMAC Requirements**:

- Each device must have an HMAC key configured
- Signature computed as `HMAC-SHA256(device.hmacKey, requestBodyString)`
- Can be globally disabled via `settings.hmacRequired = false`

**HMAC Error Responses**:

- `401 HMAC_KEY_MISSING`: `{ "error": "Device not found or HMAC key not configured", "code": "HMAC_KEY_MISSING" }`
- `401 MISSING_HMAC_SIGNATURE`: `{ "error": "HMAC signature required in X-HMAC-Signature header or Authorization header", "code": "MISSING_HMAC_SIGNATURE" }`
- `401 INVALID_HMAC_SIGNATURE`: `{ "error": "Invalid HMAC signature", "code": "INVALID_HMAC_SIGNATURE" }`
- `500 HMAC_VALIDATION_ERROR`: `{ "error": "HMAC validation failed", "code": "HMAC_VALIDATION_ERROR" }`

---

## Equipment Registry

### GET /api/equipment

List all equipment for organization.

**Response** (200 OK): Array of equipment objects with fields:

- `id` (string): Equipment UUID
- `orgId` (string): Organization ID (required)
- `vesselId` (string, nullable): FK to vessels table
- `vesselName` (string, nullable): Vessel name (backward compatibility)
- `name` (string): Equipment name (required)
- `type` (string): Equipment type - engine, pump, compressor, generator, etc. (required)
- `manufacturer` (string, nullable): Manufacturer name
- `model` (string, nullable): Model number
- `serialNumber` (string, nullable): Serial number
- `location` (string, nullable): Location - deck, engine room, bridge, etc.
- `isActive` (boolean, default: true): Active status
- `specifications` (JSONB, nullable): Technical specifications
- `operatingParameters` (JSONB, nullable): Normal operating ranges
- `maintenanceSchedule` (JSONB, nullable): Maintenance requirements
- `createdAt` (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp

**Example Response**:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "orgId": "org-123",
    "vesselId": "vessel-001",
    "vesselName": "MV Pacific Explorer",
    "name": "Main Engine #1",
    "type": "engine",
    "manufacturer": "Wartsila",
    "model": "RT-flex96C",
    "serialNumber": "WRT-2023-001",
    "location": "engine_room",
    "isActive": true,
    "specifications": { "power_kw": 80080, "cylinders": 14 },
    "operatingParameters": { "rpm_min": 22, "rpm_max": 102 },
    "maintenanceSchedule": { "interval_hours": 8000 },
    "createdAt": "2023-01-15T00:00:00.000Z",
    "updatedAt": "2024-11-01T00:00:00.000Z"
  }
]
```

**Error** (500): `{ "message": "Failed to fetch equipment registry" }`

---

### GET /api/equipment/:id

Get single equipment by ID.

**Path Parameters**:

- `id` (string): Equipment ID

**Response** (200 OK): Equipment object

**Error** (500): `{ "message": "Failed to fetch equipment" }`

---

### POST /api/equipment

Create new equipment.

**Request Body** (validated via `insertEquipmentSchema`):

```json
{
  "orgId": "org-123",
  "vesselId": "vessel-001",
  "vesselName": "MV Pacific Explorer",
  "name": "Main Engine #1",
  "type": "engine",
  "manufacturer": "Wartsila",
  "model": "RT-flex96C",
  "serialNumber": "WRT-2023-001",
  "location": "engine_room",
  "isActive": true,
  "specifications": { "power_kw": 80080 },
  "operatingParameters": { "rpm_min": 22, "rpm_max": 102 },
  "maintenanceSchedule": { "interval_hours": 8000 }
}
```

**Required Fields**:

- `orgId` (string): Organization ID
- `name` (string): Equipment name
- `type` (string): Equipment type

**Optional Fields**:

- `vesselId` (string, UUID): FK to vessels table
- `vesselName` (string): Vessel name (backward compatibility)
- `manufacturer`, `model`, `serialNumber`, `location` (string)
- `isActive` (boolean, default: true)
- `specifications`, `operatingParameters`, `maintenanceSchedule` (JSONB)

**Response** (201): Created equipment object

**Error** (400): `{ "message": "Invalid equipment data", "errors": [...] }`

---

### PUT /api/equipment/:id

Update equipment.

**Path Parameters**:

- `id` (string): Equipment ID

**Request Body**: Partial equipment data

**Response** (200): Updated equipment object

---

### DELETE /api/equipment/:id

Delete equipment.

**Path Parameters**:

- `id` (string): Equipment ID

**Response** (200): `{ "message": "Equipment deleted successfully" }`

---

### GET /api/equipment/health

Get equipment health status.

**Query Parameters**:

- `vesselId` (string, optional)
- `equipmentId` (string, optional)

**Response** (200 OK): Array of health objects with fields:

- `id`, `name`, `vessel`, `healthIndex`, `status`

**Health Classification**:

- `healthy`: healthIndex >= 75
- `warning`: 50 <= healthIndex < 75
- `critical`: healthIndex < 50

**Error** (500): `{ "message": "Failed to fetch equipment health", "error": "..." }`

---

### GET /api/equipment/:id/rul

Get RUL (Remaining Useful Life) prediction for equipment.

**Path Parameters**:

- `id` (string): Equipment ID

**Response** (200 OK): RulPrediction object with fields:

- `equipmentId` (string): Equipment ID
- `remainingDays` (number): Remaining useful life in days
- `confidenceScore` (number 0-1): Prediction confidence
- `healthIndex` (number 0-100): Current health score
- `degradationRate` (number): Health points degradation per day
- `failureProbability` (number 0-1): Probability of failure
- `riskLevel` (string): `low`, `medium`, `high`, or `critical`
- `componentStatus` (array): Health status per component
- `predictionMethod` (string): `ml_lstm`, `ml_rf`, `statistical`, or `hybrid`
- `recommendations` (string[]): Maintenance recommendations
- `operatingMode` (string, optional): Current operating mode
- `dataQuality` (number 0-1, optional): Data quality score
- `modeMultiplier` (number, optional): Mode-based adjustment factor
- `calibrated` (boolean, optional): Whether prediction is calibrated
- `repairCensored` (boolean, optional): Whether repair censoring applied

**Example Response**:

```json
{
  "equipmentId": "eq-123",
  "remainingDays": 365,
  "confidenceScore": 0.92,
  "healthIndex": 87.5,
  "degradationRate": 0.035,
  "failureProbability": 0.12,
  "riskLevel": "low",
  "componentStatus": [],
  "predictionMethod": "ml_lstm",
  "recommendations": ["Schedule inspection in 3 months"],
  "operatingMode": "TRANSIT",
  "dataQuality": 0.95,
  "calibrated": true
}
```

**Error** (404): `{ "message": "No RUL prediction available for this equipment", "hint": "Ensure equipment has degradation data or ML predictions" }`

**Error** (500): `{ "message": "Failed to calculate RUL prediction", "error": "..." }`

---

## Telemetry Ingestion

### POST /api/import/telemetry/json

Bulk import telemetry data in JSON format.

**Request Body**:

```json
{
  "rows": [
    {
      "ts": "2025-11-25T10:30:00.000Z",
      "vessel": "IMO-9876543",
      "src": "main-engine-1",
      "sig": "temperature",
      "value": 85.5,
      "unit": "°C"
    }
  ]
}
```

**Required Fields**:

- `ts`: ISO 8601 timestamp
- `vessel`: Vessel identifier
- `src`: Equipment source
- `sig`: Sensor signal type

**Optional Fields**:

- `value`: Numeric value (null allowed)
- `unit`: Unit of measurement

**Response** (200 OK):

```json
{
  "ok": true,
  "imported": 1,
  "processed": 1,
  "validRows": 1,
  "errors": [],
  "summary": {
    "successRate": "100.0%",
    "errorRate": "0.0%"
  },
  "importId": "json-import-1700913600000",
  "processingTime": "45ms",
  "message": "Successfully imported 1 of 1 telemetry records"
}
```

**Validation**:

- Timestamp tolerance: ±5 minutes (configurable)
- Finite number validation for values
- Non-empty string validation for vessel/src/sig

**Errors**:

- `400`: `{ "message": "JSON payload validation error", "errors": [...], "code": "PAYLOAD_VALIDATION_ERROR", "importId": "...", "processingTime": "..." }`
- `500`: `{ "message": "Failed to import JSON telemetry data", "code": "IMPORT_FAILURE", "importId": "...", "processingTime": "..." }`

---

### POST /api/import/telemetry/csv

Bulk import telemetry data from CSV.

**Request Body**:

```json
{
  "csvData": "ts,vessel,src,sig,value,unit\n2025-11-25T10:30:00.000Z,IMO-9876543,main-engine-1,temperature,85.5,°C"
}
```

**CSV Requirements**:

- Required headers (case-insensitive): `ts`, `vessel`, `src`, `sig`
- Optional headers: `value`, `unit`
- RFC 4180 compliant
- Empty lines skipped

**Response** (200 OK):

```json
{
  "ok": true,
  "imported": 1,
  "processed": 1,
  "validRows": 1,
  "errors": [],
  "summary": {
    "successRate": "100.0%",
    "errorRate": "0.0%",
    "csvStats": {
      "totalLines": 2,
      "headerLine": 1,
      "dataLines": 1,
      "emptyLinesSkipped": 0
    }
  },
  "importId": "csv-import-1700913600000",
  "processingTime": "67ms",
  "message": "Successfully imported 1 of 1 telemetry records from CSV"
}
```

**CSV Errors**:

- `400 EMPTY_CSV_DATA`: No CSV data provided
- `400 INSUFFICIENT_CSV_DATA`: CSV must have header + data rows
- `400 MISSING_HEADERS`: Required columns missing
- `400 NO_VALID_ROWS`: No valid data rows found
- `500 CSV_IMPORT_FAILURE`: Import failed

---

### GET /api/telemetry/history/:equipmentId/:sensorType

Get historical telemetry data.

**Path Parameters**:

- `equipmentId` (string): Equipment ID
- `sensorType` (string): Sensor type

**Query Parameters**:

- `hours` (number, optional): Hours of history (default: 24)

**Response** (200 OK): Array of telemetry readings

**Error** (500): `{ "message": "Failed to fetch telemetry history" }`

---

### GET /api/telemetry/latest

Get latest telemetry readings.

**Response** (200 OK): Array of latest readings

---

### GET /api/telemetry/trends

Get telemetry trend data.

**Query Parameters** (Zod validated):

- `equipmentId` (string, required)
- `hours` (number, optional)

**Response** (200 OK): Trend data

**Error** (400): `{ "message": "Invalid query parameters", "errors": [...], "code": "VALIDATION_ERROR" }`

**Error** (500): `{ "message": "Failed to fetch telemetry trends" }`

---

### GET /api/sensor-configs

List sensor configurations.

**Query Parameters**:

- `equipmentId` (string, optional)
- `sensorType` (string, optional)

**Response** (200 OK): Array of sensor configurations

**Error** (500): `{ "message": "Failed to fetch sensor configurations" }`

---

### POST /api/sensor-configs

Create sensor configuration.

**Request Body** (Zod validated via `insertSensorConfigSchema`):

```json
{
  "equipmentId": "eq-123",
  "sensorType": "temperature",
  "enabled": true,
  "sampleRateHz": 1.0,
  "gain": 1.0,
  "offset": 0.0,
  "deadband": 0.0,
  "minValid": 50.0,
  "maxValid": 120.0,
  "warnLo": 70.0,
  "warnHi": 100.0,
  "critLo": 60.0,
  "critHi": 110.0,
  "hysteresis": 1.0,
  "emaAlpha": 0.1,
  "targetUnit": "°C",
  "notes": "Main engine exhaust temperature",
  "expectedIntervalMs": 60000,
  "graceMultiplier": 2.0
}
```

**Required Fields**:

- `equipmentId` (string): Equipment ID
- `sensorType` (string): Sensor type matching telemetry sensor type

**Optional Fields** (with defaults):

- `enabled` (boolean, default: true)
- `sampleRateHz` (number, nullable): Target sampling rate
- `gain` (number, default: 1.0): Scaling multiplier
- `offset` (number, default: 0.0): Scaling offset
- `deadband` (number, default: 0.0): Minimum change to record
- `minValid`, `maxValid` (number, nullable): Validation range
- `warnLo`, `warnHi`, `critLo`, `critHi` (number, nullable): Threshold levels
- `hysteresis` (number, default: 0.0): Threshold hysteresis
- `emaAlpha` (number, nullable): EMA alpha (0-1)
- `targetUnit` (string, nullable): Desired unit
- `notes` (string, nullable): User description
- `expectedIntervalMs` (number, nullable): Expected telemetry interval
- `graceMultiplier` (number, default: 2.0): Offline threshold multiplier

**Response** (201): Created sensor configuration object

**Error** (400): `{ "message": "Invalid sensor configuration data", "errors": [...] }`

**Error** (500): `{ "message": "Failed to create sensor configuration" }`

---

### POST /api/sensor-config/bulk

Create multiple sensor configurations for equipment.

**Request Body** (validated via `bulkSensorConfigSchema`):

```json
{
  "equipmentId": "eq-123",
  "bundleId": "ENGINE_CORE_SUITE",
  "overwriteExisting": false,
  "configs": [
    {
      "sensorType": "temperature",
      "enabled": true,
      "sampleRateHz": 1.0,
      "targetUnit": "°C",
      "warnHi": 100.0,
      "critHi": 110.0
    },
    {
      "sensorType": "pressure",
      "enabled": true,
      "targetUnit": "bar",
      "minValid": 0.0,
      "maxValid": 10.0
    }
  ]
}
```

**Root Level Fields**:

- `equipmentId` (string, required): Target equipment ID
- `bundleId` (string, optional): Reference to bundle being applied
- `overwriteExisting` (boolean, default: false): Replace existing sensors of same type
- `configs` (array, required): Array of sensor config items (min 1)

**Config Item Fields** (from `bulkSensorConfigItemSchema`):
Inherits all fields from `insertSensorConfigSchema` EXCEPT:

- ❌ `equipmentId` - Set at root level
- ❌ `version` - Auto-generated
- ❌ `lastModifiedBy` - Set by backend
- ❌ `lastModifiedDevice` - Set by backend

**Required per config**: `sensorType` (string)

**Optional per config**: All threshold and calibration fields from sensor config schema

**Response** (201):

```json
{
  "message": "Successfully created 2 sensor configuration(s)",
  "created": 2,
  "sensors": [...]
}
```

**Error** (404): `{ "message": "Equipment not found" }`

**Error** (400): `{ "message": "Invalid bulk sensor configuration data", "errors": [...] }`

---

## Analytics

### GET /api/analytics/ml-models

List trained ML models.

**Query Parameters**:

- `modelType` (string, optional)
- `status` (string, optional)

**Response** (200 OK):

```json
{
  "results": [...],
  "metadata": {
    "orgId": "...",
    "timestamp": "2025-11-25T10:35:00.000Z",
    "version": "1.0",
    "total": 1,
    "page": 1,
    "pageSize": 1,
    "hasMore": false
  }
}
```

**Note**: Queries actual database, returns real ML models

---

### GET /api/analytics/ml-models/:id

Get ML model by ID.

**Path Parameters**:

- `id` (string): Model ID

**Response** (200 OK):

```json
{
  "result": {...},
  "metadata": {
    "orgId": "...",
    "timestamp": "2025-11-25T10:35:00.000Z",
    "version": "1.0"
  }
}
```

---

## Error Handling

**Standard Format**:

```json
{
  "message": "Error message",
  "code": "ERROR_CODE"
}
```

**Analytics Format**:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  },
  "metadata": {
    "timestamp": "2025-11-25T10:35:00.000Z",
    "version": "1.0"
  }
}
```

**Common Error Codes**:

- `MISSING_ORG_ID`: x-org-id header required
- `VALIDATION_ERROR`: Request validation failed
- `PAYLOAD_VALIDATION_ERROR`: JSON schema validation failed
- `EMPTY_CSV_DATA`: CSV data empty
- `INSUFFICIENT_CSV_DATA`: CSV needs header + data
- `MISSING_HEADERS`: Required CSV columns missing
- `NO_VALID_ROWS`: CSV has no valid data
- `IMPORT_FAILURE`: Telemetry import failed
- `CSV_IMPORT_FAILURE`: CSV import failed

---

## Additional Resources

- Integration Tests: `tests/integration/analytics-flow.test.ts`
- Marine Terminology: `docs/MARINE_TERMINOLOGY_REFERENCE.md`
- Logging Guide: `docs/MARINE_PDM_LOGGING_GUIDE.md`
- Grafana Dashboards: `dashboards/README.md`

---

**Note**: This documentation only covers production-ready endpoints with verified implementations. Additional analytics endpoints are in development.
