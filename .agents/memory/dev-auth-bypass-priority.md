---
name: Dev auth bypass vs real login priority
description: How the no-login dev auto-admin must never override a real session, on both server and client.
---

# Dev auth bypass must never override a real login

A real authenticated session must always take priority over the development
auto-admin convenience. The dev bypass is a fallback that only applies when
**nobody** is actually logged in.

**Why:** the no-login dev identity grants blanket all-permissions. If it wins
over a real session (or lingers in cache after login), a real user briefly
inherits full admin access — the dashboard, role, and permissions all disagree
with who is actually signed in.

**How to apply:**
- Server and client share one kill switch: server reads `DEV_AUTH_BYPASS` (off
  when `=0`, only active in `NODE_ENV=development`); the client mirror is
  `VITE_DEV_AUTH_BYPASS`. Keep both in lockstep — disabling one without the
  other makes UI and server disagree.
- Server bypass/all-permission shortcuts must be gated on "no real user OR the
  dev-bypass identity", never unconditionally in dev.
- Never inject a placeholder/fake session token on the client; send the real
  token or none (the server applies its own no-login identity when none is sent).
- The cached `/api/permissions/me` (5-min staleTime) must be **reset** (not just
  invalidated) on any API-session-token change. Invalidate keeps the stale
  elevated payload visible during refetch; `resetQueries` drops it so access
  collapses to deny until the real permissions load.
- Do not treat a failed permissions request as "dev mode" (no fail-open) — that
  defeats the kill switch and any real login whose request happens to fail.

Note: the seeded dev bypass user (`dev-admin-user`) is mocked with role `admin`
in the auth layer but the DB row is `super_admin`, so the dev diagnostic's
`roleSessionVsDb` mismatch flag is expected to be true under the dev bypass.
