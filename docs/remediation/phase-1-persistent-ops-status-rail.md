# Phase 1 Remediation: Persistent Ops Status Rail

**Status**: Implemented (PR #54)
**Priority**: P0 - Critical visibility blocker
**Goal**: Make top risks, offline outbox, handover, and vessel status always visible on every screen.

## Component

- Location: `client/src/components/ops/OpsStatusRail.tsx`
- Fully prop-driven and reusable
- Night-vision safe, large touch targets (44px+), redundant coding
- One-tap primary actions

## Integration (UniversalOpsShell)

Add the rail right after the top bar / header area, before subnav or main content:

```tsx
import { OpsStatusRail } from './OpsStatusRail';

// Inside UniversalOpsShell return JSX
<OpsStatusRail
  risks={topRisks}
  outboxCount={outbox.count}
  outboxHasConflict={outbox.hasConflict}
  handoverMinutes={nextHandover?.minutes}
  isVesselLocal={mode === 'vessel'}
  cachedSensors={sensorStatus.cachedCount}
  onAction={(action, payload) => {
    if (action === 'accept-risk') handleAcceptWorkOrder(payload);
    if (action === 'review-outbox') navigateToOutbox();
    // etc.
  }}
/>
```

## Data Wiring Recommendations
- Use existing `useAttentionInbox`, `useOfflineOutbox`, `useHandoverQueue`, sensor context
- Prioritize risks by severity × confidence
- Keep rail minimal (max 4 items) for glanceability

## Playwright Tests

Basic tests added in `tests/ops-status-rail.spec.ts`.
Expand with:
- Vessel-local mode simulation
- Offline banner + rail interaction
- Permission variations
- Night mode visual regression

## Acceptance Criteria (from spec)
- [x] Visible on all Operations sub-pages without scrolling
- [ ] One-tap actions work without losing context
- [ ] Night + daylight themes pass contrast
- [ ] ≥44px touch targets
- [ ] Playwright assertions pass in offline simulation

## Next
- Wire real data sources in UniversalOpsShell
- Add to other hubs if desired (Fleet, Maintenance overview)
- Tighten Playwright coverage
- Proceed to Phase 2: Standardized ActionCard component
