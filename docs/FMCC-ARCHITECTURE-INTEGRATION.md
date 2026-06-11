# FMCC Integration Architecture Summary

## Existing Architecture Analysis

This document describes how the Aquametro FMCC (Fuel Mass Consumption Computer) integrates with the existing ARUS telemetry and tracking infrastructure.

### 1. Existing Telemetry Ingestion Pipeline

**Primary Components:**

- `server/mqtt-ingestion-service.ts` - Central MQTT-based telemetry ingestion
- `server/storage.ts` - Storage interface with `createTelemetryReading()`
- `shared/schema.ts` - `equipmentTelemetry` table for sensor readings

**Data Flow:**

```
Sensors → MQTT → MqttIngestionService.processTelemetryMessage() → storage.createTelemetryReading() → equipmentTelemetry table
```

### 2. Existing Vessel Track Log System

**Primary Components:**

- `server/services/track-log-service.ts` - TrackLogService class
- `shared/schema.ts` - `vesselTrackLog` table

**Key Features:**

- Already has a `source` field for tracking data origin (e.g., 'gps', 'ais')
- Built-in deduplication (min distance 0.05NM, max time gap 5 minutes)
- Haversine distance calculation
- GPX export capability

**Schema Fields:**

```typescript
vesselTrackLog {
  id, orgId, vesselId, timestamp,
  latitude, longitude,
  sog, cog, heading,
  navStatus, source,  // ← source field already exists!
  equipmentId, distanceFromPrevNm, timeFromPrevMinutes,
  windSpeed, windDirection, seaState, createdAt
}
```

### 3. Engine Log Auto-Fill

**Location:** `server/services/engine-log-autofill-service.ts`

**Data Sources:**

- Reads from `equipmentTelemetry` table
- Aggregates sensor readings by timestamp windows
- Uses FMCC fuel data when available (prioritized over estimates)

---

## FMCC Integration Design Rules

### Design Principles (CRITICAL)

1. **FMCC must plug into existing telemetry & track schema, not create a parallel universe**
2. **If FMCC is disabled, the system behaves exactly as it does today (no regressions)**
3. **Track log and telemetry consumers should not care if data came from GPS vs FMCC**
4. **Use `source: 'fmcc'` as the distinguishing attribute**

### Integration Points

#### A. Telemetry Data Flow

```
FMCC Hardware → FmccPollingService → Normalized FmccSnapshot →
  → storage.createTelemetryReading() (fuel, engine sensors)
  → trackLogService.logPosition() (navigation data)
```

#### B. Position Data Flow

```
FMCC Navigation → TrackLogService.logPosition(source='fmcc') → vesselTrackLog table
                                                                     ↓
                                 Same table as GPS/AIS → Unified track queries
```

### Environment Variables

| Variable                   | Default     | Description                     |
| -------------------------- | ----------- | ------------------------------- |
| `FMCC_ENABLED`             | `false`     | Enable/disable FMCC integration |
| `FMCC_PROTOCOL`            | `rest`      | Protocol: 'rest' or 'modbus'    |
| `FMCC_API_URL`             | -           | REST API base URL               |
| `FMCC_MODBUS_HOST`         | `localhost` | Modbus TCP host                 |
| `FMCC_MODBUS_PORT`         | `502`       | Modbus TCP port                 |
| `FMCC_POLLING_INTERVAL_MS` | `60000`     | Poll interval in milliseconds   |
| `FMCC_MOCK`                | `false`     | Use mock data for testing       |

### Database Tables Used

1. **`equipment_telemetry`** - FMCC fuel and engine sensor readings
2. **`vessel_track_log`** - FMCC navigation/position data (source='fmcc')
3. **`fuel_emissions_log`** - Fuel consumption logs (dataSource='fmcc' when FMCC data used)

### Polling Service Data Flow

```
FmccPollingService.poll()
    │
    ├─► getFMCCService().getInstantFuelFlow(vesselId)
    │       └─► FMCCInstantFlow data (fuel rates, density, temp)
    │
    └─► buildSnapshot(data) → FmccSnapshot
            │
            ├─► routeToTrackLog() ──► trackLogService.logPosition(source='fmcc')
            │                              └─► vesselTrackLog table (UNIFIED with GPS/AIS)
            │
            └─► routeToTelemetry() ──► storage.createTelemetryReading()
                                          ├─► fuel_consumption sensor
                                          ├─► fuel_density sensor
                                          ├─► fuel_temperature sensor
                                          └─► engine telemetry (rpm, load, power)
```

### Graceful Degradation

When FMCC is disabled or unavailable:

- Fuel data falls back to SFOC estimates from telemetry
- Position tracking continues from GPS/AIS sources
- No crashes or errors - only info-level log messages
- Existing functionality remains 100% intact

---

## Code Locations

| File                                                 | Purpose                                    |
| ---------------------------------------------------- | ------------------------------------------ |
| `server/integrations/aquametro-fmcc.ts`              | FMCC service, REST/Modbus clients          |
| `server/integrations/fmcc-polling-service.ts`        | Continuous polling and data routing        |
| `server/services/track-log-service.ts`               | Unified track log (accepts FMCC positions) |
| `server/services/fuel-emissions-autofill-service.ts` | Uses FMCC fuel data when available         |
| `server/services/engine-log-autofill-service.ts`     | Engine log auto-fill with FMCC support     |
