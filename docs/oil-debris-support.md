# Oil Debris Sensor Support - Implementation Plan

## Executive Summary

Adding first-class support for oil debris wear particle monitoring to ARUS marine predictive maintenance system. This feature complements existing oil condition monitoring (ISO 4406 particle counts, water contamination) by providing direct wear debris trending for bearing and gear health assessment.

## Discovery Findings

### Existing Oil Monitoring Capabilities

ARUS already includes oil condition monitoring sensors:

1. **`oil_particles_iso_code`** (gearbox equipment type)
   - Unit: ISO 4406 cleanliness code
   - Thresholds: warnHi: 19, critHi: 21
   - Sample rate: 0.02 Hz
   - Purpose: Overall lubrication cleanliness per ISO standard

2. **`oil_water_content`** (main_engine, thruster_system)
   - Unit: ppm
   - Thresholds: warnHi: 200, critHi: 300
   - Sample rate: 0.1 Hz
   - Purpose: Detect seal leaks and cooling system contamination

### Gap Identified

**Missing**: Direct wear debris particle sensor for predictive maintenance

- **Ferrous debris**: Magnetic particles from bearings, gears, cylinder liners
- **Non-ferrous debris**: Bronze/brass particles from bushings, thrust bearings
- **Use case**: Trending wear particle concentration to predict component failures

### Feature Differentiation

| Sensor Type | Purpose | Unit | Application |
|-------------|---------|------|-------------|
| `oil_particles_iso_code` | Overall cleanliness standard | ISO 4406 | Filtration effectiveness |
| `oil_water_content` | Seal integrity | ppm | Leak detection |
| **`oil_debris`** (new) | Wear trending | ppm or particles/mL | Predictive maintenance |

## Architecture Integration

### Schema Changes

**Location**: `shared/schema.ts`

```typescript
// Add to sensor type validation (if enumerated)
export const sensorTypes = [
  // ... existing types
  "oil_debris",
  "oil_debris_ferrous",    // Optional: separate magnetic debris
  "oil_debris_non_ferrous" // Optional: separate non-magnetic debris
] as const;

// Add operating parameter types
export const parameterTypes = [
  // ... existing
  "oil_debris_ppm",
  "oil_debris_particles_ml"
] as const;
```

### Marine Sensor Templates

**Location**: `server/services/marine-sensor-templates.ts`

Add oil_debris sensors to equipment types with oil-lubricated components:

```typescript
// Main engine - add to existing template
{
  sensorType: 'oil_debris',
  defaultThresholds: { warnHi: 150, critHi: 300 },
  targetUnit: 'ppm',
  sampleRateHz: 0.0007, // ~1 sample per 24 min
  enabled: true
}

// Gearbox - add alongside oil_particles_iso_code
{
  sensorType: 'oil_debris',
  defaultThresholds: { warnHi: 100, critHi: 200 },
  targetUnit: 'ppm',
  sampleRateHz: 0.0007,
  enabled: true
}

// Auxiliary engine
{
  sensorType: 'oil_debris',
  defaultThresholds: { warnHi: 120, critHi: 250 },
  targetUnit: 'ppm',
  sampleRateHz: 0.0007,
  enabled: true
}

// Marine pump (lubricated types)
{
  sensorType: 'oil_debris',
  defaultThresholds: { warnHi: 80, critHi: 150 },
  targetUnit: 'ppm',
  sampleRateHz: 0.001,
  enabled: true
}
```

### Telemetry Ingestion

**Location**: `server/routes.ts` or telemetry-specific routes

**Existing pattern**: Telemetry ingestion already handles multiple sensor types

**Required changes**: Minimal - add validation for `oil_debris` sensor type

```typescript
// Example telemetry POST body
POST /api/telemetry
{
  "equipmentId": "main-engine-001",
  "sensorType": "oil_debris",
  "timestamp": "2025-11-08T12:34:56Z",
  "value": 180.5,
  "unit": "ppm",
  "orgId": "default-org-id" // Multi-tenant security
}
```

