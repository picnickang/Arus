# Playwright Browser Lane

The default Playwright command is the deterministic browser release-smoke lane:

```bash
npx playwright test --project=chromium
```

It starts ARUS through `playwright.config.ts` with embedded SQLite/local mode,
test auth fixtures, a stable tenant fixture, service workers blocked, and
background/optional workers disabled. The default lane is intentionally limited
to:

- SPA shell and health checks
- core desktop browser flows
- core mobile operational smokes
- Vessel Intelligence registry workflow smokes

## Quarantined Browser Debt

The broader browser journey and navigation regression specs are still kept in
the repo, but they are not part of the default release gate because the current
embedded browser boot exposes historical fixture/schema drift rather than
deterministic release-smoke failures.

Run the quarantined suite explicitly with:

```bash
PLAYWRIGHT_INCLUDE_QUARANTINE=1 npx playwright test --project=chromium
```

Current quarantined paths:

- `tests/playwright/journeys/**`
- `tests/playwright/nav-matrix.spec.ts`
- `tests/playwright/persona-nav.spec.ts`
- `tests/playwright/portal-nav.spec.ts`

Observed failure categories from the pre-ratchet full run:

- Crew journey specs time out waiting for seeded crew subview fixtures.
- Equipment journey specs hit embedded SQLite schema drift in work-order and
  audit/error-log tables.
- Navigation/persona/portal specs assert older portal affordances and route
  contracts that no longer match the consolidated shell.

Do not delete these specs. Promote them back into the default lane only after
their fixtures and current product expectations are repaired.
