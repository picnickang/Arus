# Digital Deck Logbook - Feature Assessment

**Date**: November 28, 2025  
**Author**: Agent  
**Status**: Pre-Implementation Analysis

---

## 1. Existing Logbook-Like Features Scan

### Search Results

| Feature Type | Found | Files/Tables |
|-------------|-------|--------------|
| Deck Logbook | No | - |
| Engine Logbook | No | - |
| Voyage Log | No | - |
| Daily Vessel Records | No | - |
| Operational Log | Partial | `vessel_events` table for mode changes/alerts |
| Watch Log | Partial | `crew_shifts` table for shift scheduling |

### Related Existing Tables

1. **`vessel_events`** (schema.ts:6923) - General event logging
   - Types: voyage, maintenance, weather, mode_change, alert, manual
   - Has timestamp, duration, title, description, category
   - NOT a structured deck logbook

2. **`crew_shifts`** (schema.ts:2645) - Shift scheduling
   - Role-based assignments (Watch, Maintenance, Engine Room)
   - Start/end times, vessel/equipment assignments
   - NOT hourly navigation/weather records

3. **`telemetry`** - Equipment sensor readings
   - Automated data, not manual log entries
   - Different purpose than deck log

### Conclusion: No Overlap Risk

The Digital Deck Logbook is a **new feature** that does not duplicate existing functionality:
- `vessel_events` = automated operational events
- `crew_shifts` = work scheduling
- **Deck Logbook** = structured manual record of hourly navigation, weather, and vessel conditions per maritime regulations

---

## 2. Value Justification

### Regulatory Compliance
- **IMO SOLAS** - Requires deck log for all commercial vessels
- **Flag State Requirements** - Mandatory documentation for inspections
- **Port State Control** - Logbook review during PSC inspections
- **ISM Code** - Documentation requirements for safety management

### Operational Benefits
- Digital searchable records vs paper logs
- Export to PDF/Excel for regulatory submission
- Integration with telemetry for data verification
- Crew accountability with digital signatures

### Integration Opportunities
- Link to `crew_shifts` for watch officer identification
- Cross-reference `telemetry` data for verification
- Connect to `vessel_events` for operational context
- Link to `work_orders` for maintenance mentions

---

## 3. Data Model Summary (from Excel Template)

### Hourly Entry Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Hour | 01-24 | Yes | 24-hour format |
| Course True | degrees | No | 0-359 |
| Course Gyro | degrees | No | 0-359 |
| Course Standard | degrees | No | 0-359 |
| Course Steering | degrees | No | 0-359 |
| Error Gyro | degrees | No | Compass error |
| Error Standard | degrees | No | Compass error |
| Wind Direction | compass | No | N, NE, E, etc. |
| Wind Force | Beaufort | No | 0-12 scale |
| Sea State | code | No | 0-9 scale |
| Sky Condition | text | No | Clear, Cloudy, Overcast, etc. |
| Visibility | code | No | 0-9 scale |
| Barometer | mb/hPa | No | 900-1100 typical |
| Air Temperature | Celsius | No | -50 to +50 |
| Log Reading | nm | No | Cumulative distance |
| Remarks | text | No | Free-form notes |

### Daily Summary Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| True Course Made | degrees | No | Course to noon |
| Day Run | nm | No | Distance since last noon |
| Total Distance | nm | No | Cumulative |
| Latitude (Account) | DD.DDDD | No | Dead reckoning |
| Latitude (Observed) | DD.DDDD | No | GPS/celestial |
| Longitude (Account) | DD.DDDD | No | Dead reckoning |
| Longitude (Observed) | DD.DDDD | No | GPS/celestial |
| Streaming Hours Today | hours | No | Engine running |
| Streaming Hours Total | hours | No | Cumulative |

### Watch Assignment Fields (4 watches per day)
| Field | Type | Notes |
|-------|------|-------|
| Watch Period | 00-06, 06-12, 12-18, 18-24 | Fixed periods |
| Wheel Crew | crew_id[] | Helmsman(s) |
| Lookout Crew | crew_id[] | Lookout(s) |

### Draft Readings
| Field | Type | Notes |
|-------|------|-------|
| Draft Forward | meters | Bow draft |
| Draft Mid | meters | Midship draft |
| Draft Aft | meters | Stern draft |
| Trim | meters | Calculated: Aft - Forward |

### Signatures
| Field | Type | Notes |
|-------|------|-------|
| Chief Officer | crew_id | Signing officer |
| Signed At | timestamp | Signature time |

---

## 4. Architecture Compatibility

### Database
- ✅ Uses Drizzle ORM patterns
- ✅ PostgreSQL + SQLite dual-mode support
- ✅ Multi-tenant isolation via `org_id`
- ✅ UUID primary keys

### Backend
- ✅ Express routes with `requireOrgId` middleware
- ✅ Storage interface pattern
- ✅ Zod validation for requests
- ✅ Rate limiting support

### Frontend
- ✅ React + TanStack Query
- ✅ shadcn/ui components
- ✅ Existing table/form patterns
- ✅ Export utilities (jspdf, xlsx)

### Sync
- ✅ Compatible with existing sync patterns
- ✅ Offline-first with local storage
- ✅ Can use existing conflict resolution

---

## 5. Implementation Recommendation

**Proceed with implementation** as a new Phase 7 feature:

1. **New Tables**: `deck_log_daily`, `deck_log_hourly`, `deck_log_watch`
2. **New API Routes**: `/api/logbook/deck/*`
3. **New UI Page**: Deck Logbook under Vessel Management
4. **Export**: PDF/Excel matching official format

The feature adds significant regulatory value without duplicating existing modules.
