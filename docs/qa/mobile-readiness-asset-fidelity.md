# Mobile Readiness Asset Fidelity Ledger

This ledger tracks the source and approval state for assets used by the mobile readiness replacement UI. Raw generated proof stays outside git under `/private/tmp/arus-visual-comparison/<run-id>/`.

## Approval Rules

- `exported`: exported directly from the Figma/reference board.
- `recreated-approved`: recreated as an editable high-fidelity equivalent because the source board asset is flattened or locked.
- `fallback-approved`: approved only as a generic fallback for missing or stale asset ids.

Production-critical UI must not silently use the fallback asset. The fallback is reserved for unresolved ids and must remain visually obvious as a generic ARUS placeholder.

## Inventory

| Asset id | Kind | Registry status | Fidelity status | Source note |
|---|---|---|---|---|
| `vessel-atlas` | vessel thumbnail | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `vessel-borealis` | vessel thumbnail | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `vessel-corvus` | vessel thumbnail | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `avatar-alex` | crew avatar | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `avatar-michael` | crew avatar | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `avatar-sarah` | crew avatar | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `avatar-daniel` | crew avatar | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `work-compressor` | work photo | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `work-motor` | work photo | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `work-gauge` | work photo | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `diagram-side-elevation` | vessel diagram | recreated | recreated-approved | Editable visual-match rebuild from locked reference imagery |
| `telemetry-risk-chart` | chart | recreated | recreated-approved | Editable visual-match rebuild from reference chart composition |
| `icon-readiness-check` | icon | recreated | recreated-approved | Reference-specific icon recreated from vector primitives |
| `fallback-generic` | icon | fallback | fallback-approved | Generic ARUS fallback for stale or unavailable reference assets |

## Proof Artifacts

Run:

```bash
npx playwright test tests/playwright/mobile-readiness-visual-fidelity.spec.ts --project=chromium
```

The run writes:

```text
/private/tmp/arus-visual-comparison/<run-id>/mobile-readiness-asset-contact-sheet.png
```

Required registry checks:

```bash
npm run test:unit -- tests/unit/mobile-readiness-assets.test.ts
```

