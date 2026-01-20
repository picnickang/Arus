# Crew Scheduler PdM Integration - Production Implementation Plan

**Objective**: Deliver production-ready crew scheduler with complete PdM integration, fixing all critical bugs, adding full observability, and ensuring maritime regulatory compliance.

**Timeline**: 7-10 hours (12 phases)  
**Validation Gates**: 5 mandatory checkpoints  
**Testing Requirements**: 3 test suites (unit, integration, e2e)  
**Documentation**: 4 deliverables

---

## Pre-Implementation Validation ✅

**MUST complete before starting:**

### 1. Environment Verification
- [ ] Database connection active (PostgreSQL)
- [ ] OpenAI API key configured (for testing reports)
- [ ] Workflow running without errors
- [ ] All existing tests passing

### 2. Baseline Metrics Capture
```bash
# Capture current state for comparison
npm run test 2>&1 | tee docs/audit/_artifacts/baseline_tests.log
curl http://localhost:5000/api/metrics | tee docs/audit/_artifacts/baseline_metrics.txt
```

### 3. Git Checkpoint
```bash
# Create safety checkpoint before changes
git add -A
git commit -m "Pre-implementation checkpoint: Crew scheduler baseline"
```

---

## Phase 1: Critical Frontend Fixes (90 min)

**Goal**: Fix 6 correctness bugs that prevent scheduler from working properly

### Tasks

#### 1.1 Fix Certifications Payload Shape
**File**: `client/src/components/CrewScheduler.tsx`

**Current (BROKEN)**:
```typescript
certifications: certifications.reduce((acc: any, cert: any) => {
  if (!acc[cert.crewId]) acc[cert.crewId] = [];
  acc[cert.crewId].push(cert.cert); // ❌ Only sending cert name
  return acc;
}, {})
```

**Fixed**:
```typescript
certifications: certifications.reduce((acc: any, cert: CrewCertification) => {
  (acc[cert.crewId] ||= []).push(cert); // ✅ Send full object with expiresAt
  return acc;
}, {})
```

#### 1.2 Fix Field Name Mismatch (requiredSkills → skillRequired)
**Files**: 
- `client/src/components/CrewScheduler.tsx` (form defaults, fields, display)
- Verify: `server/crew-scheduler.ts` expects `skillRequired`

**Changes**:
```typescript
// Form defaults
- requiredSkills: '',
+ skillRequired: '',

// Form field
- name="requiredSkills"
+ name="skillRequired"

// Display
- {shift.requiredSkills && ( ... "Skills: {shift.requiredSkills}" ...)}
+ {shift.skillRequired && ( ... "Skill: {shift.skillRequired}" ...)}
```

#### 1.3 Fix Time Display Bug
**File**: `client/src/components/CrewScheduler.tsx`

**Current (BROKEN)**:
```typescript
{getShiftTime(assignment.start, assignment.end)}
// Passes ISO timestamps to function expecting HH:mm format
```

**Fixed**:
```typescript
{getShiftTime(assignment.start.slice(11, 19), assignment.end.slice(11, 19))}
// Extract time portion: "2025-11-05T08:00:00Z" → "08:00:00"
```

#### 1.4 Enable Leaves Query
**File**: `client/src/components/CrewScheduler.tsx`

**Current (BROKEN)**:
```typescript
const { data: leaves = [] } = useQuery({
  queryKey: ['/api/crew/leave'],
  queryFn: () => apiRequest('/api/crew/leave'),
  enabled: false // ❌ Query disabled!
});
```

**Fixed**:
```typescript
const { data: leaves = [], isLoading: isLoadingLeaves } = useQuery({
  queryKey: ['/api/crew/leave'],
  queryFn: () => apiRequest('GET', '/api/crew/leave'),
  refetchInterval: 60000
});

// Add loading guard in handleEnhancedPlanSchedule:
if (isLoadingLeaves) {
  toast({ title: "Loading leave data…", variant: "destructive" });
  return;
}
```

#### 1.5 Fix Drydock Schema Mismatch
**File**: `client/src/components/CrewScheduler.tsx`

**Current (BROKEN)**:
```typescript
const drydockData = {
  vesselId: newDrydock.vesselId,
  yard: newDrydock.description, // ❌ Mapping to wrong field
  start: newDrydock.start,
  end: newDrydock.end
};
```

**Fixed** (verify schema first):
```typescript
// Check shared/schema.ts for correct field name
// If schema uses 'description', use:
const drydockData = {
  vesselId: newDrydock.vesselId,
  description: newDrydock.description, // ✅ Correct mapping
  start: newDrydock.start,
  end: newDrydock.end
};
```

#### 1.6 Fix Shared State Bug
**File**: `client/src/components/CrewScheduler.tsx`

**Current (BROKEN)**:
```typescript
const [isDetailsOpen, setIsDetailsOpen] = useState(true);
// Used for BOTH enhanced and basic results
```

**Fixed**:
```typescript
const [isEnhancedDetailsOpen, setIsEnhancedDetailsOpen] = useState(true);
const [isBasicDetailsOpen, setIsBasicDetailsOpen] = useState(true);
// Update all references accordingly
```

### Verification Checkpoint 1 ✅
```bash
# Manual testing checklist:
# [ ] Create shift with skillRequired field
# [ ] Plan schedule - verify certifications checked properly
# [ ] Verify time displays correctly in results
# [ ] Verify leaves are loaded before planning
# [ ] Add drydock - verify description appears in list
# [ ] Toggle both result sections independently

# Run LSP diagnostics
npm run lint
```

---

## Phase 2: Critical Backend Fixes (90 min)

**Goal**: Fix 3 scheduler algorithm bugs that cause incorrect scheduling

### Tasks

#### 2.1 Fix Drydock/Port-Call Precedence Bug
**File**: `server/crew-scheduler-ortools.ts` (or create if needed)

**Create helper functions**:
```typescript
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return Math.max(aStart.getTime(), bStart.getTime()) < Math.min(aEnd.getTime(), bEnd.getTime());
}

function toUtc(day: string, timeHHmm: string): Date {
  return new Date(`${day}T${timeHHmm}Z`); // Force UTC
}

function isWindowAllowed(
  day: string,
  startTime: string,
  endTime: string,
  vesselId: string | undefined,
  portCalls: SelectPortCall[],
  drydocks: SelectDrydockWindow[]
): boolean {
  if (!vesselId) return true; // No vessel constraint

  const shiftStart = toUtc(day, startTime);
  let shiftEnd = toUtc(day, endTime);
  if (shiftEnd <= shiftStart) {
    shiftEnd = new Date(shiftEnd.getTime() + 24 * 3600 * 1000); // Midnight crossover
  }

  // 1) DRYDOCK BLOCKS (highest priority)
  for (const d of drydocks) {
    if (d.vesselId !== vesselId) continue;
    const ds = new Date(d.start), de = new Date(d.end);
    if (overlaps(shiftStart, shiftEnd, ds, de)) return false; // ❌ Blocked
  }

  // 2) PORT CALLS ALLOW (if overlapping)
  for (const p of portCalls) {
    if (p.vesselId !== vesselId) continue;
    const ps = new Date(p.start), pe = new Date(p.end);
    if (overlaps(shiftStart, shiftEnd, ps, pe)) return true; // ✅ Allowed
  }

  // 3) No constraints prohibiting
  return true;
}
```

#### 2.2 Fix Leave/Certification Checks (Full Shift Duration)
**File**: `server/crew-scheduler-ortools.ts`

**Add interval overlap checks**:
```typescript
function shiftWindow(day: string, startTime: string, endTime: string) {
  const start = toUtc(day, startTime);
  let end = toUtc(day, endTime);
  if (end <= start) end = new Date(end.getTime() + 24*3600*1000);
  return { start, end };
}

function leaveOverlaps(
  crewId: string, 
  start: Date, 
  end: Date, 
  leaves: SelectCrewLeave[]
): boolean {
  return leaves.some(l => {
    if (l.crewId !== crewId) return false;
    const ls = new Date(l.start), le = new Date(l.end);
    return overlaps(start, end, ls, le);
  });
}

function hasValidCertification(
  crew: CrewWithSkills,
  requiredCert: string | undefined,
  shiftStart: Date,
  shiftEnd: Date,
  certifications: { [crewId: string]: SelectCrewCertification[] }
): boolean {
  if (!requiredCert) return true;
  const crewCerts = certifications[crew.id] || [];
  // Cert must be valid at least through shift end
  return crewCerts.some(c => 
    c.cert === requiredCert && new Date(c.expiresAt) >= shiftEnd
  );
}
```

#### 2.3 Add Missing Constraints (Rest, Hours, Overlap)
**Files**: 
- `server/crew-scheduler-ortools.ts`
- Update `ConstraintScheduleRequest` interface

**Extend interface**:
```typescript
export interface ConstraintScheduleRequest {
  engine: string;
  days: string[];
  shifts: SelectShiftTemplate[];
  crew: CrewWithSkills[];
  leaves: SelectCrewLeave[];
  portCalls: SelectPortCall[];
  drydocks: SelectDrydockWindow[];
  certifications: { [crewId: string]: SelectCrewCertification[] };
  preferences?: SchedulingPreferences;
  existing?: SelectCrewAssignment[]; // ✅ Add existing assignments
}
```

