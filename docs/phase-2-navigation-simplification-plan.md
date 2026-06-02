# Phase 2 — Navigation Simplification Plan (Task #309)

> **Status:** Implemented (code-inspection verified). Runtime browser login is
> not possible in the sandbox (Playwright cannot launch a browser here, and
> integration tests crash under cloud-mode db-config), so this pass verifies
> gating logic and route wiring by reading the source and pins behaviour with
> unit tests.
> **Date:** 2026-06-02
> **Companion tests:** `tests/unit/persona-navigation.test.ts`,
> `tests/unit/lr35-ui-align-user-portal-home.test.ts`,
> `tests/unit/phase2-admin-no-hubs-fallback.test.ts`,
> `tests/playwright/portal-nav.spec.ts` (CI-only).

---

## 1. Goal

Collapse the authenticated surface into a simple, honest shape:

- **Public**: a single `/portal-login` split-landing with an Admin Login and a
  User Login card. No other public routes.
- **Admin portal**: exactly **five hubs** — Maintenance, System Admin, Crew
  Management, Logistics, AI Analytics — each gated by the account's hub
  allow-list (not by role name). Direct-URL access enforces the same matrix.
- **Normal-user area**: exactly **four items** — Dashboard, Assigned Tasks,
  Feedback / Flags, Profile. Normal users never see admin hubs, in the menu or
  by typing a hub URL.

No fake buttons, no fake data, no fake success toasts. No full redesign and no
backend rewrite.

## 2. How the attached UI images shaped the result

The reference images showed a crowded admin nav with many peer entries and a
user view that exposed admin-only tooling. The simplification keeps the
existing visual language (shadcn, mobile-first ops shell) but:

- folds the long admin nav into the five canonical hubs (the underlying
  `navigationCategories` are unchanged; the admin policy projects only the five
  primary ids with display-label overrides);
- strips the user portal down to the four items a crew member actually needs;
- removes the broken "Publish Update" control from the visible System Admin UI.

## 3. Current architecture (source of truth)