### AI/ML Analysis Endpoint

**NEW ROUTE**: `/api/oil-debris/analyze`

**Pattern**: Follow existing vibration analysis endpoints

```typescript
// Request shape
interface OilDebrisAnalyzeRequest {
  equipmentId?: string;
  dataPoints: Array<{
    timestamp: string;
    value: number;
  }>;
  unit?: string; // default "ppm"
}

// Response shape
interface OilDebrisAnalyzeResponse {
  summary: string;
  status: "normal" | "warning" | "critical" | "insufficient_data";
  currentValue?: number;
  trendSlope?: number;
  trendClassification?: "improving" | "stable" | "worsening";
  riskScore?: number; // 0-1
  recommendedActions: string[];
}
```

**Implementation approach**:
1. **Phase 1**: Simple statistical analysis (mean, trend, threshold comparison)
2. **Phase 2**: Integrate with existing 3-model hybrid ensemble (LSTM, XGBoost, Random Forest)

### Health Index Integration

**Location**: Health index computation service

**Integration strategy**:
- Add `oil_debris_score` to composite health index
- Weight: 10% initially (tune based on validation)
- Calculation: Value position relative to optimal (0-150) and critical (300+) ranges
- Combine with existing indicators: vibration, temperature, pressure

### Frontend Updates

**Location**: `client/src/pages/equipment-registry.tsx`

**Required changes**:

1. **Sensor Configuration Dialog**
   - Add "Oil Debris" to sensor type dropdown
   - Default unit: "ppm"
   - Pre-fill thresholds from marine templates

2. **Operating Condition Status Section**
   - Display oil debris parameters with status badges (NORMAL/WARNING/CRITICAL)
   - Show latest telemetry values

3. **Sensor List Display**
   - Show `sensorType === "oil_debris"` with label "Oil Debris"
   - Display units and last value

## I/O Patterns & Examples

### Creating Oil Debris Sensor Configuration

```bash
POST /api/sensor-configs
{
  "equipmentId": "main-engine-001",
  "sensorType": "oil_debris",
  "orgId": "default-org-id",
  "minValid": 0,
  "maxValid": 500,
  "warnHi": 150,
  "critHi": 300,
  "targetUnit": "ppm",
  "sampleRateHz": 0.0007,
  "enabled": true
}
```

### Ingesting Telemetry Data

```bash
POST /api/telemetry
{
  "equipmentId": "main-engine-001",
  "sensorType": "oil_debris",
  "timestamp": "2025-11-08T08:30:00Z",
  "value": 185.2,
  "unit": "ppm",
  "dataQuality": 0.95
}
```

### Analyzing Oil Debris Trends

```bash
POST /api/oil-debris/analyze
{
  "equipmentId": "main-engine-001",
  "dataPoints": [
    {"timestamp": "2025-11-01T00:00:00Z", "value": 120},
    {"timestamp": "2025-11-02T00:00:00Z", "value": 135},
    {"timestamp": "2025-11-03T00:00:00Z", "value": 155},
    {"timestamp": "2025-11-04T00:00:00Z", "value": 180},
    {"timestamp": "2025-11-05T00:00:00Z", "value": 195}
  ],
  "unit": "ppm"
}

Response:
{
  "summary": "Oil debris trending upward at +18.75 ppm/day. Current level exceeds warning threshold, indicating accelerated wear.",
  "status": "warning",
  "currentValue": 195,
  "trendSlope": 18.75,
  "trendClassification": "worsening",
  "riskScore": 0.65,
  "recommendedActions": [
    "Schedule oil analysis and lab testing",
    "Inspect bearing and gear tooth condition",
    "Check oil filter for metal particles",
    "Review operating conditions for excessive loading"
  ]
}
```

## Multi-Unit Support

Support multiple measurement units to accommodate international standards:

