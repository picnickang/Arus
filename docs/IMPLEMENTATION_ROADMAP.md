# Implementation Roadmap: Proposed Repair Prompts

**Status:** Draft  
**Total Prompts Reviewed:** 12  
**Recommended Actions:** 7 Accept, 3 Reject, 2 Defer

---

## 🎯 Quick Decision Matrix

```
┌────────────────────────────────────────────────────────────────┐
│                  ACCEPT (Immediate Value)                      │
├────────────────────────────────────────────────────────────────┤
│ ✅ Prompt #1:  VesselManagement Bug Fixes                     │
│ ✅ Prompt #2:  VesselIntelligence Accuracy Fixes             │
│ ✅ Prompt #6-8: Frontend Form Patterns (Consolidated)         │
│ ✅ Prompt #9+11: LP Optimizer Comprehensive Fix (Merged)      │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    REJECT (Conflicts)                          │
├────────────────────────────────────────────────────────────────┤
│ ❌ Prompt #4:  SQLite Schema (PostgreSQL conflict)            │
│ ❌ Prompt #5:  Cost Dashboard (90% duplicate)                 │
│ ❌ Prompt #12: System Repair Full (too broad, overlaps)       │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                 DEFER (Needs Decision)                         │
├────────────────────────────────────────────────────────────────┤
│ ⚠️  Prompt #3+10: Vessel Counters (Choose UTC or SGT)         │
└────────────────────────────────────────────────────────────────┘
```

---

## 📅 7-Week Implementation Schedule

### **Week 1: Critical Bug Fixes** 🔴

**Goal:** Fix production-breaking issues

**Tasks:**

```
Day 1-2: VesselManagement Component
├─ Add missing imports (queryClient, Table components)
├─ Fix utilization calculation
├─ Add error boundaries
└─ Write unit tests

Day 3-4: VesselIntelligence Service
├─ Fix operating hours (months → hours)
├─ Add deterministic date sorting
├─ Fix cost analysis division-by-zero
└─ Integration tests with sample data

Day 5: Testing & Deployment
├─ Manual QA on staging
├─ Performance regression tests
└─ Deploy to production
```

**Deliverables:**

- [ ] Zero runtime errors in VesselManagement
- [ ] Accurate operating hours in intelligence reports
- [ ] All tests passing

**Dependencies:** None  
**Risk:** LOW  
**Effort:** 5 days

---

### **Week 2-3: LP Optimizer Consolidation** 🟡

**Goal:** Single, comprehensive optimizer fix

**Merged Prompts:** #9 (Parts+Lateness) + #11 (Core Fixes)

**Tasks:**

```
Week 2:
├─ Day 1: Solution parsing fix (META_KEYS pattern)
├─ Day 2: Binary variables + per-crew overlap
├─ Day 3: Equipment exclusivity constraints
├─ Day 4: Unassigned job penalty logic
└─ Day 5: Drizzle query fixes + transaction wrapping

Week 3:
├─ Day 1: Parts stock constraints
├─ Day 2: Soft lateness penalty
├─ Day 3: Deadline/preferred date windows
├─ Day 4: Integration tests (1000+ jobs)
└─ Day 5: Performance tuning + deployment
```

**Deliverables:**

- [ ] Optimizer returns feasible schedules
- [ ] No crew/equipment overlaps
- [ ] Parts inventory respected
- [ ] Late jobs penalized, not forbidden

**Dependencies:** None  
**Risk:** MEDIUM (complex business logic)  
**Effort:** 10 days

---

### **Week 4: Vessel Counter Decision** ⚠️

**Goal:** Choose ONE idempotent cron implementation

**Decision Point:**

```
IF multi-region deployment:
  ✅ Choose UTC (Prompt #10)
  └─ Reason: Consistent across timezones

IF Singapore-only:
  ✅ Choose SGT (Prompt #3)
  └─ Reason: Aligns with business hours

ELSE:
  ❌ Defer decision
  └─ Run current system until requirements clear
```

**Implementation (after decision):**

```
Day 1: Create daily_vessel_counters table
Day 2: Implement chosen cron logic
Day 3: Add idempotency tests
Day 4: Run parallel with old system (verification)
Day 5: Cutover + monitor
```

**Deliverables:**

- [ ] Zero double-increments across restarts
- [ ] Timezone-aware day boundaries
- [ ] Downtime tracking accurate

**Dependencies:** Product decision (UTC vs SGT)  
**Risk:** MEDIUM (business logic change)  
**Effort:** 5 days

---

### **Week 5: Frontend Pattern Library** 🟢

**Goal:** DRY principle for form improvements

