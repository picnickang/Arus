# ARUS UI Consolidation Audit & Refactoring Plan

Audit date: 2026-06-10. Scope: `client/src` (482 `.tsx` files, 169 page files, 98 routed
surfaces). Every finding below cites `file:line` evidence from this commit; counts come from
reproducible greps (patterns included where non-obvious).

---

## 0. Executive summary

The client is **not** a typical AI-sprawl codebase: design tokens are disciplined (no
hardcoded palette utilities; raw hex is confined to chart/map/3D fills — see the scorecard
correction below), routes are lazy-split with sensible vendor chunking, and a
consolidation effort (hubs, `legacy-redirects`, `embedded` props) is already half-done. The
problems are concentrated in **the unfinished half of that consolidation**:

| #   | Finding                                                                                                                                                              | Severity | Evidence                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| 1   | **9 route registrations are permanently shadowed** by redirects registered earlier in the same `<Switch>` — dead code that _looks_ live                              | High     | `App.tsx:365-398` vs `routes/records.ts:22-27`, `routes/logistics.ts`, `routes/analytics.ts` |
| 2   | **Three URL grammars for the same logbook content** (`/logs/deck`, `/deck-logbook`, `/logs?tab=deck`) render **two different presentations** depending on entry path | High     | `navigationConfig.ts:357-368` vs `navigationConfig.ts:518-523` vs `routes/records.ts`        |
| 3   | **6 settings pages exist twice**: as standalone routes _and_ as `embedded` tabs inside `configuration-hub`                                                           | High     | `pages/configuration-hub.tsx:43-83` vs `routes/system.ts:41-47`                              |
| 4   | **`PermissionsContext` value is rebuilt every provider render** (9 fresh function identities) → all 38 consumers re-render                                           | High     | `contexts/PermissionsContext.tsx:158-168`                                                    |
| 5   | **`AdminAccessContext` ticks a 1 s interval into an unmemoized context value** → 14 consumers re-render every second while admin is unlocked                         | High     | `contexts/AdminAccessContext.tsx:193,226-235`                                                |
| 6   | **`IconGridLayout` re-creates `lazy()` per tab selection** → revisiting a tab remounts content, refetches, flashes the loader                                        | High     | `components/layouts/IconGridLayout.tsx:111-132`                                              |
| 7   | Header/stat-card/severity-color logic is re-implemented per page: 97 hand-rolled headers in 33 files, 10 `getSeverityColor` implementations, 5+ stat-card variants   | Medium   | §3, §5                                                                                       |
| 8   | 10 god-files (817–1,766 lines), 129 `key={index}` sites, only 10 `React.memo` uses app-wide                                                                          | Medium   | §6                                                                                           |
| 9   | Confirmed dead code: 2 hooks, 1 orphan CSS file, 2 duplicated theme blocks, 2 deprecated stub pages, 1 unused layout helper                                          | Low      | §5                                                                                           |

Target outcome of this plan: **98 routed surfaces → ~72**, one URL grammar per destination,
one shell + one header contract, and the three verified re-render bugs fixed (items 4–6 are
each < 1 hour of work).

---

## 1. Pillar 1 — Content & component inventory

### 1.1 Page inventory (current state)

Routes are already centralized in `client/src/routes/*.ts` + `App.tsx` — that is the
machine-readable page inventory. Counts as of this audit:

| Route group | File                                                         | Routes             | Notes                                                                             |
| ----------- | ------------------------------------------------------------ | ------------------ | --------------------------------------------------------------------------------- |
| App-level   | `App.tsx:356-363`                                            | 7                  | `/`, `/portal-login`, `/feedback`, `/my-tasks`, `/profile`, `/desktop-setup`, 404 |
| Operations  | `routes/operations.ts`                                       | 6                  | hub + findings/briefing/attention/outbox/bulletins                                |
| Fleet       | `routes/fleet.ts`                                            | 11 (+ VI registry) | **two vessel-detail implementations** (see §2.3)                                  |
| Maintenance | `routes/maintenance.ts`                                      | 8                  | **two equipment-detail implementations** (see §2.3)                               |
| Crew        | `routes/crew.ts`                                             | 4                  | `/crew-scheduler` vs `/schedule-planner` overlap (§2.3)                           |
| Logistics   | `routes/logistics.ts`                                        | 7                  | 2 registrations shadowed by redirects                                             |
| Records     | `routes/records.ts`                                          | 16                 | **worst area: 6 shadowed + 4 duplicate-grammar + 4 orphan-grammar routes**        |
| Analytics   | `routes/analytics.ts`                                        | 15                 | 1 shadowed registration                                                           |
| System      | `routes/system.ts`                                           | 24                 | 6 routes duplicate configuration-hub tabs                                         |
| Redirects   | `routes/legacy-redirects.ts` + `navigationConfig.ts:497-529` | 34                 | two registries merged at runtime                                                  |

Positive findings worth protecting:

- **No orphan page files.** All 169 page files are reachable via routes, `App.tsx`, or
  intra-page imports (e.g. `findings-cards.tsx` is `findings.tsx`'s component library, not a
  dead page).
- **The `page.tsx` + `page/` directory pairs are healthy**, not duplicates: in all five cases
  (`home`, `pdm-platform`, `portal-login`, `rms-monitoring`, `equipment-hub`) the file is the
  routed orchestrator and the directory holds its tabs/sub-components.
- Naming drift only: 4 PascalCase pages (`AIStudioPage.tsx`, `DiagnosticsDashboard.tsx`,
  `MaintenanceTemplatesPage.tsx`, `OperatingParametersPage.tsx`) are routed and live —
  rename for consistency, nothing more.

### 1.2 Page Inventory framework (keep it current mechanically)

Do **not** maintain a hand-written page list — generate it. `navigationCategories`
(`config/navigationConfig.ts:155`) is already declared the single source of truth; extend that
guarantee with a script:

```
scripts/generate-site-map.mjs
  reads:  client/src/routes/*.ts (route → component file)
          client/src/config/navigationConfig.ts (hub → children → labels/descriptions)
          routeMigrations + legacy-redirects (deprecated URLs)
  emits:  docs/site-map.md          (table: URL · page file · hub · purpose · status)
          docs/site-map.mmd         (Mermaid tree for visual tools)
  fails CI when: a route has no hub, a redirect target 404s, or a page file is unrouted.
```

The "purpose" column comes free from the `description` fields already present on every nav
item. Status ∈ {canonical, redirect, shadowed, orphan} — the shadow check alone would have
caught finding #1.

### 1.3 Component audit process

Repeatable three-pass process (this audit followed it; re-run quarterly or per release):

1. **Static census** — for each suspected-duplicate family, grep the canonical component's
   import count vs the hand-rolled pattern count. The families that matter here, with current
   scores (canonical adoption / hand-rolled sites):
   - Page header: `PageHeader` 17 pages / 97 `text-2xl|3xl font-bold` headers in 33 page files
   - Hub layout: `IconGridLayout` 2 hubs, `TabbedPageLayout` 1 hub / 9 hubs hand-rolled
   - Stat tile: `shared/MetricCard`, `ml-ai/data-display/KpiCard`, `ops/OpsMetricCard` /
     local `StatTile` (`maintenance-hub.tsx:63`), inline card-divs in `fuel-emissions-log.tsx:191-215`,
     `condition-monitoring-log.tsx:153-190`, `ai-sensor-audits.tsx:168-203`,
     `certificate-registry/SummaryCards.tsx:21`
   - Severity/status colors: 10 implementations (§5.3)
   - Dialogs: `ResponsiveDialog` 8 files / 12+ raw `ui/dialog` CRUD dialogs
2. **Visual diff** — screenshot each hub and each list page (the `run`/`verify` skill or
   Playwright), tile them on one board, and circle visually-identical-but-different-code
   regions. The 9 hand-rolled hubs all repeat `IconGridLayout`'s exact visual idiom
   (`rounded-2xl` icon tile, `hover:scale-105`, label-under-icon) with re-implemented markup.
3. **Decide & record** — each family gets one verdict in this doc: _canonical component,
   migration list, deletion list_. Anything not migrated gets a tracking entry in the Master
   Checklist (§9).

### 1.4 Mapping tools

- **Site tree**: generate Mermaid from the script in §1.2; paste into FigJam/Miro only for
  _target-state_ IA workshops (current state should never be hand-drawn — it drifts).
- **Component library**: the de-facto library is `components/ui` (31 shadcn primitives, all
  used, 1,517 imports) + `components/shared` + `components/layouts`. Stand up Storybook (or a
  single `/dev/components` route in dev builds) listing ONLY blessed components:
  `PageHeader`, `IconGridLayout`, `TabbedPageLayout`, `MetricCard`, `KpiCard`,
  `ResponsiveDialog`, `PermissionGate`, `StatusPill`. The point is discoverability — every
  hand-rolled header below exists because the author didn't find the canonical one.
- **Figma**: if a Figma library is introduced, wire Code Connect mappings for those 8 blessed
  components first; do not attempt to mirror all 482 files.

---

## 2. Pillar 2 — User flow & navigation analysis

### 2.1 The route-shadowing defect (fix first — it's free)

`App.tsx` mounts redirects **before** live routes in the same wouter `<Switch>`
(`App.tsx:365-369` before `App.tsx:371-398`; wouter renders the first match). Every path that
appears in both `routeMigrations` (`navigationConfig.ts:497-529`) and a route group is
therefore a **dead registration** — the component can never render at that path:

| Shadowed registration       | File                   | Redirects to               |
| --------------------------- | ---------------------- | -------------------------- |
| `/deck-logbook`             | `routes/records.ts:22` | `/logs?tab=deck`           |
| `/engine-logbook`           | `routes/records.ts:23` | `/logs?tab=engine`         |
| `/logs-compliance`          | `routes/records.ts:24` | `/logs?tab=compliance`     |
| `/fuel-emissions-log`       | `routes/records.ts:25` | `/logs?tab=engine`         |
| `/vessel-track-log`         | `routes/records.ts:26` | `/logs?tab=deck`           |
| `/condition-monitoring-log` | `routes/records.ts:27` | `/logs?tab=equipment`      |
| `/inventory-management`     | `routes/logistics.ts`  | `/logistics?tab=inventory` |
| `/vendors`                  | `routes/logistics.ts`  | `/logistics?tab=vendors`   |
| `/governance-dashboard`     | `routes/analytics.ts`  | `/logs?tab=compliance`     |

Action: delete the 9 registrations (and their lazy imports where now unused). Behavior is
unchanged — that's the proof they're dead. Then add a unit test that asserts
`allRoutes ∩ legacyRedirects = ∅` so the class of bug can't return (see §10).

### 2.2 Duplicate intent #1: the Records area has three URL grammars

For "open the deck log", today:

| Entry path                                 | What renders                                                                           | Source                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Nav → Records → "Deck Log" (`/logs/deck`)  | `DeckLogbook` standalone — **no** hub chrome, **no** Vessel Track sibling tab          | `navigationConfig.ts:357-361`, `routes/records.ts:19` |
| `/logs` hub → Deck icon (`/logs?tab=deck`) | `IconGridLayout` chrome → `deck-log-consolidated` → inner tabs **Deck + Vessel Track** | `pages/logs-hub.tsx:14-22`                            |
| Old bookmark `/deck-logbook`               | redirect → `/logs?tab=deck` (the second presentation)                                  | `navigationConfig.ts:518`                             |
| Direct `/deck-log-consolidated`            | the consolidated page **without** hub chrome                                           | `routes/records.ts:30`                                |

Same intent, two presentations, four URLs — and the **global nav uses the one that bypasses
the consolidation**, so nav users never see the Vessel Track tab placement that bookmark
users get. The identical fork exists for engine, equipment, and compliance logs. This is the
single most user-visible inconsistency in the app.

**Consolidation decision (recommended): query-grammar wins.** `IconGridLayout` already reads
`?tab=` (`IconGridLayout.tsx:147-165`) and all 30 migrations already target it. Concretely:

1. Point the four Records nav children at `/logs?tab=<id>` (`navigationConfig.ts:350-376`).
2. Delete routes `/logs/compliance|deck|engine|equipment` and the four standalone
   `/*-consolidated` routes; add all eight to `routeMigrations` → `/logs?tab=<id>`.
3. Fix the three in-app links to `/compliance-consolidated`
   (`UnifiedCrewManagement/index.tsx:147`, `CrewRegistryLanding.tsx:347,445`).
4. Records group: 16 routes → 2 (`/logs`, `/rms-monitoring`).

### 2.3 Duplicate intent #2-5 (consolidate via feature-parity audit, §4)

| Intent           | Surface A                                                                                    | Surface B                                                                                                          | Verdict                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vessel detail    | `/fleet/:vesselId` → `VesselIntelligence` (canonical, registry-driven)                       | `/vessels/:id` → `VesselDashboard` + `/vessels/:id/3d`                                                             | Parity-audit `VesselDashboard`; fold unique widgets into VI tabs; redirect                                                                                                                                    |
| Equipment detail | `/equipment/:equipmentId` → `equipment-hub` (Overview/Work/Diagnostics/History/Context tabs) | `/pdm/equipment/:equipmentId` → `pdm-equipment-detail.tsx`                                                         | Merge PdM detail into equipment-hub's Diagnostics tab; redirect                                                                                                                                               |
| Crew scheduling  | `/crew-scheduler` (nav-labelled **"Schedule Planner"**, `navigationConfig.ts:291-295`)       | `/schedule-planner` → `schedule-planner.tsx` (not in nav)                                                          | Naming collision + hidden page. Pick one owner; redirect the other                                                                                                                                            |
| Sensor tools     | `/sensors` hub tabs                                                                          | `sensor-optimization.tsx` / `sensor-management.tsx` = "this moved" stub pages; `/sensor-templates` ALSO standalone | Delete the two stubs (point hub tabs at real destinations), keep one templates surface                                                                                                                        |
| Org gating seam  | `/equipment` list lives in **fleet** hub group                                               | `/equipment/:equipmentId` detail lives in **maintenance** group (`routes/maintenance.ts`)                          | A user whose hub allow-list has fleet-but-not-maintenance can browse the registry but every detail link bounces to `/` (`App.tsx:234-247`). Move the detail route into the fleet group or classify it via nav |

### 2.4 Click-tracking strategy (measure before/after)

Infrastructure already exists — extend rather than adopt a vendor:

- `lib/pageTracking.ts` keeps the last 8 paths; `legacy-redirects.ts:39-58` already counts
  redirect hits per `from` path (`getRedirectUsageStats`).
- **Step 1 — path-chain capture**: extend `trackPageVisit` to push `{path, ts, navSource}`
  into a ~200-entry ring buffer. Get `navSource` for free by adding
  `data-nav-source="shell|bottomnav|hubgrid|inline"` on the four navigation surfaces and
  reading it in a single delegated click listener.
- **Step 2 — define core tasks & budgets** (clicks from `/`): acknowledge an attention item
  (≤2), open a work order (≤3), log a deck entry (≤3), reach equipment detail from scan (≤2),
  approve a purchase request (≤3). Compute actual click depth from the ring buffer by
  finding the shortest recorded chains ending at the task URL.
- **Step 3 — surface it**: render both datasets in `DiagnosticsDashboard` (admin-only).
  CLOUD mode may later POST the buffer to a `ux-telemetry` endpoint; VESSEL mode stays
  local-only — consistent with the offline-first posture.
- **Step 4 — redirect retirement**: any `routeMigrations` entry with 0 hits across a release
  cycle (per `getRedirectUsageStats`) gets deleted. Today the list only grows — `legacy-redirects.ts:6`
  even says "Do NOT add new entries" while §2.2 requires adding eight; the usage stats are
  the mechanism that makes additions safe to later remove.

---

## 3. Pillar 3 — Headers & global elements

### 3.1 What exists (and is good)

The app already has exactly the right global skeleton — the issue is partial adoption:

