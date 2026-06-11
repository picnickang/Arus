# UI Assessment — Inefficiencies, Redundancies, Information Overload

> Assessed 2026-06-11 against `client/src` (~823 TS/TSX files, 94 page entries, 91 registered
> routes). Method: three parallel code audits (information architecture, redundancy, runtime
> efficiency) followed by manual verification of every headline claim. §8 tracks which
> recommendations have been remediated.

## 1. What is healthy (do not churn)

- **Code-splitting**: 87 of 94 pages are route-level `lazy()` imports; `vite.config.ts:37-87`
  splits vendor and feature chunks sensibly; three.js (`Vessel3DTwin`) is lazy-loaded.
- **React Query discipline**: global defaults are conservative (`client/src/lib/queryClient.ts`
  — 5 min staleTime, no default polling, no refetch-on-focus); most polling goes through the
  visibility-aware `pollingInterval()` helper (`client/src/lib/polling.ts`).
- **One library per concern**: date-fns only, recharts only, TanStack Query only, lucide only,
  shadcn primitives in `components/ui/` with no hand-rolled rivals.
- **Forms**: the big dialogs (`CrewFormDialog`, `ServiceOrderFormDialog`) use react-hook-form
  (uncontrolled), not per-keystroke `useState`.
- **WebSockets**: a single shared `useWebSocket` hook; no duplicated connections.
- **Not what they look like**: the paired `pages/<x>/` directory + `<x>.tsx` files
  (equipment-hub, engine-logbook, pdm-platform, rms-monitoring, home, feedback, portal-login)
  are *not* duplicates — the `.tsx` is the routed entry, the directory holds its tab
  subcomponents. No dead root-level components were found.

## 2. Finding: a half-finished route migration (structural redundancy)

Three generations of the records/navigation IA coexist:

1. `config/navigationConfig.ts` `routeMigrations` (~29 entries) already maps legacy paths
   (`/deck-logbook`, `/engine-logbook`, `/logs-compliance`, `/condition-monitoring-log`,
   `/governance-dashboard`, `/pdm-pack`, `/inventory-management`, …) to canonical
   `/logs?tab=*` / hub destinations, and feeds `routes/legacy-redirects.ts`.
2. In `App.tsx` the redirect routes render **before** `allRoutes` (wouter `Switch` is
   first-match), so duplicate live registrations left in `routes/records.ts` and friends are
   **shadowed dead config** — unreachable code that still suggests those pages are live.
3. `/logs` (`pages/logs-hub.tsx`, an `IconGridLayout`) is the canonical shell that loads the
   four thin `*-consolidated.tsx` tab wrappers — but `/logs/deck`, `/logs/engine`,
   `/logs/compliance`, `/logs/equipment` render the *bare* pages, a different UX for the
   "same" destination depending on which URL form you arrive by.

Consequences:

| Issue | Evidence |
|---|---|
| 91 routes vs ~40 nav items | `routes/*.ts` vs `navigationConfig.ts` |
| Shadowed dead registrations | `records.ts`: `/deck-logbook`, `/engine-logbook`, `/logs-compliance`, `/condition-monitoring-log` |
| Likely fully dead pages (only route shadowed) | `pages/pdm-pack.tsx` (815 ln), `pages/inventory-management.tsx` (817 ln) — verify imports before deleting |
| 4+ vessel entry points | `/fleet/:vesselId`, `/vessel-intelligence/:vesselId`, `/vessels/:id` (distinct VesselDashboard), `/equipment-schematic/:vesselId` |
| ~10 orphan routes (no nav entry) | `/operating-parameters`, `/storage-settings`, `/transport-settings`, `/admin/*` — typed-URL-only |

**Recommendation**: finish the migration — remove shadowed registrations, delete
verified-dead pages, land `/logs/<x>` on the consolidated shell, migrate redundant vessel
entry points into `routeMigrations`, and give every orphan a nav home or a redirect.

## 3. Finding: settings sprawl (information overload, worst IA offense)

Sixteen standalone settings/admin pages exist with no unified shell, ~10 of them absent from
navigation entirely (reachable only by typed URL): settings, notification-settings,
email-alerts-settings, email-templates, permissions-settings, storage-settings,
transport-settings, stormgeo-settings, scheduled-reports-settings, system-administration,
organization-management, admin/{tenants, 3d-models, equipment-dependencies,
telemetry-warehouse, access-diagnostic}.

`pages/system-administration.tsx` (869 lines) additionally nests 6 top-level tabs each with
inner sub-tab sets — 16 `TabsContent` panels two levels deep in one page. Note: this is an IA
problem only; Radix unmounts inactive tabs and the queries live in the child tab components,
so the raw audit's "all tabs hydrate on mount" claim was **wrong**.

