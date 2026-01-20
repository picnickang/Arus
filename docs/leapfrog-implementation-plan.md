# LEAPFROG Enhancement Implementation Plan
**ARUS Marine Predictive Maintenance Platform**
*Generated: November 4, 2025*

## Executive Summary

This document proposes 6 high-value enhancements from the LEAPFROG prompt that would elevate ARUS to match or exceed commercial marine PdM suites (Kongsberg K-Fleet, Wärtsilä FOS, ABB OCTOPUS).

**Total Estimated Effort:** 18-22 development days
**Priority:** High-value features that leverage existing infrastructure
**Risk:** Low - builds on proven ARUS architecture

---

## Feature Comparison Matrix

| Feature | ARUS Current State | LEAPFROG Proposal | Status |
|---------|-------------------|-------------------|---------|
| Fleet Health Overview | ✅ FleetOverview with cards | Map with geographic pins | ENHANCE |
| VPS Performance Charts | ✅ Load Distribution + Power/STW | 4 charts + fleet overlays | PARTIAL |
| Work Order Management | ✅ Table view + crew assignment | Gantt timeline | ENHANCE |
| CII Compliance | ✅ Badge + trend (just added) | Export + reporting | PARTIAL |
| Operating Mode Detection | ✅ Real-time inference (just added) | Context event timeline | ENHANCE |
| ML Predictions | ✅ LSTM/XGB/RF ensemble + SHAP | Root cause for anomalies | ENHANCE |
| AI Narrative Summaries | ✅ Performance insights (just added) | Interactive chat assistant | ENHANCE |
| 7-Day Forecasting | ❌ Not implemented | Rolling forecast dashboard | NEW |
| Fleet Map | ❌ Not implemented | Geographic visualization | NEW |
| Model Lineage UI | ❌ Backend only | Governance dashboard | NEW |

---

## Phase 1: Geographic Fleet Visualization (Priority 1)
**Effort:** 3-4 days | **Impact:** High | **Risk:** Low

### Features
- Interactive map showing all vessels with real-time positions
- RAG (Red/Amber/Green) health status pins
- Click-through to vessel detail pages
- Filter by vessel type, health status, operating mode
- Auto-refresh every 30 seconds

### Implementation
```typescript
// Backend: server/routes.ts
GET /api/fleet/map-data
Response: {
  vessels: [{
    id: string,
    name: string,
    position: { lat: number, lon: number },
    healthStatus: 'healthy' | 'warning' | 'critical',
    operatingMode: string,
    ciiRating?: 'A' | 'B' | 'C' | 'D' | 'E',
    lastUpdate: Date
  }]
}

// Frontend: client/src/pages/FleetMap.tsx
- Use react-leaflet for map rendering
- RAG pin colors based on equipment health aggregation
- Popup with vessel summary on pin click
- Side panel with vessel list and filters
```

### Dependencies
- `react-leaflet` (already used in marine software)
- `leaflet` CSS
- Position data from vessels table or telemetry

### Acceptance Criteria
- [ ] Map loads with all vessels positioned correctly
- [ ] Health status colors match fleet overview
- [ ] Click pin navigates to vessel detail
- [ ] Filters work without page reload
- [ ] Map auto-refreshes every 30s

---

## Phase 2: Gantt Chart Maintenance Timeline (Priority 1)
**Effort:** 4-5 days | **Impact:** High | **Risk:** Medium

### Features
- Interactive Gantt chart for all work orders
- Drag-to-reschedule work orders
- Color-coded by priority (critical, high, medium, low)
- Status indicators (pending, in-progress, completed, cancelled)
- Crew assignment visibility
- Filter by vessel, status, assigned crew
- Export to PDF/PNG

### Implementation
```typescript
// Backend: server/routes.ts
GET /api/maintenance/timeline
Response: {
  workOrders: [{
    id: string,
    title: string,
    vesselId: string,
    vesselName: string,
    startDate: Date,
    endDate: Date,
    priority: string,
    status: string,
    assignedCrew: string[],
    dependencies: string[] // other WO IDs
  }]
}

PATCH /api/work-orders/:id/reschedule
Body: { startDate: Date, endDate: Date }

// Frontend: client/src/components/maintenance/GanttChart.tsx
- Use @visx/xychart or custom SVG rendering
- Drag handlers for rescheduling
- Timeline zoom (day/week/month views)
- Today marker line
```

