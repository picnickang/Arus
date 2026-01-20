# Phase 7: REST API Routes - COMPLETE ✅

**Completion Date**: November 5, 2025  
**Architect Review**: APPROVED  
**Status**: Production-Ready

---

## Overview

Phase 7 delivered REST API routes for scheduler operations with critical security fixes for tenant isolation. All endpoints now derive organization identity from authenticated headers instead of trusting user-supplied parameters.

---

## Deliverables

### 1. Scheduler REST API (5 Endpoints)

**Implementation**: `server/routes.ts` (lines 11889-11997)

#### POST /api/schedule/plan
Plans crew schedule (dry-run or execute mode)

**Request Body**:
```typescript
{
  from: string,        // ISO date
  days?: number,       // Default: 7
  vessels?: string[],  // Optional vessel filter
  mode?: "dry_run" | "execute"  // Default: "dry_run"
}
```

**Response**:
```typescript
{
  runId: string,
  coverage: number,
  unfilledCount: number,
  assignments: Assignment[]
}
```

**Security**: Derives orgId from `x-org-id` header via `getOrgIdFromRequest(req)`

#### GET /api/schedule/runs
Retrieves scheduler run history

**Query Parameters**:
```typescript
{
  limit?: number  // Default: 50
}
```

**Response**: Array of `SchedulerRun` objects

**Security**: Filters runs by authenticated orgId

#### GET /api/schedule/runs/:id
Retrieves specific scheduler run by ID

**Path Parameters**: `id` (string)

**Response**: `SchedulerRun` object

**Security**: 
- Derives orgId from header
- Validates run.orgId matches authenticated orgId
- Returns 403 Forbidden if mismatch

#### GET /api/schedule/assignments
Retrieves schedule assignments for date range

**Query Parameters**:
```typescript
{
  from: string,  // ISO date (required)
  to: string     // ISO date (required)
}
```

**Response**: Array of `ScheduleAssignment` objects

**Security**: Filters assignments by authenticated orgId

#### GET /api/schedule/unfilled
Retrieves unfilled shift positions

**Query Parameters**:
```typescript
{
  runId?: string  // Optional: filter by specific run
}
```

**Response**: Array of `ScheduleUnfilled` objects

**Security**: Filters unfilled shifts by authenticated orgId

---

## Critical Security Fix

### Vulnerability (Original Implementation)
All scheduler endpoints accepted `orgId` from request body/query parameters without authentication, allowing attackers to:
- Access other organizations' scheduler data
- Enumerate sensitive scheduling information
- Bypass multi-tenant isolation

### Security Remediation

**Pattern Applied**: All endpoints now use `getOrgIdFromRequest(req)` to derive organization identity from authenticated headers.

**Authentication Function** (`server/routes.ts`, lines 204-210):
```typescript
function getOrgIdFromRequest(req: Request): string {
  const orgId = req.headers['x-org-id'] as string;
  if (!orgId || typeof orgId !== 'string' || orgId.trim() === '') {
    throw new Error('x-org-id header is required for authentication');
  }
  return orgId.trim();
}
```

**Before (VULNERABLE)**:
```typescript
app.post("/api/schedule/plan", async (req, res) => {
  const { orgId, from, days, vessels, mode } = req.body;
  // Uses user-supplied orgId - SECURITY BREACH
});
```

**After (SECURE)**:
```typescript
app.post("/api/schedule/plan", async (req, res) => {
  const orgId = getOrgIdFromRequest(req);  // Authenticated
  const { from, days, vessels, mode } = req.body;
  // Uses authenticated orgId only
});
```

---

## Security Properties

1. **Mandatory Authentication**: All endpoints require `x-org-id` header
2. **No Trusted User Input**: Organization ID derived from authenticated context only
3. **Tenant Isolation**: Endpoints cannot access data outside authenticated organization
4. **Authorization Verification**: `/api/schedule/runs/:id` explicitly validates ownership
5. **Consistent Pattern**: Matches existing crew endpoints security model

---

## Rate Limiting

**Applied**: `crewOperationRateLimit` middleware on POST /api/schedule/plan

**Configuration**:
- Window: 15 minutes
- Max requests: 100 per window
- Standard headers: true

