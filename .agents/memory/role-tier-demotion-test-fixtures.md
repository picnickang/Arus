---
name: Role-tier demotion vs always-on test fixtures
description: Demoting a role out of the super-admin tier breaks unit tests that hardcode it as always-on; update fixtures in lockstep.
---

When a role is removed from the super-admin tier (e.g. plain `admin` demoted so it
is grant-eligible but NOT always-on), several pure-resolver unit tests hardcode role
lists that assert the OLD always-on behavior and will fail:

- `tests/unit/role-hub-resolution.test.ts` — `resolveEffectiveHubAdmin([role("X")], false)`
- `tests/unit/hub-admin-grant-helpers.test.ts` — `isSuperAdminRole`, `resolveHubAdmin([...], false)`
- `tests/unit/hub-admin-nav-policy.test.ts` — `isAdminPortalAccess(role, false, true)` under "super-admin is always-on"

**Why:** the super-admin tier is `SUPER_ADMIN_ROLE_KEYS` = super_admin / system_admin /
company_admin (in `shared/role-dashboard.ts`). A demoted role becomes grant-eligible:
it is a hub admin ONLY with the stored `hubAdmin` flag or a per-user override, never
always-on. The tests embed the role name in literal arrays, so the demotion does not
reach them automatically.

**How to apply:** when changing tier membership, grep the test fixtures for the role
name and move it from the always-on group to a "needs stored flag/override" group
(false without flag, true with flag/override). These suites run in-sandbox (no DB) via
`npx jest tests/unit/<file>` — fast to verify. The broader `npm run test:unit` can
hang in the sandbox on DB-touching suites; run the specific files instead.