| Unit | Description | Use Case |
|------|-------------|----------|
| `ppm` | Parts per million by weight | Most common, sensor default |
| `particles/mL` | Particle count per milliliter | Optical particle counters |
| `mg/L` | Milligrams per liter | Lab analysis |
| `iso4406` | ISO cleanliness code | Existing `oil_particles_iso_code` sensor |

**Implementation**: Store values in canonical unit (ppm), convert for display

## Integration Checklist

### Backend
- [ ] Add `oil_debris` to sensor type schema/validation
- [ ] Add oil debris templates to marine sensor templates
- [ ] Update telemetry ingestion validation
- [ ] Create `/api/oil-debris/analyze` endpoint
- [ ] Integrate into health index computation
- [ ] Add to LLM reports system (OpenAI integration)
- [ ] Ensure multi-tenant `orgId` validation throughout

### Frontend
- [ ] Update EquipmentRegistry sensor type dropdown
- [ ] Add oil debris to Operating Condition Status display
- [ ] Show oil debris sensors in equipment sensor list
- [ ] Add data-testid attributes for E2E testing

### Testing
- [ ] Unit tests: Sensor configuration CRUD
- [ ] Unit tests: Telemetry ingestion validation
- [ ] Unit tests: Oil debris analysis algorithm
- [ ] API tests: All endpoints with oil_debris
- [ ] E2E tests: Create sensor, ingest data, view status
- [ ] Integration tests: Health index computation

### Documentation
- [ ] Update `replit.md` with oil debris feature
- [ ] Add inline JSDoc comments with I/O examples
- [ ] Document threshold tuning guidelines
- [ ] Create operator training materials

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Overlap with `oil_particles_iso_code` | Medium | Clear differentiation: ISO 4406 = cleanliness, oil_debris = wear trending |
| Unit conversion errors | Medium | Centralize conversion logic, add validation |
| False positives from sample variability | Medium | Use exponential moving average (EMA), require trend confirmation |
| Multi-tenant data isolation breach | High | Enforce `orgId` validation in ALL queries and endpoints |
| Health index degradation | Low | A/B test impact, start with low weight (10%) |

## Success Metrics

1. **Detection Rate**: Oil debris sensor detects bearing/gear failures 30+ days before critical
2. **False Positive Rate**: <15% (acceptable for predictive maintenance)
3. **Adoption**: 80% of vessels with lubricated equipment add oil debris sensors
4. **Integration**: No breaking changes to existing equipment configurations
5. **Performance**: Analysis endpoint responds in <500ms for 30-day trend

## Implementation Timeline

- **Phase 1 - Schema & Templates** (2 hours): Schema updates, marine templates
- **Phase 2 - Backend API** (3 hours): Telemetry, analysis endpoint, health integration
- **Phase 3 - Frontend** (2 hours): EquipmentRegistry updates, status display
- **Phase 4 - Testing** (2 hours): Comprehensive test coverage
- **Phase 5 - Documentation** (1 hour): Update replit.md, inline docs

**Total Estimated Effort**: 10-12 hours

## Future Enhancements

1. **ML Integration**: Incorporate into existing 3-model hybrid ensemble
2. **Particle Size Distribution**: Support multi-bin particle counters
3. **Ferrous/Non-Ferrous Separation**: Magnetic vs. non-magnetic debris
4. **Acoustic Correlation**: Cross-reference with acoustic monitoring for bearing failures
5. **Automated Lab Test Triggers**: Auto-schedule oil sampling when trends worsen
6. **Predictive RUL**: Feed into RUL Engine v2.0 for remaining useful life estimation

## References

- Existing oil monitoring: `server/services/marine-sensor-templates.ts` lines 266-271, 330-335, 379-383
- Vibration analysis pattern: `/api/vibration/*` endpoints
- Health index: 3-model hybrid ensemble (LSTM, XGBoost, Random Forest)
- Multi-tenant security: `orgId` validation patterns throughout codebase

## Version History

- **v1.0 (Nov 2025)** - Initial implementation plan
  - Identified gap vs. existing oil monitoring
  - Defined schema, API, and UI changes
  - Established integration patterns
