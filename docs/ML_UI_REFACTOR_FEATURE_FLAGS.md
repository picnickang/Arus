# ML/AI UI Refactor - Feature Flags Plan

**Date:** November 17, 2025  
**Purpose:** Incremental rollout strategy with rollback capability  
**Risk Mitigation:** Enable safe deployment and rapid recovery

---

## Overview

### Why Feature Flags?

1. **Risk Reduction:** Decouple deployment from release
2. **Incremental Rollout:** Test with small user groups first
3. **Instant Rollback:** Disable features without code deployment
4. **A/B Testing:** Compare old vs new UI performance
5. **Team Testing:** Internal validation before user exposure

---

## Feature Flag Architecture

### Implementation: Environment Variables + LocalStorage Override

**File:** `client/src/lib/feature-flags.ts`

```typescript
/**
 * ML/AI UI Refactor Feature Flags
 *
 * Flags can be controlled via:
 * 1. Environment variables (VITE_FEATURE_*)
 * 2. LocalStorage overrides (for testing)
 * 3. Admin panel toggles (future)
 */

interface FeatureFlags {
  // Phase 1: AI Management Studio
  enableNewModelManagement: boolean;
  enableUnifiedTrainingForm: boolean;
  enableNewAcousticUI: boolean;
  enableDataExports: boolean;

  // Phase 2: AI Performance
  enableNewPerformanceDashboard: boolean;
  enableNewExplanations: boolean;
  enableNewFeedbackUI: boolean;

  // Phase 3: AI Insights
  enableNewAIReports: boolean;
  enableVesselIntelligence: boolean;
  enableEquipmentKnowledge: boolean;
}

const defaultFlags: FeatureFlags = {
  // All disabled by default (progressive rollout)
  enableNewModelManagement: false,
  enableUnifiedTrainingForm: false,
  enableNewAcousticUI: false,
  enableDataExports: false,
  enableNewPerformanceDashboard: false,
  enableNewExplanations: false,
  enableNewFeedbackUI: false,
  enableNewAIReports: false,
  enableVesselIntelligence: false,
  enableEquipmentKnowledge: false,
};

/**
 * Get feature flag value with precedence:
 * 1. LocalStorage override (for developers)
 * 2. Environment variable
 * 3. Default value
 */
function getFlag(key: keyof FeatureFlags): boolean {
  // LocalStorage override (dev testing)
  const localOverride = localStorage.getItem(`feature_${key}`);
  if (localOverride !== null) {
    return localOverride === "true";
  }

  // Environment variable
  const envKey = `VITE_FEATURE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`;
  const envValue = import.meta.env[envKey];
  if (envValue !== undefined) {
    return envValue === "true";
  }

  // Default
  return defaultFlags[key];
}

export const featureFlags = {
  // Phase 1
  enableNewModelManagement: getFlag("enableNewModelManagement"),
  enableUnifiedTrainingForm: getFlag("enableUnifiedTrainingForm"),
  enableNewAcousticUI: getFlag("enableNewAcousticUI"),
  enableDataExports: getFlag("enableDataExports"),

  // Phase 2
  enableNewPerformanceDashboard: getFlag("enableNewPerformanceDashboard"),
  enableNewExplanations: getFlag("enableNewExplanations"),
  enableNewFeedbackUI: getFlag("enableNewFeedbackUI"),

  // Phase 3
  enableNewAIReports: getFlag("enableNewAIReports"),
  enableVesselIntelligence: getFlag("enableVesselIntelligence"),
  enableEquipmentKnowledge: getFlag("enableEquipmentKnowledge"),
};

/**
 * Helper for debugging - shows all active flags
 */
export function debugFeatureFlags() {
  console.table(featureFlags);
}

/**
 * Dev tool: Enable all flags for testing
 */
export function enableAllFlags() {
  Object.keys(defaultFlags).forEach((key) => {
    localStorage.setItem(`feature_${key}`, "true");
  });
  console.log("✅ All feature flags enabled. Refresh to apply.");
}

/**
 * Dev tool: Disable all flags (revert to defaults)
 */
export function disableAllFlags() {
  Object.keys(defaultFlags).forEach((key) => {
    localStorage.removeItem(`feature_${key}`);
  });
  console.log("✅ All feature flags disabled. Refresh to apply.");
}

// Expose to window for console access
if (import.meta.env.DEV) {
  (window as any).featureFlags = {
    current: featureFlags,
    debug: debugFeatureFlags,
    enableAll: enableAllFlags,
    disableAll: disableAllFlags,
  };
}
```

---

## Usage in Components

### Pattern 1: Conditional Rendering (Component Level)

```typescript
// client/src/pages/ml-ai-consolidated.tsx
import { featureFlags } from '@/lib/feature-flags';
import { MLTrainingPage } from './ml-training'; // Old
import { ConditionMonitoringStudio } from './condition-monitoring-studio'; // New

export default function MLAIConsolidated() {
  return (
    <Tabs>
      <TabsContent value="training">
        {featureFlags.enableNewModelManagement ? (
          <ConditionMonitoringStudio />
        ) : (
          <MLTrainingPage />
        )}
      </TabsContent>
    </Tabs>
  );
}
```

