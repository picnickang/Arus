---
name: lr35 source-scan UI tests
description: How the tests/unit/lr35-ui-align-* and nav-matrix specs pin UI screens, and what a screen redesign must update.
---

# lr35 source-scan UI tests

`tests/unit/lr35-ui-align-*.test.ts` run under Jest `testEnvironment: "node"` with swc/ESM — they CANNOT mount React. They assert UI contracts by **reading the page source file as a string** and matching exact `data-testid="..."`, `href="..."`, and endpoint-literal substrings (and `.not.toMatch` for forbidden patterns like `setInterval(`, `fetch(`, `PermissionGate`).

**Why:** the harness can't render, so the only enforcement is string presence in the `.tsx` source.

**How to apply:** when you redesign a screen (change testids/hrefs/endpoints), you MUST update its matching `lr35-ui-align-*` test in lockstep AND the Playwright smoke block in `tests/playwright/nav-matrix.spec.ts` (it clicks `data-testid`s on the admin/user home), or CI goes red. Some tests parse a sub-branch of a multi-branch file via a regex anchor in `beforeAll` (e.g. home.tsx admin branch anchored between `// Admin portal:` and a trailing testid) — if you remove the anchor element, every test in that suite fails at `beforeAll`, not just the relevant one.

**Known pre-existing reds (NOT caused by screen redesigns):** `lr35-bottom-nav-override-leak.test.ts` pins a `getPortalForRole`/`portal === "user"` render gate + a `portal-login` adapter contract the live `BottomNav.tsx` (uses `isAdminPortalAccess`/`hasAdminAccess`) never adopted — 3 failures. `lr35-ui-align-phase6-hubs.test.ts` Crew + Logistics "deep-link" tests are stale vs. the current crew-hub/logistics-hub. Don't try to "fix" these unless that hub is your task.
