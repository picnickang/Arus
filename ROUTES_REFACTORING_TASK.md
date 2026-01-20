# routes.ts Refactoring Task - Phase 3 Hardening

**Status:** 📋 Planned - Not Yet Started  
**Priority:** Medium  
**Estimated Effort:** 2-3 days  
**Risk Level:** High (153 refactoring sites)

---

## Overview

Complete the security hardening by refactoring `server/routes.ts` to use modern patterns, comprehensive validation, and proper error handling. This is a follow-up to Phase 1 & 2 hardening which focused on `server/index.ts`.

---

## Current State

**File:** `server/routes.ts`  
**Lines:** ~3000+ LOC  
**Issues Identified:**

1. **153 instances of `getOrgIdFromRequest()`** - Legacy pattern, should use `AuthenticatedRequest`
2. **Missing Zod validation** - Query/path params validated manually or not at all
3. **No async error wrapping** - Try/catch blocks instead of asyncHandler
4. **Unsafe WebSocket broadcasts** - No null checks on `wsServerInstance`
5. **MQTT health endpoint fragility** - Returns 500 on error instead of 503 degraded
6. **No ETag/304 caching** - Dashboard endpoints always return full payload
7. **Duplicate imports** - `z from zod` appears twice
8. **Rate limiters not applied** - Infrastructure exists but not used

---

## Objectives

### 1. Unify Org-Scoping (HIGH PRIORITY)

**Problem:**

```typescript
// Current pattern (153 instances):
const orgId = getOrgIdFromRequest(req);
if (!orgId) {
  return res.status(401).json({ error: "Unauthorized" });
}
```

**Solution:**

```typescript
// New pattern:
import { type AuthenticatedRequest } from "./middleware/auth";

app.get("/api/example", async (req: AuthenticatedRequest, res) => {
  const orgId = req.user.orgId; // Guaranteed by middleware
  // ...
});
```

**Benefits:**

- Type safety
- No manual validation
- Enforced by middleware
- Cleaner code

**Implementation Steps:**

1. Add `AuthenticatedRequest` type import
2. Replace all `getOrgIdFromRequest()` calls with `req.user.orgId`
3. Remove `orgId` null checks (middleware guarantees it)
4. Delete `getOrgIdFromRequest` function
5. Run full test suite

**Estimated Changes:** 153 occurrences across ~80 routes

---

### 2. Comprehensive Zod Validation (MEDIUM PRIORITY)

**Problem:**

```typescript
// Current pattern:
const vesselId = req.query.vesselId as string;
if (!vesselId || vesselId === "[object Object]") {
  return res.status(400).json({ error: "Invalid vesselId" });
}
```

**Solution:**

```typescript
// New pattern:
const querySchema = z.object({
  vesselId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  startDate: z.string().datetime().optional(),
});

const { vesselId, limit, startDate } = querySchema.parse(req.query);
```

**Routes Requiring Validation:**

- `/api/telemetry/latest` - vesselId, equipmentId, limit
- `/api/equipment/health` - equipmentId, vesselId
- `/api/analytics/*` - Various date ranges and IDs
- `/api/vessels/*` - vessel IDs and filters
- All bulk endpoints - array validation

**Benefits:**

- Structured error responses
- Type coercion (strings → numbers)
- Clear documentation of expected params
- Better error messages for clients

---

### 3. Async Handler Wrapping (MEDIUM PRIORITY)

**Problem:**

```typescript
// Current pattern:
app.get("/api/example", async (req, res) => {
  try {
    const data = await storage.getData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal error" });
  }
});
```

**Solution:**

```typescript
// New pattern:
import { asyncHandler } from "./utils/async-handler";

app.get(
  "/api/example",
  asyncHandler(async (req, res) => {
    const data = await storage.getData();
    res.json(data);
  })
);
```

**Benefits:**

- No manual try/catch needed
- Errors automatically passed to error middleware
- Cleaner code
- Consistent error handling

**Estimated Changes:** ~200 async route handlers

---

### 4. WebSocket Broadcast Safety (LOW PRIORITY)

**Problem:**

```typescript
// Current pattern:
wsServerInstance.broadcast({ type: "alert", data });
// Crashes if wsServerInstance is null
```

**Solution:**

```typescript
// New pattern:
function broadcastAlertSafe(payload: any) {
  if (!wsServerInstance) {
    console.warn("WebSocket server not available, skipping broadcast");
    return;
  }
  try {
    wsServerInstance.broadcast(payload);
  } catch (error) {
    console.error("WebSocket broadcast failed:", error);
  }
}

// Usage:
broadcastAlertSafe({ type: "alert", data });
```

**Benefits:**

- No crashes when WebSocket unavailable
- Graceful degradation
- Better error logging

---

### 5. MQTT Health Endpoint Hardening (LOW PRIORITY)

**Problem:**

```typescript
// Current pattern:
app.get("/api/mqtt/health", async (req, res) => {
  const mqttSync = await import("./mqtt-reliable-sync");
  const status = mqttSync.getStatus(); // Throws if not initialized
  res.json(status);
});
```

**Solution:**

```typescript
// New pattern:
app.get(
  "/api/mqtt/health",
  asyncHandler(async (req, res) => {
    try {
      const mqttSync = await import("./mqtt-reliable-sync");
      const status = mqttSync.getStatus();
      res.status(200).json({ status: "healthy", ...status });
    } catch (error) {
      res.status(503).json({
        status: "degraded",
        reason: "MQTT service unavailable",
        error: error.message,
      });
    }
  })
);
```

**Benefits:**

- Proper HTTP semantics (503 for degraded service)
- No 500 errors for expected conditions
- Better monitoring

