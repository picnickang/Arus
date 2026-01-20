# Feature Enhancement Assessment
## Proposed PdM UX/UI Features vs. ARUS Architecture

**Date:** November 4, 2025  
**Status:** Enhancement Opportunities Identified  
**Approach:** Extract valuable UX patterns from proposals, avoid redundant implementations

---

## Executive Summary

After reviewing the proposed features against ARUS's current architecture, **9 of 10 features already exist**, but several propose **valuable UX enhancements** that could improve user experience without duplicating functionality.

**Recommendation:** **Selective Enhancement** - Extract 4-5 high-value UX improvements and integrate them into existing components.

---

## Feature-by-Feature Analysis

### ✅ F1: Fleet Overview (Already Exists)
**Current State:** `FleetOverview.tsx` with vessel cards, stats, hierarchical organization  
**Proposed:** Cards + RAG + filters + sort

**Assessment:**
- ✅ Hierarchical vessel organization: **EXISTS**
- ✅ Color-coded status (RAG): **EXISTS**
- ✅ Summary statistics: **EXISTS**
- ❌ Advanced filtering (region, type, efficiency): **MISSING**
- ❌ Multi-column sorting: **MISSING**

**Enhancement Opportunity:** ⭐⭐⭐ (3/5)
- Add filter chips for vessel type, region, status
- Add sortable columns (efficiency, alerts, last update)
- Minimal effort: 2-4 hours

---

### ✅ F2: Vessel Performance Charts (Mostly Exists)
**Current State:** VPS Phase 1 & 2 complete (Load Distribution + Power vs STW)  
**Proposed:** 4 VPS charts with baselines, fleet avg, and toggling

**Assessment:**
- ✅ Load Distribution Histogram: **EXISTS** (just implemented)
- ✅ Power vs STW: **EXISTS** (just implemented)
- ✅ Load vs SFOC calculations: **EXISTS** (digital-twin-fuel-calc.ts)
- ✅ Fuel vs Time trends: **EXISTS** (Equipment Analytics)
- ❌ **Baseline overlay toggles**: **MISSING**
- ❌ **Fleet average comparison lines**: **MISSING**
- ❌ **Percentile ribbons (p25, p50, p75)**: **MISSING**

**Enhancement Opportunity:** ⭐⭐⭐⭐⭐ (5/5) **HIGH VALUE**
- Add toggle controls to show/hide baselines on PowerSTWChart
- Add fleet average overlay on LoadDistributionChart
- Add percentile ribbons for fleet benchmarking
- Effort: 6-8 hours

---

### ⚠️ F3: Anomaly Overlays (Partially Exists)
**Current State:** Anomaly detection exists, but not visualized on performance charts  
**Proposed:** Markers + threshold bands + "view alert" on charts

**Assessment:**
- ✅ Anomaly detection: **EXISTS** (ML ensemble predictions)
- ✅ Alerts system: **EXISTS**
- ❌ **Anomaly markers on charts**: **MISSING**
- ❌ **Threshold bands (ReferenceArea)**: **MISSING**
- ❌ **Clickable markers → alert details**: **MISSING**

**Enhancement Opportunity:** ⭐⭐⭐⭐ (4/5) **HIGH VALUE**
- Add Recharts `ReferenceLine` / `ReferenceArea` for threshold bands
- Add scatter points for anomaly timestamps on performance charts
- Make markers clickable to navigate to alert details
- Effort: 4-6 hours

---

### ⚠️ F4: Context Layer Engine (Partially Exists)
**Current State:** Weather integration exists via OpenWeatherMap  
**Proposed:** AIS & Metocean with mode/sea-state bands

**Assessment:**
- ✅ Weather context: **EXISTS** (OpenWeatherMap integration)
- ✅ Sea state calculations: **EXISTS** (Douglas scale in simulator)
- ❌ **Context bands on charts**: **MISSING** (visual representation)
- ❌ **AIS integration**: **MISSING** (requires data contracts)
- ❌ **Operational mode detection**: **PARTIAL** (exists in simulator but not visualized)

**Enhancement Opportunity:** ⭐⭐⭐ (3/5)
- Add shaded `ReferenceArea` regions on charts for sea state / operational mode
- Visualize existing weather data on performance charts
- Defer AIS integration (requires external data source)
- Effort: 4-6 hours

---

### ✅ F5: Alerts Workflow (Already Exists)
**Current State:** Complete alerts system with acknowledgment and work order creation  
**Proposed:** Ack / Create Work Order flow