**Add constraint checks**:
```typescript
function restOk(
  assignments: Assignment[], 
  existing: SelectCrewAssignment[], 
  crewId: string, 
  start: Date, 
  minRestH: number
): boolean {
  let lastEnd: Date | null = null;
  
  // Check both current run and existing assignments
  const allAssignments = [...assignments, ...existing.map(e => ({
    crewId: e.crewId,
    start: e.start.toISOString(),
    end: e.end.toISOString()
  }))];
  
  for (const a of allAssignments) {
    if (a.crewId !== crewId) continue;
    const end = new Date(a.end);
    if (end <= start && (lastEnd === null || end > lastEnd)) {
      lastEnd = end;
    }
  }
  
  if (lastEnd === null) return true;
  const restHours = (start.getTime() - lastEnd.getTime()) / (1000 * 60 * 60);
  return restHours >= minRestH;
}

function hoursInRange(
  assignments: Assignment[],
  existing: SelectCrewAssignment[],
  crewId: string,
  weekStart: Date,
  weekEnd: Date
): number {
  let total = 0;
  
  const allAssignments = [...assignments, ...existing.map(e => ({
    crewId: e.crewId,
    start: e.start.toISOString(),
    end: e.end.toISOString()
  }))];
  
  for (const a of allAssignments) {
    if (a.crewId !== crewId) continue;
    const start = new Date(a.start);
    const end = new Date(a.end);
    const lo = new Date(Math.max(start.getTime(), weekStart.getTime()));
    const hi = new Date(Math.min(end.getTime(), weekEnd.getTime()));
    if (lo < hi) {
      total += (hi.getTime() - lo.getTime()) / (1000 * 60 * 60);
    }
  }
  
  return total;
}
```

### Verification Checkpoint 2 ✅
```bash
# Unit tests for constraint logic
npm run test -- crew-scheduler

# Integration test:
# [ ] Create drydock window overlapping shift
# [ ] Create port call overlapping shift  
# [ ] Verify drydock blocks, port call doesn't override
# [ ] Create crew leave spanning shift
# [ ] Verify shift not assigned during leave
# [ ] Create cert expiring mid-shift
# [ ] Verify shift not assigned
```

---

## Phase 3: Database Schema for Audit Trail (45 min)

**Goal**: Add tables for scheduler run history and compliance tracking

### Tasks

#### 3.1 Add Drizzle Schema
**File**: `shared/schema.ts`

**Add tables**:
```typescript
// Scheduler run audit trail
export const schedulerRuns = pgTable("scheduler_runs", {
  id: varchar("id").primaryKey().$defaultFn(() => randomUUID()),
  orgId: varchar("org_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  mode: varchar("mode").notNull().default("dry_run"), // 'dry_run' | 'execute' | 'auto'
  inputHash: varchar("input_hash").notNull(),
  stats: jsonb("stats").$type<{
    duration_ms: number;
    assigned: number;
    unfilled: number;
    reasons: Array<{ reason: string; count: number }>;
  }>(),
  success: boolean("success").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

export const scheduleAssignments = pgTable("schedule_assignments", {
  id: varchar("id").primaryKey().$defaultFn(() => randomUUID()),
  runId: varchar("run_id").notNull(),
  orgId: varchar("org_id").notNull(),
  date: varchar("date").notNull(), // YYYY-MM-DD
  shiftId: varchar("shift_id").notNull(),
  crewId: varchar("crew_id").notNull(),
  vesselId: varchar("vessel_id"),
  start: timestamp("start", { withTimezone: true }).notNull(),
  end: timestamp("end", { withTimezone: true }).notNull(),
  role: varchar("role"),
  executed: boolean("executed").default(false),
  createdAt: timestamp("created_at").defaultNow()
});

export const scheduleUnfilled = pgTable("schedule_unfilled", {
  id: varchar("id").primaryKey().$defaultFn(() => randomUUID()),
  runId: varchar("run_id").notNull(),
  orgId: varchar("org_id").notNull(),
  day: varchar("day").notNull(),
  shiftId: varchar("shift_id").notNull(),
  need: integer("need").notNull(),
  reason: varchar("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// Export types
export type SelectSchedulerRun = typeof schedulerRuns.$inferSelect;
export type InsertSchedulerRun = typeof schedulerRuns.$inferInsert;
export type SelectScheduleAssignment = typeof scheduleAssignments.$inferSelect;
export type InsertScheduleAssignment = typeof scheduleAssignments.$inferInsert;
export type SelectScheduleUnfilled = typeof scheduleUnfilled.$inferSelect;
export type InsertScheduleUnfilled = typeof scheduleUnfilled.$inferInsert;

// Zod schemas
export const insertSchedulerRunSchema = createInsertSchema(schedulerRuns);
export const insertScheduleAssignmentSchema = createInsertSchema(scheduleAssignments);
export const insertScheduleUnfilledSchema = createInsertSchema(scheduleUnfilled);
```

#### 3.2 Add Storage Methods
**File**: `server/storage.ts`

**Add to IStorage interface**:
```typescript
// Scheduler run management
createSchedulerRun(run: InsertSchedulerRun): Promise<SelectSchedulerRun>;
updateSchedulerRun(id: string, data: Partial<InsertSchedulerRun>): Promise<SelectSchedulerRun>;
getSchedulerRuns(orgId: string, limit?: number): Promise<SelectSchedulerRun[]>;
getSchedulerRun(id: string): Promise<SelectSchedulerRun | undefined>;

// Schedule assignments
createBulkScheduleAssignments(assignments: InsertScheduleAssignment[]): Promise<void>;
getScheduleAssignments(orgId: string, fromDate: Date, toDate: Date): Promise<SelectScheduleAssignment[]>;

// Unfilled shifts
createBulkScheduleUnfilled(unfilled: InsertScheduleUnfilled[]): Promise<void>;
getScheduleUnfilled(orgId: string, runId?: string): Promise<SelectScheduleUnfilled[]>;
```

#### 3.3 Push Schema to Database
```bash
# Sync schema changes
npm run db:push

# If data loss warning, force it (audit tables are new)
npm run db:push --force
```

#### 3.4 Add Indexes
**File**: `server/db-indexes.ts` (or create migration)

```typescript
// Add indexes for scheduler queries
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_org_vessel_start 
  ON schedule_assignments(org_id, vessel_id, start);

CREATE INDEX IF NOT EXISTS idx_scheduler_runs_org_started 
  ON scheduler_runs(org_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_unfilled_org_day 
  ON schedule_unfilled(org_id, day);
```

### Verification Checkpoint 3 ✅
```bash
# Verify schema deployed
npm run db:push

# Test storage methods
npm run test -- storage

# Verify indexes created
psql $DATABASE_URL -c "\d schedule_assignments"
psql $DATABASE_URL -c "\d scheduler_runs"
psql $DATABASE_URL -c "\d schedule_unfilled"
```

---

## Phase 4: Event Bus & PdM Triggers (60 min)

**Goal**: Create event-driven architecture for PdM → Scheduler integration

### Tasks

#### 4.1 Create Event Bus
**File**: `server/events/scheduler-bus.ts` (NEW)

```typescript
import { EventEmitter } from 'events';

export type SchedulerEventName = 
  | "pdm.rul.updated" 
  | "pdm.anomaly.created" 
  | "pdm.maintenance.window"
  | "scheduler.run.started"
  | "scheduler.run.completed"
  | "scheduler.run.failed";

export interface RulUpdatedEvent {
  orgId: string;
  vesselId: string;
  equipmentId: string;
  remainingDays: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  operatingMode?: string;
}

export interface AnomalyCreatedEvent {
  orgId: string;
  vesselId: string;
  equipmentId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  anomalyType: string;
  window?: { start: Date; end: Date };
}

export interface MaintenanceWindowEvent {
  orgId: string;
  vesselId: string;
  equipmentId: string;
  start: Date;
  end: Date;
  priority: string;
}

class SchedulerEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Handle many concurrent subscriptions
  }

  emitRulUpdate(event: RulUpdatedEvent): void {
    this.emit('pdm.rul.updated', event);
  }

  emitAnomalyCreated(event: AnomalyCreatedEvent): void {
    this.emit('pdm.anomaly.created', event);
  }

  emitMaintenanceWindow(event: MaintenanceWindowEvent): void {
    this.emit('pdm.maintenance.window', event);
  }

  onRulUpdate(handler: (event: RulUpdatedEvent) => Promise<void> | void): void {
    this.on('pdm.rul.updated', handler);
  }

  onAnomalyCreated(handler: (event: AnomalyCreatedEvent) => Promise<void> | void): void {
    this.on('pdm.anomaly.created', handler);
  }

  onMaintenanceWindow(handler: (event: MaintenanceWindowEvent) => Promise<void> | void): void {
    this.on('pdm.maintenance.window', handler);
  }
}

export const schedulerEventBus = new SchedulerEventBus();
```

#### 4.2 Wire RUL Engine to Emit Events
**File**: `server/rul-engine.ts`

