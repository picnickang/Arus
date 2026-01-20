# Crew Management System Improvements - Implementation Strategy

**Date**: November 28, 2025  
**Estimated Total Effort**: 40-55 hours (revised after architecture review)  
**Priority Focus**: Maritime Regulatory Compliance (STCW, Port State Control)  
**Baseline Document**: `docs/crew-stack-notes.md` (architectural summary)

---

## Executive Summary

This document outlines a phased implementation strategy for enhancing the ARUS crew management system. The improvements target three key areas:
1. **Regulatory Compliance** - Certification expiry alerts and document tracking
2. **Operational Efficiency** - Schedule-to-HoR automation
3. **Safety Enhancement** - Fatigue risk monitoring and fleet compliance dashboard

**Reference**: See `docs/crew-stack-notes.md` for the complete baseline analysis of existing screens, APIs, schemas, and deployment modes.

### Architecture Review Notes
The architect review identified the following critical requirements:
- All API endpoints must follow existing `requireOrgId` middleware patterns in `routes.ts`
- Schema changes must use Drizzle ORM with proper insert schemas (no raw SQL ALTERs)
- Storage interface (`IStorage`) must be updated for all new CRUD operations
- Background job infrastructure requires pg-boss integration for scheduled tasks
- React Query cache invalidation must be explicit for all mutations
- The schedule publication pipeline does NOT currently exist and must be built as part of Phase 3

### Dual-Mode Compatibility Requirements

All changes must work in both deployment modes:

| Requirement | Cloud (PostgreSQL) | Vessel (SQLite) |
|-------------|-------------------|-----------------|
| Schema tables | `shared/schema.ts` | `shared/schema-sqlite-vessel.ts` |
| Runtime exports | `shared/schema-runtime.ts` (auto-selects) | Same file |
| Tenant isolation | `x-org-id` header via `requireOrgId` | Same pattern |
| Background jobs | pg-boss (full features) | node-cron fallback or disabled |
| Offline behavior | N/A | Core functions work without network |

**Critical**: New tables/columns must be defined in BOTH schema files with compatible types.

### Offline/Vessel Mode Considerations
- All crew/scheduler/HoR core functions must work offline
- No mandatory external API calls for scheduling or compliance
- Background jobs gracefully skip if pg-boss unavailable in vessel mode
- Sync conflict resolution uses existing outbox pattern

### Permissions/Roles
If `users.role` field is populated, enforce:
- `admin`, `manager`: Full CRUD on crew, schedules, HoR
- `technician`: View crew, limited schedule edits
- `viewer`: Read-only access

Check existing role enforcement in `server/middleware/auth.ts` before adding new restrictions.

---

## Phase 1: Certification Expiry Warning System (Priority: High)
**Estimated Effort**: 6-8 hours (revised)  
**Regulatory Impact**: Port State Control compliance, STCW requirements

### Business Value
- Prevents crew from working with expired certifications
- Avoids port detentions due to documentation issues
- Automated alerts reduce administrative burden

### Technical Approach

#### Existing Schema Reference
The `crew_cert` table already exists in `shared/schema.ts` (line 2693):
```typescript
export const crewCertification = pgTable(
  "crew_cert",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").notNull().references(() => organizations.id),
    crewId: varchar("crew_id").notNull().references(() => crew.id),
    cert: text("cert").notNull(), // STCW, BOSIET, etc.
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    issuedBy: text("issued_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  }
);
```

#### Schema Additions (Drizzle ORM)
```typescript
// In shared/schema.ts - ADD columns to existing crewCertification table
// NOTE: Use npm run db:push to sync, NOT raw SQL

// Add to crewCertification definition:
alertSent30: boolean("alert_sent_30").default(false),
alertSent60: boolean("alert_sent_60").default(false),
alertSent90: boolean("alert_sent_90").default(false),
lastAlertDate: timestamp("last_alert_date", { mode: "date" }),
acknowledgedBy: varchar("acknowledged_by", { length: 255 }),
acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
```

#### Storage Interface Updates
```typescript
// In server/storage.ts - Add to IStorage interface:
getCertificationsExpiring(orgId: string, daysWindow: number): Promise<SelectCrewCertification[]>;
acknowledgeCertificationAlert(id: string, userId: string): Promise<void>;
updateCertificationAlertFlags(id: string, flags: { alert30?: boolean; alert60?: boolean; alert90?: boolean }): Promise<void>;
```

