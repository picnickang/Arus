# ARUS Auto-Filled Logbook System - Analysis & Implementation

**Date**: November 28, 2025  
**Status**: Task A - Analysis Complete

---

## 1. Existing Logbook Implementation Scan

### DECK LOG - FULLY IMPLEMENTED ✅

| Component         | Location                                                                                             | Status                |
| ----------------- | ---------------------------------------------------------------------------------------------------- | --------------------- |
| Schema            | `shared/schema.ts:7667-7909`                                                                         | Complete              |
| Tables            | `deck_log_daily`, `deck_log_hourly`, `deck_log_events`, `deck_log_watch`, `deck_log_hourly_autofill` | Complete              |
| Backend API       | `server/routes.ts:21145-21596`                                                                       | Complete (~450 lines) |
| Auto-fill Service | `server/services/stormgeo-integration-service.ts`                                                    | Complete              |
| Event Service     | `server/services/deck-log-event-service.ts`                                                          | Complete              |
| Frontend          | `client/src/pages/deck-logbook.tsx`                                                                  | Complete (1602 lines) |

**Auto-fill Sources:**

- StormGeo weather/routing data (CSV/JSON import, API)
- GPS position from equipment telemetry
- Weather conversion (wind speed → Beaufort, wave height → sea state)

### ENGINE LOG - FULLY IMPLEMENTED ✅

| Component         | Location                                                                                                 | Status                |
| ----------------- | -------------------------------------------------------------------------------------------------------- | --------------------- |
| Schema            | `shared/schema.ts:7963-8280`                                                                             | Complete              |
| Tables            | `engine_log_daily`, `engine_log_hourly`, `engine_log_events`, `engine_log_generator`, `engine_log_watch` | Complete              |
| Backend API       | `server/routes.ts:21596-22280`                                                                           | Complete (~680 lines) |
| Auto-fill Service | `server/services/engine-log-autofill-service.ts`                                                         | Complete (817 lines)  |
| Event Service     | `server/services/engine-log-event-service.ts`                                                            | Complete              |
| Frontend          | `client/src/pages/engine-logbook.tsx`                                                                    | Complete (1850 lines) |
| Validation        | `server/validation/engine-log-schemas.ts`                                                                | Complete              |

**Auto-fill Sources:**

- Main engine telemetry (RPM, load, temps, pressures)
- Generator telemetry (load kW, voltage, frequency)
- Running hours calculation
- Anomaly detection with configurable thresholds

### LOGS & COMPLIANCE HUB - FULLY IMPLEMENTED ✅

| Component         | Location                                     | Status               |
| ----------------- | -------------------------------------------- | -------------------- |
| Frontend          | `client/src/pages/logs-compliance-hub.tsx`   | Complete (594 lines) |
| Compliance Engine | `server/services/compliance-rules-engine.ts` | Complete             |

---

## 2. Missing Auto-Filled Logs

### FUEL / EMISSIONS LOG - NOT IMPLEMENTED ❌

**Current State:**

- Engine log has `foConsumption`, `doConsumption`, `loConsumption` fields in daily records
- Equipment telemetry can store fuel flow sensor data
- No dedicated fuel/emissions tables or time-series tracking
- No CO₂ emission calculation

**Required for Full Implementation:**

- [ ] `fuel_emissions_log` table for time-series fuel tracking
- [ ] Fuel consumption calculation from:
  - Flow meters (if available)
  - Engine load × SFOC curves (fallback estimation)
- [ ] CO₂ emission calculation using IMO emission factors
- [ ] API routes for querying fuel logs
- [ ] Frontend view with period summaries

### TRACK / POSITION LOG - PARTIALLY IMPLEMENTED ⚠️

**Current State:**

- Equipment telemetry stores GPS lat/lon, SOG, COG
- Deck log hourly has position fields
- No dedicated AIS-like track table
- Position data scattered across telemetry, not exposed as logbook

**Required for Full Implementation:**

- [ ] `vessel_track_log` table for deduplicated position history
- [ ] Track pipeline from GPS telemetry with change detection
- [ ] API routes for track queries by vessel/time range
- [ ] Frontend map or table view
- [ ] Export to standard formats (GPX, KML)

### CONDITION MONITORING LOG - PARTIALLY IMPLEMENTED ⚠️

**Current State:**

- `vibration_features` table (schema.ts:1846) - FFT features
- `vibration_analysis` table (schema.ts:3922) - Analysis results
- `condition_monitoring` table (schema.ts:4292) - Equipment health scores
- ML anomaly scores exist in various tables
- No aggregate periodic log view