---

### 6. ETag/304 Caching (LOW PRIORITY)

**Target Endpoints:**

- `/api/dashboard` - Expensive aggregation
- `/api/analytics/fleet-health` - Large payload
- `/api/insights/latest` - Frequently polled

**Implementation:**

```typescript
import { createHash } from "crypto";

app.get(
  "/api/dashboard",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getDashboardData(req.user.orgId);

    const hash = createHash("sha1").update(JSON.stringify(data)).digest("hex");
    const etag = `W/"${hash}"`;

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.setHeader("ETag", etag);
    res.json(data);
  })
);
```

**Benefits:**

- Reduced bandwidth (304 responses have no body)
- Faster response times
- Better client-side caching

---

### 7. Apply Rate Limiters (HIGH PRIORITY)

**Already Created (Phase 2):**

- `writeLimiter` - 300/min for writes
- `telemetryLimiter` - 600/min for telemetry
- `bulkLimiter` - 10/5min for expensive ops

**Application Plan:**

```typescript
import { writeLimiter, telemetryLimiter, bulkLimiter } from "./middleware/rate-limit";

// Write operations
app.use(["/api/parts", "/api/work-orders", "/api/equipment", "/api/sensors"], writeLimiter);

// Telemetry ingestion
app.use(["/api/telemetry", "/api/edge/heartbeat"], telemetryLimiter);

// Bulk operations
app.use(["/api/telemetry/bulk", "/api/import/*"], bulkLimiter);
```

**Benefits:**

- DoS protection
- Fair resource allocation
- Prevents accidental abuse

---

## Implementation Strategy

### Step 1: Preparation

1. Create comprehensive test suite for critical routes
2. Document current behavior
3. Set up feature branch
4. Establish rollback plan

### Step 2: Low-Risk Changes First

1. Fix duplicate imports ✅ Easy win
2. Add WebSocket safety helpers ✅ Isolated change
3. Harden MQTT health endpoint ✅ Single route

### Step 3: Medium-Risk Changes

1. Wrap async handlers ⚠️ Affects all routes
2. Add Zod validation ⚠️ Changes error responses
3. Implement ETag caching ⚠️ New behavior

### Step 4: High-Risk Changes

1. Apply rate limiters ⚠️⚠️ Could block legitimate traffic
2. Replace getOrgIdFromRequest ⚠️⚠️⚠️ 153 changes, high regression risk

### Step 5: Testing & Validation

1. Run full test suite
2. Manual testing of critical flows
3. Load testing with rate limits
4. Security testing (auth bypass attempts)
5. Performance testing (ETag effectiveness)

---

## Testing Requirements

### Unit Tests

- [ ] Zod schemas validate correctly
- [ ] Zod schemas reject invalid input
- [ ] asyncHandler catches errors
- [ ] WebSocket helpers handle null gracefully
- [ ] ETag generation is stable

### Integration Tests

- [ ] Multi-tenant guard: 401 without auth
- [ ] HMAC validation on telemetry endpoints
- [ ] Rate limits trigger 429 after threshold
- [ ] ETag: second request returns 304
- [ ] MQTT health: 200 healthy, 503 degraded

### Security Tests

- [ ] getOrgIdFromRequest removal doesn't break auth
- [ ] Rate limits prevent brute force
- [ ] Zod validation prevents injection

---

## Risk Mitigation

### Risk: Breaking Auth (getOrgIdFromRequest removal)

**Mitigation:**

- Change one route at a time
- Run full test suite after each change
- Keep `getOrgIdFromRequest` function until all usages removed
- Use TypeScript to catch missing `req.user.orgId`

### Risk: Rate Limiting Blocks Legitimate Traffic

**Mitigation:**

- Start with generous limits (300/min)
- Monitor 429 responses in production
- Add bypass for internal services
- Implement rate limit metrics

### Risk: Zod Validation Changes Break Clients

**Mitigation:**

- Document new validation rules
- Add migration guide
- Test with actual client requests
- Consider grace period with warnings

---

## Success Criteria

- [ ] Zero getOrgIdFromRequest usages remaining
- [ ] All routes use asyncHandler
- [ ] All query/body params Zod validated
- [ ] Rate limiters applied to write/telemetry/bulk routes
- [ ] WebSocket broadcasts never crash
- [ ] MQTT health returns 503 on degradation
- [ ] ETag caching implemented on 3+ endpoints
- [ ] Full test suite passes
- [ ] No TypeScript errors
- [ ] Security audit passes

---

## Rollback Plan

If critical issues arise:

1. Revert to Phase 2 state (before routes.ts changes)
2. Remove rate limiters from routes
3. Keep Phase 1 & 2 improvements (server/index.ts)

Estimated rollback time: < 10 minutes

---

## Estimated Timeline

- **Preparation:** 4 hours
- **Low-risk changes:** 4 hours
- **Medium-risk changes:** 8 hours
- **High-risk changes:** 16 hours (getOrgIdFromRequest refactoring)
- **Testing & validation:** 8 hours
- **Total:** 40 hours (5 days)

---

## Dependencies

- Phase 1 & 2 hardening complete ✅
- Rate limiting middleware created ✅
- asyncHandler utility created ✅
- Comprehensive test suite (TO CREATE)
- Staging environment for testing
- Monitoring for 429 responses

---

## Next Steps

1. Review and approve this refactoring plan
2. Create comprehensive test suite
3. Schedule Phase 3 implementation
4. Coordinate with team for testing support
5. Prepare rollback procedures

---

**Created:** November 7, 2025  
**Author:** ARUS Development Team  
**Status:** Awaiting approval