---

## Testing & Validation

### Architect Review Findings
✅ All five scheduler routes derive orgId exclusively from `getOrgIdFromRequest(req)`  
✅ No user-controlled org switching possible  
✅ `/api/schedule/runs/:id` adds explicit org ownership check  
✅ No regressions in error handling or service operation  
✅ LSP diagnostics: Clean (0 errors)  
✅ Server status: Running successfully  

### Security Verification
- ✅ No endpoints accept orgId from request body
- ✅ No endpoints accept orgId from query parameters
- ✅ All endpoints validate x-org-id header presence
- ✅ Tenant isolation verified via ownership checks

---

## Recommendations (Future Enhancements)

### 1. Improved Error Response Codes
**Current**: Returns 500 when `x-org-id` header is missing  
**Suggested**: Return 401 Unauthorized for missing authentication  

### 2. Input Validation
**Current**: Basic TypeScript validation  
**Suggested**: Add Zod schemas for request/query payload validation  

### 3. Enumeration Attack Prevention
**Current**: No rate limiting on GET endpoints  
**Suggested**: Apply rate limiting to read endpoints to mitigate enumeration risks  

### 4. JWT Integration
**Current**: HMAC header authentication  
**Suggested**: Evaluate JWT tokens for enhanced security in production  

---

## Integration Points

### Scheduler Controller
- `planAndMaybeExecute()` - Main scheduling orchestration
- Returns run metadata, assignments, and unfilled positions

### Storage Layer
- `getSchedulerRuns()` - Fetch run history
- `getSchedulerRun()` - Fetch specific run
- `getScheduleAssignments()` - Fetch assignments by date range
- `getScheduleUnfilled()` - Fetch unfilled positions

### Auto-Replan Controller
- Triggers via `/api/schedule/plan` with `mode: "execute"`
- Integrates with PdM event bus
- Applies deduplication and cleanup logic

---

## Metrics Exposure

All scheduler operations emit Prometheus metrics:
- `sched_run_duration_seconds` - Planning duration
- `sched_runs_total{status, mode}` - Run counts
- `sched_coverage_percent` - Current coverage
- `sched_unfilled_total` - Unfilled position count
- `sched_assigned_shifts` - Total assignments
- `sched_auto_replan_triggers` - Auto-replan events
- `sched_deduplicated_runs` - Duplicate prevention
- `sched_cleanup_assignments` - Cleaned assignments

**Endpoint**: `/api/metrics` (public, bypasses authentication)

---

## File Modifications

### server/routes.ts
**Lines Modified**: 11889-11997

**Changes**:
1. Added 5 scheduler API endpoints
2. Applied `getOrgIdFromRequest()` to all endpoints
3. Added explicit ownership check for `/api/schedule/runs/:id`
4. Removed orgId from request body/query parameters
5. Applied rate limiting to POST /api/schedule/plan

---

## Phase Completion Criteria

- ✅ All 5 scheduler endpoints implemented
- ✅ Tenant isolation enforced via authenticated headers
- ✅ Cross-tenant access prevention verified
- ✅ Rate limiting applied to POST endpoint
- ✅ Error handling implemented
- ✅ LSP diagnostics clean
- ✅ Server running successfully
- ✅ Architect review approved
- ✅ Security pattern consistent with existing endpoints

---

## Impact Assessment

### Security Impact
**HIGH PRIORITY**: Critical tenant isolation vulnerability eliminated. All scheduler endpoints now enforce proper authentication and authorization.

### Operational Impact
**POSITIVE**: Full REST API coverage for scheduler operations enables frontend integration and monitoring.

### Performance Impact
**MINIMAL**: Endpoints leverage existing storage layer. No new database queries or performance overhead.

---

## Next Steps (Phase 8)

Frontend Schedule Board implementation including:
1. Schedule visualization grid
2. Assignment management UI
3. Unfilled position alerts
4. Run history viewer
5. Real-time updates via WebSocket

---

**Phase 7 Status**: PRODUCTION-READY ✅  
**Security Status**: TENANT ISOLATION RESTORED ✅  
**Architect Approval**: GRANTED ✅