### Pattern 2: Feature Wrapper Component

```typescript
// client/src/components/FeatureFlag.tsx
import { featureFlags } from '@/lib/feature-flags';

interface FeatureFlagProps {
  flag: keyof typeof featureFlags;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function FeatureFlag({ flag, fallback = null, children }: FeatureFlagProps) {
  const isEnabled = featureFlags[flag];
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

// Usage:
<FeatureFlag
  flag="enableNewModelManagement"
  fallback={<MLTrainingPageOld />}
>
  <ConditionMonitoringStudio />
</FeatureFlag>
```

---

## Rollout Strategy

### Phase 1: Internal Testing (Week 1)

**Target:** Development team only  
**Method:** LocalStorage overrides

**Setup:**

```bash
# In browser console on dev environment
window.featureFlags.enableAll();
location.reload();
```

**Validation:**

- ✅ All new components render without errors
- ✅ All existing functionality still works
- ✅ No console errors or warnings
- ✅ Mobile layouts work correctly

**Exit Criteria:**

- All E2E tests passing
- No critical bugs
- Performance metrics acceptable

---

### Phase 2: Beta Users (Week 2)

**Target:** 5-10 internal users (crew managers, fleet operators)  
**Method:** Environment variable + invitation

**Deployment:**

```bash
# .env.production
VITE_FEATURE_ENABLE_NEW_MODEL_MANAGEMENT=true
VITE_FEATURE_ENABLE_UNIFIED_TRAINING_FORM=true
```

**Beta Invitation:**

- Email selected users
- Provide feedback form: "What do you like? What's confusing?"
- Monitor Sentry for errors

**Metrics to Track:**

- User session duration (should not decrease)
- Error rate (should not increase)
- Task completion time (training a model, generating report)

**Exit Criteria:**

- No critical bugs reported
- Positive user feedback (>80% satisfaction)
- Error rate < 1%

---

### Phase 3: Staged Rollout (Week 3)

**Target:** 25% → 50% → 100% of users  
**Method:** Gradual environment variable rollout

**25% Rollout:**

```bash
# Enable for random sample
# (Requires backend percentage-based flag support - future enhancement)
VITE_FEATURE_ENABLE_NEW_MODEL_MANAGEMENT=true
```

**Monitor for 48 hours:**

- Performance metrics
- Error rates
- User feedback
- Support tickets

**50% Rollout:**

- If metrics stable, increase to 50%

**100% Rollout:**

- If metrics still stable, enable for all users
- Old components remain in codebase (code path available)

---

### Phase 4: Deprecation (Week 6+)

**After 2 weeks at 100%:**

- Monitor for any late-surfacing issues
- If stable, remove old components from codebase
- Remove feature flags (code cleanup)

---

## Rollback Procedure

### Instant Rollback (Emergency)

**Scenario:** Critical bug discovered in production

**Action:**

```bash
# 1. Disable feature flag immediately
# .env.production
VITE_FEATURE_ENABLE_NEW_MODEL_MANAGEMENT=false

# 2. Redeploy frontend (or restart if using runtime config)
npm run build && npm run deploy

# Time to rollback: ~2 minutes
```

**Communication:**

- Post in #incidents Slack channel
- Update status page
- Notify affected users

---

### Partial Rollback

**Scenario:** One feature broken, others work fine

**Action:**

```bash
# Disable only the problematic feature
VITE_FEATURE_ENABLE_NEW_ACOUSTIC_UI=false
# Keep others enabled
VITE_FEATURE_ENABLE_NEW_MODEL_MANAGEMENT=true
```

---

## Feature Flag Lifecycle

### Flag States

```
NEW → BETA → ROLLOUT → ESTABLISHED → DEPRECATED → REMOVED
```

**Lifecycle Management:**

| State       | Description          | Duration  | Action                   |
| ----------- | -------------------- | --------- | ------------------------ |
| NEW         | Just developed       | 1 week    | Internal testing only    |
| BETA        | Beta users testing   | 1 week    | Gather feedback          |
| ROLLOUT     | Gradual 25→100%      | 1-2 weeks | Monitor metrics          |
| ESTABLISHED | 100% enabled, stable | 2+ weeks  | Remove flag if no issues |
| DEPRECATED  | Flag always true     | N/A       | Clean up code            |
| REMOVED     | Code deleted         | N/A       | Flag deleted             |

**Cleanup Schedule:**

- Every sprint: Review flags in "ESTABLISHED" state
- Remove flags that have been stable for 2+ weeks
- Document flag removal in changelog

---

## Environment Configuration

### Development

