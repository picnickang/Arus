---
name: Navigation routing traps
description: Why hub-tab URLs are dead clicks and how routeMigrations can shadow real page routes in the wouter Switch.
---

# Navigation routing traps (ARUS client)

## The hubs do not read `?tab=`
`/maint`, `/crew`, `/system` are plain landing pages (see `client/src/routes/*.ts`). A link like `/maint?tab=work-orders` just re-renders the hub overview — a dead click. Always link to the real registered route instead (`/work-orders`, `/crew-management`, `/system-administration`, `/equipment-intelligence`, etc.). Other hubs (`/logistics`, `/fleet`, `/logs`) and self-tabbing pages (`/notifications`, `/sensors`, `/inventory-management`) DO read their own tab param and are fine.

## routeMigrations can shadow real pages
`navigationConfig.ts` exports `routeMigrations`; `client/src/routes/legacy-redirects.ts` turns it into `legacyRedirects`, and `App.tsx` renders `legacyRedirects` in the `<Switch>` BEFORE the real page routes. If a `routeMigrations` entry maps a canonical route to a hub (e.g. `"/work-orders": "/maint?tab=work-orders"`), the redirect wins and the real page becomes unreachable.

**Why:** wouter matches first-wins on pathname; a redirect registered before the page route hijacks it. This caused Task #236's dead clicks — `/work-orders` rendered the Maintenance Hub overview, not the WorkOrders page.

**How to apply:** A `routeMigrations`/`legacyRedirects` `from` key must NEVER equal a path that also has a real registered route. Redirect sources are only for retired aliases with no real page (e.g. `/dashboard`, `/alerts`, `/inventory-management`→`/logistics?tab=inventory`).

## Dynamic URL writes are an easy miss
A static grep for `/maint?tab=` will NOT catch dynamically-built bad URLs like ``history.replaceState({}, "", `/maint?${qs}`)`` (the `useWorkOrderFilterData` filter-sync did this and rewrote users off `/work-orders`). The regression guard `tests/unit/navigation-canonical.test.ts` bans the literal prefix `"/maint?"` / `` `/maint? `` in any string or template literal under `client/src`, which covers both link attributes and `replaceState`/`pushState` constructions.