**Add to updateEquipmentRulPrediction function**:
```typescript
import { schedulerEventBus } from './events/scheduler-bus';

// After RUL calculation and storage (line ~XXX)
const riskLevel = determineRiskLevel(remainingDays, confidence);

// Emit event for scheduler integration
schedulerEventBus.emitRulUpdate({
  orgId: orgId,
  vesselId: equipment.vesselId || 'unknown',
  equipmentId: equipmentId,
  remainingDays: remainingDays,
  riskLevel: riskLevel,
  operatingMode: operatingMode
});
```

#### 4.3 Wire Anomaly Detection to Emit Events
**File**: `server/routes.ts` (alert creation endpoint)

**Find alert creation endpoint and add**:
```typescript
import { schedulerEventBus } from './events/scheduler-bus';

// After alert created (line ~XXXX in POST /api/alerts)
if (alert.severity === 'high' || alert.severity === 'critical') {
  const equipment = await storage.getEquipment(alert.equipmentId);
  schedulerEventBus.emitAnomalyCreated({
    orgId: alert.orgId || 'default-org',
    vesselId: equipment?.vesselId || 'unknown',
    equipmentId: alert.equipmentId,
    severity: alert.severity as 'low' | 'medium' | 'high' | 'critical',
    anomalyType: alert.type
  });
}
```

#### 4.4 Wire Maintenance Scheduling to Emit Events
**File**: `server/routes.ts` (maintenance schedule creation)

**Find maintenance schedule creation and add**:
```typescript
import { schedulerEventBus } from './events/scheduler-bus';

// After maintenance schedule created (line ~XXXX in POST /api/maintenance/schedule)
const equipment = await storage.getEquipment(schedule.equipmentId);
schedulerEventBus.emitMaintenanceWindow({
  orgId: schedule.orgId || 'default-org',
  vesselId: equipment?.vesselId || 'unknown',
  equipmentId: schedule.equipmentId,
  start: new Date(schedule.scheduledDate),
  end: new Date(schedule.estimatedCompletion || schedule.scheduledDate),
  priority: schedule.priority
});
```

### Verification Checkpoint 4 ✅
```bash
# Test event bus in isolation
npm run test -- scheduler-bus

# Integration test:
# [ ] Trigger RUL calculation
# [ ] Verify event emitted with correct data
# [ ] Create high-severity alert
# [ ] Verify anomaly event emitted
# [ ] Create maintenance schedule
# [ ] Verify maintenance window event emitted
```

---

## Phase 5: Auto-Replan Controller (90 min)

**Goal**: Build intelligent controller that triggers crew replanning based on PdM events

### Tasks

#### 5.1 Create Auto-Replan Policy
**File**: `server/scheduler/auto-replan-policy.ts` (NEW)

```typescript
import { schedulerEventBus, RulUpdatedEvent, AnomalyCreatedEvent, MaintenanceWindowEvent } from '../events/scheduler-bus';
import { planAndMaybeExecute } from './scheduler-controller';

// Configuration from environment
const RUL_DAYS_CRITICAL = Number(process.env.SCHED_RUL_DAYS_CRITICAL ?? 9);
const RISK_REPLAN_LEVEL = (process.env.SCHED_RISK_REPLAN_LEVEL ?? "high").toLowerCase();
const AUTO_REPLAN_DAYS = Number(process.env.SCHED_AUTO_REPLAN_DAYS ?? 7);

function riskToRank(r: string): number {
  const ranks: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };
  return ranks[r] ?? 0;
}

// Initialize auto-replan listeners
export function initializeAutoReplanPolicy(): void {
  
  // RUL-triggered replanning
  schedulerEventBus.onRulUpdate(async (event: RulUpdatedEvent) => {
    const shouldReplan = 
      event.remainingDays <= RUL_DAYS_CRITICAL || 
      riskToRank(event.riskLevel) >= riskToRank(RISK_REPLAN_LEVEL);
    
    if (shouldReplan) {
      console.log(`[Auto-Replan] RUL trigger: vessel=${event.vesselId}, remainingDays=${event.remainingDays}, risk=${event.riskLevel}`);
      
      try {
        await planAndMaybeExecute({
          orgId: event.orgId,
          days: AUTO_REPLAN_DAYS,
          vessels: [event.vesselId],
          mode: "auto",
          trigger: "rul_critical",
          triggerContext: {
            equipmentId: event.equipmentId,
            remainingDays: event.remainingDays,
            riskLevel: event.riskLevel
          }
        });
      } catch (error) {
        console.error('[Auto-Replan] Failed to replan from RUL trigger:', error);
      }
    }
  });

  // Anomaly-triggered replanning
  schedulerEventBus.onAnomalyCreated(async (event: AnomalyCreatedEvent) => {
    if (event.severity === 'high' || event.severity === 'critical') {
      console.log(`[Auto-Replan] Anomaly trigger: vessel=${event.vesselId}, severity=${event.severity}`);
      
      try {
        await planAndMaybeExecute({
          orgId: event.orgId,
          days: AUTO_REPLAN_DAYS,
          vessels: [event.vesselId],
          mode: "auto",
          trigger: "anomaly_detected",
          triggerContext: {
            equipmentId: event.equipmentId,
            severity: event.severity,
            anomalyType: event.anomalyType
          }
        });
      } catch (error) {
        console.error('[Auto-Replan] Failed to replan from anomaly trigger:', error);
      }
    }
  });

  // Maintenance window replanning
  schedulerEventBus.onMaintenanceWindow(async (event: MaintenanceWindowEvent) => {
    console.log(`[Auto-Replan] Maintenance window trigger: vessel=${event.vesselId}`);
    
    try {
      await planAndMaybeExecute({
        orgId: event.orgId,
        days: AUTO_REPLAN_DAYS,
        vessels: [event.vesselId],
        mode: "auto",
        trigger: "maintenance_scheduled",
        triggerContext: {
          equipmentId: event.equipmentId,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          priority: event.priority
        }
      });
    } catch (error) {
      console.error('[Auto-Replan] Failed to replan from maintenance window:', error);
    }
  });

  console.log('[Auto-Replan] Policy initialized with config:', {
    RUL_DAYS_CRITICAL,
    RISK_REPLAN_LEVEL,
    AUTO_REPLAN_DAYS
  });
}
```

#### 5.2 Create Scheduler Controller
**File**: `server/scheduler/scheduler-controller.ts` (NEW)

```typescript
import crypto from "node:crypto";
import { storage } from "../storage";
import { planShifts, generateDays } from "../crew-scheduler";
import { 
  InsertSchedulerRun, 
  InsertScheduleAssignment, 
  InsertScheduleUnfilled,
  SelectCrewAssignment 
} from '@shared/schema';

interface PlanParams {
  orgId: string;
  from?: string;
  days?: number;
  vessels?: string[];
  mode?: "dry_run" | "execute" | "auto";
  trigger?: string;
  triggerContext?: any;
}

export async function planAndMaybeExecute({
  orgId,
  from,
  days = 7,
  vessels,
  mode = "dry_run",
  trigger,
  triggerContext
}: PlanParams) {
  const since = from ?? new Date().toISOString().slice(0, 10);
  const daysArr = generateDays(since, days);

  // Load scheduling inputs
  const shifts = await loadShiftTemplates(orgId, vessels);
  const crew = await loadCrewWithSkills(orgId);
  const leaves = await loadCrewLeaves(orgId);
  const portCalls = await loadPortCalls(orgId, vessels);
  const drydocks = await loadDrydocks(orgId, vessels);
  const certifications = await loadCertifications(orgId);
  const existing = await loadExistingAssignments(orgId, since, daysArr[daysArr.length - 1]);

  // Calculate input hash for deduplication
  const inputHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ daysArr, shifts, crew, leaves, portCalls, drydocks }))
    .digest("hex");

  // Create scheduler run record
  const runData: InsertSchedulerRun = {
    orgId,
    startedAt: new Date(),
    mode,
    inputHash,
    stats: trigger ? { trigger, triggerContext } : undefined
  };

  const run = await storage.createSchedulerRun(runData);
  const t0 = Date.now();

  try {
    // Execute scheduling algorithm
    const { scheduled, unfilled } = planShifts(daysArr, shifts, crew, leaves, existing);
    const durationMs = Date.now() - t0;

    // Persist results
    if (mode === "execute" || mode === "auto") {
      const assignmentRecords: InsertScheduleAssignment[] = scheduled.map(a => ({
        runId: run.id,
        orgId,
        date: a.date,
        shiftId: a.shiftId,
        crewId: a.crewId,
        vesselId: a.vesselId,
        start: new Date(a.start),
        end: new Date(a.end),
        role: a.role,
        executed: true
      }));

      await storage.createBulkScheduleAssignments(assignmentRecords);
    }

    // Always persist unfilled data for analysis
    const unfilledRecords: InsertScheduleUnfilled[] = unfilled.map(u => ({
      runId: run.id,
      orgId,
      day: u.day,
      shiftId: u.shiftId,
      need: u.need,
      reason: u.reason
    }));

    await storage.createBulkScheduleUnfilled(unfilledRecords);

    // Aggregate stats
    const stats = {
      duration_ms: durationMs,
      assigned: scheduled.length,
      unfilled: unfilled.reduce((sum, u) => sum + u.need, 0),
      reasons: aggregateReasons(unfilled.map(u => u.reason)),
      trigger,
      triggerContext
    };

    // Update run with results
    await storage.updateSchedulerRun(run.id, {
      finishedAt: new Date(),
      success: true,
      stats
    });

    console.log(`[Scheduler] Run completed: mode=${mode}, assigned=${scheduled.length}, unfilled=${stats.unfilled}, duration=${durationMs}ms`);

    return { runId: run.id, mode, stats, scheduled, unfilled };

  } catch (error) {
    // Mark run as failed
    await storage.updateSchedulerRun(run.id, {
      finishedAt: new Date(),
      success: false,
      stats: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
    throw error;
  }
}

// Helper functions
async function loadShiftTemplates(orgId: string, vessels?: string[]) {
  const allShifts = await storage.getShiftTemplates();
  if (!vessels || vessels.length === 0) return allShifts;
  return allShifts.filter(s => !s.vesselId || vessels.includes(s.vesselId));
}

async function loadCrewWithSkills(orgId: string) {
  const crew = await storage.getCrew();
  const crewWithSkills = await Promise.all(
    crew.map(async c => {
      const skills = await storage.getCrewSkills(c.id);
      return { ...c, skills: skills.map(s => s.skill) };
    })
  );
  return crewWithSkills;
}

async function loadCrewLeaves(orgId: string) {
  // Get all crew, then get their leaves
  const crew = await storage.getCrew();
  const allLeaves = await Promise.all(
    crew.map(c => storage.getCrewLeave(c.id))
  );
  return allLeaves.flat();
}

async function loadPortCalls(orgId: string, vessels?: string[]) {
  const allPortCalls = await storage.getPortCalls();
  if (!vessels || vessels.length === 0) return allPortCalls;
  return allPortCalls.filter(pc => vessels.includes(pc.vesselId));
}

async function loadDrydocks(orgId: string, vessels?: string[]) {
  const allDrydocks = await storage.getDrydockWindows();
  if (!vessels || vessels.length === 0) return allDrydocks;
  return allDrydocks.filter(d => vessels.includes(d.vesselId));
}

async function loadCertifications(orgId: string) {
  const certsList = await storage.getCrewCertifications();
  const certsMap: { [crewId: string]: any[] } = {};
  for (const cert of certsList) {
    (certsMap[cert.crewId] ||= []).push(cert);
  }
  return certsMap;
}

async function loadExistingAssignments(orgId: string, from: string, to: string): Promise<SelectCrewAssignment[]> {
  return await storage.getCrewAssignmentsByDateRange(new Date(from), new Date(to));
}

function aggregateReasons(reasons: string[]): Array<{ reason: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of reasons) {
    map.set(r, (map.get(r) || 0) + 1);
  }
  return Array.from(map, ([reason, count]) => ({ reason, count }));
}
```

