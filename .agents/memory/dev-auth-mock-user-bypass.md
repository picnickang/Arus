---
name: Dev-mode auth mock-user bypass
description: In development, server auth middleware can inject a fixed mock admin and ignore real session tokens — silently breaks /api/me/* self-service flows.
---

`requireAuthentication` (server/security/authentication.ts) has a `NODE_ENV==='development'` fast-path that attaches a fixed mock `dev-admin-user` (admin@example.com). It must only fire when **no** real `Authorization: Bearer` token is present — otherwise any authenticated `/api/me/*` request from a real portal login is silently re-attributed to the dev admin.

**Why:** symptom was a regular user stuck on the forced change-password screen — `/api/me/change-password` ran as the dev admin, so `bcrypt.compare(theirCurrentPassword, devAdminHash)` failed → `INVALID_CURRENT_PASSWORD` → UI "Could not update password", and their `must_change_password` flag never cleared. The dev fast-path was clobbering `req.user` even though the client correctly sent a Bearer token. The rule: in dev, a presented session token must win over the mock fallback.

**How to apply:** when debugging "logged-in user acts like the wrong account / admin" or self-service (`/api/me/*`) failures **only in dev**, suspect this bypass first. A sibling bypass exists in `server/websocket.ts` (`NODE_ENV==='development' && !requireTenantAuth()` returns default-org/dev identity before token parsing) — same shape, affects WS upgrade auth, not yet token-aware. Verify any auth fix end-to-end against the running dev server with a throwaway user (login → change-password → re-login), because the dev fast-path means in-process unit checks won't exercise the real token path.