**Required for Full Implementation:**

- [ ] Aggregation pipeline from vibration/CM analysis
- [ ] Periodic summary log entries (hourly/daily)
- [ ] API routes for condition log queries
- [ ] Frontend condition monitoring log view
- [ ] Trend visualization

---

## 3. Proposed Architecture for Missing Logs

### Unified Log Architecture

All auto-filled logs follow this pattern:

```
[Telemetry Source] → [Aggregation Pipeline] → [Log Table] → [API] → [Frontend]
     ↓                      ↓                      ↓           ↓          ↓
  Real-time           Cron job or          Time-series    REST +     React +
  ingestion          stream processor      with indexes   Export    Recharts
```

### Common Features:

- `org_id` tenant isolation
- `vessel_id` scoping
- Timestamp indexes for time-range queries
- Configurable sampling intervals
- Retention policies via cron jobs
- Export to CSV/PDF/XLSX

### New Tables to Create:

```typescript
// 1. Fuel/Emissions Log
fuel_emissions_log: {
  (id,
    org_id,
    vessel_id,
    period_start,
    period_end,
    fo_consumption_mt,
    do_consumption_mt,
    lo_consumption_mt,
    co2_emissions_mt,
    sox_emissions_kg,
    nox_emissions_kg,
    avg_engine_load,
    distance_nm,
    fuel_efficiency_mt_per_nm,
    data_source(flow_meter | estimated | manual));
}

// 2. Vessel Track Log
vessel_track_log: {
  (id,
    org_id,
    vessel_id,
    timestamp,
    latitude,
    longitude,
    sog,
    cog,
    heading,
    nav_status(underway | anchored | moored | maneuvering),
    source(gps | ais | manual));
}

// 3. Condition Monitoring Log (aggregate view)
condition_log_summary: {
  (id,
    org_id,
    vessel_id,
    equipment_id,
    period_start,
    period_end,
    vibration_rms_avg,
    vibration_rms_max,
    vibration_rms_min,
    ml_anomaly_score_avg,
    ml_anomaly_score_max,
    health_index,
    condition_grade,
    alerts_count,
    critical_alerts_count);
}
```

---

## 4. Implementation Priority

| Log Type             | Priority | Effort | Dependency         |
| -------------------- | -------- | ------ | ------------------ |
| Fuel/Emissions       | High     | Medium | Engine telemetry   |
| Track/Position       | Medium   | Low    | GPS telemetry      |
| Condition Monitoring | Medium   | Medium | Existing CM tables |

---

## 5. Configuration Requirements

Environment variables to add:

```bash
# Fuel/Emissions Log
FUEL_LOG_INTERVAL_MINUTES=60
FUEL_CO2_FACTOR=3.206  # tons CO2 per ton HFO
FUEL_SOX_FACTOR=0.02   # kg SOx per ton fuel (0.5% S)

# Track Log
TRACK_LOG_INTERVAL_SECONDS=60
TRACK_MIN_DISTANCE_NM=0.1  # Minimum movement to log

# Condition Monitoring Log
CM_LOG_INTERVAL_MINUTES=60
CM_ANOMALY_THRESHOLD=0.7  # Log when score exceeds

# Retention (days)
FUEL_LOG_RETENTION_DAYS=730
TRACK_LOG_RETENTION_DAYS=365
CM_LOG_RETENTION_DAYS=365
```

---

## 6. Files to Create/Modify

### New Files:

- `shared/schema.ts` - Add new table definitions (extend, not replace)
- `server/services/fuel-emissions-log-service.ts` - Fuel calculation pipeline
- `server/services/track-log-service.ts` - Position deduplication pipeline
- `server/services/condition-log-service.ts` - CM aggregation pipeline
- `client/src/pages/fuel-emissions-log.tsx` - Frontend view
- `client/src/pages/vessel-track-log.tsx` - Frontend view
- `client/src/pages/condition-monitoring-log.tsx` - Frontend view

### Modify:

- `server/routes.ts` - Add API routes
- `server/storage.ts` - Add storage interface methods
- `client/src/App.tsx` - Add routes
- Navigation components - Add menu items

---

## 7. Existing Auto-Fill Test Data

The dev fake data service (`server/services/dev-fake-data-service.ts`) already supports:

- Engine telemetry generation (ME + generators)
- Navigation/GPS data generation
- Weather snapshot generation
- Event creation

Extend for:

- Fuel flow meter simulation
- Vibration/CM data simulation