#### 5.3 Initialize Auto-Replan on Startup
**File**: `server/index.ts`

```typescript
import { initializeAutoReplanPolicy } from './scheduler/auto-replan-policy';

// Add after route registration (line ~XXX)
if (process.env.ENABLE_AUTO_REPLAN !== 'false') {
  initializeAutoReplanPolicy();
  console.log('✓ Auto-replan policy initialized');
}
```

### Verification Checkpoint 5 (MANDATORY GATE) ✅
```bash
# Critical validation - MUST PASS to continue
npm run test -- scheduler-controller
npm run test -- auto-replan-policy

# Integration test:
# [ ] Simulate RUL dropping below threshold
# [ ] Verify auto-replan triggered
# [ ] Verify scheduler run created with trigger="rul_critical"
# [ ] Simulate high-severity anomaly
# [ ] Verify auto-replan triggered
# [ ] Check scheduler_runs table for audit trail

# Check logs
grep "Auto-Replan" /tmp/logs/Start_application_*.log | tail -20
```

**STOP HERE IF ANY TESTS FAIL** - Fix before proceeding

---

## Phase 6: Prometheus Metrics (45 min)

**Goal**: Add comprehensive observability for scheduler operations

### Tasks

#### 6.1 Create Scheduler Metrics
**File**: `server/observability/scheduler-metrics.ts` (NEW)

```typescript
import client from "prom-client";

// Scheduler run duration
export const schedRunDuration = new client.Histogram({
  name: "arus_scheduler_run_duration_ms",
  help: "Scheduler run duration in milliseconds",
  buckets: [50, 100, 250, 500, 1000, 2000, 4000, 8000],
  labelNames: ["org_id", "mode", "trigger"]
});

// Unfilled positions counter
export const schedUnfilledTotal = new client.Counter({
  name: "arus_scheduler_unfilled_total",
  help: "Total unfilled positions across all runs",
  labelNames: ["org_id", "vessel_id"]
});

// Unfilled by reason
export const schedUnfilledReason = new client.Counter({
  name: "arus_scheduler_unfilled_reason_total",
  help: "Unfilled positions grouped by reason",
  labelNames: ["org_id", "reason"]
});

// Scheduler runs total
export const schedRunsTotal = new client.Counter({
  name: "arus_scheduler_runs_total",
  help: "Total scheduler runs",
  labelNames: ["org_id", "mode", "trigger", "status"]
});

// Assigned shifts
export const schedAssignedShifts = new client.Counter({
  name: "arus_scheduler_assigned_shifts_total",
  help: "Total shifts successfully assigned",
  labelNames: ["org_id", "vessel_id"]
});

// Auto-replan triggers
export const schedAutoReplanTriggers = new client.Counter({
  name: "arus_scheduler_auto_replan_triggers_total",
  help: "Count of auto-replan triggers by source",
  labelNames: ["org_id", "trigger_type"]
});

// Coverage percentage gauge
export const schedCoveragePercent = new client.Gauge({
  name: "arus_scheduler_coverage_percent",
  help: "Percentage of shifts successfully assigned in last run",
  labelNames: ["org_id"]
});
```

#### 6.2 Instrument Controller
**File**: `server/scheduler/scheduler-controller.ts`

**Add metrics collection**:
```typescript
import { 
  schedRunDuration, 
  schedUnfilledTotal, 
  schedUnfilledReason,
  schedRunsTotal,
  schedAssignedShifts,
  schedCoveragePercent
} from '../observability/scheduler-metrics';

// After scheduling completes (in try block):
schedRunDuration.labels(orgId, mode, trigger || 'manual').observe(durationMs);
schedRunsTotal.labels(orgId, mode, trigger || 'manual', 'success').inc();

for (const assignment of scheduled) {
  schedAssignedShifts.labels(orgId, assignment.vesselId || 'unassigned').inc();
}

for (const u of unfilled) {
  schedUnfilledTotal.labels(orgId, u.vesselId || 'unknown').inc(u.need);
}

for (const { reason, count } of stats.reasons) {
  schedUnfilledReason.labels(orgId, reason).inc(count);
}

const coverage = scheduled.length / (shifts.length * days.length) * 100;
schedCoveragePercent.labels(orgId).set(coverage);

// In catch block:
schedRunsTotal.labels(orgId, mode, trigger || 'manual', 'failed').inc();
```

#### 6.3 Instrument Auto-Replan
**File**: `server/scheduler/auto-replan-policy.ts`

```typescript
import { schedAutoReplanTriggers } from '../observability/scheduler-metrics';

// Before each replan attempt:
schedAutoReplanTriggers.labels(event.orgId, 'rul_critical').inc();
schedAutoReplanTriggers.labels(event.orgId, 'anomaly_detected').inc();
schedAutoReplanTriggers.labels(event.orgId, 'maintenance_scheduled').inc();
```

### Verification
```bash
# Trigger scheduler run
curl -X POST http://localhost:5000/api/schedule/plan \
  -H "Content-Type: application/json" \
  -d '{"orgId":"test","days":7,"mode":"dry_run"}'

# Check metrics
curl http://localhost:5000/api/metrics | grep arus_scheduler

# Expected output:
# arus_scheduler_run_duration_ms_bucket{org_id="test",mode="dry_run",trigger="manual",...}
# arus_scheduler_runs_total{org_id="test",mode="dry_run",trigger="manual",status="success"} 1
# arus_scheduler_coverage_percent{org_id="test"} 85.5
```

---

## Phase 7: REST API Routes (60 min)

**Goal**: Expose scheduler functionality via clean REST API

### Tasks

#### 7.1 Create Scheduler Routes
**File**: `server/routes.ts`

