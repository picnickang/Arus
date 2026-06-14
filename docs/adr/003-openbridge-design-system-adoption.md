# ADR 003 — OpenBridge Design System Adoption (maritime HMI)

**Status:** Accepted — GO, via incremental adoption with a documented fallback.
**Date:** 2026-06-14
**Relates to:** UI/UX remediation plan M2; `docs/compliance/Maritime-HMI-Compliance.md`.

## Context

The HMI compliance appendix claims "OpenBridge Design System alignment," but OpenBridge
(DNV's open maritime HMI system) was **never actually a dependency** — the UI is homegrown
Tailwind/shadcn + emoji icons. To make the IEC 62288 / OpenBridge claim real (standardized
symbology, brilliance palettes, bridge ergonomics), we evaluated adopting OpenBridge.

## Spike findings (validated 2026-06-14)

Installed and inspected locally (deps reverted from this gate commit — see Decision):

- **Packages exist + install** from the public registry: `@oicl/openbridge-webcomponents@1.0.1`
  (Lit web components) and `@oicl/openbridge-webcomponents-react@1.0.1` (React wrappers).
- **React 18 is supported.** The React wrapper is built on `@lit/react` (Lit's official React
  adapter) with peer `react: ^17 || ^18 || ^19` — matches our React 18.3.1. This is the standard,
  Vite-friendly interop for Lit components (no hand-rolled custom-element plumbing).
- **Design tokens** ship as a single import: `@oicl/openbridge-webcomponents/dist/openbridge.css`.
  It defines the OpenBridge token system, including `--global-size-spacing-touch-target-min: 48px`
  (OpenBridge mandates 48px touch targets — already stricter than our 44px floor).
- **Components are subpath imports** (no root barrel), e.g.
  `import { ObcTopBar } from "@oicl/openbridge-webcomponents-react/components/top-bar/top-bar.js"`
  (named `Obc*` exports). Icons live under `.../icons/icon-NN-*.js`. Components are browser-only
  (Lit references `customElements`/`HTMLElement` at module eval), so they render in the app/Vite,
  not in Node.

## Decision

**Adopt OpenBridge incrementally**, gated per phase, reusing the existing 4-theme token plumbing:

- **Phase A — tokens + icons:** import `openbridge.css`; map OpenBridge brilliance (day/dusk/night/
  bright) onto our themes (light / dark / **bridge**=night / **daylight**) from the single
  `theme-provider` source of truth; replace remaining emoji/ad-hoc icons with the OpenBridge icon set
  (redundant icon+text+color). This supersedes the M2.2 night-dimming remap over time (OB tokens
  replace the brand/slate palette, letting the remap be deleted).
- **Phase B — chrome:** migrate the top bar / navigation to `ObcTopBar` + OpenBridge navigation.
- **Phase C — surfaces:** alert/notification + card surfaces (OpenBridge alert management, aligned to
  IMO MSC.302(87) / IEC 62923), replacing the homegrown ops-card patterns.

Each phase is its own PR with visual review and runs through the existing gates (axe-contrast across
the 4 brilliances, the mobile-visual suite, bridge-conditions).

## Consequences & risks

- **Deps land with first usage, not here.** Committing the OB packages while unused would fail the
  `check:dead-code` (knip) guard, so this gate commits only the ADR; `@oicl/openbridge-webcomponents`
  + `-react` are added in the first Phase-A PR alongside the first real component/CSS import.
- **Build/render validation** of an OB component in our Vite toolchain is deferred to that first PR
  (build + screenshot). The `@lit/react` path is standard and Vite-supported, so risk is low.
- **Subpath-import friction:** no barrel — each component is a specific deep import; budget for that.
- **Bundle size:** OpenBridge is large; import per-component (tree-shaken) rather than wholesale.
- **CSS interaction:** `openbridge.css` is global; verify it doesn't fight the existing Tailwind base
  (scope or layer if needed).

## Fallback

If full component adoption proves visually disruptive or heavy, adopt **OpenBridge tokens + icon set
only** — keep our React/shadcn components but style them with OpenBridge tokens and use OB icons.
That still delivers IEC 62288 symbology + brilliance compliance at much lower churn.
