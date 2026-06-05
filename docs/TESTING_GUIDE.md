# ARUS Testing Guide

This guide explains which test lane to use when changing ARUS and how the
current coverage baseline is enforced.

## Fast Local Checks

Run these before opening a PR:

```bash
npm run lint
npm run check
npm run test:unit
```

Use `npm run check:guards-full` before review when you touch schemas, route
registration, domain boundaries, bootstrapping, or type/hygiene debt.

## Test Lanes

- **Unit tests:** `npm run test:unit`
  - Use for pure domain logic, view-model derivers, policy helpers, and small
    service functions.
  - The default Jest environment is Node, so React DOM mounting is not available
    in this lane.
- **Integration tests:** `npm run test:integration`
  - Use for route behavior, repositories, service composition, audit contracts,
    and database-backed workflows.
  - CI provides PostgreSQL and runs migrations first.
- **Playwright tests:** `npx playwright test`
  - Use for browser-rendered contracts, navigation, interaction, and console
    error checks.
  - CI installs Chromium only to keep the job within budget.
- **Source-scan tests:**
  - Use sparingly when the fast Node test lane cannot mount a React surface but a
    stable source-level contract must be pinned.
  - Keep source-scan assertions focused on public test IDs, route decisions, or
    known architectural boundaries.

## Coverage Baseline

Use the summary command for the current Jest coverage baseline:

```bash
npm run test:coverage:summary
```

The enforced global threshold currently stays at the passing floor in
`jest.config.mjs`. Raise it only after verifying the new floor locally, and do
not lower it to hide a regression.

## Quality And Drift Checks

- `npm run check:dead-code` runs `knip` against the explicit dynamic-entry map.
  It currently enforces the measured floor of 4,053 Knip issues, so CI blocks
  regressions without treating the existing dynamic-loader false positives as
  safe cleanup targets.
- `npm run check:duplication` runs `jscpd` with `.jscpd.json`. Current output is
  667 clones and 2.31% duplicated lines against a 0% threshold, so this check is
  documented and available but not yet part of `check:guards-full`.
- `npm run check:boot-health` confirms dynamically imported route modules still
  register cleanly.
- `npm run check:schema` verifies Postgres/SQLite schema parity.

When a check uses a baseline file, regenerate the baseline only after the metric
has improved or a reviewer has approved an intentional exception.