**Add routes** (around line 12700 after existing crew endpoints):
```typescript
import { planAndMaybeExecute } from './scheduler/scheduler-controller';
import { insertSchedulerRunSchema, insertScheduleAssignmentSchema } from '@shared/schema';

// ==================== Scheduler API ====================

// Plan crew schedule (dry-run or execute)
app.post("/api/schedule/plan", crewOperationRateLimit, async (req, res) => {
  try {
    const { orgId, from, days, vessels, mode } = req.body;
    
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }
    
    const result = await planAndMaybeExecute({
      orgId,
      from,
      days: days || 7,
      vessels,
      mode: mode || "dry_run"
    });
    
    res.json(result);
  } catch (error) {
    console.error("Failed to plan schedule:", error);
    res.status(500).json({ 
      error: "Failed to plan schedule",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get scheduler run history
app.get("/api/schedule/runs", async (req, res) => {
  try {
    const { orgId, limit } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }
    
    const runs = await storage.getSchedulerRuns(
      orgId as string, 
      limit ? parseInt(limit as string) : 50
    );
    
    res.json(runs);
  } catch (error) {
    console.error("Failed to fetch scheduler runs:", error);
    res.status(500).json({ error: "Failed to fetch scheduler runs" });
  }
});

// Get specific scheduler run
app.get("/api/schedule/runs/:id", async (req, res) => {
  try {
    const run = await storage.getSchedulerRun(req.params.id);
    
    if (!run) {
      return res.status(404).json({ error: "Scheduler run not found" });
    }
    
    res.json(run);
  } catch (error) {
    console.error("Failed to fetch scheduler run:", error);
    res.status(500).json({ error: "Failed to fetch scheduler run" });
  }
});

// Get schedule assignments for date range
app.get("/api/schedule/assignments", async (req, res) => {
  try {
    const { orgId, from, to } = req.query;
    
    if (!orgId || !from || !to) {
      return res.status(400).json({ 
        error: "orgId, from, and to dates are required" 
      });
    }
    
    const assignments = await storage.getScheduleAssignments(
      orgId as string,
      new Date(from as string),
      new Date(to as string)
    );
    
    res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch schedule assignments:", error);
    res.status(500).json({ error: "Failed to fetch schedule assignments" });
  }
});

// Get unfilled shifts
app.get("/api/schedule/unfilled", async (req, res) => {
  try {
    const { orgId, runId } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }
    
    const unfilled = await storage.getScheduleUnfilled(
      orgId as string,
      runId as string | undefined
    );
    
    res.json(unfilled);
  } catch (error) {
    console.error("Failed to fetch unfilled shifts:", error);
    res.status(500).json({ error: "Failed to fetch unfilled shifts" });
  }
});
```

### Verification
```bash
# Test all endpoints
# 1. Plan schedule
curl -X POST http://localhost:5000/api/schedule/plan \
  -H "Content-Type: application/json" \
  -d '{"orgId":"test-org","days":7,"mode":"dry_run"}'

# 2. Get runs
curl http://localhost:5000/api/schedule/runs?orgId=test-org

# 3. Get specific run
curl http://localhost:5000/api/schedule/runs/{runId}

# 4. Get assignments
curl "http://localhost:5000/api/schedule/assignments?orgId=test-org&from=2025-11-01&to=2025-11-08"

# 5. Get unfilled
curl "http://localhost:5000/api/schedule/unfilled?orgId=test-org"
```

---

## Phase 8: Frontend Schedule Board (90 min)

**Goal**: Build comprehensive UI for schedule management

### Tasks

#### 8.1 Create Schedule Board View
**File**: `client/src/pages/schedule-board.tsx` (NEW)

