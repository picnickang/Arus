# ARUS Maritime HMI Compliance — Evidence Map

**Version**: 2.0 (evidence-linked)
**Date**: 2026-06-14
**Status**: Pre-pilot. Each claim below cites a specific enforced artifact
(test / token / guard / lint rule). Claims without an artifact are listed
under §6 "Not yet enforced" rather than asserted.

> How to read this: every row names the **artifact** that makes the claim true
> and keeps it true. "Enforced" = a CI gate fails if it regresses. "Implemented"
> = present in code but not independently gated. CORE Playwright specs run in
> `ci.yml` via `CORE_RELEASE_TESTS` (`playwright.config.ts`); guards run via
> `npm run check:guards`; unit specs run in the `test:unit` lane.

## 1. SOLAS V/15 & IMO S-Mode (MSC.1/Circ.1609) — persistent critical info

| Claim | Status | Enforced by (artifact) |
|---|---|---|
| Persistent Ops Status Rail (top risk, offline outbox, handover) on the **admin** ops surface | Enforced | `client/src/components/ops/OpsStatusRail.tsx` mounted in `UniversalOpsShell.tsx`; `tests/playwright/bridge-conditions.spec.ts` (CORE) asserts the rail region renders with the risk chip |
| Persistent rail on the **mobile-readiness** surface (docked above the bottom nav; surfaces for risk/outbox/offline) | Enforced | mounted in `client/src/App.tsx` for mobile-readiness routes; `tests/playwright/mobile-ops-rail.spec.ts` (CORE) asserts it docks above the nav and shows the risk chip |
| Critical items do not scroll off-screen | Enforced | `mobile-ops-rail.spec.ts` asserts the rail's lower edge sits above the nav and in the lower viewport (fixed-docked, not in-flow) |
| Redundant coding (icon + text + colour, never colour-only) | Implemented + partial gate | `OpsStatusRail.tsx` renders an icon (`ObiAlertCategoryA`) **and** a text label **and** colour per chip; `bridge-conditions.spec.ts` asserts the `obi-alert-category-a` symbol renders. Engine-gauge emoji replaced with vector icons (commit `d6179e35`). No standalone "colour-only" lint (see §6) |

## 2. IEC 62288 / MSC.1/Circ.1609 — brilliance & night vision

| Claim | Status | Enforced by (artifact) |
|---|---|---|
| Four brilliances (day / dusk / **night** / bright) mapped to OpenBridge palettes | Enforced | `client/src/components/theme-provider.tsx` sets `data-obc-theme`; `bridge-conditions.spec.ts` asserts `html[data-obc-theme="night"]` under the bridge theme |
| Night-vision dimming on the mobile screens (amber-on-dark, not a bright white UI) | Enforced | `.dark` token remap in `client/src/index.css`; `bridge-conditions.spec.ts` + `mobile-ops-rail.spec.ts` assert the rail background luminance < 60 under bridge |
| Brilliance is **reachable on a phone** (bridge crew can dim on the device) | Enforced | `ThemeToggle` (incl. Bridge/Night) mounted in the mobile headers (`MobileReadinessShared.tsx`); `mobile-ops-rail.spec.ts` asserts the control is visible, ≥44px, and Bridge is one tap away |
| Contrast meets WCAG AA across **all four** brilliances | Enforced (ratchet) | `tests/playwright/axe-contrast.spec.ts` (CORE) runs axe `color-contrast` on both surfaces × 4 themes; baselines `axe-contrast-baseline.json` (ops = 6) and `axe-contrast-mobile-baseline.json` (mobile = 22), ratchet-down-only |
| Reduced motion honoured (rough seas / vestibular — WCAG 2.3.3) | Enforced | reduced-motion block in `client/src/index.css`; pinned by `tests/unit/reduced-motion-css.test.ts` |

## 3. OpenBridge Design System alignment

| Claim | Status | Enforced by (artifact) |
|---|---|---|
| Adoption decision + scope recorded | Enforced (review) | ADR `docs/adr/003-openbridge-design-system-adoption.md` |
| OpenBridge web components in use | Implemented (incremental) | `@oicl/openbridge-webcomponents(-react)` deps; `ObiAlertCategoryA` (rail risk chip), `ObcIconButton` + `ObiSearch` (ops top-bar search); `openbridge.css` imported in `client/src/main.tsx` |
| OpenBridge brilliance tokens active | Enforced | `data-obc-theme` mapping (§2) + `openbridge.css` import; contrast gate covers the result |
| Touch targets ≥44px | Enforced | `bridge-conditions.spec.ts` + `mobile-ops-rail.spec.ts` assert rail/header control bounding boxes ≥44px; bottom nav is `h-16` (64px) in `MobileReadinessShared.tsx` |

## 4. Responsive density & no-overflow (small-screen legibility)

| Claim | Status | Enforced by (artifact) |
|---|---|---|
| No horizontal overflow at 360–768px | Enforced | `tests/playwright/mobile-core-smoke.spec.ts` (`expectNoMobileOverflow`) and `mobile-readiness-visual-fidelity.spec.ts` (`expectNoHorizontalOverflow`, ≤1px per screen × viewport); `mobile-ops-rail.spec.ts` asserts ≤1px at 360px with the header control |
| Crew & Inventory dense grids reflow to cards (no truncation) | Implemented | `client/src/features/mobile-readiness/MobileReadinessAdminScreens.tsx` (`MobileCrewPage` / `MobileInventoryPage`) — vertical cards; overflow gated as above |

## 5. Offline-first / connectivity (VESSEL mode)

| Claim | Status | Enforced by (artifact) |
|---|---|---|
| Always-visible connectivity + pending-sync indication | Implemented | `ConnectivityBannerWithSync` mounted globally in `App.tsx` |
| Offline state surfaces on the rail | Enforced | `bridge-conditions.spec.ts` + `mobile-ops-rail.spec.ts` drop connectivity and assert an "Offline" indicator appears |

## 6. Not yet enforced (honest gaps — do not claim as compliant)

- **Touch-target size as a lint rule.** Sizes are asserted in e2e (above) and set in CSS, but there is no static lint that fails a sub-44px interactive element. (Rubric item 6 — pending.)
- **Full OpenBridge symbology migration.** Adoption is incremental (rail icon, top-bar search). Most icons are still `lucide-react`. (Rubric item 4 — in progress, Phase B/C.)
- **Pixel-diff visual regression.** The repo's Argos pipeline (`mobile-qa-visual-argos.yml`) runs the mobile viewport projects; committed pixel baselines are not used in this lane (cross-env fragile). Contrast + overflow + render are gated deterministically instead.
- **Light/daylight residual contrast.** 15 of the mobile contrast violations (light 9 / daylight 6) are light-palette design choices (e.g. `slate-500` small text); not yet ratcheted down. Night themes are near-clean (dark 2 / bridge 5).
- **Logs/Records & PdM telemetry density.** These still use dense grids (overflow-gated, not card-reflowed). (Rubric item 7 — partial.)
- **Confirm-on-destructive.** Not applicable on the mobile-readiness screens today: they are read-only (no destructive actions). Re-evaluate when mobile write actions are added.

## 7. How to re-verify

```
npm run check:guards          # anti-placeholder, dynamic-classnames, type-debt ratchets
npm run test:unit             # includes reduced-motion-css contract
# CORE Playwright lane (browser): bridge-conditions, mobile-ops-rail, axe-contrast
#   run via CI (ci.yml) or locally against a server on :5000
```

This appendix is an evidence map, not a certification. It states what is
currently enforced and what is not, so a Class society / fleet superintendent
review can audit each claim against the cited artifact.