**Assessment:**
- ✅ Alert acknowledgment: **EXISTS**
- ✅ Work order creation from alerts: **EXISTS**
- ✅ Alert prioritization: **EXISTS**

**Enhancement Opportunity:** ⭐ (1/5) **NO VALUE** - Already complete

---

### ✅ F6: Maintenance List/Timeline (Mostly Exists)
**Current State:** Maintenance schedules with calendar view  
**Proposed:** List + timeline visualization

**Assessment:**
- ✅ Maintenance list: **EXISTS**
- ✅ Calendar view: **EXISTS** (weekly calendar in `maintenance-schedules.tsx`)
- ❌ **Gantt-style timeline**: **MISSING** (calendar view is per-day, not continuous timeline)

**Enhancement Opportunity:** ⭐⭐ (2/5)
- Add Gantt-style timeline view for long-term planning
- Low priority: current calendar view is functional
- Effort: 8-12 hours

---

### ⚠️ F7: Baselines & Fleet Benchmarking (Partially Exists)
**Current State:** Baselines exist in cost savings engine, but not visualized on charts  
**Proposed:** Baseline + fleet avg + percentiles

**Assessment:**
- ✅ Baseline calculations: **EXISTS** (cost savings, digital twin)
- ❌ **Baseline overlays on charts**: **MISSING**
- ❌ **Fleet average comparison**: **MISSING**
- ❌ **Percentile ribbons**: **MISSING**

**Enhancement Opportunity:** ⭐⭐⭐⭐⭐ (5/5) **HIGH VALUE** (Overlaps with F2)
- This is the same enhancement as F2
- Critical for fleet benchmarking and performance comparison

---

### ✅ F8: Compliance/CII (Already Exists)
**Current State:** Compliance tracking and CII calculations exist  
**Proposed:** Mini-tile + reports

**Assessment:**
- ✅ Compliance tracking: **EXISTS**
- ✅ CII calculations: **EXISTS**
- ✅ Reports: **EXISTS**

**Enhancement Opportunity:** ⭐ (1/5) **NO VALUE** - Already complete

---

### ❌ F9: Settings/Customization (Missing)
**Current State:** Dashboard preferences exist, but no chart-level customization  
**Proposed:** Toggle/reorder charts, thresholds, units

**Assessment:**
- ✅ Dashboard preferences: **EXISTS**
- ❌ **Chart-level toggles (baseline, fleet avg)**: **MISSING**
- ❌ **Chart reordering**: **MISSING**
- ❌ **Custom thresholds**: **PARTIAL** (ML thresholds exist but not user-configurable)
- ❌ **Unit preferences (metric/imperial)**: **MISSING**

**Enhancement Opportunity:** ⭐⭐⭐⭐ (4/5) **HIGH VALUE**
- Add toggle controls for baseline/fleet avg overlays (integrates with F2/F7)
- Add unit preferences (kW/HP, kn/mph, kg/lbs)
- Add custom threshold configuration for alerts
- Effort: 6-8 hours

---

### ✅ F10: Narrative Summary (Already Exists)
**Current State:** Technician Insights UX provides plain-English summaries  
**Proposed:** Performance Summary card

**Assessment:**
- ✅ Plain-English insights: **EXISTS** (Technician Insights UX)
- ✅ Equipment status summaries: **EXISTS**
- ✅ Action recommendations: **EXISTS**

**Enhancement Opportunity:** ⭐ (1/5) **NO VALUE** - Already complete via Technician Insights

---

## Recommended Enhancements (Priority Order)

### 🏆 Priority 1: Chart Baseline & Fleet Benchmarking (F2 + F7 + F9)
**Value:** ⭐⭐⭐⭐⭐ (5/5)  
**Effort:** 6-8 hours  
**Impact:** Enables fleet-wide performance comparison and optimization

**Implementation:**
1. Add toggle controls to `PowerSTWChart` and `LoadDistributionChart`:
   - ☑️ Show Baseline
   - ☑️ Show Fleet Average
   - ☑️ Show Percentiles (p25, p50, p75)
2. Create `/api/fleet/benchmarks` endpoint returning fleet aggregates
3. Add Recharts `Line` components for baseline/fleet avg overlays
4. Add semi-transparent `Area` for percentile ribbons
5. Store toggle preferences in localStorage

**Files to Modify:**
- `client/src/components/analytics/PowerSTWChart.tsx`
- `client/src/components/analytics/LoadDistributionChart.tsx`
- `server/routes.ts` (add benchmark endpoint)
- `server/vps-kpi-service.ts` (add fleet aggregation functions)

