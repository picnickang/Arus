# ARUS Crew Management Stack - Architectural Summary

**Generated**: November 28, 2025  
**Purpose**: Document existing implementation before upgrading crew management, scheduler, and HoR modules

---

## 1. Current Implementation Summary

### 1.1 Crew Management

**Location**:

- Frontend: `client/src/pages/crew-management.tsx` → `client/src/components/UnifiedCrewManagement.tsx`
- Backend: `server/domains/crew/` (routes.ts, service.ts, repository.ts)

**Existing UX**:

- ✅ Crew list with search, filter by vessel/rank/status/skill
- ✅ Add/Edit/Delete crew members via dialogs
- ✅ Toggle active/inactive status
- ✅ Toggle on-duty/off-duty status
- ✅ Skill assignment and management
- ✅ Sortable columns (name, rank, vessel, status, duty)
- ✅ CSV export
- ✅ Debounced search for performance

**NOT Implemented**:

- ❌ Certification expiry warnings/badges
- ❌ Certification expiry filters ("expiring soon", "expired")
- ❌ Crew document tracking UI
- ❌ Fleet-wide compliance dashboard

---

### 1.2 Crew Scheduler

**Location**:

- Frontend: `client/src/pages/crew-scheduler.tsx` → `client/src/components/CrewScheduler.tsx`
- Backend: `server/crew-scheduler.ts` (greedy algorithm), `server/crew-scheduler-ortools.ts` (constraint-based OR-Tools)

**Existing UX**:

- ✅ Shift template management (CRUD)
- ✅ Date range selection for scheduling
- ✅ Two scheduling engines: Greedy and OR-Tools
- ✅ STCW compliance validation toggle (`validateSTCW`)
- ✅ Port call and drydock window management
- ✅ Fairness visualization (`FairnessViz` component)
- ✅ Filter by vessel and crew
- ✅ Preference weights configuration (unfilled, fairness, night_over, etc.)
- ✅ Night shift limits (`max_nights_per_week`)

**Existing Scheduling Logic**:

- ✅ Skill matching for shifts
- ✅ Leave period exclusion
- ✅ Minimum rest time between shifts
- ✅ Maximum hours per 7-day rolling window
- ✅ Vessel assignment matching
- ✅ Fairness distribution (in OR-Tools engine)
- ✅ Night shift tracking and limits

**NOT Implemented**:

- ❌ Schedule publication workflow (save/approve/publish)
- ❌ Auto-populate Hours of Rest from published schedules
- ❌ Schedule-to-HoR preview before publishing
- ❌ Persisted schedule runs with audit trail

---

### 1.3 Hours of Rest (HoR)

**Location**:

- Frontend: `client/src/pages/hours-of-rest.tsx` → `client/src/components/HoursOfRestGrid.tsx`
- Backend: STCW compliance in `server/stcw-compliance.ts`, PDF generation in `server/stcw-pdf-generator.ts`

**Existing UX**:

- ✅ 24-hour grid per day with click/drag to mark rest/work
- ✅ Month/year selection
- ✅ Crew and vessel selection
- ✅ Pattern application (4-8 watch, 6-6 split, night watch, day shift)
- ✅ CSV import/export
- ✅ Copy previous day functionality
- ✅ Undo/redo support
- ✅ Real-time STCW compliance checking
- ✅ Visual compliance indicators (daily status badges)
- ✅ Rest total display per day
- ✅ Month compliance summary
- ✅ PDF export of rest sheets

**STCW Compliance Engine** (`server/stcw-compliance.ts`):

- ✅ Minimum 10 hours rest in any 24-hour period
- ✅ Minimum 77 hours rest in any 7-day period
- ✅ Split rest rule (≤2 periods, at least one ≥6h)
- ✅ Rolling 7-day compliance calculation
- ✅ `checkMonthCompliance()` function

**NOT Implemented**:

- ❌ Auto-population from scheduler
- ❌ Fatigue risk score indicator
- ❌ Fleet-wide compliance dashboard
- ❌ Schedule run linkage (`scheduleRunId`)

---

## 2. Database Schema

### 2.1 Crew Tables (PostgreSQL)