#### API Endpoints (Following existing patterns)
| Method | Endpoint | Description | Middleware |
|--------|----------|-------------|------------|
| GET | `/api/crew/certifications/expiring` | List expiring certs | requireOrgId, crewOperationRateLimit |
| GET | `/api/crew/:crewId/certifications` | Get crew's certs | requireOrgId |
| PATCH | `/api/crew/certifications/:id/acknowledge` | Acknowledge alert | requireOrgId |

#### Background Job (pg-boss)
```typescript
// In server/routes.ts - Register job processor
// Similar to existing insights job pattern

// Job: check-certification-expiry (runs nightly via cron)
import Boss from 'pg-boss';

async function registerCertificationExpiryJob(boss: Boss, storage: IStorage) {
  await boss.schedule('check-certification-expiry', '0 3 * * *'); // 3 AM daily
  
  boss.work('check-certification-expiry', async (job) => {
    const orgs = await storage.getAllOrganizations();
    for (const org of orgs) {
      await checkAndUpdateExpiryAlerts(org.id, storage);
    }
  });
}
```

#### Frontend Components
1. **CertificationAlertBanner** - Top-level warning in UnifiedCrewManagement
2. **CertificationStatusBadge** - Visual indicator (green/amber/red) per crew member
3. **ExpiryFilterPanel** - Filter crew by certification expiry window
4. **CrewScheduler Integration** - Warning when assigning crew with expiring certs

#### Cache Invalidation
```typescript
// On mutation success:
queryClient.invalidateQueries({ queryKey: ['/api/crew/certifications'] });
queryClient.invalidateQueries({ queryKey: ['/api/crew', crewId, 'certifications'] });
```

#### Implementation Steps
1. Update `shared/schema.ts` with alert tracking columns (Drizzle format)
2. Run `npm run db:push` to sync schema
3. Update `IStorage` interface and `DatabaseStorage` class
4. Add API endpoints following existing routing patterns
5. Register pg-boss job for nightly expiry scanning
6. Build alert banner component with filter integration
7. Add scheduler warning indicators
8. Write unit tests for expiry logic

### Dependencies
- None (standalone feature, uses existing pg-boss infrastructure)

---

## Phase 2: Crew Document Management (Priority: High)
**Estimated Effort**: 4-5 hours  
**Regulatory Impact**: ISM Code, Flag State requirements
**Status**: ✅ COMPLETE (November 28, 2025)

### Implementation Summary (Completed)
- ✅ Database schema: `crew_documents` table added to both PostgreSQL and SQLite schemas
- ✅ Storage interface: Full CRUD methods in IStorage, MemStorage, DatabaseStorage
- ✅ Repository layer: CrewRepository with document methods
- ✅ Service layer: CrewService with audit trail integration
- ✅ API endpoints: GET/POST/PATCH/DELETE for documents, expiry alerts, scan-expiry
- ✅ Frontend: DocumentExpiryAlertBanner, CrewDocumentsTab, integrated into UnifiedCrewManagement
- ✅ Profile dialog: New crew profile dialog with Details and Documents tabs