### Dependencies
- `@visx/xychart` or `recharts` with custom bars
- Drag-and-drop library or native HTML5 drag API
- Work orders data (already exists)

### Acceptance Criteria
- [ ] All work orders display on timeline
- [ ] Drag work order updates dates in backend
- [ ] Color coding matches priority levels
- [ ] Filter changes don't reset zoom level
- [ ] Export generates usable PDF

---

## Phase 3: Context Event Timeline (Priority 2)
**Effort:** 3-4 days | **Impact:** Medium-High | **Risk:** Low

### Features
- Annotate telemetry charts with operational events
- Voyage phase markers (departure, transit, arrival, port ops)
- Maintenance event overlays
- Weather condition bands
- Operating mode transition indicators
- Link events to predictions for better explainability

### Implementation
```typescript
// Backend: server/routes.ts
GET /api/context/events?vesselId=X&from=Y&to=Z
Response: {
  events: [{
    id: string,
    type: 'voyage' | 'maintenance' | 'weather' | 'mode_change',
    timestamp: Date,
    duration?: number, // minutes
    description: string,
    severity?: string,
    metadata: Record<string, any>
  }]
}

POST /api/context/events
Body: { vesselId, type, timestamp, description, metadata }

// Frontend: Enhance PowerSTWChart and LoadDistributionChart
- Vertical event markers on charts
- Hover tooltip with event details
- Color-coded by event type
- Toggle event types on/off
```

### Integration Points
- Operating mode detection (already implemented)
- Weather service (already integrated)
- Work orders (maintenance events)
- Manual event logging for voyage phases

### Acceptance Criteria
- [ ] Events display as vertical markers on charts
- [ ] Event types have distinct colors
- [ ] Tooltips show full event details
- [ ] Can manually add events via UI
- [ ] Events persist in database

---

## Phase 4: Root Cause Attribution Dashboard (Priority 2)
**Effort:** 3-4 days | **Impact:** High | **Risk:** Low

### Features
- SHAP values for detected anomalies (not just predictions)
- Top 5 contributing sensors visualization
- Historical similar anomaly matches
- Recommended corrective actions from LLM
- Export anomaly report with attribution

### Implementation
```typescript
// Backend: server/ai/root-cause-analyzer.ts
export class RootCauseAnalyzer {
  async analyzeAnomaly(anomalyWindow: TelemetryPoint[]): Promise<{
    topContributors: { sensor: string, weight: number, value: number }[],
    similarHistorical: { timestamp: Date, similarity: number }[],
    recommendedActions: string[],
    confidence: number
  }>
}

GET /api/anomalies/:id/root-cause
Response: RootCauseAnalysis

// Frontend: client/src/components/analytics/RootCauseCard.tsx
- Bar chart of SHAP values
- Sensor contribution breakdown
- Similar anomalies timeline
- Action recommendations list
```

### Integration Points
- Existing SHAP explainability service
- Anomaly detection pipeline
- OpenAI integration for action suggestions
- Telemetry data

### Acceptance Criteria
- [ ] Root cause analysis completes in <2s
- [ ] Top contributors match SHAP output
- [ ] Recommendations are actionable
- [ ] Can export analysis as PDF
- [ ] Historical matches show relevant events

---

## Phase 5: 7-Day Predictive Forecast (Priority 2)
**Effort:** 3-4 days | **Impact:** Medium | **Risk:** Low

### Features
- Rolling 7-day equipment health forecast
- Confidence intervals (80%, 95%)
- Maintenance opportunity windows
- Fuel consumption predictions
- Alert threshold crossings
- Export forecast data

### Implementation
```typescript
// Backend: server/ai/forecast-service.ts
export class ForecastService {
  async generate7DayForecast(
    equipmentId: string,
    orgId: string
  ): Promise<{
    forecasts: {
      date: Date,
      healthScore: number,
      confidence: { lower80: number, upper80: number, lower95: number, upper95: number },
      maintenanceWindow: boolean,
      predictedFailureProbability: number
    }[],
    fuelConsumption: { date: Date, tonnes: number, confidence: number }[],
    alerts: { date: Date, type: string, severity: string }[]
  }>
}

GET /api/forecast/:equipmentId/7day

// Frontend: client/src/pages/ForecastDashboard.tsx
- Line chart with confidence bands
- Highlight maintenance windows
- Alert markers
- Compare forecast vs actual (after time passes)
```