```typescript
// shared/schema.ts line 2549
crew: {
  id, orgId, vesselId, name, rank, maxHours7d, minRestH,
  active, onDuty, createdAt, updatedAt
}

// line 2595
crewSkill: { id, orgId, crewId, skill, proficiency, createdAt }

// line 2614
crewLeave: { id, orgId, crewId, start, end, reason, createdAt }

// line 2637
shiftTemplate: { id, orgId, vesselId, role, durationH, start, end,
  skillRequired, needed, description, createdAt }

// line 2663
crewAssignment: { id, orgId, crewId, vesselId, shiftId, date,
  start, end, role, createdAt }

// line 2693
crewCertification (crew_cert): { id, orgId, crewId, cert, expiresAt,
  issuedBy, createdAt }
// NOTE: Missing alert tracking columns (alertSent30, alertSent60, etc.)

// line 2861
crewRestSheet: { id, orgId, crewId, crewName, shipName, imoNumber,
  watchType, month, year, createdAt }
// NOTE: Missing scheduleRunId, sourceType columns

// line 2886
crewRestDay: { id, sheetId, date, h0..h23 (24 columns), createdAt }
```

### 2.2 SQLite Parity

All crew tables have SQLite equivalents in `shared/schema-sqlite-vessel.ts`:

- `crewSqlite`, `crewSkillSqlite`, `crewLeaveSqlite`
- `shiftTemplateSqlite`, `crewAssignmentSqlite`
- `crewCertificationSqlite`, `crewRestSheetSqlite`, `crewRestDaySqlite`

Unified exports via `shared/schema-runtime.ts` with `isLocalMode` check.

---

## 3. API Endpoints

### 3.1 Crew Domain Routes (`server/domains/crew/routes.ts`)

| Method | Endpoint                               | Description                                     |
| ------ | -------------------------------------- | ----------------------------------------------- |
| GET    | `/api/crew`                            | List all crew (optional: orgId, vesselId query) |
| POST   | `/api/crew`                            | Create crew member                              |
| GET    | `/api/crew/:id`                        | Get crew by ID                                  |
| PUT    | `/api/crew/:id`                        | Update crew                                     |
| DELETE | `/api/crew/:id`                        | Delete crew                                     |
| GET    | `/api/crew/:id/skills`                 | Get crew skills                                 |
| POST   | `/api/crew/:id/skills`                 | Add skill                                       |
| DELETE | `/api/crew/:id/skills/:skillId`        | Remove skill                                    |
| GET    | `/api/crew/:id/leave`                  | Get crew leave                                  |
| POST   | `/api/crew/:id/leave`                  | Add leave                                       |
| DELETE | `/api/crew/:id/leave/:leaveId`         | Delete leave                                    |
| GET    | `/api/crew/:id/certifications`         | Get certifications                              |
| POST   | `/api/crew/:id/certifications`         | Add certification                               |
| DELETE | `/api/crew/:id/certifications/:certId` | Delete certification                            |

### 3.2 Scheduler Routes (`server/routes.ts`)

| Method | Endpoint                            | Description                 |
| ------ | ----------------------------------- | --------------------------- |
| GET    | `/api/shift-templates`              | List shift templates        |
| POST   | `/api/shift-templates`              | Create shift template       |
| PUT    | `/api/shift-templates/:id`          | Update template             |
| DELETE | `/api/shift-templates/:id`          | Delete template             |
| POST   | `/api/crew-scheduler/plan`          | Execute scheduling (greedy) |
| POST   | `/api/crew-scheduler/plan-enhanced` | Execute with OR-Tools       |
| GET    | `/api/crew-assignments`             | Get assignments             |
| POST   | `/api/crew-assignments`             | Create assignment           |

### 3.3 HoR Routes (`server/routes.ts`)

| Method | Endpoint               | Description            |
| ------ | ---------------------- | ---------------------- |
| GET    | `/api/stcw/rest`       | Get rest records       |
| POST   | `/api/stcw/rest/save`  | Save rest sheet + days |
| POST   | `/api/stcw/rest/check` | Check STCW compliance  |
| GET    | `/api/stcw/rest/pdf`   | Generate PDF export    |

---

## 4. Deployment Mode Handling

**Detection** (`shared/schema-runtime.ts`):

```javascript
const isLocalMode = process.env.LOCAL_MODE === "true" || process.env.EMBEDDED_MODE === "true";
const DEPLOYMENT_MODE = isLocalMode ? "VESSEL" : "CLOUD";
```

**Schema Selection**:

- `isLocalMode = true` → SQLite tables (libSQL/Turso)
- `isLocalMode = false` → PostgreSQL tables (Neon)

**Offline Considerations**:

- All core crew/scheduler/HoR functions work locally
- No mandatory external API calls for scheduling
- MQTT broker offline handling already exists
- Sync conflict resolution implemented

