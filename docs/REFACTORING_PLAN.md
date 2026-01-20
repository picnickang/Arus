# God Files Refactoring Plan

## Current State

### server/routes.ts
- **Size**: 13,731 lines (508KB)
- **Routes**: ~422 API endpoints
- **Status**: Monolithic, but functional

### server/storage.ts  
- **Size**: 14,024 lines (500KB)
- **Methods**: ~648 async methods
- **Status**: Monolithic, but functional

**Total**: 27,755 lines requiring refactoring

## Route Distribution Analysis

Top route domains (by count):
- analytics: 47 routes (lines 2166-11605)
- crew: 28 routes
- equipment: 19 routes  
- condition: 17 routes
- work-orders: 16 routes
- vessels: 14 routes
- alerts: 14 routes
- optimization: 11 routes
- maintenance-templates: 11 routes
- sync: 10 routes

## Recommended Refactoring Strategy

### Phase 1: Routes Extraction (routes.ts)

**Pattern**: Follow existing modular structure (sensor-routes.ts, beast-mode-routes.ts, enhanced-llm-routes.ts)

1. Create domain-specific route files:
   ```
   server/routes/
   ├── analytics-routes.ts      (47 routes)
   ├── crew-routes.ts            (28 routes)
   ├── equipment-routes.ts       (19 routes)
   ├── work-order-routes.ts      (16 routes)
   ├── vessel-routes.ts          (14 routes)
   ├── alert-routes.ts           (14 routes)
   └── ... (10+ more domains)
   ```

2. Each route file exports:
   ```typescript
   export function mountXRoutes(app: Express, storage: IStorage, rateLimiters: RateLimiters) {
     app.get('/api/x/...', async (req, res) => { ... });
     app.post('/api/x/...', writeOperationRateLimit, async (req, res) => { ... });
   }
   ```

3. Update server/routes.ts to mount all modules:
   ```typescript
   import { mountAnalyticsRoutes } from './routes/analytics-routes';
   import { mountCrewRoutes } from './routes/crew-routes';
   // ... etc
   
   export async function registerRoutes(app: Express) {
     // Shared rate limiters
     const rateLimiters = { telemetryRateLimit, writeOperationRateLimit, ... };
     
     // Mount domain routes
     mountAnalyticsRoutes(app, storage, rateLimiters);
     mountCrewRoutes(app, storage, rateLimiters);
     // ... etc
   }
   ```

**Expected Result**: routes.ts reduced from 13,731 to ~2,000 lines (just registration)

### Phase 2: Storage Domain Extraction (storage.ts)

**Pattern**: Facade pattern with domain repositories

1. Create domain repository structure:
   ```
   server/storage/
   ├── index.ts                  (exports IStorage facade)
   ├── shared/
   │   ├── types.ts              (common types)
   │   └── utils.ts              (shared utilities)
   └── domains/
       ├── core-repository.ts         (org, user, device - ~25 methods)
       ├── telemetry-repository.ts    (telemetry, sensor - ~30 methods)
       ├── maintenance-repository.ts  (work orders, maintenance - ~75 methods)
       ├── crew-repository.ts         (crew, shifts, rest - ~50 methods)
       ├── alert-repository.ts        (alerts, compliance - ~30 methods)
       ├── inventory-repository.ts    (parts, stock, supplier - ~15 methods)
       ├── analytics-repository.ts    (ML, RUL, vibration - ~30 methods)
       └── admin-repository.ts        (admin, system - ~15 methods)
   ```

2. Keep IStorage as stable facade:
   ```typescript
   export interface IStorage {
     // All existing method signatures (unchanged)
     getOrganizations(): Promise<Organization[]>;
     // ... ~648 methods
   }
   ```

3. DatabaseStorage becomes thin coordinator:
   ```typescript
   export class DatabaseStorage implements IStorage {
     private core: CoreRepository;
     private telemetry: TelemetryRepository;
     private maintenance: MaintenanceRepository;
     // ... domain repositories
     
     constructor(db: DB) {
       this.core = new CoreRepository(db);
       this.telemetry = new TelemetryRepository(db);
       // ... initialize all domains
     }
     
     // Delegate to repositories
     getOrganizations() { return this.core.getOrganizations(); }
     getDevices(orgId) { return this.core.getDevices(orgId); }
     getTelemetry(id) { return this.telemetry.getTelemetry(id); }
     // ... delegate all 648 methods
   }
   ```

**Expected Result**: storage.ts reduced from 14,024 to ~2,000 lines (just delegation)

### Phase 3: Testing & Validation

**For each extracted module:**

1. **Unit Tests**: Test repository methods in isolation
2. **Integration Tests**: Test API endpoints with real database
3. **Smoke Tests**: Verify critical user flows still work
4. **Performance Tests**: Ensure no regression in query performance

**Critical Acceptance Criteria:**
- ✅ All existing imports still work (`import { storage } from './storage'`)
- ✅ All TypeScript types unchanged
- ✅ All API endpoints return same responses
- ✅ All tests pass
- ✅ Each file < 1,000 lines
- ✅ Zero production bugs introduced

## Implementation Order

### Priority 1: Routes (Lower Risk)
1. Extract analytics routes (largest, most isolated)
2. Extract crew routes
3. Extract equipment routes  
4. Extract work-order routes
5. Continue with remaining domains

### Priority 2: Storage (Higher Risk)
1. Create shared utilities
2. Extract core repository (org, user, device)
3. Extract telemetry repository
4. Extract maintenance repository
5. Continue domain-by-domain
6. Update DatabaseStorage to delegate

## Risk Mitigation

**High-Risk Areas:**
- Circular dependencies between domains
- Shared helper functions
- Rate limiter configuration
- Error handling patterns
- WebSocket dependencies

**Mitigation Strategies:**
- Extract one domain at a time
- Test after each extraction
- Keep rollback commits for each step
- Maintain 100% backward compatibility
- Use feature flags for gradual rollout

## Estimated Effort

- **Routes extraction**: 8-12 hours (lower risk)
- **Storage extraction**: 16-24 hours (higher risk)  
- **Testing & validation**: 4-8 hours
- **Total**: 28-44 hours of engineering time

## Status

- ✅ CRUD Migration Complete (33 components, 1,125 lines saved)
- ⏸️ God Files Refactoring: **Documented, not yet started**
- 📋 Infrastructure created: `server/storage/shared/`, `server/storage/domains/`

## Next Steps

1. Get stakeholder approval on approach
2. Schedule refactoring sprint (2-3 days dedicated time)
3. Set up comprehensive test coverage first
4. Execute extraction incrementally
5. Monitor production metrics closely

## Alternative Approaches

If full extraction is deemed too risky:

**Option A**: Extract only top 3 domains (analytics, crew, equipment)
- Reduces routes.ts by ~30%
- Lower risk, faster execution

**Option B**: Keep monoliths, add documentation
- Document domain boundaries with comments
- Add table of contents at top of each file
- Use IDE folding regions to organize

**Option C**: New features go in separate files
- Keep existing code as-is (working, tested)
- All new features must be in modular files
- Natural migration over time