**Recommendation**: a `/system/settings` shell (IconGridLayout, the `/logs` pattern) grouping
the pages into sections (General / Notifications & Email / Integrations / Access / Data &
Assets), reusing the existing pages as lazily-loaded section content; old URLs redirect via
`routeMigrations`. Flatten system-administration to URL-addressable sections.

## 4. Finding: fleet-hub data loading (worst runtime inefficiency)

`pages/fleet-hub.tsx` fires on mount: 5 full-collection queries (`/api/vessels`,
`/api/equipment`, `/api/work-orders`, `/api/alerts`, `/api/pdm/dashboard`) **plus** an N+1
`useQueries` loop — `GET /api/vessel-intelligence/:vesselId/summary` per vessel — because
`buildFleetTriageViewModel` needs every summary to choose the priority vessel. A 20-vessel
fleet costs 25 requests to paint one hub.

**Recommendation**: a batch `GET /api/vessel-intelligence/summaries` endpoint in the same
domain as the per-vessel route (org-scoped via `requireOrgId`, not in the public-paths
allowlist), replacing the client loop with one query. Keep the collection queries whose cache
is shared with other pages.

## 5. Finding: utility & component redundancy

| Redundancy | Count | Canonical / recommendation |
|---|---|---|
| Local `formatDate` definitions | 9 | re-point at `lib/formatters.ts` / `lib/time-utils.ts` (SGT), preserving each call site's output format |
| Local `formatCurrency` definitions | 6 | re-point at `lib/formatters.ts` |
| status/risk/severity→color maps (`riskColor`×3, `statusColor`×4, `severityColor`, per-table configs) | ~8 | extract a shared `lib/status-colors.ts` |
| `StatusBadge` implementations | 2 incompatible APIs (`components/shared/` 17 statuses, `components/ml-ai/utils/` 11) | share the color config now; merging the components is deliberately deferred |
| `PageHeader` implementations | 2 (`components/ml-ai/layouts/`, `components/navigation/`) | different jobs (breadcrumb header vs sticky app bar); merge not worth the churn |
| `useQuery → skeleton → error card` inline blocks | 98 | introduce a `QueryBoundary` wrapper opportunistically, **not** as a mass refactor |
| KPI-card variants (`KpiCard`, `MetricCard`, `OpsMetricCard`) | 3 | intentional domain variants; leave |

## 6. Finding: smaller runtime issues

- `components/crew-admin/SafetyTab.tsx:471` polls with a raw `refetchInterval: 20000`,
  bypassing the visibility-aware helper → use `pollingInterval(POLL_INTERVALS.STANDARD)`.
- Schedule grid rows (`GridRow`/`VesselRow` used by `SchedulePlanner`) are not memoized —
  every drag/filter state change re-renders the whole grid → `React.memo` + stable callbacks.
- `App.tsx` runs a 15 s pending-count interval even with nothing pending → gate on
  `pendingCount > 0`.
- `contexts/AdminAccessContext.tsx` ticks 1×/sec **only during an unlocked admin session**
  (the raw audit's "unconditional timer" claim was wrong — guarded at line 159). Remaining
  cost: context consumers re-render each second *while unlocked*; isolate countdown values
  from the main context value.
- **Virtualization** exists only in `VirtualizedWorkOrderTable` and
  `VirtualizedInventoryTable`. Large unvirtualized `.map()` renders remain in
  `MaintenanceTemplatesPage` (12+), `governance-dashboard` (6), `home` (8), `agent-activity`,
  `DiagnosticsDashboard`. Copy the `@tanstack/react-virtual` pattern when any of these lists
  exceeds ~100 rows in practice; don't virtualize pre-emptively.
- **Polling volume**: ~170 polled queries app-wide (37×30 s, 81×60 s, 23×120 s, 29×300 s).
  Individually defensible, collectively a server-load/battery consideration for the VESSEL
  (offline-first) deployment. When touching a polled view, prefer WebSocket-driven
  invalidation (the shared hook exists) over adding intervals.

## 7. Scorecard (pre-remediation)

| Dimension | Score | Notes |
|---|---|---|
| Route clarity | 4/10 | 91 routes / ~40 nav items, shadowed dead registrations, 2 dead pages |
| Hub & page density | 5/10 | fleet-hub N+1; nested-tab mega-pages; hubs otherwise reasonable |
| Settings UX | 2/10 | 16 scattered pages, most without nav |
| Runtime efficiency | 7/10 | strong foundations; localized hotspots |
| Component hygiene | 6/10 | no dead code; utility duplication |

## 8. Remediation status

Updated as work lands on this branch. Currently: **assessment only — no remediation yet.**