---

## 5. Tenant/Org Isolation

**Middleware**: `requireOrgId` in `server/middleware/auth.ts`

**Pattern**:

```typescript
app.use("/api", requireOrgId); // Global middleware
const orgId = (req as AuthenticatedRequest).orgId;
```

**Header**: `x-org-id` required on all `/api/*` requests

**Exemptions**:

- Health check endpoints
- Telemetry ingestion (uses HMAC auth)
- Public endpoints

---

## 6. Existing Compliance/Alert Features

### 6.1 What Exists

- ✅ STCW rest hour validation (10h/24h, 77h/7d, split rule)
- ✅ Day-by-day compliance badges in HoR grid
- ✅ Month compliance summary
- ✅ Scheduler STCW validation toggle
- ✅ Crew certification storage (`crew_cert` table)

### 6.2 What's Missing

- ❌ Certification expiry warning system (30/60/90 day alerts)
- ❌ Background job for nightly expiry scanning
- ❌ Expiry badges/filters in crew list
- ❌ Crew document tracking (passport, seaman's book, visa)
- ❌ Fatigue risk score calculation
- ❌ Fleet-wide compliance dashboard

---

## 7. Background Job Infrastructure

**Current**: `pg-boss` is installed and used for scheduled jobs

**Pattern from routes.ts**:

```typescript
import Boss from "pg-boss";
// Jobs registered for insights, alerts, etc.
```

**Can be reused for**:

- Nightly certification expiry scanning
- Scheduled HoR generation from published schedules
- Fleet compliance summary updates

---

## 8. Planned Upgrades

See `docs/implementation-plans/crew-management-improvements.md` for detailed implementation strategy.

### Phase 1: Certification Expiry Warning System

- Add alert tracking columns to `crew_cert` table
- Create nightly background job for expiry scanning
- Add expiry badges and filters to crew management UI
- Add warnings in scheduler when assigning crew with expiring certs

### Phase 2: Crew Document Management

- Create `crew_documents` table (SQLite + PostgreSQL parity)
- Add document CRUD API endpoints
- Add documents tab in crew detail view

### Phase 3: Schedule Publication + HoR Auto-populate

- Create `scheduleRuns` and `scheduleAssignments` tables
- Build approval/publish workflow
- Transform assignments to rest periods
- Link HoR records to schedule runs

### Phase 4: Fatigue Risk Score

- Calculate risk from consecutive low-rest days
- Show color-coded indicators in HoR and crew views
- Store latest score per crew member

### Phase 5: Schedule-to-HoR Compliance Preview

- Preview STCW violations before publishing
- Block publishing if critical violations

### Phase 6: Fleet Compliance Dashboard

- Aggregate STCW compliance across vessels
- Show certification expiry counts
- Trend charts for compliance over time

---

## 9. Verification Checklist

Before implementing changes:

- [x] Understood deployment mode detection (`isLocalMode`)
- [x] Understood tenant isolation (`requireOrgId`, `x-org-id`)
- [x] Verified schema parity (PostgreSQL + SQLite via schema-runtime)
- [x] Identified existing crew/scheduler/HoR features
- [x] Identified gaps requiring implementation
- [ ] Create test fixtures for integration testing
- [ ] Review STCW rules with maritime operations team

---

## 10. File Reference

| File                                              | Purpose                                   |
| ------------------------------------------------- | ----------------------------------------- |
| `client/src/components/UnifiedCrewManagement.tsx` | Crew list UI                              |
| `client/src/components/CrewScheduler.tsx`         | Scheduler UI (1800 lines)                 |
| `client/src/components/HoursOfRestGrid.tsx`       | HoR grid UI (2021 lines)                  |
| `client/src/components/FairnessViz.tsx`           | Fairness visualization                    |
| `server/domains/crew/`                            | Crew domain (routes, service, repository) |
| `server/crew-scheduler.ts`                        | Greedy scheduling algorithm               |
| `server/crew-scheduler-ortools.ts`                | OR-Tools constraint solver                |
| `server/stcw-compliance.ts`                       | STCW compliance engine                    |
| `server/stcw-pdf-generator.ts`                    | PDF export for rest sheets                |
| `shared/schema.ts`                                | PostgreSQL schema definitions             |
| `shared/schema-sqlite-vessel.ts`                  | SQLite schema definitions                 |
| `shared/schema-runtime.ts`                        | Unified schema exports                    |
