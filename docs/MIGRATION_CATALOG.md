# CRUD Hooks Migration Catalog
**Status:** Phase 1 - Discovery Complete
**Date:** October 11, 2025

## Summary
- **Total components identified:** 21
- **Already migrated:** 13 (507 lines saved)
- **Remaining to migrate:** 21
- **Estimated total savings:** ~630 additional lines

## Migration Batches (Risk-Based Sequencing)

### Batch 1: Low Risk - Simple Forms (1-2 mutations, standard CRUD)
**Complexity:** ⭐ Low | **Risk:** 🟢 Very Low | **Lines to save:** ~60

1. **MultiPartSelector.tsx** - 1 mutation
2. **WorkOrderCostForm.tsx** - 1 mutation  
3. **transport-settings.tsx** - 1 mutation

### Batch 2: Medium Risk - Cost/Config Forms (2-3 mutations, some custom logic)
**Complexity:** ⭐⭐ Medium | **Risk:** 🟡 Low-Medium | **Lines to save:** ~180

4. **LaborRateConfiguration.tsx** - 3 mutations
5. **PartsInventoryCostForm.tsx** - 2 mutations
6. **ExpenseTrackingForm.tsx** - 3 mutations
7. **storage-settings.tsx** - 5 mutations
8. **system-administration.tsx** - 3 mutations

### Batch 3: Higher Complexity - Schedulers & Analysis (3+ mutations, complex state)
**Complexity:** ⭐⭐⭐ High | **Risk:** 🟠 Medium | **Lines to save:** ~270

9. **CrewScheduler.tsx** - Multiple mutations, complex scheduling logic
10. **HoursOfRest.tsx** - STCW compliance, complex calculations
11. **OperatingConditionAlertsPanel.tsx** - Real-time alerting logic
12. **UnknownSignals.tsx** - Signal mapping workflow
13. **SensorTemplates.tsx** - Template management
14. **SimplifiedCrewManagement.tsx** - Crew operations alternative UI

### Batch 4: Specialized Pages (unique workflows, highest complexity)
**Complexity:** ⭐⭐⭐⭐ Very High | **Risk:** 🔴 Medium-High | **Lines to save:** ~120

15. **manual-telemetry-upload.tsx** - File upload, validation, processing
16. **ml-training.tsx** - ML model training workflows
17. **optimization-tools.tsx** - Multi-step optimization processes
18. **advanced-analytics.tsx** - Complex analytics operations
19. **pdm-pack.tsx** - Predictive maintenance pack operations

### Special Case: Requires Bug Fix First
**Status:** 🚨 BLOCKED - Rendering issue must be fixed before migration

20. **sensor-optimization.tsx** - KNOWN BUG: Blank page, backend works, frontend crashes
   - Must fix rendering issue in Phase 2
   - Then migrate in separate focused effort

## Migration Strategy

### Phase 1: CRUD Hooks Migration
**Sequence:** Batch 1 → Batch 2 → Batch 3 → Batch 4

**Per-Batch Process:**
1. Read component and identify all mutations
2. Migrate to appropriate CRUD hook (useCreateMutation, useUpdateMutation, useDeleteMutation, useCustomMutation)
3. Verify invalidateKeys matches original queryClient.invalidateQueries calls
4. Test locally, verify LSP clean
5. Run architect review
6. Move to next component

**Rollback Strategy:**
- Git revert individual component if regression found
- Each component is independent migration
- Zero breaking changes expected

### Success Criteria
- ✅ Zero TypeScript errors
- ✅ Behavior preserved (mutations work, cache invalidates, toasts appear)
- ✅ Lines of code reduced by ~25-30 per component
- ✅ Architect review passed

## Risk Mitigation
1. **Incremental batches:** Never migrate >5 components at once
2. **Test between batches:** Smoke test each batch before next
3. **Architecture review:** Architect validates each batch
4. **Feature preservation:** All original functionality maintained
5. **Cache invalidation:** Verify query cache updates correctly

## Next Steps
1. ✅ Catalog complete
2. ⏭️ Start Batch 1 migration (3 simple components)
3. → Continue through batches sequentially
4. → Fix sensor-optimization.tsx in Phase 2
