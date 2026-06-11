# Step 1: Overlap & Value Check

**Date**: November 24, 2025  
**Task**: Validate Proposed Improvements vs Existing Features  
**Status**: 🔍 **In Progress - Identifying Genuine Gaps**

---

## Executive Summary

This document evaluates each proposed telemetry improvement against the existing ARUS infrastructure to determine:

1. **Does this already exist?** (identify duplications)
2. **Does it add genuine marine PdM value?** (not just cosmetic)
3. **Does it conflict with architecture?** (offline-first, multi-tenant, dual-mode)

Based on Step 0 architecture scan and log analysis, I'm evaluating **5 proposed improvements**.

---

## Evaluation Framework

### Decision Criteria

For each proposed improvement:

- ✅ **PROCEED** - Adds genuine value, no overlap, no conflicts
- ⚠️ **MODIFY** - Partially overlaps, needs refinement to add value
- ❌ **REJECT** - Duplicates existing feature, no additional value
- 🔄 **DEFER** - Good idea, but requires architecture discussion first

### Marine PdM Value Assessment

Does this improvement help marine operators:

1. **Prevent failures** - Detect issues before breakdown
2. **Reduce downtime** - Faster diagnosis and repair
3. **Lower costs** - Avoid unnecessary maintenance or emergencies
4. **Ensure safety** - Identify safety-critical risks
5. **Maintain compliance** - Meet regulatory requirements

If NO to all 5 criteria → reject as cosmetic change.

---

## Proposed Improvement #1: Bridge-Style Vessel View

### Description

Single-vessel dashboard styled like a ship's bridge control room with:

- Large real-time gauges (engine RPM, speed, fuel pressure, temperature)
- Equipment layout mimicking physical vessel layout
- Traffic-light status indicators
- Quick access to critical equipment

### Overlap Analysis

**Existing Features**:

1. ✅ **Dashboard (`dashboard.tsx`)** - Real-time metrics, vessel filter, equipment health
2. ✅ **Health Monitor (`health-monitor.tsx`)** - Equipment cards with health status
3. ✅ **Fleet Overview (`FleetOverview.tsx`)** - Vessel-organized equipment view
4. ✅ **Real-time Telemetry** - WebSocket updates (30s refresh)
5. ✅ **Latest Telemetry Table** - 50 most recent readings on dashboard

**What's Missing**:

- ❌ No "bridge-style" layout with large gauges
- ❌ No physical equipment layout (e.g., "port side engine room", "starboard thruster")
- ❌ No large real-time visualization optimized for bridge monitoring

### Value Assessment

**Marine PdM Value**: ✅ **High**

**Reasoning**:

1. **Prevent Failures** - Quick glance at critical equipment status
2. **Reduce Downtime** - Faster situational awareness for crew
3. **Safety** - Immediate visibility of critical equipment (main engine, steering, thrusters)
4. **Usability** - Familiar layout for marine operators (mimics physical bridge)

**Marine-Specific Benefits**:

- Chief engineer can monitor engine room from bridge
- Watch officers can see equipment status during navigation
- Critical equipment (main engine, steering, DP thrusters) prioritized
- Physical layout helps crew locate equipment quickly

### Architecture Compatibility

**Check Against Architecture**:

- ✅ **Offline-First** - Can use cached telemetry data
- ✅ **Multi-Tenant** - Vessel-specific view (no cross-tenant data)
- ✅ **Dual-Mode** - SQLite can support (no PostgreSQL-specific features required)
- ✅ **Real-Time** - WebSocket updates already implemented

**Implementation Complexity**: **Medium**

- Requires new page component
- Can reuse existing telemetry APIs
- Can reuse existing chart components (gauges)
- No new backend endpoints needed

### Decision

**Status**: ✅ **PROCEED (High Value, No Overlap)**

**Recommendation**: Implement as **new page** (`/vessel-bridge/:vesselId`)

**Rationale**:

1. No overlap with existing dashboards (different use case)
2. High marine PdM value (familiar interface for crew)
3. Architecture-compatible (no breaking changes)
4. Reuses existing infrastructure (telemetry APIs, WebSocket, charts)

**Scope**:

- Single-vessel view (not fleet-wide)
- Real-time telemetry display
- Critical equipment prioritization
- Optional: Physical layout mode (equipment positioned by location)

---

