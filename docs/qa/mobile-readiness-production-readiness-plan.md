# Mobile Readiness Production Readiness Plan

## Scope

This plan tracks the remaining hardening needed before the mobile readiness replacement UI can be treated as production-ready. It covers local runtime parity, role-aware navigation correctness, production-safe E2E traversal, and a visual pass against the Figma/reference-board captures.

## Implemented Gates

- Role-aware link audit: `tests/playwright/mobile-readiness-link-audit.spec.ts` verifies admin and regular-user visible route-bearing controls land on the expected pages.
- Visible control crawl: `tests/playwright/mobile-readiness-control-crawl.spec.ts` inventories route-bearing controls and documented state-only buttons for admin and regular-user personas.
- Replacement-route contract: `client/src/features/mobile-readiness/mobile-readiness-route-contract.ts` is shared by app routing and Playwright expectations.
- Local SQLite runtime blockers: local-mode telemetry rollup and access seeding are explicitly skipped where the underlying runtime tables are cloud-only.
- Local development login parity: the default development admin can be linked into the local SQLite crew roster without cloud-only crew columns.
- System settings SQLite parity: `system_settings` includes the encrypted OpenAI key column used by the runtime settings repository.
- Visual fidelity contract: `tests/playwright/mobile-readiness-visual-fidelity-contract.ts` maps every mobile readiness screen marker to a Figma/reference-board artifact.
- Visual capture gate: `tests/playwright/mobile-readiness-visual-fidelity.spec.ts` captures each board-aligned route at `360`, `375`, `390`, `414`, `430`, and `768px` widths, generates side-by-side comparison sheets, and writes evidence only under `/private/tmp/arus-visual-comparison`.
- Asset fidelity ledger: `docs/qa/mobile-readiness-asset-fidelity.md` tracks exported/recreated/fallback status and the generated asset contact sheet workflow.
- Production audit harness: `tests/playwright/journeys/production-full-write-audit.spec.ts` is gated by production URL, dedicated credentials, and `ARUS_PROD_E2E_ALLOW_WRITES=1`.

## Visual Pass Workflow

Run:

```bash
npx playwright test tests/playwright/mobile-readiness-visual-fidelity.spec.ts --project=chromium
```

The gate captures these groups:

- Today queues
- Fleet
- Vessel overview
- Vessel diagram
- PdM risk queue
- Asset case
- Telemetry advanced
- Work queue
- Technician execution
- Logs
- Crew
- Inventory
- Settings

Raw outputs stay outside git:

```text
/private/tmp/arus-visual-comparison/<run-id>/
  *-<viewport>.png
  *-<viewport>-comparison.png
  mobile-readiness-asset-contact-sheet.png
  visual-fidelity-report.json
  visual-fidelity-summary.md
```

The tracked contract requires every route to have:

- a replacement screen marker;
- an existing reference-board artifact;
- captures at `360`, `375`, `390`, `414`, `430`, and `768px` widths;
- a side-by-side comparison artifact for each capture;
- no legacy universal/admin shell leakage.

## Required Verification

Run before release signoff:

```bash
npm run check -- --pretty false
npm run check:tests -- --pretty false
npm run build
npx playwright test --project=chromium
PLAYWRIGHT_INCLUDE_QUARANTINE=1 npx playwright test tests/playwright/nav-matrix.spec.ts --project=chromium
```

For production traversal, use only a dedicated QA account and enable writes explicitly:

```bash
PLAYWRIGHT_BASE_URL=<prod> \
ARUS_PROD_E2E_USERNAME=<user> \
ARUS_PROD_E2E_PASSWORD=<pass> \
ARUS_PROD_E2E_ALLOW_WRITES=1 \
npx playwright test tests/playwright/journeys/production-full-write-audit.spec.ts --project=chromium
```

## Remaining Signoff Criteria

- Default Chromium Playwright suite passes.
- Production write audit passes against a dedicated QA tenant.
- Manual visual review compares `/private/tmp/arus-visual-comparison/<run-id>` comparison sheets against the cited reference artifacts and records any deltas.
- Admin and regular-user role boundaries remain green in the link audit.
- No horizontal overflow is observed at `360`, `375`, `390`, `414`, `430`, and `768px`.
- Any production-created QA records are cleaned up or listed by run prefix.

## Latest Local Verification

Run during the June 13, 2026 Singapore-time session. Generated artifact timestamps use UTC-style names from June 12, 2026.

Latest verification:

- `npm run check -- --pretty false` passed.
- `npm run check:tests -- --pretty false` passed.
- `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/mobile-readiness-assets.test.ts tests/unit/mobile-readiness-visual-fidelity-manifest.test.ts --runInBand` passed: 2 suites, 6 tests.
- `npx playwright test tests/playwright/mobile-readiness-control-crawl.spec.ts --project=chromium` passed: 5 tests.
- `npx playwright test tests/playwright/mobile-readiness-link-audit.spec.ts --project=chromium` passed: 9 tests.
- `npx playwright test tests/playwright/mobile-readiness-visual-fidelity.spec.ts --project=chromium` passed: 1 test, 78 captures.
- `ARUS_PROD_E2E_ALLOW_WRITES=1 npx playwright test tests/playwright/journeys/production-full-write-audit.spec.ts --project=chromium --list` passed: 1 discoverable production-gated test.
- `npx playwright test --project=chromium` passed: 49 tests.
- `npm run build` passed.
- `PLAYWRIGHT_INCLUDE_QUARANTINE=1 npx playwright test tests/playwright/nav-matrix.spec.ts --project=chromium` passed: 9 tests.

Latest visual capture report:

```text
/private/tmp/arus-visual-comparison/local-2026-06-12T19-55-19-173Z/visual-fidelity-report.json
```

That report contains 13 route groups, 78 viewport captures, 14 asset contact-sheet entries, and zero console/page errors.

Earlier verification retained for traceability:

- `npm run check -- --pretty false` passed.
- `npm run check:tests -- --pretty false` passed.
- Focused mobile readiness/local-mode Jest suite passed: 9 suites, 34 tests.
- `npx playwright test --project=chromium` passed: 44 tests.
- `PLAYWRIGHT_INCLUDE_QUARANTINE=1 npx playwright test tests/playwright/nav-matrix.spec.ts --project=chromium` passed: 9 tests.
- `npm run build` passed.

Latest visual capture report:

```text
/private/tmp/arus-visual-comparison/local-2026-06-12T18-35-49-064Z/visual-fidelity-report.json
```

That report contains 13 captured route groups at the original `390x844` size. The current gate now requires 78 captures across the full viewport matrix plus comparison sheets and an asset contact sheet. Raw screenshots remain outside git by design.