### Integration Points
- Existing LSTM prediction model
- Telemetry aggregation
- Maintenance scheduling
- Weather forecast integration

### Acceptance Criteria
- [ ] Forecast generates for all equipment
- [ ] Confidence intervals are reasonable
- [ ] Maintenance windows align with predictions
- [ ] Can compare forecast accuracy over time
- [ ] Export includes all forecast data

---

## Phase 6: AI Chat Assistant (Priority 3)
**Effort:** 2-3 days | **Impact:** Medium | **Risk:** Low

### Features
- Chat interface for asking questions about equipment
- Explain predictions and anomalies in plain language
- Search historical patterns
- Suggest maintenance actions
- Context-aware responses using vessel/equipment data

### Implementation
```typescript
// Backend: server/ai/copilot-service.ts
export class CoPilotService {
  async chat(
    message: string,
    context: { vesselId?: string, equipmentId?: string },
    orgId: string
  ): Promise<{
    response: string,
    sources: { type: string, id: string, relevance: number }[],
    suggestedActions: string[]
  }>
}

POST /api/copilot/chat
Body: { message, context }

// Frontend: client/src/components/ai/CoPilotPanel.tsx
- Chat message list
- Input with send button
- Context badges (current vessel/equipment)
- Source citations for responses
- Copy response button
```

### Integration Points
- Existing OpenAI integration
- Equipment health data
- Prediction results
- Work order history
- Telemetry data

### Acceptance Criteria
- [ ] Chat responds in <3s
- [ ] Answers are contextually relevant
- [ ] Citations link to actual data
- [ ] Can handle follow-up questions
- [ ] Conversation history persists in session

---

## Implementation Roadmap

### Sprint 1 (Week 1): Foundation
- **Days 1-2:** Fleet Map backend + basic frontend
- **Days 3-5:** Fleet Map interactive features + filters

### Sprint 2 (Week 2): Planning Tools  
- **Days 1-3:** Gantt Chart backend + rendering
- **Days 4-5:** Gantt Chart drag-to-reschedule + export

### Sprint 3 (Week 3): Intelligence
- **Days 1-2:** Context Event Timeline backend + UI
- **Days 3-5:** Root Cause Attribution + 7-Day Forecast

### Sprint 4 (Week 4): Assistant & Polish
- **Days 1-2:** AI Chat Assistant
- **Days 3-5:** Testing, bug fixes, documentation

---

## Resource Requirements

### Development
- 1 Full-stack developer: 18-22 days
- 1 QA tester: 5 days (parallel testing)

### Third-Party Services
- OpenAI API: Additional chat tokens (~$20-50/month)
- Map tiles: Free tier (OpenStreetMap) sufficient

### Infrastructure
- No additional cloud resources needed
- Uses existing PostgreSQL, Redis, OpenAI setup

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Map performance with 100+ vessels | Low | Medium | Clustering, lazy loading |
| Gantt drag-drop browser compatibility | Low | Low | Polyfill, fallback to modal edit |
| OpenAI rate limits | Medium | Low | Response caching, queue management |
| 7-day forecast accuracy | Medium | Medium | Confidence intervals, model tuning |
| SHAP computation slowness | Low | Medium | Background jobs, caching |

---

## Success Metrics

### User Experience
- Fleet map loads in <2s with 100 vessels
- Gantt chart handles 500+ work orders smoothly
- Chat assistant responds in <3s average
- Root cause analysis available for all anomalies

### Business Value
- 20% reduction in maintenance planning time (Gantt)
- 15% better resource allocation (Fleet Map)
- 30% faster anomaly investigation (Root Cause + Chat)
- 10% fewer unplanned breakdowns (7-Day Forecast)

### Technical Quality
- All new features <150ms backend latency (p95)
- 100% test coverage for new services
- Zero breaking changes to existing features
- Full mobile responsiveness

---

## Conclusion

These 6 enhancements leverage ARUS's existing infrastructure (ML models, OpenAI integration, telemetry pipeline) to provide enterprise-grade features found in commercial marine PdM suites. The phased approach allows incremental delivery and validation.

**Recommended Start:** Phase 1 (Fleet Map) - highest visual impact, lowest risk, fastest to market.

**Next Steps:**
1. Review and approve implementation plan
2. Allocate development resources
3. Set up feature flags for gradual rollout
4. Begin Sprint 1 with Fleet Map foundation