---

### 🥈 Priority 2: Anomaly Overlays on Charts (F3)
**Value:** ⭐⭐⭐⭐ (4/5)  
**Effort:** 4-6 hours  
**Impact:** Directly correlates anomalies with performance data

**Implementation:**
1. Modify chart components to accept optional `anomalyPoints` prop
2. Add Recharts `ReferenceLine` for anomaly timestamps
3. Add `ReferenceArea` for threshold bands
4. Make anomaly markers clickable (navigate to `/alerts?id=...`)
5. Fetch anomaly data from existing `/api/insights` endpoints

**Files to Modify:**
- `client/src/components/analytics/PowerSTWChart.tsx`
- `client/src/components/analytics/LoadDistributionChart.tsx`
- Add shared `<AnomalyOverlay>` component

---

### 🥉 Priority 3: Unit Preferences & Custom Thresholds (F9)
**Value:** ⭐⭐⭐⭐ (4/5)  
**Effort:** 6-8 hours  
**Impact:** Improves accessibility for international users

**Implementation:**
1. Create `useUnitPreferences()` hook with localStorage persistence
2. Add Settings page section for unit configuration:
   - Power: kW / HP
   - Speed: knots / mph / km/h
   - Mass: kg / lbs
   - Temperature: °C / °F
3. Add conversion utilities in `client/src/lib/units.ts`
4. Apply conversions in all chart components
5. Add custom threshold editor for alert levels

**Files to Create:**
- `client/src/hooks/useUnitPreferences.ts`
- `client/src/lib/units.ts`

**Files to Modify:**
- `client/src/pages/settings.tsx`
- All chart components (apply unit conversions)

---

### 🎖️ Priority 4: Context Bands on Charts (F4)
**Value:** ⭐⭐⭐ (3/5)  
**Effort:** 4-6 hours  
**Impact:** Visualizes operational context on performance data

**Implementation:**
1. Modify telemetry endpoints to include `context` (sea_state, mode)
2. Add `ReferenceArea` shaded regions on charts for context periods
3. Color-code by sea state / operational mode
4. Add legend explaining context bands

**Files to Modify:**
- `server/routes.ts` (enrich telemetry responses with context)
- `client/src/components/analytics/PowerSTWChart.tsx`

---

### 💡 Priority 5: Fleet Overview Advanced Filtering (F1)
**Value:** ⭐⭐⭐ (3/5)  
**Effort:** 2-4 hours  
**Impact:** Improves fleet navigation for large operators

**Implementation:**
1. Add filter chips for vessel type, region, status
2. Add multi-column sorting (by efficiency, alerts, last update)
3. Use existing FleetOverview data, just enhance UI

**Files to Modify:**
- `client/src/pages/FleetOverview.tsx`

---

## Implementation Plan

### Phase 1: Chart Enhancements (2-3 days)
1. ✅ Baseline & Fleet Benchmarking toggles
2. ✅ Anomaly overlays with clickable markers
3. ✅ Context bands (sea state / mode visualization)

### Phase 2: Settings & Customization (1-2 days)
4. ✅ Unit preferences system
5. ✅ Custom threshold configuration

### Phase 3: Polish (1 day)
6. ✅ Fleet Overview filtering improvements
7. ✅ Testing and documentation

**Total Estimated Effort:** 4-6 working days  
**Expected ROI:** High - Significant UX improvements without redundant development

---

## Not Recommended

### ❌ Skip: Proposed Assessment Framework
- Audit scripts (audit_stack.js, ping_endpoints.js, score_features.js)
- POC routes under `/poc`
- Redundancy scoring system
- Screenshot automation with Puppeteer

**Reason:** ARUS already has production features; we don't need parallel POC infrastructure. We can implement enhancements directly in existing components.

### ❌ Skip: Gantt Timeline (F6)
**Reason:** Current calendar view is sufficient; Gantt adds complexity for marginal benefit.

### ❌ Skip: AIS Integration (F4 partial)
**Reason:** Requires external data contracts not scoped in proposal. Weather integration already covers context.

---

## Decision

**Adopt:** Priorities 1-4 as targeted enhancements to existing components  
**Defer:** Priority 5 (nice-to-have)  
**Reject:** Assessment framework, POC infrastructure, Gantt timeline, AIS integration

---

**Document Version:** 1.0  
**Date:** November 4, 2025  
**Status:** ✅ READY FOR IMPLEMENTATION