### Business Value
- Centralized document tracking (passport, seaman's book, visa)
- Proactive expiry management
- Audit-ready document records

### Technical Approach

#### Database Schema
```typescript
// In shared/schema.ts
export const crewDocuments = pgTable('crew_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: varchar('org_id', { length: 255 }).notNull(),
  crewId: uuid('crew_id').references(() => crew.id).notNull(),
  documentType: varchar('document_type', { length: 50 }).notNull(), // 'passport', 'seaman_book', 'visa', 'medical', 'endorsement'
  documentNumber: varchar('document_number', { length: 100 }),
  issuingAuthority: varchar('issuing_authority', { length: 255 }),
  issuedAt: timestamp('issued_at'),
  expiresAt: timestamp('expires_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

#### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crew/:id/documents` | List all documents for crew member |
| POST | `/api/crew/:id/documents` | Add new document |
| PATCH | `/api/crew/documents/:docId` | Update document |
| DELETE | `/api/crew/documents/:docId` | Remove document |
| GET | `/api/crew/documents/expiring` | List all expiring documents (query: days) |

#### Frontend Components
1. **CrewDocumentsTab** - Tab in crew profile drawer
2. **DocumentFormDialog** - Add/edit document modal
3. **DocumentExpiryWidget** - Dashboard summary of expiring docs
4. Reuse CertificationAlertBanner pattern for document alerts

#### Implementation Steps
1. Create crew_documents schema and migrations
2. Add storage interface methods
3. Build CRUD API endpoints with Zod validation
4. Create document management UI components
5. Integrate with existing expiry alert system
6. Add document type icons (passport, visa, etc.)

### Dependencies
- Phase 1 (reuses expiry alert infrastructure)

---

## Phase 3: Auto-populate Hours of Rest from Scheduler (Priority: Medium-High)
**Estimated Effort**: 10-14 hours (revised - includes missing publication pipeline)  
**Regulatory Impact**: STCW compliance automation

### ⚠️ Prerequisite Work
**CRITICAL**: The schedule publication workflow does NOT currently exist. The current scheduler only generates assignments in memory or saves them temporarily. A complete publication pipeline must be built.

### Business Value
- Eliminates manual HoR data entry
- Reduces human error in compliance records
- Creates audit trail linking schedules to rest records

### Technical Approach

#### Existing Schema Reference
The `crew_rest_sheet` table exists (line 2861) but lacks schedule linking:
```typescript
export const crewRestSheet = pgTable("crew_rest_sheet", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  crewId: varchar("crew_id").notNull(),
  crewName: text("crew_name"),
  shipName: text("ship_name"),
  imoNumber: text("imo_number"),
  watchType: text("watch_type"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  // ... more fields
});
```

#### New Schema: Schedule Publication
```typescript
// In shared/schema.ts - NEW table for schedule publication tracking
export const scheduleRuns = pgTable("schedule_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  mode: text("mode").notNull(), // 'dry_run', 'execute', 'auto'
  startedAt: timestamp("started_at", { mode: "date" }).defaultNow(),
  completedAt: timestamp("completed_at", { mode: "date" }),
  status: text("status").notNull().default("draft"), // 'draft', 'approved', 'published', 'cancelled'
  statsAssigned: integer("stats_assigned").default(0),
  statsUnfilled: integer("stats_unfilled").default(0),
  statsDurationMs: integer("stats_duration_ms"),
  publishedAt: timestamp("published_at", { mode: "date" }),
  publishedBy: varchar("published_by", { length: 255 }),
  horGenerated: boolean("hor_generated").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const scheduleAssignments = pgTable("schedule_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  runId: varchar("run_id").notNull().references(() => scheduleRuns.id),
  date: text("date").notNull(), // YYYY-MM-DD format
  shiftId: varchar("shift_id").notNull(),
  crewId: varchar("crew_id").notNull().references(() => crew.id),
  vesselId: varchar("vessel_id").references(() => vessels.id),
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(),
  role: text("role"),
  executed: boolean("executed").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Modify existing crewRestSheet - ADD columns:
scheduleRunId: varchar("schedule_run_id").references(() => scheduleRuns.id),
sourceType: text("source_type").default("manual"), // 'manual', 'schedule', 'import'
```

#### Storage Interface Updates
```typescript
// In server/storage.ts - Add to IStorage:
// Schedule Runs
createScheduleRun(orgId: string, run: InsertScheduleRun): Promise<SelectScheduleRun>;
getScheduleRuns(orgId: string, limit?: number): Promise<SelectScheduleRun[]>;
getScheduleRunById(id: string): Promise<SelectScheduleRun | undefined>;
updateScheduleRunStatus(id: string, status: string, publishedBy?: string): Promise<void>;

// Schedule Assignments
saveScheduleAssignments(orgId: string, runId: string, assignments: InsertScheduleAssignment[]): Promise<void>;
getScheduleAssignments(runId: string): Promise<SelectScheduleAssignment[]>;
getScheduleAssignmentsByDateRange(orgId: string, from: string, to: string): Promise<SelectScheduleAssignment[]>;

// HoR Generation
generateHoRFromSchedule(runId: string, generateForMonth: number, generateForYear: number): Promise<void>;
```

#### API Endpoints (Following existing patterns)
| Method | Endpoint | Description | Middleware |
|--------|----------|-------------|------------|
| GET | `/api/schedule/runs` | List schedule runs | requireOrgId |
| POST | `/api/schedule/plan` | Execute scheduling (creates run) | requireOrgId |
| POST | `/api/schedule/:runId/publish` | Publish and persist schedule | requireOrgId |
| POST | `/api/schedule/:runId/generate-hor` | Generate HoR from schedule | requireOrgId |
| GET | `/api/schedule/assignments` | Get assignments for date range | requireOrgId |
| GET | `/api/hor/preview` | Preview HoR before commit | requireOrgId |

#### Idempotency & Error Handling
```typescript
// Use existing idempotency pattern from routes.ts
const idempotencyKey = req.headers['x-idempotency-key'];
if (idempotencyKey) {
  const isDuplicate = await storage.checkIdempotency(idempotencyKey, '/api/schedule/generate-hor');
  if (isDuplicate) {
    incrementIdempotencyHit('/api/schedule/generate-hor');
    return res.status(200).json({ message: 'Already processed' });
  }
}

// Transaction wrapper for HoR generation
await db.transaction(async (tx) => {
  // 1. Lock schedule run record
  // 2. Transform assignments to rest periods
  // 3. Insert rest_day records
  // 4. Update schedule run horGenerated flag
  // 5. Record idempotency
});
```

#### Workflow
```
CrewScheduler → "Execute Schedule" → POST /api/schedule/plan
     ↓
Creates scheduleRun (status: draft) + scheduleAssignments
     ↓
"Preview Compliance" → POST /api/schedule/:runId/preview-compliance (Phase 5)
     ↓
"Publish Schedule" → Confirm dialog → POST /api/schedule/:runId/publish
     ↓
Status changes to 'published', assignments marked executed
     ↓
"Generate Hours of Rest" → POST /api/schedule/:runId/generate-hor
     ↓
Backend transforms assignments to rest periods using SGT timezone
     ↓
Creates crew_rest_day entries linked to schedule_run_id
     ↓
HoursOfRestGrid shows auto-populated data (sourceType: 'schedule')
```

#### Cache Invalidation
```typescript
// After publish:
queryClient.invalidateQueries({ queryKey: ['/api/schedule/runs'] });
queryClient.invalidateQueries({ queryKey: ['/api/schedule/assignments'] });

// After HoR generation:
queryClient.invalidateQueries({ queryKey: ['/api/stcw/rest'] });
queryClient.invalidateQueries({ queryKey: ['/api/hor'] });
```

#### Implementation Steps
1. Create `scheduleRuns` and `scheduleAssignments` schemas in `shared/schema.ts`
2. Add `scheduleRunId` and `sourceType` to `crewRestSheet` 
3. Run `npm run db:push` to sync schema
4. Update `IStorage` interface with all schedule CRUD operations
5. Implement `DatabaseStorage` methods
6. Build `/api/schedule/plan` to save runs and assignments
7. Build `/api/schedule/:runId/publish` endpoint
8. Build assignment-to-rest transformation logic with SGT timezone handling
9. Build `/api/schedule/:runId/generate-hor` endpoint with idempotency
10. Update CrewScheduler UI with publish workflow
11. Add HoR preview before generation
12. Handle conflict detection for overlapping manual entries
13. Write integration tests for the full workflow

### Dependencies
- Existing scheduler algorithm (verified ✓)
- STCW compliance checker (exists ✓)
- **NEW**: Schedule publication infrastructure must be built first

---

## Phase 4: Fatigue Risk Score Indicator (Priority: Medium)
**Estimated Effort**: 4-5 hours  
**Regulatory Impact**: Safety management, ISM Code
**Status**: ✅ COMPLETE (November 28, 2025)

### Implementation Summary (Completed)
- ✅ Fatigue calculation algorithm in stcw-compliance.ts with weighted scoring
- ✅ API endpoints: GET /api/hor/fatigue/:crewId, /api/hor/fatigue/vessel/:vesselId, /api/hor/fatigue/fleet
- ✅ FatigueRiskBadge component with popover showing contributing factors
- ✅ FatigueSummaryCard for vessel-level overview
- ✅ Integration into HoursOfRestGrid and schedule-board assignments table

### Business Value
- Proactive fatigue risk identification
- Data-driven watch schedule optimization
- Safety culture enhancement

### Technical Approach

#### Fatigue Risk Algorithm
```typescript
interface FatigueMetrics {
  sleepDebt24h: number;        // Hours below 10h rest in 24h periods
  sleepDebt7d: number;         // Hours below 77h rest in 7 day window
  consecutiveNightShifts: number;
  timeSinceLastFullRest: number; // Hours
  nightWorkRatio: number;      // % of work hours at night (22:00-06:00)
}

function calculateFatigueRisk(metrics: FatigueMetrics): 'low' | 'medium' | 'high' | 'critical' {
  let score = 0;
  
  if (metrics.sleepDebt24h > 0) score += metrics.sleepDebt24h * 10;
  if (metrics.sleepDebt7d > 0) score += metrics.sleepDebt7d * 5;
  if (metrics.consecutiveNightShifts >= 3) score += 20;
  if (metrics.consecutiveNightShifts >= 5) score += 30;
  if (metrics.nightWorkRatio > 0.5) score += 15;
  
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}
```

#### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hor/fatigue/:crewId` | Get fatigue metrics for crew |
| GET | `/api/hor/fatigue/vessel/:vesselId` | Vessel-wide fatigue summary |

#### Frontend Components
1. **FatigueRiskBadge** - Color-coded indicator (green/amber/orange/red)
2. **FatigueDetailsPopover** - Breakdown of contributing factors
3. **HoRGrid integration** - Fatigue column in summary view
4. **CrewScheduler warnings** - Flag high-fatigue crew in assignments

#### Implementation Steps
1. Extend stcw-compliance.ts with fatigue calculations
2. Create fatigue API endpoints
3. Build FatigueRiskBadge component
4. Integrate into HoursOfRestGrid
5. Add warnings to CrewScheduler crew selection

### Dependencies
- Phase 3 (relies on normalized rest data)

---

## Phase 5: Schedule-to-HoR Validation Preview (Priority: Medium)
**Estimated Effort**: 3-4 hours  
**Regulatory Impact**: STCW preventive compliance
**Status**: ✅ COMPLETE (November 28, 2025)

### Implementation Summary (Completed)
- ✅ API endpoint: POST /api/schedule/preview-compliance
- ✅ compliance-preview.ts module with assignment-to-rest conversion and STCW checks
- ✅ CompliancePreviewModal component with violation grouping and acknowledgment flow
- ✅ Gating logic: blocks publish on violations, requires acknowledgment for warnings
- ✅ schedule-board.tsx integration: publish button opens compliance preview first

### Business Value
- Catch STCW violations before they happen
- Reduce rework from invalid schedules
- Training tool for scheduling supervisors

### Technical Approach

#### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedule/preview-compliance` | Validate draft schedule against STCW |

#### Request/Response
```typescript
// Request
interface PreviewComplianceRequest {
  scheduleRunId?: string;  // For saved schedules
  assignments?: Assignment[]; // For draft validation
}

// Response
interface PreviewComplianceResponse {
  isCompliant: boolean;
  violations: Array<{
    crewId: string;
    crewName: string;
    date: string;
    rule: '10h_24h' | '77h_7d' | 'consecutive_days';
    description: string;
    severity: 'warning' | 'violation';
  }>;
  summary: {
    totalCrew: number;
    compliantCrew: number;
    violationCount: number;
    warningCount: number;
  };
}
```

#### Frontend Components
1. **CompliancePreviewModal** - Show violations before publishing
2. **ComplianceGate** - Block publish if critical violations
3. Violation list with crew details and suggested fixes

#### Implementation Steps
1. Create preview-compliance endpoint reusing STCW checker
2. Build CompliancePreviewModal component
3. Add "Preview Compliance" button before Publish
4. Implement gating logic for critical violations
5. Add "Ignore Warning" acknowledgment flow

### Dependencies
- Phase 3 & 4 (schedule-to-HoR and fatigue calculations)

---

## Phase 6: Fleet STCW Compliance Dashboard (Priority: Medium)
**Estimated Effort**: 4-5 hours  
**Regulatory Impact**: Fleet-wide compliance monitoring
**Status**: ✅ COMPLETE (November 28, 2025)

### Implementation Summary (Completed)
- ✅ API endpoints: GET /api/dashboard/stcw-summary, /api/dashboard/stcw-summary/vessel/:id, /api/dashboard/stcw-trends
- ✅ stcw-dashboard.ts service module with fleet and vessel aggregation
- ✅ STCWComplianceWidget dashboard component with:
  - Fleet-wide compliance summary metrics
  - VesselRow expandable breakdown with drill-down
  - ComplianceTrendChart with Recharts visualization
  - TopIssues panel for critical attention items
- ✅ Dashboard integration: widget added after FleetRisksCard on main dashboard
- ✅ Navigation: links to Hours of Rest dashboard for detailed review

### Business Value
- Executive visibility into compliance status
- Early warning for fleet-wide trends
- ISM Code audit readiness

### Technical Approach

#### Database Schema
```typescript
// Materialized view for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fleet_stcw_summary AS
SELECT 
  org_id,
  vessel_id,
  DATE_TRUNC('day', date) as report_date,
  COUNT(DISTINCT crew_id) as total_crew,
  SUM(CASE WHEN is_compliant THEN 1 ELSE 0 END) as compliant_crew,
  AVG(rest_hours_24h) as avg_rest_24h,
  AVG(rest_hours_7d) as avg_rest_7d,
  COUNT(CASE WHEN fatigue_risk = 'high' OR fatigue_risk = 'critical' THEN 1 END) as high_fatigue_count
FROM crew_rest_day_summary
GROUP BY org_id, vessel_id, DATE_TRUNC('day', date);
```

#### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stcw-summary` | Fleet compliance overview |
| GET | `/api/dashboard/stcw-summary/vessel/:id` | Per-vessel details |
| GET | `/api/dashboard/stcw-trends` | 7/30 day compliance trends |

#### Frontend Components
1. **STCWComplianceWidget** - Dashboard card with fleet summary
2. **VesselComplianceBreakdown** - Expandable per-vessel view
3. **ComplianceTrendChart** - Line chart showing compliance % over time
4. **FatigueHeatmap** - Visual overview of fatigue risk by vessel/date

#### Implementation Steps
1. Create materialized view for summary data
2. Build summary API endpoints
3. Create STCWComplianceWidget component
4. Add to main dashboard page
5. Implement trend charts with Recharts
6. Add drill-down navigation to HoR grid

### Dependencies
- Phases 3, 4, 5 (complete HoR and fatigue data pipeline)

---

## Implementation Timeline (Revised)

| Phase | Feature | Effort | Dependencies | Target | Risk Level |
|-------|---------|--------|--------------|--------|------------|
| 1 | Certification Expiry Alerts | 6-8h | None | Week 1 | Low |
| 2 | Document Management | 5-7h | Phase 1 | Week 1-2 | Low |
| 3 | Schedule Publication + HoR Integration | 10-14h | None | Week 2-3 | **High** |
| 4 | Fatigue Risk Score | 5-7h | Phase 3 | Week 3 | Medium |
| 5 | Compliance Preview | 4-5h | Phase 3, 4 | Week 3-4 | Low |
| 6 | Fleet Dashboard | 5-7h | All previous | Week 4 | Low |

**Total Revised Estimate**: 35-48 hours

### Risk Assessment
- **Phase 3 (High Risk)**: Requires building entire schedule publication pipeline that doesn't exist. Complex timezone handling for SGT. High integration complexity with existing scheduler.
- **Phase 4 (Medium Risk)**: Algorithm complexity for accurate fatigue scoring. Requires validation against maritime fatigue research.

---

## Prerequisites Checklist

Before starting implementation:
- [ ] Confirm pg-boss job queue is configured and running
- [ ] Verify existing `crewCertification` table has data for testing
- [ ] Understand current HoR data flow and timezone handling
- [ ] Review STCW compliance rules with maritime operations team
- [ ] Create test data fixtures for integration testing

---

## Testing Strategy

### Unit Tests
- Certification expiry date calculations
- Fatigue risk algorithm
- STCW compliance rules
- Schedule-to-rest transformation

### Integration Tests
- API endpoint validation
- Database schema migrations
- Real-time alert triggers

### E2E Tests (Playwright)
- Certification alert workflow
- Document CRUD operations
- Schedule publish → HoR generation flow
- Dashboard widget rendering

---

## Risk Considerations

1. **Timezone Handling** - All times stored in UTC, displayed in Singapore Time (SGT)
2. **Data Migration** - Existing rest data may need backfilling for fatigue calculations
3. **Performance** - Materialized view refresh scheduling for dashboard
4. **Regulatory Accuracy** - STCW rules must be precisely implemented

---

## Next Steps

1. ✅ Confirm existing schema entities and gaps
2. 🔲 Begin Phase 1: Certification Expiry Alerts
3. 🔲 Create frontend wireframes for approval
4. 🔲 Set up automated testing pipeline

**Approval Required Before Implementation**: Yes  
**Stakeholder Review**: Maritime Operations Team