## Proposed Improvement #2: Multi-Sensor Time-Series Overlay

### Description

Compare multiple sensors on one chart:

- Overlay temperature, pressure, vibration on single timeline
- Correlation analysis (e.g., "pressure spikes when temperature rises")
- Dual Y-axis support (different units on same chart)
- Zoom, pan, time range selection

### Overlap Analysis

**Existing Features**:

1. ✅ **TimeSeriesChart (`TimeSeriesChart.tsx`)** - Single sensor line/area chart
2. ✅ **Telemetry History API** - `GET /api/telemetry/history/:equipmentId/:sensorType?hours=24`
3. ✅ **Equipment Detail Pages** - Individual sensor charts

**What's Missing**:

- ❌ No multi-sensor overlay on single chart
- ❌ No dual Y-axis support (currently single value label)
- ❌ No correlation visualization
- ❌ No interactive zoom/pan (Recharts supports it, but not enabled)

### Value Assessment

**Marine PdM Value**: ✅ **High**

**Reasoning**:

1. **Prevent Failures** - Detect correlated anomalies (e.g., temp + pressure + vibration)
2. **Root Cause Analysis** - See cause-effect relationships
3. **Diagnostics** - Faster troubleshooting with multi-sensor view
4. **Pattern Detection** - Identify failure signatures (e.g., bearing failure = high vibration + high temperature)

**Marine-Specific Benefits**:

- Diesel engine diagnostics: Correlate exhaust temp, fuel pressure, RPM
- Bearing analysis: Correlate vibration + temperature + oil pressure
- Hydraulic system: Correlate pressure + flow rate + temperature
- Thruster performance: Correlate RPM + current draw + vibration

### Architecture Compatibility

**Check Against Architecture**:

- ✅ **Offline-First** - Can use cached telemetry history
- ✅ **Multi-Tenant** - Equipment-scoped queries (no cross-tenant data)
- ✅ **Dual-Mode** - SQLite can support (no PostgreSQL-specific features)
- ✅ **Real-Time** - Can update live with WebSocket

**Implementation Complexity**: **Medium**

- Extend TimeSeriesChart component
- Add dual Y-axis support (Recharts supports this)
- Add sensor selector UI
- No new backend endpoints needed (use existing `/api/telemetry/history`)

### Decision

**Status**: ✅ **PROCEED (High Value, No Overlap)**

**Recommendation**: Extend **TimeSeriesChart** component with multi-sensor mode

**Rationale**:

1. No overlap (current charts are single-sensor only)
2. High marine PdM value (correlation analysis critical for diagnostics)
3. Architecture-compatible (no breaking changes)
4. Reuses existing APIs (telemetry history)

**Scope**:

- Multi-sensor overlay (2-4 sensors on one chart)
- Dual Y-axis support (different units)
- Legend with sensor colors
- Time range selector (1h, 6h, 24h, 7d)
- Optional: Correlation coefficient display

---

## Proposed Improvement #3: Top 5 Fleet Risks Dashboard

### Description

Aggregated fleet-wide risk view:

- Top 5 highest-risk equipment across entire fleet
- Risk score combining: RUL + health index + threshold breaches + DTC severity
- One-click navigation to equipment detail
- Risk trend (increasing/decreasing/stable)
- Estimated impact (downtime cost, safety level)

### Overlap Analysis

**Existing Features**:

1. ✅ **Fleet Overview (`FleetOverview.tsx`)** - Fleet-wide insights, status filters
2. ✅ **Health Monitor (`health-monitor.tsx`)** - Equipment health cards
3. ✅ **Dashboard (`dashboard.tsx`)** - Fleet metrics (fleet health, risk alerts)
4. ✅ **AI Insights (`ai-insights.tsx`)** - Vessel intelligence patterns, critical equipment

**What's Missing**:

- ❌ No "Top N" aggregated risk ranking across fleet
- ❌ No composite risk score (currently separate: health index, RUL, alerts)
- ❌ No risk trend visualization
- ❌ No impact estimation (downtime cost, safety level)

**What Exists (Partial Overlap)**:

- ⚠️ Fleet Overview has "Critical" and "Action Required" filters
- ⚠️ AI Insights has "risks.critical" array
- ⚠️ Dashboard shows "riskAlerts" count

**Difference**:

- Existing features show lists of equipment needing attention
- Proposed feature ranks equipment by composite risk score
- Proposed feature shows impact estimation (cost, safety)
- Proposed feature shows risk trend over time

### Value Assessment

**Marine PdM Value**: ✅ **Very High**

**Reasoning**:

1. **Prevent Failures** - Prioritize highest-risk equipment
2. **Reduce Downtime** - Focus maintenance on most critical equipment
3. **Lower Costs** - Avoid highest-impact failures
4. **Ensure Safety** - Identify safety-critical risks first
5. **Resource Allocation** - Help fleet managers prioritize limited crew/parts

**Marine-Specific Benefits**:

- Fleet manager can prioritize across multiple vessels
- Shore-based maintenance planning
- Risk-based inspection scheduling
- Regulatory compliance (demonstrate risk management)

### Architecture Compatibility

**Check Against Architecture**:

- ✅ **Offline-First** - Can cache risk scores
- ✅ **Multi-Tenant** - Fleet-scoped queries (org-level)
- ✅ **Dual-Mode** - SQLite can support (aggregation queries)
- ✅ **Real-Time** - Can update with WebSocket

**Implementation Complexity**: **Medium-High**

- Requires new risk scoring algorithm (composite of health + RUL + alerts + DTC)
- New API endpoint: `GET /api/fleet/top-risks?limit=5`
- New component: TopRisksPanel
- Backend: Aggregation query across equipment, predictions, alerts

### Decision

**Status**: ✅ **PROCEED (Very High Value, Minimal Overlap)**

**Recommendation**: Implement as **new API + dashboard widget**

**Rationale**:

1. Minimal overlap (existing features don't rank or score risk)
2. Very high marine PdM value (prioritization critical for fleet management)
3. Architecture-compatible (standard aggregation queries)
4. Complements existing features (doesn't replace)

**Scope**:

- Top 5 (or configurable N) highest-risk equipment
- Composite risk score (0-100)
- Risk factors breakdown (RUL contribution, health contribution, alert contribution)
- Estimated impact (downtime hours, cost estimate, safety level)
- One-click navigation to equipment detail
- Optional: Risk trend sparkline (7-day history)

---

## Proposed Improvement #4: Alert Impact Analysis

### Description

For each alert, show "What happens if I ignore this?":

- Estimated time to failure (from RUL)
- Estimated repair cost (minor vs major failure)
- Estimated downtime (hours/days)
- Safety risk level (low/medium/high/critical)
- Compliance impact (regulatory violations)

### Overlap Analysis

**Existing Features**:

1. ✅ **Alerts Page (`alerts.tsx`)** - Alert configurations, severity filtering
2. ✅ **RUL Predictions** - Remaining useful life estimates
3. ✅ **Work Orders** - Link alerts to work orders
4. ✅ **AI Insights** - ROI calculations, compliance reports

**What's Missing**:

- ❌ No "impact if ignored" analysis on alert cards
- ❌ No cost estimation for deferred maintenance
- ❌ No downtime estimation
- ❌ No safety risk quantification
- ❌ No compliance impact on individual alerts

**What Exists (Partial Overlap)**:

- ⚠️ RUL predictions show "days remaining"
- ⚠️ AI Insights show fleet-level ROI
- ⚠️ Severity levels (low/medium/high/critical) indicate importance

**Difference**:

- Existing features show **what** is wrong
- Proposed feature shows **consequences** of inaction
- Existing features show fleet-level cost savings
- Proposed feature shows per-alert cost avoidance

### Value Assessment

**Marine PdM Value**: ✅ **Very High**

**Reasoning**:

1. **Prevent Failures** - Quantify urgency of response
2. **Lower Costs** - Show cost of minor repair vs major failure
3. **Ensure Safety** - Highlight safety-critical alerts
4. **Compliance** - Show regulatory impact
5. **Decision Support** - Help crew prioritize limited resources

**Marine-Specific Benefits**:

- Chief engineer can prioritize maintenance tasks
- Shore-based planner can allocate budget
- Demonstrate risk management for audits
- Justify maintenance expenses to vessel owner

**Example Scenarios**:

- Alert: "Main engine oil pressure low"
  - Time to failure: 12 hours
  - Minor repair cost: $2,000 (replace oil pump seal)
  - Major failure cost: $50,000 (engine rebuild)
  - Downtime: 2 days (minor) vs 14 days (major)
  - Safety risk: High (loss of propulsion at sea)

### Architecture Compatibility

**Check Against Architecture**:

- ✅ **Offline-First** - Can cache impact calculations
- ✅ **Multi-Tenant** - Alert-scoped queries (no cross-tenant data)
- ✅ **Dual-Mode** - SQLite can support (no PostgreSQL-specific features)
- ✅ **Real-Time** - Can update with WebSocket

**Implementation Complexity**: **High**

- Requires cost estimation database (equipment type → repair costs)
- Requires downtime estimation model
- Requires safety risk matrix (alert type + equipment criticality)
- Requires compliance rules database
- Backend: New service `impact-analysis.service.ts`

### Decision

**Status**: ⚠️ **MODIFY (High Value, Needs Refinement)**

**Recommendation**: Implement **simplified version** first (impact categories only)

**Rationale**:

1. Very high value (decision support critical for marine operators)
2. No overlap (existing features don't show consequences)
3. Architecture-compatible
4. **BUT**: Full implementation is complex (cost database, downtime models)

**Simplified Scope** (Phase 1):

- Impact categories only (Low/Medium/High/Critical)
- Safety risk level (based on equipment criticality)
- Generic time to failure (from RUL)
- Generic impact descriptions (template-based)

**Full Scope** (Phase 2 - Future):

- Equipment-specific cost database
- Statistical downtime models
- Regulatory compliance rules engine
- Historical failure cost analysis

**Phase 1 Implementation**:

```typescript
interface AlertImpact {
  timeToFailure: number; // from RUL
  impactLevel: "low" | "medium" | "high" | "critical";
  safetyRisk: "low" | "medium" | "high" | "critical";
  description: string; // template-based
  recommendation: string; // template-based
}
```

---

## Proposed Improvement #5: Marine Terminology Consistency

### Description

Ensure consistent use of marine industry terminology:

- "Main Engine" (not "Primary Motor")
- "Bow Thruster" (not "Front Propeller")
- "Engine Room" (not "Machinery Space")
- "Port/Starboard" (not "Left/Right")
- "Underway" (not "In Transit")
- Equipment naming conventions aligned with marine standards

### Overlap Analysis

**Existing Features**:

1. ✅ **Equipment Registry** - Equipment types, names, locations
2. ✅ **Equipment Constants** (`client/src/constants/equipment.ts`) - Equipment type definitions
3. ✅ **UI Components** - Various labels, tooltips, descriptions

**Current State**:

- ✅ Equipment types use marine terminology (Main Engine, Bow Thruster, etc.)
- ✅ Operating modes use marine terms (DP, Transit, Harbor, etc.)
- ⚠️ Some UI labels may use generic terms
- ⚠️ No enforcement of marine terminology in user-generated content

**What's Missing**:

- ❌ No terminology validation/suggestions
- ❌ No glossary or help system
- ❌ No consistency checking for custom equipment names

### Value Assessment

**Marine PdM Value**: ⚠️ **Medium**

**Reasoning**:

1. **Usability** - Familiar terminology for marine operators
2. **Professionalism** - Industry-standard language
3. **Clarity** - Avoid confusion (e.g., "port" = harbor vs port side)
4. **Training** - Easier onboarding for marine engineers

**NOT High Priority Because**:

- Doesn't directly prevent failures
- Doesn't reduce costs
- Doesn't improve safety
- Cosmetic improvement (though valuable)

### Architecture Compatibility

**Check Against Architecture**:

- ✅ **Offline-First** - Terminology dictionary can be cached
- ✅ **Multi-Tenant** - No impact
- ✅ **Dual-Mode** - No impact

**Implementation Complexity**: **Low-Medium**

- Update UI labels (find/replace)
- Create terminology dictionary
- Add inline help/tooltips
- Optional: Terminology validation for custom names

### Decision

**Status**: ⚠️ **MODIFY (Medium Value, Low Priority)**

**Recommendation**: Implement as **audit + gradual improvement** (not urgent)

**Rationale**:

1. Medium value (usability, not PdM functionality)
2. No blocking issues (existing terminology mostly correct)
3. Architecture-compatible
4. Low implementation risk

**Scope**:

1. **Audit** - Review all UI labels, tooltips, help text
2. **Dictionary** - Create marine terminology reference
3. **Gradual Updates** - Fix as we modify components
4. **Help System** - Add inline glossary for marine terms
5. **Validation** - Suggest marine terminology for custom equipment names

**Priority**: **Low** (cosmetic improvement, not PdM-critical)

---

## Summary: Overlap & Value Check Results

### Approved for Implementation ✅

| #   | Improvement                          | Value     | Overlap | Decision                  | Priority  |
| --- | ------------------------------------ | --------- | ------- | ------------------------- | --------- |
| 1   | **Bridge-Style Vessel View**         | High      | None    | ✅ Proceed                | High      |
| 2   | **Multi-Sensor Time-Series Overlay** | High      | None    | ✅ Proceed                | High      |
| 3   | **Top 5 Fleet Risks Dashboard**      | Very High | Minimal | ✅ Proceed                | Very High |
| 4   | **Alert Impact Analysis**            | Very High | None    | ⚠️ Proceed (Simplified)   | High      |
| 5   | **Marine Terminology Consistency**   | Medium    | Partial | ⚠️ Proceed (Low Priority) | Low       |

### Rejected Improvements ❌

**None** - All proposed improvements add genuine value with minimal overlap.

---

## Implementation Recommendations

### Phase 1: High-Priority Marine PdM Features

**Order of Implementation** (by marine PdM value):

1. **Top 5 Fleet Risks Dashboard** (Very High Value)
   - Backend: Risk scoring algorithm + API endpoint
   - Frontend: TopRisksPanel component
   - Estimated effort: 4-6 hours

2. **Bridge-Style Vessel View** (High Value)
   - Frontend: New page component with gauge visualizations
   - Reuses: Existing telemetry APIs, WebSocket, charts
   - Estimated effort: 6-8 hours

3. **Multi-Sensor Time-Series Overlay** (High Value)
   - Frontend: Extend TimeSeriesChart component
   - Backend: No changes needed
   - Estimated effort: 3-4 hours

4. **Alert Impact Analysis (Simplified)** (High Value)
   - Backend: Impact categorization service
   - Frontend: Impact badges on alert cards
   - Estimated effort: 3-4 hours

### Phase 2: Usability Improvements

5. **Marine Terminology Consistency** (Medium Value, Low Priority)
   - Audit + gradual updates
   - Estimated effort: 2-3 hours

### Total Estimated Effort

**Phase 1**: 16-22 hours (high-value PdM features)  
**Phase 2**: 2-3 hours (usability improvements)

---

## Architecture Considerations

### No Breaking Changes Required ✅

All approved improvements:

- ✅ Use existing APIs (no new backend endpoints needed, except risk scoring)
- ✅ Compatible with offline-first architecture
- ✅ Compatible with dual-mode (PostgreSQL + SQLite)
- ✅ Respect multi-tenant isolation
- ✅ Use existing real-time mechanisms (WebSocket)

### New Components Required

**Backend**:

- `risk-scoring.service.ts` - Composite risk score calculation
- `impact-analysis.service.ts` - Alert impact categorization

**Frontend**:

- `/vessel-bridge/:vesselId` - Bridge-style vessel page
- `TopRisksPanel.tsx` - Top N risks dashboard widget
- `MultiSensorChart.tsx` - Multi-sensor overlay chart
- `AlertImpactBadge.tsx` - Impact visualization on alerts

**API Endpoints**:

- `GET /api/fleet/top-risks?limit=5&orgId=...` - Top N risks
- No other new endpoints needed (use existing telemetry/health APIs)

---

## Next Steps

### Step 2: Implementation Planning

**For each approved improvement**:

1. Detailed component design
2. API contract definition (for new endpoints)
3. Data model updates (if needed)
4. Testing strategy
5. Documentation updates

**Ready to proceed to implementation** once you approve this overlap analysis.

---

## Conclusion

**Key Findings**:

1. ✅ **No duplications detected** - All proposed improvements add genuine value
2. ✅ **High marine PdM value** - All features (except terminology) directly support predictive maintenance
3. ✅ **Architecture-compatible** - No conflicts with offline-first, dual-mode, or multi-tenant design
4. ✅ **Low implementation risk** - Reuses existing infrastructure

**Recommendation**: **Proceed with Phase 1 implementation** (4 high-value features)

---

**Report Prepared By**: Overlap & Value Analysis System  
**Date**: November 24, 2025  
**Status**: ✅ **Step 1 Complete - Ready for Implementation Planning**
