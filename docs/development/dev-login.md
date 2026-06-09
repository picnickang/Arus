# Temporary Dev Login

This is removable development tooling for previewing ARUS admin and user portal
states without repeatedly signing in with seeded accounts.

## Enablement

- Production always disables dev login.
- `ARUS_DEV_LOGIN=0` disables it in every non-production mode.
- `NODE_ENV=test` requires `ARUS_DEV_LOGIN=1`.
- Local development enables it by default unless `ARUS_DEV_LOGIN=0` is set.
- Browser controls are also hidden when `VITE_ARUS_DEV_LOGIN=0` or the build is
  production.

## Available Personas

- `Dev Admin Login` calls `POST /api/portal/dev-login` with
  `{ "persona": "admin" }` and creates an in-memory synthetic superuser session.
- `Dev User Login` starts a regular user-preview session with
  `deck_officer`.
- Dev user sessions can switch between:
  `deck_officer`, `crew_member`, `technician`, `logistics_user`,
  `procurement_user`, `safety_officer`, `maintenance_planner`, and `viewer`.

Dev user preview sessions are not admin sessions. `/api/permissions/me` returns
`hubAdmin: false`, `isDevMode: false`, no admin hub grants, and the selected
regular role only.

## Deletion Checklist

Remove all of these pieces when development preview access is no longer needed:

- `server/security/dev-login/`
- `client/src/features/dev-login/`
- `shared/dev-login.ts`
- `client/src/application/navigation/role-hint.ts` if it is no longer used
  outside the dev-login cleanup.
- `POST /api/portal/dev-login` in `server/domains/me-portal/routes.ts`
- `/portal/dev-login` in `server/bootstrap/public-api-paths.ts`
- dev-login handling in `server/security/authentication.ts`
- dev-login branches in `server/domains/permissions/routes.ts`
- dev-login imports and buttons in `client/src/pages/portal-login.tsx`
- `DevUserRoleTabs` usage in `client/src/pages/home.tsx`
- dev-login tests under `tests/unit/`
- this document

Keep the real seeded `admin/admin` development account unless the credential
login and Crew Access/Login workflows are also being retired.