- `UniversalOpsShell` (`components/ops/UniversalOpsShell.tsx`) wraps every hub route
  (`App.tsx:382-385`), uses the children-as-props pattern correctly (shell state changes
  don't re-render the page), and derives nav from `navigationCategories`.
- `BottomNav` + `CopilotFab` mount only on non-shell routes (`App.tsx:410-411`).
- `CommandPaletteMount` is lazy and admin-gated (`App.tsx:345`).
- `PageHeader` (`components/navigation/PageHeader.tsx`) is a complete sticky header:
  back/home, title/subtitle, `action` slot, `SuggestionBell`, `ThemeToggle`.

### 3.2 The adoption gap

- 17 pages import `PageHeader`; **33 page files hand-roll 97 headers** with
  `text-2xl|3xl font-bold` (e.g. `pdm-equipment-detail.tsx:106`,
  `admin/telemetry-warehouse.tsx:170` — which even reimplements `data-testid="text-page-title"`,
  `fuel-emissions-log.tsx:328,336,344`, `AIStudioPage.tsx:354,377`).
- `NavigationCard` + `NavigationGroup` (`components/navigation/`) are **dead** — imported
  only by each other. Either they become the blessed hub-card pair or they get deleted;
  currently 9 hubs hand-roll what these were built for.
- **Double-chrome defect**: `IconGridLayout` renders its own sticky header + breadcrumb
  (`IconGridLayout.tsx:182-254`) _inside_ `UniversalOpsShell`, and embedded pages may render
  their own `PageHeader` again unless they honor `embedded` — three stacked headers is
  reachable in the Records flow today.

### 3.3 Blueprint: one global layout contract

Rule: **pages own content; layouts own chrome.** Enforceable form:

```
UniversalOpsShell                  ← owns: nav rail, search trigger, profile, org context
  └─ AppPage (new, thin)           ← owns: PageHeader (title/subtitle/actions), max-width, padding
       └─ page content             ← owns: nothing global; no <h1>, no sticky divs
```

```tsx
// client/src/components/layouts/AppPage.tsx
import type { ReactNode } from "react";
import { PageHeader } from "@/components/navigation/PageHeader";
import { cn } from "@/lib/utils";

interface AppPageProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode; // maps to PageHeader's `action` slot
  /** Suppress chrome when rendered inside a hub tab (replaces ad-hoc `embedded` props). */
  embedded?: boolean;
  width?: "full" | "7xl" | "5xl";
  children: ReactNode;
}

export function AppPage({
  title,
  subtitle,
  actions,
  embedded,
  width = "7xl",
  children,
}: AppPageProps) {
  if (embedded) return <div className="p-4 md:p-6">{children}</div>;
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={title} subtitle={subtitle} action={actions} />
      <main
        className={cn(
          "mx-auto px-4 py-6 md:px-6",
          width === "7xl" && "max-w-7xl",
          width === "5xl" && "max-w-5xl"
        )}
      >
        {children}
      </main>
    </div>
  );
}
```

Migration is mechanical per page: delete the hand-rolled `<div className="text-2xl font-bold">`
block, wrap the page in `AppPage`, move its buttons into `actions`. The existing per-page
`embedded?: boolean` props (`configuration-hub.tsx:30`, `OperatingParametersPage`, etc.)
collapse into this one prop. Start with the 10 worst offenders listed in §1.3, then ratchet:
a guard script counts `text-(2|3)xl font-bold` in `pages/` and only allows the number to go
down (matches the repo's existing burn-down culture in `scripts/*-baseline.json`).

---

## 4. Pillar 4 — Page consolidation strategy

### 4.1 Workflow (per merge, ~½ day each)

1. **Pick the primary** — the surface with the canonical URL, better data layer, and shell
   integration (usually the hub/tab side).
2. **Feature-parity matrix** — one row per capability of the secondary page (columns:
   capability, query/mutation used, present-in-primary?, migration note). Capabilities, not
   pixels: filters, exports, dialogs, deep-link params, permissions.
3. **Migrate deltas** into the primary as a tab/accordion/dialog (progressive disclosure, §4.3).
4. **Redirect** — add the secondary's URL to `routeMigrations` (carrying query params —
   `buildRedirectTarget` in `App.tsx:161-178` already merges them), delete its route.
5. **Delete the page file** one release later, after `getRedirectUsageStats` shows the
   redirect is actually taken (proves bookmarks worked) and no support complaints.

### 4.2 Concrete merge list (orchestrates §2 findings)

| #   | Merge                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Routes removed | Effort | Risk                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------ | ------------------------------------------- |
| C1  | Delete 9 shadowed registrations (§2.1)                                                                                                                                                                                                                                                                                                                                                                                                                                          | 9              | XS     | None — provably dead                        |
| C2  | Records → single `/logs?tab=` grammar (§2.2)                                                                                                                                                                                                                                                                                                                                                                                                                                    | 8              | S      | Low — UI already exists both ways; pick one |
| C3  | Settings: `configuration-hub` already embeds `settings`, `transport-settings`, `storage-settings`, `OperatingParametersPage`, `DiagnosticsDashboard`, `permissions-settings` as tabs (`configuration-hub.tsx:43-83`). Retire 4 standalone routes (`/settings`, `/transport-settings`, `/storage-settings`, `/permissions-settings`) → `/configuration?tab=…`; decide one owner for diagnostics (keep `/diagnostics`, drop the tab embed, since nav links it as "System Health") | 4              | S      | Low                                         |
| C4  | Notifications: fold `/notification-settings`, `/email-alerts-settings`, `/email-templates` into `notifications-hub` tabs — **verify parity first** (hub internals not audited)                                                                                                                                                                                                                                                                                                  | 3              | M      | Medium                                      |
| C5  | Sensors: delete `sensor-optimization.tsx` + `sensor-management.tsx` stubs ("this moved" placeholders), point hub tabs at real destinations; single templates surface                                                                                                                                                                                                                                                                                                            | 1 (+2 files)   | XS     | None                                        |
| C6  | Crew scheduling: one owner for `/crew-scheduler` vs `/schedule-planner` (§2.3)                                                                                                                                                                                                                                                                                                                                                                                                  | 1              | M      | Medium — needs product call                 |
| C7  | Equipment detail: merge `pdm-equipment-detail` into `equipment-hub` Diagnostics tab                                                                                                                                                                                                                                                                                                                                                                                             | 1              | M      | Medium                                      |
| C8  | Vessel detail: parity-audit `VesselDashboard` vs `VesselIntelligence`, fold, redirect `/vessels/:id`                                                                                                                                                                                                                                                                                                                                                                            | 2              | L      | High — biggest pages in app; do last        |
| C9  | Analytics: `scheduled-reports-settings` becomes a Settings tab/dialog of `scheduled-reports`                                                                                                                                                                                                                                                                                                                                                                                    | 1              | S      | Low                                         |
| C10 | Logistics: retire standalone `/service-orders`, `/service-requests` (nav already targets `/logistics?tab=…`)                                                                                                                                                                                                                                                                                                                                                                    | 2              | S      | Low                                         |

Total: **98 → ~72 routed surfaces (−26)** with zero capability loss; every removal is a
redirect, not a 404.

### 4.3 Progressive disclosure patterns (reduce pages, keep features)

- **Tabs** (`?tab=` + `IconGridLayout`/`TabbedPageLayout`): for sibling datasets — exactly
  what Records/Logistics already do. After the §8.3 fix, tabs keep their loaded state on
  revisit, which removes the last UX argument for separate pages.
- **Accordion/collapsible sections**: for the long settings forms in C3/C4 instead of
  separate routes per form (shadcn `accordion` is already in `components/ui`).
- **Wizards**: `desktop-setup` is the template; apply to "create scheduled report" so the
  settings page (C9) stops being a destination and becomes a step.
- Rule of thumb: a URL is justified only if users deep-link/bookmark it or permissions
  differ. Otherwise it's a tab.

---

## 5. Pillar 5 — Static analysis & code optimization

### 5.1 Style system: healthy — protect it

- `index.css`: 46 semantic custom properties × 4 themes (light/dark/bridge/daylight);
  Tailwind config maps them; no hardcoded palette utilities (`bg-blue-500`-style) in any TSX.
  **Erratum (2026-06-11):** the original "zero raw hex/rgb" claim here was a bad measurement —
  re-scoring found 119 raw-color occurrences in 31 files, clustered in chart/map/3D fills plus
  25 arbitrary-value utilities (`bg-[#…]`); see `docs/UI-SCORECARD.md` §3. The §10 token guard
  should ban `-[#` and introduce `--chart-*` tokens rather than pin zero.
- All 97 `style={{…}}` occurrences are legitimately dynamic (virtual-table column widths,
  schedule-block geometry, progress transforms). No action.
- **Duplicated theme blocks**: bridge/daylight are defined 3×:
  `index.css:61-94` (`:root[data-theme="bridge"]`), `index.css:415-448` (`.bridge` class
  duplicate, plus `.daylight` at `:553-573`), and `styles/bridge-and-daylight.css` (70 lines,
  **never imported**). Delete the orphan file; verify which selector `theme-provider.tsx`
  actually sets and delete the other duplicate block.

### 5.2 Confirmed dead code (zero references — safe to purge)

| Artifact                                                           | Lines | Evidence                                                                           |
| ------------------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------- |
| `hooks/use-upload.ts`                                              | 93    | no importers                                                                       |
| `hooks/useDashboardPreferences.ts`                                 | 49    | no importers                                                                       |
| `styles/bridge-and-daylight.css`                                   | 70    | never imported; content duplicated in `index.css`                                  |
| `components/navigation/NavigationCard.tsx` + `NavigationGroup.tsx` | ~90   | imported only by each other (decide: bless for §3.2 or delete)                     |
| `createIconGridLegacyRedirects` (`IconGridLayout.tsx:288-301`)     | 14    | exported, never called; `GridItem.legacyRoutes` metadata it consumes is also inert |
| `pages/sensor-optimization.tsx`, `pages/sensor-management.tsx`     | ~43   | "moved" placeholder stubs (C5)                                                     |
| 9 shadowed route registrations                                     | —     | §2.1                                                                               |

Correction (Wave 1): `components/FairnessViz.tsx` was initially flagged dead but is consumed
via a **relative** import (`scheduling/enhanced-schedule-results-card.tsx:17`) that the
alias-only grep missed — kept. Lesson folded into §10: dead-code detection must resolve
relative imports, which is exactly what `knip` does and ad-hoc greps don't.

Near-dead: `components/unified-crew-components.tsx` is **885 lines consumed for one export**
(`CrewViewDialogContent`, imported once at `UnifiedCrewManagement/index.tsx:8`). Extract that
component, delete the rest. Adopt `knip` (or `ts-prune`) in CI to keep finding these —
one-off greps rot.

### 5.3 Duplicate logic to centralize

- **Severity/status colors — 10 implementations**, 4+ being true duplicates:
  canonical `features/analytics/lib/analyticsUtils.ts:54` and
  `features/maintenance/lib/pdmUtils.ts:84` vs re-definitions in
  `useMissionOverviewData.ts:166`, `usePdmPackData.ts:145`, `useSystemAdminData.ts:134`,
  `useDTCDiagnosticsData.ts:94` (identical to `ActiveDtcsPanel.tsx:30`), plus variants in
  `ai-health/InsightsTab.tsx:194`, `useAiInsightsData.ts:194`, `NarrativeSummaryCard.tsx:125`.
  Fix: one `client/src/lib/severity.ts` exporting `severityBadgeVariant()`, `severityTextClass()`,
  `severityBgClass()` over a shared `Severity` type, then delete the 8 locals.
- **Severity/status TYPE unions** re-declared in 5+ client files
  (`ops/OpsStatusPill.tsx:4`, `features/workflow/types.ts`, `hooks/useWebSocket.ts`,
  `lib/analytics-priority.ts`×3, `features/work-orders/types.ts`) while `@shared` already
  exports `ALARM_SEVERITIES`, `SAFETY_BULLETIN_SEVERITIES`, `CERTIFICATE_STATUSES`,
  `CREW_TASK_STATUSES`. Centralize in `@shared` (this also feeds the repo's existing
  duplicate-type ratchet).
- **Stat cards**: bless `shared/MetricCard` (+ `KpiCard` for trend variant); migrate the 5
  hand-rolled sites in §1.3; delete `maintenance-hub.tsx`'s local `StatTile`.
- **Utilities**: formatters are well-consolidated; only `getInitials`
  (`scheduling/ScheduleGeneratorPanel.tsx:34`) needs hoisting to `lib/utils.ts`.
- **CRUD dialogs**: `WorkOrderFormDialog` and `ServiceOrderFormDialog` share ~80% structure
  (Dialog→Header→`useForm`+`zodResolver`→fields→footer). Extract `FormDialog` wrapper
  (schema + fields + onSubmit in, chrome/dirty-guard/submit handling shared) and route both
  through `ResponsiveDialog` so mobile gets sheets for free (currently 8 adopters vs 12+ raw).

### 5.4 Bundle

`vite.config.ts` manualChunks already split vendor-react / vendor-ui / vendor-charts /
vendor-export / feature chunks; lucide imports are all named (262 files, no wildcard).
recharts is not lazy-imported, but because every page is `lazy()` and recharts lives in
`vendor-charts`, it loads only when a chart page loads — acceptable; don't spend effort here.

---

## 6. Pillar 6 — Runtime performance profiling

### 6.1 Verified re-render bugs (fix this week)

1. **`PermissionsContext`** (`PermissionsContext.tsx:158-168`) — `permissions` is memoized
   (`:94-118`) but the context **value** object plus 9 closures are rebuilt on every provider
   render, so every render of the provider (any state change above it in `App.tsx:478-489`)
   re-renders all **38** `usePermissions` consumers — including `UniversalOpsShell` and
   `BottomNav` on every page. Fix in §8.1.
2. **`AdminAccessContext`** (`AdminAccessContext.tsx:193,226-235`) — `setInterval(…, 1000)`
   updates `timeUntilExpiry`/`timeUntilIdleTimeout` state every second while admin is
   unlocked, and the value object is unmemoized → **14 consumers re-render 1×/second for the
   whole admin session**. Fix in §8.2: memoize + move the countdown out of context.
3. **`IconGridLayout.useDeferredComponent`** (`IconGridLayout.tsx:111-132`) — `lazy(item.load)`
   is created inside `useMemo([item?.id])`, so switching tabs A→B→A constructs a **new** lazy
   component for A: Suspense fallback flashes, content remounts, queries refetch, filters and
   scroll reset. Affects `/logs`, `/operations` and any future IconGrid hub. Fix in §8.3.

`OrganizationContext` (80 consumers) and `FocusModeContext` are correctly memoized — no action.

### 6.2 Polling inventory (network + render churn)

Defaults are good (`lib/queryClient.ts`: `refetchInterval: false`,
`refetchOnWindowFocus: false`, `staleTime` 5 min). Overrides are not: ~115 `refetchInterval`
sites — 1× 10 s (digital-twin simulation), 2× 20 s (`crew-admin/SafetyTab.tsx`, which also
runs a 30 s poll concurrently → ~5 req/min sustained from one mounted tab), 30+× 30 s
(findings, rms-monitoring, `CopilotFab` — globally mounted), 40+× 60 s, 40+× ≥120 s. Plus
`App.tsx:286` (15 s pending-count interval) and the 1 s admin ticker (§6.1.2).

Policy fix, not whack-a-mole: export `POLL = { REALTIME: 30_000, ACTIVE: 60_000, BACKGROUND: 300_000 }`
next to `CACHE_TIMES`, require every `refetchInterval` to reference it (greppable), gate all
polls on visibility (`refetchIntervalInBackground: false` is default — verify none override
it; pause `CopilotFab` polling when the drawer is closed).

### 6.3 Memoization & list hygiene

- **10 `React.memo` uses across 482 components**, while every hub route re-renders under a
  context-churning provider (§6.1.1). Fix the providers first — that removes most pressure —
  then memoize only measured hot list rows.
- **129 `key={index}` sites**; the ones that matter are mutable lists:
  `SchedulePlanner` grids (drag/reorder → reconciliation churn + state bleed),
  `rms-monitoring/ConsumptionTab.tsx` table rows. Skeleton arrays (`TableSkeleton.tsx` etc.)
  are fine. Pattern fix in §8.4.
- Zero `eslint-disable react-hooks/exhaustive-deps` in the codebase — good discipline; keep.
- Radix `TabsContent` unmounts inactive tabs by default and **no `forceMount` exists** — DOM
  stays lean; tab-heavy pages are the correct shape already.

### 6.4 God components (flatten by splitting, not by micro-memoizing)

| File                                                                                                                               | Lines     |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------- |
| ~~`pages/vessel-intelligence/registry-screens.tsx`~~ split 2026-06-11 → 111-line dispatcher + `registry-screens/` (8 files ≤430 L) | ~~1,766~~ |
| `pages/admin/equipment-dependencies.tsx`                                                                                           | 1,127     |
| `pages/ml-training.tsx`                                                                                                            | 990       |
| `pages/admin/3d-models.tsx`                                                                                                        | 936       |
| `pages/copilot-admin.tsx`                                                                                                          | 872       |
| `pages/system-administration.tsx`                                                                                                  | 862       |
| `pages/engine-logbook.tsx`                                                                                                         | 862       |
| `pages/findings.tsx`                                                                                                               | 841       |
| `pages/deck-logbook/index.tsx`                                                                                                     | 838       |
| `pages/inventory-management.tsx`                                                                                                   | 817       |
| (crew: `UnifiedCrewManagement/CrewTaskTracker.tsx` ~42 KB, `CrewFormDialog.tsx` ~41 KB)                                            |           |

Split rule: one file per screen/tab/dialog, colocated `use<Page>Data` hook for queries,
presentational children take primitives. `registry-screens.tsx` first — it backs ~6 routes
from one file; the `equipment-hub/` directory (`ActionBar` + 5 tab files + `shared.tsx`) is
the in-repo template for the target shape.

### 6.5 Profiling workflow

`DevPerformanceOverlay` (Ctrl+Shift+P) already tracks API latency, route timings, memory,
and top-rendered components via `perfLog`. Add a render-count assertion to it in dev: warn
when any component exceeds N renders within 5 s — that would have flagged §6.1.1/2
immediately. Use React DevTools Profiler on `/logs`, `/work-orders`, `/crew-scheduler`
before/after the §8 fixes and store flamegraph screenshots in the PR.

---

## 7. Deliverable A — UI Consolidation Map

Target information architecture (post C1–C10). One URL grammar: hubs own
`?tab=` deep links; `:param` routes only for entity details.

```
/                                Command Center (role-aware home)
/portal-login · /my-tasks · /profile · /feedback        (user portal, unshelled)

OPERATIONS  /operations?tab=…    attention | findings | briefing | outbox | bulletins
FLEET       /fleet               triage board
            /fleet/:vesselId     Vessel Intelligence (absorbs VesselDashboard C8; ?target= sections)
            /vessel-management · /equipment · /equipment/:equipmentId (moved into fleet group)
            /certificates · /equipment-scan · /operating-parameters
MAINTENANCE /maint?tab=…         work-orders | schedules | templates | equipment-intelligence
            /work-orders · /maintenance · /maintenance-templates (kept: bookmarked worklists)
            /pdm-platform?tab=…  (absorbs pdm-equipment-detail → /equipment/:id?tab=diagnostics C7)
            /digital-twin
CREW        /crew-management?view=…   roster | tasks
            /crew-scheduler      (single scheduler, C6) · /hours-of-rest
LOGISTICS   /logistics?tab=…     inventory | service-requests | service-orders | vendors (C10)
            /purchase-requests/:id
RECORDS     /logs?tab=…          compliance | deck | engine | equipment   (C2 — one grammar)
            /rms-monitoring
ANALYTICS   /analytics?tab=…     operations | maintenance | finance | data-integrity
            /equipment-intelligence · /knowledge-base · /kb-analytics
            /scheduled-reports   (settings as tab, C9) · /ai-health · /ai-sensor-audits
            /ai-studio · /ml-training
SYSTEM      /system              hub
            /configuration?tab=… system | transport | storage | parameters | permissions (C3)
            /notifications?tab=… preferences | email-alerts | templates (C4, verify parity)
            /sensors?tab=…       templates (stubs deleted, C5)
            /organization-management · /system-administration · /diagnostics
            /admin/*             tenants | 3d-models | equipment-dependencies | telemetry-warehouse | access-diagnostic
```

Scoreboard: 98 routes → ~72; redirect registry +18 short-term, then shrinks via usage-stats
retirement (§2.4); page files −~12 after one-release deprecation windows.

Sequencing: **Wave 1 (free wins)** C1, C5, §5.2 deletions, §8.1–8.3 fixes →
**Wave 2 (records & settings)** C2, C3, C9, C10 + AppPage adoption on touched pages →
**Wave 3 (product calls)** C4, C6, C7 → **Wave 4** C8 + god-file splits.

---

## 8. Deliverable B — Refactoring code examples

### 8.1 Memoize `PermissionsContext` (38 consumers stop re-rendering)

```tsx
// contexts/PermissionsContext.tsx — replace lines 120-168
const value = useMemo<PermissionsContextType>(() => {
  const allow = import.meta.env.DEV && permissions.isDevMode;
  const hasPermission = (resource: string, action: string): boolean => {
    if (allow) return true;
    if (permissions.isLoading) return false;
    return permissions.permissions[resource]?.[action] === true;
  };
  return {
    permissions,
    hasPermission,
    hasAnyPermission: (r, actions) => actions.some((a) => hasPermission(r, a)),
    hasAllPermissions: (checks) => checks.every((c) => hasPermission(c.resource, c.action)),
    canView: (r) => hasPermission(r, "view"),
    canCreate: (r) => hasPermission(r, "create"),
    canEdit: (r) => hasPermission(r, "edit"),
    canDelete: (r) => hasPermission(r, "delete"),
    canExport: (r) => hasPermission(r, "export"),
  };
}, [permissions]); // `permissions` is already memoized at :94-118
```

### 8.2 Stop the 1 Hz context cascade in `AdminAccessContext`

Countdown values are _derivable_ from `sessionExpiresAt` + last-activity — they don't belong
in shared context state. Remove `timeUntilExpiry`/`timeUntilIdleTimeout` from the context
(keep the auto-lock interval, which only _reads_), memoize the remaining value, and let the
one component that displays a countdown tick itself:

```tsx
// hooks/useAdminCountdown.ts — only the countdown badge pays the 1 Hz cost
export function useAdminCountdown(sessionExpiresAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessionExpiresAt]);
  return sessionExpiresAt ? Math.max(0, sessionExpiresAt - now) : null;
}
```

```tsx
// AdminAccessContext.tsx — value becomes stable between real auth events
const value = useMemo<AdminAccessContextType>(
  () => ({
    isAdminUnlocked,
    sessionToken,
    sessionExpiresAt,
    unlockAdminFromUserSession,
    lockAdmin,
    logout,
  }),
  [isAdminUnlocked, sessionToken, sessionExpiresAt, unlockAdminFromUserSession, lockAdmin, logout]
);
```

### 8.3 Fix `IconGridLayout` tab remount/flash (and keep visited tabs warm)

```tsx
// IconGridLayout.tsx — cache lazy components by their stable load fn, not per-selection
const lazyComponentCache = new WeakMap<
  () => Promise<{ default: ComponentType<Record<string, never>> }>,
  ComponentType<Record<string, never>>
>();

function useDeferredComponent(item: GridItem | undefined) {
  return useMemo(() => {
    if (!item) return null;
    if (item.component) return item.component;
    if (!item.load) return null;
    let Lazy = lazyComponentCache.get(item.load);
    if (!Lazy) {
      Lazy = lazy(item.load);
      lazyComponentCache.set(item.load, Lazy); // re-selecting a tab reuses the resolved module
    }
    return (
      <Suspense fallback={<PageLoader variant={item.loaderVariant || "cards"} />}>
        <Lazy />
      </Suspense>
    );
  }, [item?.id, item?.load]);
}
```

Optional second step if tab-local state (filters/scroll) must survive switching: render every
_visited_ item and toggle `hidden` instead of unmounting — trade memory for state retention:

```tsx
{
  items
    .filter((i) => visitedIds.has(i.id))
    .map((i) => (
      <div key={i.id} hidden={i.id !== selectedId}>
        {renderItem(i)}
      </div>
    ));
}
```

### 8.4 Stable keys + memoized rows for mutable lists (SchedulePlanner et al.)

```tsx
const AssignmentRow = memo(function AssignmentRow({ assignment, onSelect }: RowProps) {
  return (
    <div role="row" onClick={() => onSelect(assignment.id)}>
      …
    </div>
  );
});

// parent
const handleSelect = useCallback((id: string) => setSelectedId(id), []);
{
  assignments.map((a) => (
    <AssignmentRow
      key={a.id /* never the index for reorderable data */}
      assignment={a}
      onSelect={handleSelect}
    />
  ));
}
```

### 8.5 Route canonicalization (Records, C2) — the shape of every merge

```ts
// routes/records.ts — after
export const recordsRoutes = [
  { path: "/logs", component: LogsHub },
  { path: "/rms-monitoring", component: RmsMonitoring },
]; // 16 → 2; deleted paths all live on in routeMigrations

// config/navigationConfig.ts — Records children use the one grammar IconGridLayout owns
{ name: "Deck Log", href: "/logs?tab=deck", … }

// config/navigationConfig.ts — routeMigrations additions
"/logs/compliance": "/logs?tab=compliance",
"/logs/deck": "/logs?tab=deck",
"/logs/engine": "/logs?tab=engine",
"/logs/equipment": "/logs?tab=equipment",
"/compliance-consolidated": "/logs?tab=compliance",
"/deck-log-consolidated": "/logs?tab=deck",
"/engine-log-consolidated": "/logs?tab=engine",
"/equipment-log-consolidated": "/logs?tab=equipment",
```

### 8.6 Master header adoption (AppPage from §3.3)

```tsx
// pages/fuel-emissions-log.tsx — before: 3 hand-rolled text-3xl headers (:328,336,344)
export default function FuelEmissionsLog() {
  return (
    <AppPage
      title="Fuel & Emissions"
      subtitle="Engine room fuel consumption and MARPOL emissions"
      actions={<ExportButton />}
    >
      <SummaryRow>{/* MetricCard ×3 replaces inline text-2xl card divs (:191-215) */}</SummaryRow>
      <FuelLogTable />
    </AppPage>
  );
}
```

---

## 9. Deliverable C — Master checklist

### Fix immediately (verified bugs; ≤1 day total)

- [x] Memoize `PermissionsContext` value — `contexts/PermissionsContext.tsx:158` (§8.1) — done, Wave 1
- [x] Memoize `AdminAccessContext` value + drop the 1 Hz countdown state — `contexts/AdminAccessContext.tsx` (§8.2) — done, Wave 1; `timeUntilExpiry`/`timeUntilIdleTimeout` had **zero consumers**, so they were removed outright (no `useAdminCountdown` hook needed; the interval now only enforces auto-lock)
- [x] Cache lazy components in `IconGridLayout` — `components/layouts/IconGridLayout.tsx` (§8.3) — done, Wave 1
- [x] Delete 9 shadowed route registrations — `routes/records.ts`, `routes/logistics.ts`, `routes/analytics.ts` (§2.1) — done, Wave 1
- [ ] Fix Records nav/grammar fork so both menus show the same Deck/Engine/Equipment/Compliance UI (§2.2, §8.5)
- [ ] Move `/equipment/:equipmentId` into the fleet route group (hub-gating seam, §2.3)
- [ ] Dedup `SafetyTab` 20 s + 30 s concurrent polls — `components/crew-admin/SafetyTab.tsx`

### Static (purge & centralize; 1–2 days)

- [x] Delete: `use-upload.ts`, `useDashboardPreferences.ts`, `styles/bridge-and-daylight.css`,
      duplicate `.bridge`/`.daylight` blocks in `index.css`,
      `createIconGridLegacyRedirects` + `GridItem.legacyRoutes` — done, Wave 1
      (`FairnessViz.tsx` kept — see correction in §5.2; sensor stub pages deferred to C5)
- [ ] Decide `NavigationCard`/`NavigationGroup`: bless for hubs or delete (§3.2)
- [ ] Extract `CrewViewDialogContent`; delete rest of `unified-crew-components.tsx` (885 lines) (§5.2)
- [ ] Create `lib/severity.ts`; delete 8 duplicate `getSeverityColor` implementations (§5.3)
- [ ] Hoist severity/status unions to `@shared`; update 5+ client files (§5.3)
- [ ] `getInitials` → `lib/utils.ts` (§5.3)
- [ ] Add `knip`/`ts-prune` to CI (§5.2)

### Visual / structural (per Wave 2–3)

- [ ] Introduce `AppPage`; migrate the 10 worst hand-rolled headers; add header burn-down guard (§3.3)
- [ ] Migrate 5 hand-rolled stat-card sites to `MetricCard`/`KpiCard`; delete local `StatTile` (§5.3)
- [ ] Eliminate double-chrome on `/logs` flow (shell + IconGridLayout + page headers) (§3.2)
- [ ] Execute merges C3, C4, C9, C10 with feature-parity matrices (§4.2)
- [ ] `FormDialog` wrapper for WorkOrder/ServiceOrder dialogs; ResponsiveDialog adoption 8 → 20+ (§5.3)
- [ ] Resolve `/crew-scheduler` vs `/schedule-planner` naming collision (C6)

### Runtime (per Wave 2–4)

- [ ] Introduce `POLL` constants; re-base ~115 `refetchInterval` sites; pause `CopilotFab` poll when closed (§6.2)
- [ ] Replace `key={index}` in SchedulePlanner grids + rms-monitoring tables with entity ids (§8.4)
- [ ] Split `registry-screens.tsx` (1,766 L) by screen — **done 2026-06-11** (dispatcher + `registry-screens/`, hub-v2 test pins the family); remainder pending: `equipment-dependencies.tsx`, `CrewTaskTracker`, `CrewFormDialog` (§6.4)
- [ ] Profile `/logs`, `/work-orders`, `/crew-scheduler` before/after; attach flamegraphs (§6.5)
- [ ] Vessel-detail merge C8 (last; largest)

---

## 10. Guardrails (keep it from regressing)

Matches the repo's existing ratchet culture (`check:guards`, `scripts/*-baseline.json`):

1. **Route-shadow test** — unit test asserting no path appears in both `legacyRedirects` and
   any route group, and every `routeMigrations` target resolves to a registered route
   (`/logs?tab=deck` → `/logs`). Would have caught §2.1 and the grammar fork.
2. **Header burn-down** — `scripts/check-ui-baselines.mjs` counting
   `text-(2|3)xl font-bold` under `pages/` (current: 97) and `style={{` (current: 97);
   numbers may only decrease.
3. **Context-memo lint** — adopt `eslint-plugin-react-hooks` rule set that flags unmemoized
   provider values (or a 10-line custom rule: `value={` object literal inside a `*Provider`).
4. **Dead-export scan** — `knip` in `check:guards`, baselined like the hex-storage burn-down.
5. **Token guard** — forbid `#hex`/`rgb(`/raw palette classes in `client/src` (currently 0 —
   pin it while it's clean).
