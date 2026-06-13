# Mobile Old UI Route Audit

**Date:** 2026-06-13
**Status:** Phase 1 Seeded (using new `classifyMobileRoute`)
**Classifier Version:** Initial

## Summary

| Status                  | Count | Action Needed |
|-------------------------|-------|---------------|
| `mobileReplacement`     | 7     | Keep & maintain |
| `mobileUserPage`        | 2     | Review polish |
| `universalAdminShell`   | 3     | Block from mobile nav |
| `legacyCardLayout`      | 4     | Wrap or replace (P0) |
| `missing`               | 2     | Add handling or remove |

**High Priority Leaks:** 6

## Detailed Classification (Seeded from `classifyMobileRoute`)

| Path                    | Classification         | Safe for Bottom Nav? | Recommended Action                     | Priority | Notes |
|-------------------------|------------------------|----------------------|----------------------------------------|----------|-------|
| `/`                     | mobileReplacement      | ✅ Yes               | Keep                                   | P0       | Command center |
| `/fleet`                | mobileReplacement      | ✅ Yes               | Keep                                   | P0       | Good |
| `/work-orders`          | mobileReplacement      | ✅ Yes               | Keep                                   | P0       | Good |
| `/pdm-platform`         | mobileReplacement      | ✅ Yes               | Keep                                   | P0       | Good |
| `/logs`                 | mobileReplacement      | ✅ Yes               | Keep                                   | P0       | Good |
| `/system`               | mobileUserPage         | ✅ Yes               | Polish UI if needed                    | P1       | Settings |
| `/profile`              | legacyCardLayout       | ❌ No                | Create `MobileProfilePage` or wrapper  | P0       | Inconsistent target across roles |
| `/my-tasks`             | legacyCardLayout       | ❌ No                | Wrap with MobilePageShell              | P0       | Common CTA leak |
| `/attention-inbox`      | missing                | ❌ No                | Add to MobileReadinessRoute or remove  | P0       | Appears in fleetOps |
| UniversalOpsShell paths | universalAdminShell    | ❌ No                | Add guard in App.tsx + tests           | P0       | Critical |

## Action Items
- [ ] Update `mobile-readiness-navigation.ts` to use `isSafeForBottomNav`
- [ ] Block UniversalOpsShell from mobile flows
- [ ] Seed more rows after full codebase scan

**Maintenance:** Re-run `classifyMobileRoute` against all nav definitions after every change to bottom nav.

Last updated by Grok Phase 1 implementation.