```bash
# .env.development
# All flags enabled for dev/testing
VITE_FEATURE_ENABLE_NEW_MODEL_MANAGEMENT=true
VITE_FEATURE_ENABLE_UNIFIED_TRAINING_FORM=true
VITE_FEATURE_ENABLE_NEW_ACOUSTIC_UI=true
VITE_FEATURE_ENABLE_DATA_EXPORTS=true
VITE_FEATURE_ENABLE_NEW_PERFORMANCE_DASHBOARD=true
VITE_FEATURE_ENABLE_NEW_EXPLANATIONS=true
VITE_FEATURE_ENABLE_NEW_FEEDBACK_UI=true
VITE_FEATURE_ENABLE_NEW_AI_REPORTS=true
VITE_FEATURE_ENABLE_VESSEL_INTELLIGENCE=true
VITE_FEATURE_ENABLE_EQUIPMENT_KNOWLEDGE=true
```

### Staging

```bash
# .env.staging
# Match production rollout state
VITE_FEATURE_ENABLE_NEW_MODEL_MANAGEMENT=true
VITE_FEATURE_ENABLE_UNIFIED_TRAINING_FORM=false
# ... (mirrors production)
```

### Production

```bash
# .env.production
# Controlled rollout (start with all false)
VITE_FEATURE_ENABLE_NEW_MODEL_MANAGEMENT=false
VITE_FEATURE_ENABLE_UNIFIED_TRAINING_FORM=false
VITE_FEATURE_ENABLE_NEW_ACOUSTIC_UI=false
VITE_FEATURE_ENABLE_DATA_EXPORTS=false
VITE_FEATURE_ENABLE_NEW_PERFORMANCE_DASHBOARD=false
VITE_FEATURE_ENABLE_NEW_EXPLANATIONS=false
VITE_FEATURE_ENABLE_NEW_FEEDBACK_UI=false
VITE_FEATURE_ENABLE_NEW_AI_REPORTS=false
VITE_FEATURE_ENABLE_VESSEL_INTELLIGENCE=false
VITE_FEATURE_ENABLE_EQUIPMENT_KNOWLEDGE=false
```

---

## Testing with Feature Flags

### Unit Tests

**Mock feature flags in tests:**

```typescript
// jest.setup.ts
jest.mock("@/lib/feature-flags", () => ({
  featureFlags: {
    enableNewModelManagement: true,
    // ... all flags true for testing
  },
}));
```

### E2E Tests

**Test both paths:**

```typescript
// Test old UI (flag disabled)
test("ML Training - Old UI", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear(); // Ensure no overrides
  });
  // Test old UI behavior
});

// Test new UI (flag enabled)
test("ML Training - New UI", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("feature_enableNewModelManagement", "true");
  });
  // Test new UI behavior
});
```

---

## Admin Panel (Future Enhancement)

**Feature Flag Management UI**

```typescript
// client/src/pages/admin/feature-flags.tsx
export function FeatureFlagsAdmin() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Feature</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Rollout %</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>New Model Management</TableCell>
          <TableCell>
            <Badge className="bg-green-500">Enabled</Badge>
          </TableCell>
          <TableCell>100%</TableCell>
          <TableCell>
            <Button size="sm" variant="outline">Disable</Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
```

---

## Monitoring & Alerts

### Metrics to Track Per Flag

**Performance:**

- Page load time (old vs new)
- Time to Interactive
- Bundle size impact

**Usage:**

- % of users seeing new UI
- Feature adoption rate
- User engagement metrics

**Errors:**

- JavaScript errors (by feature flag)
- API errors (by feature flag)
- User-reported bugs

**Alerts:**

```yaml
# Alert if error rate increases >5% after enabling flag
- alert: FeatureFlagErrorRateHigh
  expr: |
    (errors_per_feature_flag{flag="enableNewModelManagement"} / requests_per_feature_flag{flag="enableNewModelManagement"})
    > 0.05
  for: 5m
  annotations:
    summary: "High error rate detected for new model management UI"
    action: "Consider disabling feature flag"
```

---

## Documentation

### User-Facing

**No need to mention feature flags to users!**

- They see the new UI when it's ready
- No "beta" or "experimental" labels (unless desired)

### Developer-Facing

**README section:**

````markdown
## Feature Flags

This project uses feature flags for gradual rollout.

### Enable all flags locally:

```javascript
// Browser console
window.featureFlags.enableAll();
location.reload();
```
````

### Check current flags:

```javascript
window.featureFlags.current;
```

```

---

## Summary

| Phase | Duration | Scope | Rollback Time |
|-------|----------|-------|---------------|
| Internal Testing | 1 week | Dev team (5 people) | Instant (localStorage) |
| Beta Testing | 1 week | Internal users (10 people) | 2 minutes (env var) |
| 25% Rollout | 2 days | Random 25% | 2 minutes |
| 50% Rollout | 2 days | Random 50% | 2 minutes |
| 100% Rollout | Ongoing | All users | 2 minutes |
| Flag Removal | Week 6+ | N/A | N/A |

**Risk Mitigation:** ✅ **ROBUST**
- Instant rollback capability
- Gradual exposure limits blast radius
- Old UI always available as fallback

---

**Next Step:** Proceed to Mobile Responsive Strategy
```
