# Playwright Journey Specs (LR-2)

Realistic end-to-end workflows that span more than one page or
require backend state. These differ from `tests/playwright/*.spec.ts`
(thin smoke / pure-UI specs) in two ways:

1. They cover **operational journeys** an actual user completes —
   not single-screen affordances.
2. Several require **seeded backend state** (a tenant, vessels, parts,
   work orders, a 3D model). Specs that need state they cannot
   provision themselves are explicitly marked `test.fixme()` with
   a comment naming the missing dependency. They are still
   list-discoverable by `npx playwright test --list` so CI shows
   the coverage gap rather than hiding it.

## Per-spec status

| Spec                      | Status            | Blocker (if any)                                                                                                                   |
| ------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `offline-outbox.spec.ts`  | Live — runs in CI | none                                                                                                                               |
| `pr-po-receive.spec.ts`   | `test.fixme`      | LR-3 procurement seed fixture                                                                                                      |
| `crew-compliance.spec.ts` | `test.fixme`      | LR-3 crew certs seed + STCW snapshot                                                                                               |
| `3d-viewer.spec.ts`       | `test.fixme`      | LR-3 GLB upload via admin seed (object-storage round-trip)                                                                         |
| `amos-import.spec.ts`     | `test.fixme`      | LR-3 UI smoke once admin import page is rebuilt; backend path is already covered by `tests/integration/import-amos-golden.test.ts` |

## Why `test.fixme` rather than `test.skip`

`test.skip()` would silently hide the gap. `test.fixme()` lights up
in the Playwright reporter as `expected to fail / currently fixme`,
making the coverage hole visible on every CI run. The LR-3 work that
provisions the missing fixtures will flip each `fixme` to a real
assertion in a single review.