**Consolidated Prompts:** #6 (Sensors) + #7 (Work Orders) + #8 (Expenses)

**Tasks:**

```
Day 1: Create reusable components
├─ components/form/ControlledSelect.tsx
├─ components/form/CurrencyInput.tsx
├─ hooks/useControlledNumber.ts
└─ hooks/useCurrencyFormat.ts

Day 2-3: Apply to existing forms
├─ Sensor Templates
├─ Work Order Cost
└─ Expense Tracking

Day 4: Testing
├─ Unit tests for hooks
├─ Integration tests for forms
└─ Visual regression tests

Day 5: Documentation + Deployment
├─ Storybook stories
└─ Deploy to production
```

**Deliverables:**

- [ ] Zero uncontrolled component warnings
- [ ] Consistent numeric input handling
- [ ] Reusable currency formatting

**Dependencies:** None  
**Risk:** LOW (UI improvements)  
**Effort:** 5 days

---

### **Week 6: Security Hardening** 🔐

**Goal:** CSRF + rate limiting for admin routes

**Subset of Prompt #10:**

**Tasks:**

```
Day 1: Middleware implementation
├─ server/middleware/csrf.ts
├─ server/middleware/rateLimit.ts
└─ server/middleware/logging.ts

Day 2: Apply to admin routes
├─ /api/admin/settings (POST/PUT/DELETE)
├─ /api/admin/patches (POST)
└─ /api/admin/auth/change-password (POST)

Day 3: Frontend integration
├─ Add x-csrf-token header
└─ Handle 403/429 errors gracefully

Day 4: Testing
├─ Unit tests (middleware)
├─ Integration tests (routes)
└─ Security audit

Day 5: Deployment + Monitoring
├─ Deploy to staging
├─ Monitor rate limit hits
└─ Production rollout
```

**Deliverables:**

- [ ] CSRF protection on all admin mutations
- [ ] Rate limiting (60 req/min per IP)
- [ ] Structured JSON logging

**Dependencies:** None  
**Risk:** MEDIUM (auth changes)  
**Effort:** 5 days

---

### **Week 7: Schema Hardening (Optional)** ⏸️

**Goal:** Foreign keys + CHECK constraints

**Subset of Prompt #4 (PostgreSQL-compatible only):**

**Tasks:**

```
Day 1: Migration planning
├─ Audit existing data for orphan rows
├─ Plan FK cascade behaviors
└─ Design CHECK constraints

Day 2-3: Migration execution
├─ Add FKs (vessels → equipment → telemetry)
├─ Add CHECK constraints (enums)
└─ Add unique indexes (rollups)

Day 4: Verification
├─ Test CASCADE DELETE behavior
├─ Verify enum validation
└─ Performance benchmarks

Day 5: Deployment
├─ Apply to staging
├─ Monitor query performance
└─ Production rollout (if safe)
```

**Deliverables:**

- [ ] No orphan equipment/telemetry records
- [ ] Enum values validated at DB layer
- [ ] Cascade deletes working correctly

**Dependencies:** Full database backup  
**Risk:** HIGH (schema changes)  
**Effort:** 5 days

**⚠️ NOTE:** Defer if not critical

---

## 🚨 Explicitly REJECTED Items

### 1. SQLite Schema Migration (Prompt #4)

**Why Rejected:**

- Current system uses PostgreSQL (`pgTable`, `jsonb`, `boolean`)
- Prompt assumes SQLite (`sqliteTable`, `TEXT`, `integer`)
- Would require complete rewrite of `shared/schema.ts`

**Alternative:**

- Verify if dual-mode (PostgreSQL + SQLite) already exists
- If yes, add SQLite schema as **separate** file
- If no, skip entirely

**Cost if applied:** 2+ weeks of migration work + high data loss risk

---

### 2. Cost Savings Dashboard Rewrite (Prompt #5)

**Why Rejected:**

- `server/cost-savings-engine.ts` already implements 90% of proposed features
- Prompt creates duplicate business logic
- Parallel maintenance burden

**Alternative:**

- Extend existing engine with missing features:
  - `/breakdown` endpoint (add groupBy parameter)
  - `/top` endpoint (add sorting logic)
  - `/roi` endpoint (add ROI multiple calculation)

**Cost if applied:** +2000 lines of duplicate code

---

### 3. System Repair Full Rewrite (Prompt #12)

**Why Rejected:**

