---
name: Playwright e2e can't launch a browser in the Replit sandbox
description: Why Playwright specs fail to run locally here, and how to verify them anyway.
---

# Playwright browser launch fails in-sandbox

Running any Playwright spec here fails at browser launch with:
`chrome-headless-shell: error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file`.
The chromium headless shell needs OS shared libs that aren't present in the sandbox. This is environment, not test-authoring.

**Why:** the sandbox image lacks the GTK/glib system libraries the bundled chromium depends on; CI installs chromium properly (see `playwright.config.ts` + CI `e2e-smoke` job).

**How to apply:** author the spec correctly (model new route-mocked journeys on `tests/playwright/journeys/offline-outbox.spec.ts` — `page.route` + `fulfill`, no DB seed; admin-gated pages use `/portal-login` → `button-card-portal-admin`), confirm `npx tsc --noEmit` is clean, then let CI run it. Don't chase the libglib error or try to apt-install browser deps. Run attempt: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test <spec> --project=chromium` (reuses the already-running app on :5000).