```typescript
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Play, Eye, AlertTriangle, CheckCircle2, Clock, Users, Ship } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';

export default function ScheduleBoard() {
  const { toast } = useToast();
  const [orgId] = useState("default-org-id");
  const [days, setDays] = useState(7);
  const [vessels, setVessels] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  
  const from = format(new Date(), 'yyyy-MM-dd');
  const to = format(addDays(new Date(), days), 'yyyy-MM-dd');

  // Fetch scheduler runs
  const { data: runs = [], isLoading: isLoadingRuns } = useQuery({
    queryKey: ['/api/schedule/runs', orgId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/schedule/runs?orgId=${orgId}&limit=20`);
      return response;
    },
    refetchInterval: 30000
  });

  // Fetch assignments
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['/api/schedule/assignments', orgId, from, to],
    queryFn: async () => {
      const response = await apiRequest('GET', 
        `/api/schedule/assignments?orgId=${orgId}&from=${from}&to=${to}`
      );
      return response;
    },
    refetchInterval: 30000
  });

  // Fetch unfilled
  const { data: unfilled = [], isLoading: isLoadingUnfilled } = useQuery({
    queryKey: ['/api/schedule/unfilled', orgId, selectedRunId],
    queryFn: async () => {
      const url = selectedRunId 
        ? `/api/schedule/unfilled?orgId=${orgId}&runId=${selectedRunId}`
        : `/api/schedule/unfilled?orgId=${orgId}`;
      const response = await apiRequest('GET', url);
      return response;
    },
    enabled: !!orgId
  });

  // Plan mutation
  const planMutation = useMutation({
    mutationFn: async (mode: 'dry_run' | 'execute') => {
      return apiRequest('POST', '/api/schedule/plan', {
        orgId,
        from,
        days,
        vessels: vessels.length > 0 ? vessels : undefined,
        mode
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule/runs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule/unfilled'] });
      
      const coveragePercent = (data.stats.assigned / (data.stats.assigned + data.stats.unfilled)) * 100;
      
      toast({
        title: "Schedule Generated",
        description: `Assigned ${data.stats.assigned} shifts (${coveragePercent.toFixed(1)}% coverage) in ${data.stats.duration_ms}ms`
      });
      
      setSelectedRunId(data.runId);
    },
    onError: (error: any) => {
      toast({
        title: "Scheduling Failed",
        description: error.message || "Failed to generate schedule",
        variant: "destructive"
      });
    }
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Schedule Board</h1>
            <p className="text-muted-foreground">PdM-driven intelligent crew planning</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => planMutation.mutate('dry_run')}
            disabled={planMutation.isPending}
            variant="outline"
            data-testid="button-plan-dryrun"
          >
            <Eye className="h-4 w-4 mr-2" />
            Dry Run
          </Button>
          <Button
            onClick={() => planMutation.mutate('execute')}
            disabled={planMutation.isPending}
            data-testid="button-plan-execute"
          >
            <Play className="h-4 w-4 mr-2" />
            Execute Schedule
          </Button>
        </div>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Planning Configuration</CardTitle>
          <CardDescription>Configure schedule parameters</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium">Planning Horizon (Days)</label>
            <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
              <SelectTrigger data-testid="select-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <label className="text-sm font-medium">Date Range</label>
            <div className="text-sm text-muted-foreground mt-2">
              {from} to {to}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs" data-testid="tab-runs">
            <Clock className="h-4 w-4 mr-2" />
            Run History
          </TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">
            <Users className="h-4 w-4 mr-2" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="unfilled" data-testid="tab-unfilled">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Unfilled Shifts
          </TabsTrigger>
        </TabsList>

        {/* Runs Tab */}
        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle>Scheduler Runs</CardTitle>
              <CardDescription>History of all scheduling operations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRuns ? (
                <div>Loading runs...</div>
              ) : runs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No scheduler runs yet. Click "Dry Run" or "Execute Schedule" to start.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Unfilled</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run: any) => (
                      <TableRow 
                        key={run.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedRunId(run.id)}
                        data-testid={`row-run-${run.id}`}
                      >
                        <TableCell className="font-mono text-xs">
                          {run.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            run.mode === 'execute' ? 'default' : 
                            run.mode === 'auto' ? 'destructive' : 
                            'outline'
                          }>
                            {run.mode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(run.startedAt), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell>
                          {run.stats?.duration_ms ? `${run.stats.duration_ms}ms` : '-'}
                        </TableCell>
                        <TableCell className="text-green-600">
                          {run.stats?.assigned || 0}
                        </TableCell>
                        <TableCell className="text-amber-600">
                          {run.stats?.unfilled || 0}
                        </TableCell>
                        <TableCell>
                          {run.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Assignments</CardTitle>
              <CardDescription>Crew assignments for selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAssignments ? (
                <div>Loading assignments...</div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No assignments for this period.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Crew</TableHead>
                      <TableHead>Vessel</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment: any, idx: number) => (
                      <TableRow key={assignment.id || idx} data-testid={`row-assignment-${idx}`}>
                        <TableCell>{assignment.date}</TableCell>
                        <TableCell className="font-medium">{assignment.crewId}</TableCell>
                        <TableCell>
                          {assignment.vesselId ? (
                            <div className="flex items-center gap-2">
                              <Ship className="h-4 w-4" />
                              {assignment.vesselId}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{assignment.shiftId.slice(0, 8)}...</TableCell>
                        <TableCell>
                          {format(new Date(assignment.start), 'HH:mm')} - {format(new Date(assignment.end), 'HH:mm')}
                        </TableCell>
                        <TableCell>{assignment.role || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={assignment.executed ? 'default' : 'outline'}>
                            {assignment.executed ? 'Executed' : 'Planned'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unfilled Tab */}
        <TabsContent value="unfilled">
          <Card>
            <CardHeader>
              <CardTitle>Unfilled Shifts</CardTitle>
              <CardDescription>Positions that could not be filled</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUnfilled ? (
                <div>Loading unfilled shifts...</div>
              ) : unfilled.length === 0 ? (
                <div className="text-center py-8 text-green-600 flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  All shifts filled successfully!
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Reason breakdown */}
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(
                      unfilled.reduce((acc: any, u: any) => {
                        acc[u.reason] = (acc[u.reason] || 0) + u.need;
                        return acc;
                      }, {})
                    ).map(([reason, count]) => (
                      <Card key={reason}>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">{count as number}</div>
                          <div className="text-sm text-muted-foreground">{reason}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Detailed table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Positions Needed</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unfilled.map((u: any, idx: number) => (
                        <TableRow key={idx} data-testid={`row-unfilled-${idx}`}>
                          <TableCell>{u.day}</TableCell>
                          <TableCell className="font-mono text-xs">{u.shiftId.slice(0, 8)}...</TableCell>
                          <TableCell className="font-bold text-amber-600">{u.need}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{u.reason}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 8.2 Register Route
**File**: `client/src/App.tsx`

```typescript
import ScheduleBoard from './pages/schedule-board';

// Add route in Switch
<Route path="/ops/schedule" component={ScheduleBoard} />
```

#### 8.3 Add to Navigation
**File**: `client/src/config/navigationConfig.ts`

```typescript
{
  label: 'Schedule Board',
  path: '/ops/schedule',
  icon: Calendar,
  description: 'PdM-driven crew planning',
  group: 'operations'
}
```

### Verification
```bash
# Manual UI testing:
# [ ] Navigate to /ops/schedule
# [ ] Click "Dry Run" - verify run appears in table
# [ ] Switch to Assignments tab - verify data loads
# [ ] Switch to Unfilled tab - verify breakdown shown
# [ ] Click row in runs table - verify unfilled filters
# [ ] Click "Execute Schedule" - verify executed badge
```

---

## Phase 9: RUL Chart Integration (60 min)

**Goal**: Show crew availability overlays on vessel RUL charts

### Tasks

#### 9.1 Add Crew Overlay to RUL Chart
**File**: Find the vessel RUL chart component (likely `client/src/components/RulChart.tsx` or similar)

**Add query for crew assignments**:
```typescript
// Fetch crew assignments for this vessel
const { data: crewAssignments = [] } = useQuery({
  queryKey: ['/api/schedule/assignments', orgId, vesselId, dateRange],
  queryFn: async () => {
    const from = format(new Date(), 'yyyy-MM-dd');
    const to = format(addDays(new Date(), 30), 'yyyy-MM-dd');
    const response = await apiRequest('GET',
      `/api/schedule/assignments?orgId=${orgId}&from=${from}&to=${to}`
    );
    // Filter for this vessel
    return response.filter((a: any) => a.vesselId === vesselId);
  },
  enabled: !!vesselId && showCrewOverlay
});
```

**Add overlay toggle**:
```typescript
const [showCrewOverlay, setShowCrewOverlay] = useState(false);

// In UI:
<div className="flex items-center gap-2">
  <Checkbox 
    checked={showCrewOverlay}
    onCheckedChange={setShowCrewOverlay}
    id="crew-overlay"
  />
  <Label htmlFor="crew-overlay">Show crew assignments</Label>
</div>
```

**Add overlay visualization** (in chart configuration):
```typescript
// Add crew availability bands to RUL timeline chart
const crewOverlayData = crewAssignments.map((a: any) => ({
  start: new Date(a.start),
  end: new Date(a.end),
  crewId: a.crewId,
  role: a.role
}));

// Render as colored bands above/below RUL line
```

#### 9.2 Add RUL Context to Schedule Board
**File**: `client/src/pages/schedule-board.tsx`

**Add RUL data query**:
```typescript
// Fetch RUL predictions for vessels with critical equipment
const { data: rulAlerts = [] } = useQuery({
  queryKey: ['/api/rul/critical', orgId],
  queryFn: async () => {
    const response = await apiRequest('GET', '/api/equipment-health');
    // Filter for critical RUL (≤9 days)
    return response.filter((e: any) => e.remainingDays && e.remainingDays <= 9);
  },
  refetchInterval: 60000
});
```

**Add alert banner**:
```typescript
{rulAlerts.length > 0 && (
  <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        Critical RUL Alerts
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {rulAlerts.map((alert: any) => (
          <div key={alert.equipmentId} className="flex justify-between items-center">
            <span>{alert.equipmentId} on {alert.vesselId}</span>
            <Badge variant="destructive">
              {alert.remainingDays} days remaining
            </Badge>
          </div>
        ))}
      </div>
      <Button 
        className="mt-4"
        onClick={() => planMutation.mutate('auto')}
        variant="destructive"
        data-testid="button-auto-replan"
      >
        Auto-Replan for Critical Equipment
      </Button>
    </CardContent>
  </Card>
)}
```

### Verification
```bash
# Integration test:
# [ ] Trigger RUL calculation showing critical equipment
# [ ] Navigate to Schedule Board
# [ ] Verify critical alert banner appears
# [ ] Click "Auto-Replan" - verify scheduler run triggered
# [ ] Navigate to vessel RUL chart
# [ ] Toggle "Show crew assignments"
# [ ] Verify crew overlay appears on timeline
```

---

## Phase 10: Comprehensive Testing (120 min)

**Goal**: Achieve >80% code coverage with unit + integration + e2e tests

### Tasks

#### 10.1 Unit Tests for Constraints
**File**: `server/tests/scheduler-constraints.test.ts` (NEW)

```typescript
import { describe, it, expect } from '@jest/globals';
import { overlaps, isWindowAllowed, leaveOverlaps, hasValidCertification } from '../crew-scheduler-ortools';

describe('Scheduler Constraint Logic', () => {
  describe('overlaps', () => {
    it('should detect overlapping time windows', () => {
      const a = { start: new Date('2025-11-05T08:00:00Z'), end: new Date('2025-11-05T16:00:00Z') };
      const b = { start: new Date('2025-11-05T12:00:00Z'), end: new Date('2025-11-05T20:00:00Z') };
      expect(overlaps(a.start, a.end, b.start, b.end)).toBe(true);
    });

    it('should not detect non-overlapping windows', () => {
      const a = { start: new Date('2025-11-05T08:00:00Z'), end: new Date('2025-11-05T16:00:00Z') };
      const b = { start: new Date('2025-11-05T17:00:00Z'), end: new Date('2025-11-05T20:00:00Z') };
      expect(overlaps(a.start, a.end, b.start, b.end)).toBe(false);
    });
  });

  describe('isWindowAllowed', () => {
    it('should block shifts during drydock', () => {
      const drydocks = [{
        vesselId: 'vessel-1',
        start: '2025-11-05T00:00:00Z',
        end: '2025-11-10T00:00:00Z'
      }];
      
      const result = isWindowAllowed(
        '2025-11-06',
        '08:00',
        '16:00',
        'vessel-1',
        [],
        drydocks as any
      );
      
      expect(result).toBe(false);
    });

    it('should allow shifts during port calls', () => {
      const portCalls = [{
        vesselId: 'vessel-1',
        start: '2025-11-05T00:00:00Z',
        end: '2025-11-10T00:00:00Z'
      }];
      
      const result = isWindowAllowed(
        '2025-11-06',
        '08:00',
        '16:00',
        'vessel-1',
        portCalls as any,
        []
      );
      
      expect(result).toBe(true);
    });

    it('should prioritize drydock over port call', () => {
      const drydocks = [{ vesselId: 'vessel-1', start: '2025-11-05T00:00:00Z', end: '2025-11-10T00:00:00Z' }];
      const portCalls = [{ vesselId: 'vessel-1', start: '2025-11-05T00:00:00Z', end: '2025-11-10T00:00:00Z' }];
      
      const result = isWindowAllowed('2025-11-06', '08:00', '16:00', 'vessel-1', portCalls as any, drydocks as any);
      
      expect(result).toBe(false); // Drydock blocks even with port call
    });
  });

  describe('leaveOverlaps', () => {
    it('should detect leave overlapping shift', () => {
      const leaves = [{
        crewId: 'crew-1',
        start: '2025-11-05T00:00:00Z',
        end: '2025-11-10T00:00:00Z'
      }];
      
      const result = leaveOverlaps(
        'crew-1',
        new Date('2025-11-06T08:00:00Z'),
        new Date('2025-11-06T16:00:00Z'),
        leaves as any
      );
      
      expect(result).toBe(true);
    });
  });

  describe('hasValidCertification', () => {
    it('should validate certification expiry', () => {
      const crew = { id: 'crew-1', skills: ['navigation'] };
      const certifications = {
        'crew-1': [{
          cert: 'STCW_OOW',
          expiresAt: '2025-12-31T00:00:00Z'
        }]
      };
      
      const result = hasValidCertification(
        crew as any,
        'STCW_OOW',
        new Date('2025-11-06T08:00:00Z'),
        new Date('2025-11-06T16:00:00Z'),
        certifications as any
      );
      
      expect(result).toBe(true);
    });

    it('should reject expired certification', () => {
      const crew = { id: 'crew-1', skills: ['navigation'] };
      const certifications = {
        'crew-1': [{
          cert: 'STCW_OOW',
          expiresAt: '2025-11-01T00:00:00Z' // Expired
        }]
      };
      
      const result = hasValidCertification(
        crew as any,
        'STCW_OOW',
        new Date('2025-11-06T08:00:00Z'),
        new Date('2025-11-06T16:00:00Z'),
        certifications as any
      );
      
      expect(result).toBe(false);
    });
  });
});
```

#### 10.2 Integration Tests for Auto-Replan
**File**: `server/tests/auto-replan-integration.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { schedulerEventBus } from '../events/scheduler-bus';
import { initializeAutoReplanPolicy } from '../scheduler/auto-replan-policy';

describe('Auto-Replan Integration', () => {
  beforeEach(() => {
    // Reset event bus
    schedulerEventBus.removeAllListeners();
  });

  it('should trigger replan on critical RUL', async () => {
    let replanTriggered = false;
    
    // Mock planAndMaybeExecute
    jest.mock('../scheduler/scheduler-controller', () => ({
      planAndMaybeExecute: async () => {
        replanTriggered = true;
        return { runId: 'test-run', stats: {} };
      }
    }));

    initializeAutoReplanPolicy();

    // Emit RUL event
    schedulerEventBus.emitRulUpdate({
      orgId: 'test-org',
      vesselId: 'vessel-1',
      equipmentId: 'engine-1',
      remainingDays: 5, // Critical
      riskLevel: 'high'
    });

    // Wait for async handler
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(replanTriggered).toBe(true);
  });

  it('should not trigger replan on non-critical RUL', async () => {
    let replanTriggered = false;
    
    initializeAutoReplanPolicy();

    schedulerEventBus.emitRulUpdate({
      orgId: 'test-org',
      vesselId: 'vessel-1',
      equipmentId: 'engine-1',
      remainingDays: 30, // Not critical
      riskLevel: 'low'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(replanTriggered).toBe(false);
  });
});
```

#### 10.3 E2E Tests for UI Workflows
**File**: `e2e/schedule-board.spec.ts` (NEW) - Use with run_test tool

```typescript
Test Plan:
1. [New Context] Create a new browser context
2. [Browser] Navigate to /ops/schedule
3. [Verify] Ensure page loads with "Schedule Board" title
4. [Browser] Click "Dry Run" button (data-testid="button-plan-dryrun")
5. [Verify] Wait for toast notification "Schedule Generated"
6. [Verify] Ensure run appears in "Run History" table
7. [Browser] Click "Assignments" tab (data-testid="tab-assignments")
8. [Verify] Ensure assignments table contains at least one row
9. [Browser] Click "Unfilled Shifts" tab (data-testid="tab-unfilled")
10. [Verify] Ensure unfilled section displays (empty is OK)
11. [Browser] Select "14" from days dropdown (data-testid="select-days")
12. [Browser] Click "Execute Schedule" button (data-testid="button-plan-execute")
13. [Verify] Ensure new run appears with "execute" badge
14. [Browser] Click on most recent run row
15. [Verify] Ensure unfilled table filters to that run
```

### Verification Checkpoint (CRITICAL GATE) ✅
```bash
# Run all tests
npm run test

# Expected:
# ✓ Scheduler constraint tests (8 passing)
# ✓ Auto-replan integration tests (5 passing)
# ✓ Storage method tests (6 passing)
# ✓ Event bus tests (4 passing)

# Run e2e test
# Use run_test tool with above test plan

# Coverage check
npm run test -- --coverage
# Target: >80% coverage for new code
```

**STOP IF COVERAGE <80%** - Add missing tests before proceeding

---

## Phase 11: Documentation (60 min)

**Goal**: Create production-ready documentation for operators and developers

### Tasks

#### 11.1 API Reference
**File**: `docs/api/scheduler-api.md` (NEW)

````markdown
# Scheduler API Reference

## Endpoints

### POST /api/schedule/plan
Plan crew schedule with optional execution.

**Request:**
```json
{
  "orgId": "string (required)",
  "from": "string (YYYY-MM-DD, optional, defaults to today)",
  "days": "number (optional, default 7)",
  "vessels": "string[] (optional)",
  "mode": "dry_run | execute | auto (optional, default dry_run)"
}
```

**Response:**
```json
{
  "runId": "uuid",
  "mode": "dry_run",
  "stats": {
    "duration_ms": 1250,
    "assigned": 42,
    "unfilled": 3,
    "reasons": [
      { "reason": "insufficient_skills", "count": 2 },
      { "reason": "on_leave", "count": 1 }
    ]
  },
  "scheduled": [...],
  "unfilled": [...]
}
```

### GET /api/schedule/runs
Fetch scheduler run history.

**Query Parameters:**
- `orgId` (required): Organization ID
- `limit` (optional): Max runs to return (default 50)

### GET /api/schedule/assignments
Get crew assignments for date range.

**Query Parameters:**
- `orgId` (required)
- `from` (required): Start date (YYYY-MM-DD)
- `to` (required): End date (YYYY-MM-DD)

### GET /api/schedule/unfilled
Get unfilled shifts.

**Query Parameters:**
- `orgId` (required)
- `runId` (optional): Filter by specific run
````

#### 11.2 PdM Integration Guide
**File**: `docs/guides/pdm-scheduler-integration.md` (NEW)

````markdown
# PdM-Scheduler Integration Guide

## Overview
The crew scheduler automatically replans shifts when predictive maintenance detects critical equipment conditions.

## Auto-Replan Triggers

### 1. RUL Critical Threshold
When RUL Engine predicts equipment failure within configured threshold:

**Configuration:**
```bash
SCHED_RUL_DAYS_CRITICAL=9  # Trigger replan when ≤9 days remaining
SCHED_RISK_REPLAN_LEVEL=high  # Minimum risk level to trigger
```

**Example:**
```
RUL Engine: Engine #3 has 7 days remaining (risk: high)
↓
Event Bus: pdm.rul.updated event emitted
↓
Auto-Replan: Trigger 7-day crew replan for vessel
↓
Scheduler: Adjust shifts to accommodate upcoming maintenance
```

### 2. Anomaly Detection
High/critical severity anomalies trigger immediate replan.

### 3. Maintenance Windows
When maintenance is scheduled, crew is automatically reallocated.

## Viewing Integration Status

**Metrics:**
```bash
curl http://localhost:5000/api/metrics | grep arus_scheduler_auto_replan
# arus_scheduler_auto_replan_triggers_total{org_id="...",trigger_type="rul_critical"} 3
```

**Scheduler Runs:**
Navigate to Schedule Board → Run History → Look for mode="auto"

## Configuration

Add to `.env`:
```bash
# Auto-replan policy
ENABLE_AUTO_REPLAN=true
SCHED_RUL_DAYS_CRITICAL=9
SCHED_RISK_REPLAN_LEVEL=high
SCHED_AUTO_REPLAN_DAYS=7
```
````

#### 11.3 Troubleshooting Runbook
**File**: `docs/operations/scheduler-runbook.md` (NEW)

````markdown
# Scheduler Operations Runbook

## Common Issues

### Issue: Auto-replan not triggering

**Symptoms:**
- RUL predictions show critical equipment
- No scheduler runs with mode="auto"

**Diagnosis:**
```bash
# Check if auto-replan is enabled
grep "Auto-Replan.*initialized" logs/Start_application_*.log

# Check RUL thresholds
curl http://localhost:5000/api/metrics | grep arus_rul_remaining_days
```

**Resolution:**
1. Verify `ENABLE_AUTO_REPLAN=true` in environment
2. Check `SCHED_RUL_DAYS_CRITICAL` threshold
3. Restart application to reload config

### Issue: High unfilled shift count

**Symptoms:**
- `arus_scheduler_unfilled_total` metric high
- Unfilled tab shows many gaps

**Diagnosis:**
```bash
curl http://localhost:5000/api/schedule/unfilled?orgId=xxx

# Common reasons:
# - insufficient_skills
# - on_leave
# - rest_violation
# - hours_exceeded
```

**Resolution:**
1. insufficient_skills → Add qualified crew or reduce shift requirements
2. on_leave → Adjust planning horizon or hire temporary crew
3. rest_violation → Reduce shift density or add rest periods
4. hours_exceeded → Redistribute shifts across more crew

### Issue: Scheduler performance degradation

**Symptoms:**
- `arus_scheduler_run_duration_ms` increasing
- Timeouts on `/api/schedule/plan`

**Diagnosis:**
```bash
# Check metrics
curl http://localhost:5000/api/metrics | grep arus_scheduler_run_duration

# Look for p95 > 5000ms
```

**Resolution:**
1. Reduce planning horizon (30 days → 14 days)
2. Filter to specific vessels
3. Enable database query optimization
4. Consider upgrading OR-Tools to constraint solver

## Metrics Reference

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| `arus_scheduler_run_duration_ms` | Scheduler execution time | p95 > 5000ms |
| `arus_scheduler_unfilled_total` | Unfilled positions | > 20% of total shifts |
| `arus_scheduler_runs_total{status="failed"}` | Failed runs | > 5% failure rate |
| `arus_scheduler_auto_replan_triggers_total` | Auto-replan count | Monitor for unexpected spikes |
````

#### 11.4 Update Main README
**File**: `replit.md`

Add section:
```markdown
## Crew Scheduler PdM Integration (November 2025)

**Status**: Production-ready ✅

Intelligent crew scheduling system integrated with RUL Engine v2.0 for predictive maintenance-driven crew planning.

**Key Features:**
- Auto-replan triggers from RUL predictions, anomalies, and maintenance windows
- Comprehensive constraint enforcement (drydock priority, leave overlap, certification validation)
- Full audit trail with run history and unfilled analysis
- Prometheus observability (run duration, coverage %, unfilled reasons)
- REST API for external integrations
- Schedule Board UI with dry-run and execute modes

**Architecture:**
- Event-driven integration via scheduler event bus
- Dry-run/execute/auto modes for different workflows
- Database audit trail in `scheduler_runs`, `schedule_assignments`, `schedule_unfilled` tables
- 4 REST endpoints for planning and analytics

**Configuration:**
```bash
ENABLE_AUTO_REPLAN=true
SCHED_RUL_DAYS_CRITICAL=9
SCHED_RISK_REPLAN_LEVEL=high
SCHED_AUTO_REPLAN_DAYS=7
```

**Documentation:**
- API Reference: `docs/api/scheduler-api.md`
- Integration Guide: `docs/guides/pdm-scheduler-integration.md`
- Operations Runbook: `docs/operations/scheduler-runbook.md`
```

### Verification
```bash
# Verify all docs exist
ls -la docs/api/scheduler-api.md
ls -la docs/guides/pdm-scheduler-integration.md
ls -la docs/operations/scheduler-runbook.md

# Test docs build (if using doc generator)
npm run docs:build
```

---

## Phase 12: Final Validation & Polish (60 min)

**Goal**: Comprehensive end-to-end validation ensuring production readiness

### Tasks

#### 12.1 Final Test Suite
```bash
# 1. Unit tests
npm run test -- scheduler
# Expected: All passing

# 2. Integration tests  
npm run test -- auto-replan
# Expected: All passing

# 3. Linting
npm run lint
# Expected: 0 errors, 0 warnings

# 4. Type checking
tsc --noEmit
# Expected: 0 errors

# 5. Database schema validation
npm run db:push
# Expected: "No schema changes detected" or successful push
```

#### 12.2 End-to-End Validation Workflow
**Manual test checklist:**

1. **Frontend Critical Fixes** ✅
   - [ ] Create shift with `skillRequired` field
   - [ ] Plan schedule with valid certifications
   - [ ] Verify time displays correctly (HH:mm format)
   - [ ] Verify leaves loaded before planning
   - [ ] Add drydock window - check description displays
   - [ ] Toggle enhanced/basic results independently

2. **Backend Constraint Logic** ✅
   - [ ] Create drydock overlapping shift → verify shift blocked
   - [ ] Create port call overlapping shift → verify shift allowed
   - [ ] Create drydock + port call → verify drydock wins
   - [ ] Add crew leave spanning shift → verify not assigned
   - [ ] Add cert expiring during shift → verify not assigned
   - [ ] Test rest time violations → verify not assigned

3. **PdM Integration** ✅
   - [ ] Trigger RUL calc showing critical equipment (≤9 days)
   - [ ] Verify auto-replan triggered (check logs + database)
   - [ ] Verify scheduler run created with trigger="rul_critical"
   - [ ] Create high-severity alert → verify auto-replan
   - [ ] Schedule maintenance → verify auto-replan

4. **API Endpoints** ✅
   - [ ] POST /api/schedule/plan (dry_run) → verify response
   - [ ] POST /api/schedule/plan (execute) → verify assignments saved
   - [ ] GET /api/schedule/runs → verify history
   - [ ] GET /api/schedule/assignments → verify data
   - [ ] GET /api/schedule/unfilled → verify analysis

5. **UI Workflows** ✅
   - [ ] Navigate to /ops/schedule
   - [ ] Run dry-run → verify results display
   - [ ] Execute schedule → verify executed badges
   - [ ] View assignments table → verify data loaded
   - [ ] View unfilled breakdown → verify reasons aggregated
   - [ ] Toggle 14-day horizon → verify dates update

6. **Observability** ✅
   - [ ] Run scheduler → check Prometheus metrics
   - [ ] Verify `arus_scheduler_run_duration_ms` recorded
   - [ ] Verify `arus_scheduler_unfilled_total` updated
   - [ ] Verify `arus_scheduler_auto_replan_triggers_total` incremented
   - [ ] Check logs for successful completion messages

#### 12.3 Performance Validation
```bash
# Capture performance metrics
curl -X POST http://localhost:5000/api/schedule/plan \
  -H "Content-Type: application/json" \
  -d '{"orgId":"test","days":30,"mode":"dry_run"}' \
  -w "\nTime: %{time_total}s\n"

# Expected: < 5 seconds for 30-day planning horizon

# Check Prometheus histogram
curl http://localhost:5000/api/metrics | grep arus_scheduler_run_duration_ms_bucket

# Expected: p95 < 5000ms, p99 < 8000ms
```

#### 12.4 Security Audit
```bash
# Check for exposed secrets
grep -r "API_KEY\|SECRET\|PASSWORD" server/ client/ --exclude-dir=node_modules

# Verify org-id validation in routes
grep -A 5 "POST /api/schedule" server/routes.ts | grep orgId

# Test unauthorized access
curl -X POST http://localhost:5000/api/schedule/plan \
  -H "Content-Type: application/json" \
  -d '{"days":7,"mode":"execute"}'
# Expected: 400 error "orgId is required"
```

#### 12.5 Final Polish

**Code cleanup:**
```bash
# Remove console.logs (keep structured logging only)
grep -r "console.log" server/ --exclude-dir=node_modules | grep -v "//"

# Remove commented code
# Manual review recommended

# Format all code
npm run format
```

**UI polish:**
- [ ] Verify all buttons have loading states
- [ ] Verify all forms have validation
- [ ] Verify all tables have empty states
- [ ] Verify all modals have proper close handlers
- [ ] Verify dark mode works on all new components

### Final Verification Checkpoint (PRODUCTION GATE) ✅
```bash
# Complete test suite
npm run test -- --coverage
# Required: >80% coverage, all tests passing

# Build check
npm run build
# Required: Clean build, no errors

# Performance benchmark
npm run perf-harness
# Required: All scenarios < thresholds

# Database integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM scheduler_runs;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM schedule_assignments;"
# Verify tables exist and accessible

# Metrics endpoint
curl http://localhost:5000/api/metrics | grep arus_scheduler | wc -l
# Expected: 6+ scheduler metrics

# Documentation completeness
[ -f docs/api/scheduler-api.md ] && \
[ -f docs/guides/pdm-scheduler-integration.md ] && \
[ -f docs/operations/scheduler-runbook.md ] && \
echo "✅ Docs complete" || echo "❌ Docs missing"
```

**GO/NO-GO Decision Criteria:**
- ✅ All tests passing (unit + integration + e2e)
- ✅ Code coverage >80%
- ✅ All 9 critical bugs fixed
- ✅ PdM integration functional
- ✅ Metrics exposed and validated
- ✅ Documentation complete
- ✅ Performance within SLAs
- ✅ Security audit passed

**If all criteria met → PRODUCTION READY** 🚀

---

## Environment Configuration

**Required environment variables** (add to `.env`):

```bash
# Scheduler configuration
ENABLE_AUTO_REPLAN=true
SCHED_RUL_DAYS_CRITICAL=9
SCHED_RISK_REPLAN_LEVEL=high
SCHED_AUTO_REPLAN_DAYS=7

# Performance tuning
SCHEDULER_MAX_PLANNING_DAYS=30
SCHEDULER_TIMEOUT_MS=10000

# Feature flags
ENABLE_SCHEDULER_METRICS=true
ENABLE_SCHEDULER_AUDIT_TRAIL=true
```

---

## Rollback Procedures

### If issues discovered during implementation:

**Phase 1-3 rollback:**
```bash
git revert <commit-sha>
npm run db:push -- --force  # Revert schema changes
```

**Phase 4-6 rollback:**
```bash
# Disable auto-replan
export ENABLE_AUTO_REPLAN=false
# Restart application
npm run dev
```

**Phase 7-9 rollback:**
```bash
# Comment out route registration
# Remove UI components from navigation
git checkout -- client/src/App.tsx
```

**Complete rollback:**
```bash
git reset --hard <pre-implementation-commit>
npm run db:push --force
npm run dev
```

---

## Success Metrics

**Implementation complete when:**

| Metric | Target | Validation |
|--------|--------|------------|
| Critical bugs fixed | 9/9 | Manual testing checklist |
| Test coverage | >80% | `npm run test -- --coverage` |
| API endpoints | 4/4 working | curl tests passing |
| UI components | 1 page + 1 integration | Manual navigation |
| Documentation | 3 docs complete | File existence check |
| PdM integration | Auto-replan functional | Trigger RUL → verify replan |
| Observability | 6+ metrics exposed | `/api/metrics` check |
| Performance | p95 < 5000ms | Prometheus histogram |

---

## Post-Implementation Tasks

1. **Create release notes**
2. **Update changelog**
3. **Tag release**: `git tag v2.1-crew-scheduler-pdm`
4. **Deploy to staging** for final validation
5. **Create Grafana dashboard** for scheduler metrics
6. **Schedule training session** for operators
7. **Monitor for 48 hours** before declaring production-ready

---

## Support & Escalation

**If blocked:**
1. Check troubleshooting runbook: `docs/operations/scheduler-runbook.md`
2. Review metrics: `curl http://localhost:5000/api/metrics | grep arus_scheduler`
3. Check logs: `grep "Auto-Replan\|Scheduler" /tmp/logs/Start_application_*.log`
4. Rollback if critical: See "Rollback Procedures" above

**Production incident response:**
1. Disable auto-replan: `ENABLE_AUTO_REPLAN=false`
2. Switch to manual mode only
3. Investigate root cause via audit trail
4. Fix and re-enable incrementally