- Too broad (1567 lines of instructions)
- 70% overlap with other prompts (#10, #11)
- Proposes complete rewrites instead of targeted fixes

**Alternative:**

- Cherry-pick specific fixes (already covered in other prompts)
- Skip redundant rewrites

**Cost if applied:** 6+ weeks of work, most of it redundant

---

## 📊 Effort vs Impact Analysis

```
High Impact, Low Effort (DO FIRST):
┌─────────────────────────────────────────┐
│ • VesselManagement fixes       (2 days) │
│ • VesselIntelligence fixes     (2 days) │
│ • Frontend pattern library     (5 days) │
└─────────────────────────────────────────┘

High Impact, High Effort (DO NEXT):
┌─────────────────────────────────────────┐
│ • LP Optimizer consolidation  (10 days) │
│ • Security hardening           (5 days) │
└─────────────────────────────────────────┘

Medium Impact, Medium Effort (DECIDE):
┌─────────────────────────────────────────┐
│ • Vessel counter idempotency   (5 days) │
└─────────────────────────────────────────┘

Low Impact, High Effort (DEFER):
┌─────────────────────────────────────────┐
│ • Schema hardening             (5 days) │
│ • Money → cents migration     (10 days) │
└─────────────────────────────────────────┘
```

---

## ✅ Acceptance Criteria (All Phases)

Before marking any phase complete:

### **Code Quality**

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes with 0 warnings
- [ ] Test coverage ≥80% for new code
- [ ] All functions have JSDoc comments

### **Testing**

- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual QA completed on staging
- [ ] Performance regression tests pass

### **Database**

- [ ] Migrations tested on prod snapshot
- [ ] Rollback script prepared
- [ ] Schema changes backwards-compatible
- [ ] Query performance unchanged (±10%)

### **Security**

- [ ] Multi-tenant isolation verified
- [ ] No secrets in logs
- [ ] Rate limiting tested
- [ ] CSRF protection working

### **Documentation**

- [ ] Architecture decision recorded
- [ ] API changes in OpenAPI spec
- [ ] Migration guide written
- [ ] `replit.md` updated

---

## 🎯 Success Metrics

### **Week 1 (Bug Fixes)**

- ✅ Zero runtime errors in VesselManagement
- ✅ Operating hours accuracy: ±1% vs manual calculation
- ✅ Deployment success rate: 100%

### **Week 2-3 (LP Optimizer)**

- ✅ Schedule feasibility rate: >95%
- ✅ No crew overlaps: 100% compliance
- ✅ Parts inventory respect: 100% compliance
- ✅ Optimization time: <10s for 1000 jobs

### **Week 4 (Vessel Counter)**

- ✅ Zero double-increments: 30-day verification
- ✅ Timezone correctness: 100% alignment with chosen TZ
- ✅ Cron execution time: <1s per run

### **Week 5 (Frontend Patterns)**

- ✅ Zero uncontrolled warnings
- ✅ Form submission success rate: 100%
- ✅ Numeric input errors: 0 NaN values

### **Week 6 (Security)**

- ✅ CSRF block rate: 100% (401 on missing token)
- ✅ Rate limit effectiveness: <1% false positives
- ✅ Log completeness: 100% requests have requestId

### **Week 7 (Schema - Optional)**

- ✅ Zero orphan records after FK addition
- ✅ Enum validation: 100% invalid values rejected
- ✅ Query performance: ±5% vs baseline

---

## 🔄 Rollback Plan

For each phase:

### **Week 1-2 (Code Changes Only)**

```bash
# Rollback via Git
git revert <commit-hash>
npm run build
npm run deploy
```

### **Week 4 (Cron Changes)**

```bash
# Disable new cron, revert to old logic
kubectl scale deployment cron-scheduler --replicas=0
git revert <commit-hash>
npm run deploy
```

### **Week 6 (Security)**

```bash
# Remove CSRF/rate-limit middleware
git revert <commit-hash>
npm run deploy

# Monitor for broken admin routes
tail -f /var/log/arus/admin.log | grep "401\|403"
```

### **Week 7 (Schema)**

```sql
-- Rollback foreign keys
ALTER TABLE equipment DROP CONSTRAINT fk_vessel_id;
ALTER TABLE telemetry DROP CONSTRAINT fk_equipment_id;

-- Rollback CHECK constraints
ALTER TABLE vessels DROP CONSTRAINT chk_vessel_class;
```

---

## 📞 Escalation Path

**Phase blocked?** Contact:

1. **Technical blocker:** Engineering Lead
2. **Product decision (UTC vs SGT):** Product Manager
3. **Schema migration risk:** Database Admin
4. **Security concerns:** InfoSec Team

**Red flags to escalate immediately:**

- Data loss detected
- Production outage >5 minutes
- Security vulnerability discovered
- Performance degradation >50%

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-05  
**Status:** Ready for Review
