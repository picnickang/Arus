# Navigation Role → Hub Matrix (Phase 2, Task #309)

> **Status:** Code-inspection verified, pinned by
> `tests/unit/persona-navigation.test.ts`. Hub access is an explicit
> per-account grant (`hubAdmin` + `hubAccess`), **not** an automatic property of
> the role name. Direct-URL access enforces the same matrix via
> `AdminPortalRouteGuard` in `client/src/App.tsx`.
> **Date:** 2026-06-02

---

## 1. Portals

`getPortalForRole(role)` maps each role to one of two surfaces:

- **admin** — sees the five-hub command center (subject to hub allow-list).
- **user** — sees the four-item reduced surface.

Unknown / null roles default to the **safer user portal**.

## 2. The five admin hubs

| Hub id        | Display label   | Example routes                        |
| ------------- | --------------- | ------------------------------------- |
| `maintenance` | Maintenance     | `/work-orders`, schedule, PdM         |
| `system`      | System Admin    | system settings, roles, admin tooling |
| `crew`        | Crew Management | crew roster (single hub)              |
| `logistics`   | Logistics       | inventory, suppliers                  |
| `analytics`   | AI Analytics    | analytics hub, AI findings            |

## 3. The four user items

| Item id          | Label            | Route       | Hub-gated? |
| ---------------- | ---------------- | ----------- | ---------- |
| `user-dashboard` | Dashboard        | `/`         | No         |
| `user-tasks`     | Assigned Tasks   | `/my-tasks` | No         |
| `user-feedback`  | Feedback / Flags | `/feedback` | No         |
| `user-profile`   | Profile          | `/profile`  | No         |

## 4. Role → hub mapping (default intent)

`hubAccess` semantics: `null` = all hubs (unrestricted); a list = exactly those
hubs; `[]` = no hubs (→ no-hubs fallback page).

| Role                                                     | Portal        | Default hub access                                   |
| -------------------------------------------------------- | ------------- | ---------------------------------------------------- |
| Super Admin                                              | admin         | All hubs (`hubAccess = null`)                        |
| Admin                                                    | admin         | Only the hubs a Super Admin granted                  |
| Company Admin                                            | admin         | Company-level hubs (as granted)                      |
| Fleet Manager                                            | admin         | Maintenance / Logistics (if granted)                 |
| Chief Engineer                                           | admin         | Maintenance / Equipment Intelligence (if granted)    |
| Crew Manager                                             | admin         | Crew Management (if granted)                         |
| Viewer / Auditor                                         | admin or user | Read-only on permitted hubs, **no mutation actions** |
| Normal User (crew, deck officer, logistics user, viewer) | user          | **None** — four user items only                      |

> The role→portal mapping is verified by `persona-navigation.test.ts`
> ("portal assignment"); the per-hub filtering is verified by the same suite
> ("primary categories per persona" cases 1–11).

## 5. Direct-URL enforcement

Menus are derived from the same policy that gates routes, so hiding an item is
never the only defence:

- Every admin hub route-group in `App.tsx` is wrapped by
  `AdminPortalRouteGuard`, which redirects an account without admin access to
  `/`.
- `BottomNav` (the admin hub launcher) renders nothing without admin access.
- A stale/tampered nav override in `localStorage` cannot widen a persona's hubs
  — `intersectOverrideWithPolicy` drops any disallowed id before render
  (verified by `lr35-bottom-nav-override-leak.test.ts` and the override-tamper
  case in `persona-navigation.test.ts`).

## 6. Empty-hub admin

An admin with `hubAccess === []` (granted admin access, zero hubs) sees the
safe **no-hubs fallback** page (`shell-admin-no-hubs`) with a Profile link and
logout — never a blank shell. See
`docs/phase-2-navigation-simplification-plan.md` §6.
