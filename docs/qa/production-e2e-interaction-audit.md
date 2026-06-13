# Production E2E Interaction Audit

This report tracks the production-safe interaction audit for the mobile readiness UI and related operational workflows.

## Harness

Spec:

```text
tests/playwright/journeys/production-full-write-audit.spec.ts
```

Required environment:

```bash
PLAYWRIGHT_BASE_URL=<prod> \
ARUS_PROD_E2E_USERNAME=<dedicated-qa-user> \
ARUS_PROD_E2E_PASSWORD=<dedicated-qa-password> \
ARUS_PROD_E2E_ALLOW_WRITES=1 \
npx playwright test tests/playwright/journeys/production-full-write-audit.spec.ts --project=chromium
```

Optional:

```bash
ARUS_PROD_E2E_PORTAL=admin
ARUS_PROD_E2E_RUN_PREFIX=ARUS-E2E-YYYYMMDD-shortid
```

## Evidence Policy

Raw evidence is intentionally excluded from git:

```text
/private/tmp/arus-production-e2e-audit/<run-prefix>/
  production-full-write-audit-report.json
  production-full-write-audit-report.md
  *.png
  traces and failure artifacts
```

Only this tracked report should be updated with concise production findings, reproduction steps, cleanup status, and file ownership notes.

## Current Status

Status: `pending-live-credentials`

The harness is implemented and discoverable. A live run is intentionally blocked until a dedicated production QA account, production base URL, and `ARUS_PROD_E2E_ALLOW_WRITES=1` are supplied.

## Pathways Covered By Harness

| Area | Coverage |
|---|---|
| Login | Admin or user portal login with dedicated production credentials |
| Navigation inventory | Visible route-bearing links and route-target controls on audited routes |
| Navigation traversal | Click each collected control, wait for route settlement, reject 404/blank/stuck-loading states |
| Runtime monitoring | Console errors, page errors, failed requests, and 4xx/5xx responses |
| Write path | Work-order create flow when a visible create control is available for the QA account |
| Persistence | Created audit-owned work order must be visible after reload/search route return |
| Cleanup tracking | Any records with the run prefix must be deleted/archived where product controls allow or listed here |

## Latest Run

No live production run has been executed in this repo state.

## Cleanup Ledger

| Run prefix | Created records | Cleanup status | Notes |
|---|---:|---|---|
| Pending | 0 | Not started | Awaiting production credentials and explicit write opt-in |

## Repo File Ledger

| File | Purpose |
|---|---|
| `tests/playwright/journeys/production-full-write-audit.spec.ts` | Production-gated traversal and write-path harness |
| `docs/qa/production-e2e-interaction-audit.md` | Durable production audit summary and cleanup ledger |