| Concern | File | Mechanism |
|---|---|---|
| Hub/route definitions | `client/src/config/navigationConfig.ts` | `navigationCategories`, `ROUTE_HUB_MAP` |
| Role → portal | `client/src/application/navigation/role-navigation-policy.ts` | `getPortalForRole` ("admin" vs "user") |
| Role → visible items | same file | `getPrimaryCategoriesForRole`, `getAdminPrimaryCategories`, `filterCategoriesByHubAccess` |
| Admin portal access | same file | `isAdminPortalAccess` (explicit `hubAdmin` grant, not role name) |
| Hub URL gating | `client/src/App.tsx` | `AdminPortalRouteGuard` wraps every hub route-group; non-admins redirect to `/` |
| Admin hub launcher | `client/src/components/BottomNav.tsx` | renders nothing without admin access (#218 render gate) |
| User portal shell | `client/src/pages/home.tsx` → `UserPortalHome` | sidebar built from `getPrimaryCategoriesForRole(role)` |

### Admin hub projection

`ADMIN_PRIMARY_CATEGORY_IDS = [maintenance, system, crew, logistics, analytics]`
with label overrides `system → "System Admin"`, `crew → "Crew Management"`,
`analytics → "AI Analytics"`. `filterCategoriesByHubAccess(cats, hubAccess)`:

- `hubAccess === null` → all five hubs (super-admin / dev / fully-granted).
- `hubAccess === ["maintenance"]` → only Maintenance, etc.
- `hubAccess === []` → no hubs (drives the no-hubs fallback, §6).

### User portal items

`USER_PRIMARY_CATEGORIES` (in policy order):

| id | label | route | backend |
|---|---|---|---|
| `user-dashboard` | Dashboard | `/` | `GET /api/me/dashboard` |
| `user-tasks` | Assigned Tasks | `/my-tasks` | `GET /api/me/tasks` |
| `user-feedback` | Feedback / Flags (sidebar: "Report / Flag Issue") | `/feedback` | feedback page (client-tracked) |
| `user-profile` | Profile | `/profile` | `POST /api/me/change-password`, `POST /api/me/logout` |

## 4. Per-route disposition

| Route | Disposition |
|---|---|
| `/portal-login` | Public — split landing (Admin / User). |
| `/` | Dashboard. Renders `UserPortalHome` for user roles, admin command center for admins. |
| `/my-tasks` | Normal-user accessible, **not** hub-gated. Read-only list of the caller's own tasks. |
| `/profile` | Normal-user accessible, **not** hub-gated. Identity + change-password + logout. |
| `/feedback` | Normal-user accessible, **not** hub-gated. |
| Maintenance hub routes (e.g. `/work-orders`) | Admin-hub-gated (`maintenance`). |
| System Admin hub routes | Admin-hub-gated (`system`); some sub-features Super-Admin-only. |
| Crew Management hub routes | Admin-hub-gated (`crew`). |
| Logistics hub routes | Admin-hub-gated (`logistics`). |
| AI Analytics hub routes | Admin-hub-gated (`analytics`). |
| Legacy paths | Redirected to canonical routes via `buildRedirectTarget` in `App.tsx`. |

The four non-gated routes (`/feedback`, `/my-tasks`, `/profile`, plus `/` and
`/portal-login`) are the only routes outside `AdminPortalRouteGuard`. Every hub
route-group is wrapped by the guard, so a normal user who types a hub URL is
redirected to `/` — the matrix is enforced by the router, not just the menu.

## 5. "Publish Update" — hidden, not faked

The System Admin "Publish Update" control had no working backend route. It is
removed from the visible UI (the `TabsTrigger` is gone) and its tab body is
replaced with an honest amber "Publishing unavailable" notice — no form, no
click handler, no success toast, no fake state. A code comment records that the
backend route is absent. See `docs/button-action-trust-verification.md`.

## 6. Admin no-hubs safe fallback

An admin-portal account whose hub allow-list is a populated-but-empty set
(granted admin access, zero hubs assigned) would otherwise see a blank command
center. `HomePage` now detects `pinnedGroups.length === 0 && otherGroups.length
=== 0` and renders an explicit fallback (`data-testid="shell-admin-no-hubs"`):
"No admin hubs assigned… Contact your Super Admin," with a Profile link and a
logout affordance. `hubAccess === null` (all hubs) never lands here. Pinned by
`tests/unit/phase2-admin-no-hubs-fallback.test.ts`.

## 7. Mobile density findings

- Admin hub launcher (`BottomNav`) is mobile-only (`md:hidden`) and shows only
  the granted hubs plus a policy-driven "More" sheet; it renders nothing for
  user-portal accounts, reclaiming the bottom strip.
- The user portal uses a compact sidebar (sheet on mobile via
  `button-mobile-menu` → `sheet-mobile-nav`) with just the four items.
- Secondary actions stay in detail pages / overflow; summary cards precede
  dense tables on the dashboard.

## 8. Known risks

- **Permission backfill**: orgs seeded before the permission-grant model need
  their admin roles re-granted the relevant hub permissions, or those admins
  may land on the no-hubs fallback. See `docs/permission-backfill-notes.md`.
- **Brittle source-scan tests**: some pre-existing `lr35-*` unit tests scan
  `home.tsx`/`BottomNav.tsx`/`portal-login.tsx` for string patterns that drifted
  during the #218 refactor; they fail independently of this task and are not
  re-scoped here.

## 9. Crew Management — Phase 3 TODO

Phase 2 only confirms Crew Management is a **single** hub entry with the roster
inside it and no duplicate roster nav entries. Deferred to Phase 3:

- role-based roster tables (group crew by role);
- crew alert log surfaced inside the hub (no fake alert data);
- reduced sub-tabs and consolidated row actions.

## 10. Deferred (out of scope for Phase 2)

- Dashboard simplification beyond the current card set.
- Backend cleanup of API-only domains (DP, Charter, Vetting, Offshore Ops,
  EFMS) — kept as authenticated, org-scoped API-only features.
- Optional user surfaces (Documents / Notices / My Certifications / My
  Schedule) — only added if/when those features are real.
