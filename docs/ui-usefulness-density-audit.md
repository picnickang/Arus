# ARUS — UI Usefulness & Density Audit (Report Only)

> **Status:** Analysis only. No production code, routes, permissions, or behavior were changed by this pass. This document is the input for a future, separate implementation task.
> **Date:** 2026-06-02
> **Scope:** ~89 page files in `client/src/pages`, ~60 backend domains in `server/domains`, the hub-based navigation system, and the role/permission surface.
> **Companion:** `docs/ui-usefulness-density-audit.json` (machine-readable item-by-item inventory with scores, recommendations, affected files, risk, proposed placement, and permission recommendation).
> **Prior art:** `docs/ux-audit.md` (earlier, narrower pass) — referenced, not superseded structurally.

---

## How to read this report

Every UI item is assigned:

- **A usefulness score (0–100)** from the 9-factor framework in §0.
- **A class (A–G)** describing its disposition.
- **A recommendation:** `KEEP` / `CONSOLIDATE` / `HIDE` / `ROLE-GATE` / `DELETE` / `FIX-FIRST`.
- **A removal-risk rating** (Low / Medium / High) — how dangerous it is to change or remove the item.

### Class legend (A–G)

| Class | Meaning | Typical recommendation |
|---|---|---|
| **A** | Core / mission-critical — used often, high operational or compliance value | KEEP (feature prominently) |
| **B** | Useful supporting feature | KEEP |
| **C** | Niche / role-specific — valuable to a few roles, noise to everyone else | KEEP + ROLE-GATE |
| **D** | Redundant / duplicate — overlaps another surface | CONSOLIDATE |
| **E** | Incomplete / placeholder / partial data | FIX-FIRST or HIDE |
| **F** | Broken / no-op / misleading-success | FIX-FIRST (or DELETE the control) |
| **G** | Dead / unlinked, or backend-only with no UI | DELETE or intentionally EXPOSE |

---

## §0. The 9-factor usefulness framework

Each item is scored on nine factors. The first seven add value; the redundancy and complexity factors subtract.

| # | Factor | Weight | What it measures |
|---|---|---|---|
| 1 | Operational importance | +20 | Does day-to-day fleet operation depend on it? |
| 2 | Usage frequency | +15 | Daily / weekly / monthly / rarely. |
| 3 | Role relevance | +10 | How many roles genuinely need it vs. see it as noise. |
| 4 | Accuracy / trustworthiness | +15 | Does it show real, correct data and real actions? |
| 5 | Completeness | +10 | Is the feature finished or a stub? |
| 6 | Safety / compliance value | +15 | Does removing it create a safety or regulatory gap? |
| 7 | Business value (cost/ROI) | +15 | Does it drive cost savings, procurement, or reporting? |
| 8 | Redundancy penalty | −20 | Overlap with another surface. |
| 9 | Complexity penalty | −15 | Tab/option overload, technical jargon exposed to operators. |

Score = sum of factor contributions, clamped to 0–100. The JSON companion stores the final calibrated score per item (not the individual per-factor inputs).

---

## §1. Executive summary

ARUS is **feature-rich but over-surfaced**. The platform exposes roughly 90 distinct page routes through 8 navigation categories, several of which present the *same* underlying data (equipment health, fleet health, predictive risk, audit logs) in three or four different places. The result is high cognitive load: an operator or admin must learn which of several near-identical dashboards is the "real" one.

Headline findings:

1. **Severe dashboard duplication around equipment/AI health.** `equipment-intelligence`, `pdm-dashboard`, `ai-health-dashboard`, and the analytics hub all render fleet-health gauges and "assets at risk" lists. This is the single biggest density problem.
2. **The admin surface is too wide and too flat.** System Administration alone carries 12+ tabs/sub-tabs; PdM Platform has 8; Configuration Hub has 6. Deep technical tooling (ML training, drift, governance, telemetry warehouse, transport settings) sits next to everyday operational tools with no separation.
3. **A handful of buttons are genuinely broken or fake.** Confirmed no-op buttons (`Acknowledge`, `Assign` on the equipment hub) and hardcoded "live" metrics (`Models Active: 3`, `Last Training: 7 days ago` on the AI Health dashboard) erode trust. These should be fixed or removed before any cosmetic cleanup.
4. **Frontend gating and backend authorization are mostly aligned but have known gaps.** The Attention Inbox is correctly enforced on both sides. However, several routes gate by **role name** (`requireRole`) while the UI gates by **permission grant** (`PermissionGate`), so a user with a DB permission grant can still be blocked, and conversely some list endpoints (e.g. safety bulletins) are open to all authenticated users while the UI implies restriction.
5. **Backend-only domains with no UI.** DP Monitoring, Charter Compliance, Vetting, Offshore Ops, EFMS, and Data Export have working backends but no consumer in `client/src`. They are either future work or dead weight — each needs an explicit "expose or remove" decision.
6. **The 5-hub model already exists** (`maintenance`, `system`, `crew`, `logistics`, `analytics` are the admin primaries) — this audit recommends *deepening and tidying* that model rather than inventing a new IA, plus formally separating the normal-user area (today: Dashboard + Feedback only) and grouping the crew roster by role.

**Recommended sequencing:** fix/flag the broken & fake controls first (trust), then collapse the duplicate dashboards (density), then re-gate by the role hierarchy (clarity), then resolve the backend-only domains (debt).

---

## §2. The biggest density problems

| Rank | Problem | Surfaces involved | Why it hurts |
|---|---|---|---|
| 1 | **Four overlapping "health/risk" dashboards** | `equipment-intelligence`, `pdm-dashboard`, `ai-health-dashboard`, `analytics-hub` | Users can't tell which is authoritative; same gauges and lists rendered 4×. |
| 2 | **System Administration over-tabbed** | `system-administration` (12+ tabs/sub-tabs), `system-hub`, `configuration-hub` | Audit logs, service health, and settings appear in all three; no clear "start here". |
| 3 | **PdM split across 5 routes** | `pdm-dashboard`, `pdm-platform`, `pdm-pack`, `pdm-schedule`, `pdm/equipment/:id` | Predictive maintenance has no single front door; `pdm-platform` alone has 8 tabs. |
| 4 | **Analytics fan-out** | `analytics`, `/analytics/operations`, `/analytics/maintenance`, `/analytics/finance`, `/analytics/data-integrity` | Reasonable as sub-pages, but the hub repeats their headline numbers. |
| 5 | **Logs/compliance triplication** | `logs-hub`, `logs/compliance`, `compliance-consolidated`, plus per-book `*-consolidated` pages | Deck/engine/equipment each have a page *and* a consolidated page *and* a compliance roll-up. |
| 6 | **Crew views overlap** | `crew-hub`, `crew-management`, roster components | Roster appears in multiple places with different controls. |
| 7 | **Settings sprawl** | `settings`, `notification-settings`, `email-templates`, `email-alerts-settings`, `storage-settings`, `transport-settings`, `permissions-settings`, `stormgeo-settings` | Eight separate settings routes that belong under one Configuration hub. |

---

## §3. Top 10 to KEEP (highest usefulness)

These are class A/B — keep and, where noted, feature more prominently.

| # | Item | Route | Class | Score | Note |
|---|---|---|---|---|---|
| 1 | Attention Inbox | `/attention-inbox` | A | 92 | Action-oriented single front door for work needing attention. |
| 2 | Work Orders | `/work-orders` | A | 90 | Core maintenance workflow; real CRUD + closeout. |
| 3 | Vessel Dashboard | `/vessels/:id` | A | 89 | Real-time per-vessel status; primary operational view. |
| 4 | Equipment Registry | `/equipment` | A | 88 | Canonical equipment list + status. |
| 5 | Maintenance Schedules | `/maintenance` | A | 86 | Planned maintenance; drives the whole PdM loop. |
| 6 | Hours of Rest | `/hours-of-rest` | A | 85 | STCW compliance — safety/regulatory weight. |
| 7 | Deck & Engine Logbooks | `/logs/deck`, `/logs/engine` | A | 84 | Statutory records; sign-off workflow. |
| 8 | Inventory Management | `/inventory-management` | A | 83 | Parts/stock — directly drives procurement and uptime. |
| 9 | Safety Bulletins | `/safety-bulletins` | A | 82 | Real safety feed backing the user dashboard. |
| 10 | Certificate Registry | `/certificates` | B | 80 | Expiry tracking; compliance value. |

---

## §4. Top 10 to CONSOLIDATE (class D)

| # | Keep (canonical) | Fold in / redirect | Rationale |
|---|---|---|---|
| 1 | **Equipment Intelligence** as the single risk/health view | `pdm-dashboard`, the health gauges in `analytics-hub`, overview cards in `ai-health-dashboard` | One authoritative "what's at risk" surface. |
| 2 | **PdM Platform** as the predictive front door | `pdm-pack`, `pdm-schedule`, `pdm-dashboard` (as tabs/sections) | Collapse 5 PdM routes into 1 hub with tabs. |
| 3 | **Configuration Hub** | `settings` device/system bits, `storage-settings`, `transport-settings`, `email-templates`, `email-alerts-settings`, `notification-settings`, `stormgeo-settings` | One settings home; sub-tabs per domain. |
| 4 | **System Administration** | `system-hub` overview cards, `diagnostics` | Single admin landing; promote "start here". |
| 5 | **Logs Hub** | `compliance-consolidated`, `deck-log-consolidated`, `engine-log-consolidated`, `equipment-log-consolidated` | Per-book pages + one consolidated tab, not 4 separate routes. |
| 6 | **Crew Management** | `crew-hub` roster overlap | One roster, grouped by role (see §13). |
| 7 | **Logistics Hub** | `/vendors`, `/suppliers`, `/service-providers`, `/inventory-management` (already tab-redirects) | Formalize the tab model; remove duplicate entry routes. |
| 8 | **Analytics Hub** | headline numbers duplicated from sub-pages | Hub links out; stops re-rendering sub-page KPIs. |
| 9 | **AI Health Dashboard** | merge into AI Analytics hub as a tab | Don't keep a standalone near-duplicate of analytics. |
| 10 | **Sensors Hub** | `sensor-templates` (separate route); `sensor-management` & `sensor-optimization` already render as Sensors-hub tabs | Fold the standalone `sensor-templates` route in too, so all sensor tooling lives under one hub. |

---

## §5. Top 10 to DELETE or HIDE (class E/F/G)

| # | Item | Class | Action | Risk | Why |
|---|---|---|---|---|---|
| 1 | `Acknowledge` button (equipment hub) | F | DELETE control (or FIX) | Low | No `onClick`; does nothing. |
| 2 | `Assign` button (equipment hub) | F | DELETE control (or FIX) | Low | No `onClick`; does nothing. |
| 3 | "Models Active: 3" stat (AI Health) | F | FIX-FIRST | Low | Hardcoded; should read real model count. |
| 4 | "Last Training: 7 days ago" stat (AI Health) | F | FIX-FIRST | Low | Hardcoded string. |
| 5 | Duplicate consolidated log routes | D | CONSOLIDATE | Medium | `deck-log-consolidated`, `engine-log-consolidated`, `equipment-log-consolidated`, `compliance-consolidated` belong as tabs, not 4 routes. |
| 6 | Standalone AI Health Dashboard | D | CONSOLIDATE | Medium | Near-duplicate of analytics; merge as a tab (after fixing its hardcoded stats). |
| 7 | DP Monitoring backend (`/api/dp`) | G | EXPOSE or DELETE | Medium | Working backend, no UI consumer. |
| 8 | EFMS backend (`/api/efms`) | G | EXPOSE or DELETE | Medium | No UI consumer. |
| 9 | Charter / Vetting backends | G | EXPOSE or DELETE | Medium | OSV-specific, backend-only. |
| 10 | "All systems operating within normal parameters" fallback (analytics key findings) | E | FIX-FIRST | Low | Masks query failures as a healthy state. |

> Note: `home.tsx`, `portal-login.tsx`, `not-found.tsx`, `desktop-setup.tsx`, and `findings-cards.tsx` were flagged as "unregistered" but are **intentionally** mounted outside the route-group files (app shell / conditional / sub-component). They are **not** dead — do not delete.
>
> Correction (verified): `sensor-optimization.tsx` and `sensor-management.tsx` are **not** orphans. They are lazily imported and rendered as tabs inside `client/src/pages/sensors-hub.tsx` (`/sensors`). Keep them; consolidate under the Sensors hub rather than deleting.

---

## §6. Top 10 broken / confusing buttons & actions (class F/E)

| # | Control | Location | Confirmed issue | Recommendation |
|---|---|---|---|---|
| 1 | `Acknowledge` | `equipment-hub.tsx:318` | No `onClick` handler — dead button. | FIX (wire to alert ack) or remove. |
| 2 | `Assign` | `equipment-hub.tsx:322` | No `onClick` handler — dead button. | FIX (wire to assignment) or remove. |
| 3 | Models Active stat | `ai-health-dashboard.tsx:355` | Hardcoded `3`. | Bind to real model registry count. |
| 4 | Last Training stat | `ai-health-dashboard.tsx:359` | Hardcoded `7 days ago`. | Bind to latest `training_metrics` row. |
| 5 | Analytics "Key Findings" fallback | `analytics-hub.tsx:299` | "All systems… normal" shown when data missing/failed — masks errors. | Distinguish "no findings" from "query failed". |
| 6 | Logistics cost display | `logistics-hub.tsx:89` | `$—` whenever cost aggregation is null (frequent). | Surface "not available" vs. zero; verify backend aggregation. |
| 7 | "Publish Update" | `system-administration.tsx` | Submission path relies on Replit-env assumptions; may not trigger real side-effects in prod. | Verify end-to-end or gate behind a clear "dev only" notice. |
| 8 | "PDF exported successfully" toast | `scheduling/ScheduleGeneratorPanel.tsx:622` | Toast fires before stream verified non-empty. | Await/verify stream before success toast. |
| 9 | "Dashboard config saved" toast | `crew-admin/RolesDashboardsTab.tsx:190` | Success shown on mutation trigger in some legacy paths without persistence confirmation. | Confirm on settled mutation only. |
| 10 | Hub "overview" stat cards repeated across hubs | multiple | Same number shown in 3–4 places risks divergence when one source lags. | Single source of truth per metric. |

> Verification note: items 1–6 were directly confirmed by reading the source. Items 7–9 were reported by the inventory sweep and are marked **needs-confirmation** in the JSON (`confidence: "reported"`) — a future implementation task should reproduce before acting.

---

## §7. Full feature / tab / button / route inventory

The complete item-by-item inventory (route → component file → description → role visibility → class → score → recommendation → risk → proposed hub) lives in the machine-readable companion **`docs/ui-usefulness-density-audit.json`** at the **route level**, alongside a separate list of the verified/flagged broken controls (`brokenActions`). It is **not** an exhaustive every-button-and-tab catalogue — only the controls called out in §6 are itemized individually. The summary by navigation group is below.

### Operations (`operations.ts`)
`/operations` (hub), `/findings`, `/briefing`, `/attention-inbox` (admin-gated), `/offline-outbox`, `/safety-bulletins`.

### Fleet (`fleet.ts`)
`/fleet` (hub), `/vessels/:id`, `/vessels/:id/3d`, `/certificates`, `/vessel-management`, `/equipment`, `/equipment-scan`, `/operating-parameters`.

### Maintenance (`maintenance.ts`)
`/maint` (hub), `/work-orders`, `/maintenance` (schedules), `/maintenance-templates`, `/pdm/equipment/:id`, `/pdm/schedule`, `/pdm-pack`, `/pdm-dashboard`, `/pdm-platform`, `/digital-twin`, `/equipment/:id`.

### Crew (`crew.ts`)
`/crew` (hub), `/crew-management`, `/crew-scheduler`, `/schedule-planner`, `/hours-of-rest`.

### Logistics (`logistics.ts`)
`/logistics` (hub), `/inventory-management`, `/vendors`, `/purchase-requests/:id`, `/service-orders`, `/service-requests`, `/optimization-tools`.

### Records / Logs (`records.ts`)
`/logs` (hub), `/logs/compliance`, `/logs/deck`, `/logs/engine`, `/logs/equipment`, `/fuel-emissions-log`, `/vessel-track-log`, `/rms-monitoring`, `/compliance-consolidated`, `/deck-log-consolidated`, `/engine-log-consolidated`, `/equipment-log-consolidated`.

### Analytics / AI (`analytics.ts`)
`/equipment-intelligence`, `/analytics` (hub), `/analytics/operations`, `/analytics/maintenance`, `/analytics/finance`, `/analytics/data-integrity`, `/knowledge-base`, `/kb-analytics`, `/governance-dashboard`, `/scheduled-reports`, `/scheduled-reports-settings`, `/ai-health`, `/ai-sensor-audits`, `/ai-studio`, `/ml-training`.

### System / Admin (`system.ts`)
`/system` (hub), `/configuration`, `/sensors`, `/notifications`, `/stormgeo-settings`, `/sensor-templates`, `/organization-management`, `/system-administration`, `/diagnostics`, `/telemetry-upload`, `/copilot-admin`, `/agent/activity`, `/settings`, `/notification-settings`, `/email-templates`, `/email-alerts-settings`, `/permissions-settings`, `/storage-settings`, `/transport-settings`, `/admin/tenants`, `/admin/3d-models`, `/admin/equipment-dependencies`, `/admin/telemetry-warehouse`, `/admin/access-diagnostic`.

### Legacy alias routes (Records)
`records.ts` also registers alias paths that point at the same components as the canonical routes: `/deck-logbook` → Deck Logbook, `/engine-logbook` → Engine Logbook, `/logs-compliance` → Logs Compliance Hub, `/condition-monitoring-log` → Equipment Condition Log. These are kept for backward-compatible deep links; treat as aliases (not separate features) in any consolidation.

### Unregistered page files
`home.tsx`, `portal-login.tsx`, `not-found.tsx`, `desktop-setup.tsx`, `findings-cards.tsx` are intentionally mounted outside the route groups (app shell / conditional / sub-component) — keep. `sensor-optimization.tsx` and `sensor-management.tsx` are **not** standalone routes but **are** rendered as tabs inside `sensors-hub.tsx` — keep (see §5 correction).

---

## §8. Simplified navigation (target IA)

Reuse the **existing** category ids; do not invent new ones.

### Two top-level areas

1. **Normal-User Area** (default for crew/operational/viewer roles)
   - Today (role dashboard), Attention Inbox (where permitted), My Tasks, Safety Notices, Logs entry (deck/engine for their vessel), Feedback.
   - No hub launcher, no admin tabs (already enforced: bottom-nav hidden without hub-admin grant).

2. **Admin Area** — 5 hubs (the existing admin primaries):
   - **Maintenance** (`maintenance`)
   - **System Admin** (`system`)
   - **Crew Management** (`crew`)
   - **Logistics** (`logistics`)
   - **AI Analytics** (`analytics`)

### Hub front doors

Each hub gets **one** landing page and a small, named set of tabs (target ≤ 6 tabs/hub). Deep technical tooling (ML training, drift, governance, telemetry warehouse, transport settings) moves **one level down** into an "Advanced" tab so it's reachable but not in the operator's face.

---

## §9. Role / hub access matrix

Recommended role hierarchy (mapped onto existing role ids):

| Tier | Hierarchy role | Existing role ids that map here |
|---|---|---|
| 1 | **Super Admin** | `super_admin` |
| 2 | **Admin** | `admin`, `system_admin`, `company_admin` |
| 3 | **Manager / Dept Lead** | `fleet_manager`, `captain`, `vessel_master`, `chief_engineer`, `safety_officer`, `maintenance_planner` |
| 4 | **Supervisor** | `supervisor`, `chief_officer`, `second_engineer` |
| 5 | **Staff / Crew / Tech / Logistics** | `technician`, `crew_member`, `deck_officer`, `logistics_user`, `procurement_user`, ranks (`bosun`, `able_seaman`, …) |
| 6 | **Viewer / Auditor** | `viewer` |

### Hub visibility (recommended)

| Hub | Super Admin | Admin | Manager | Supervisor | Staff/Crew | Viewer |
|---|---|---|---|---|---|---|
| Maintenance | ✅ | ✅ | ✅ | ✅ (assigned) | �౷ (own WOs) | 👁 read |
| System Admin | ✅ | ✅ | ◔ (limited) | ❌ | ❌ | ❌ |
| Crew Management | ✅ | ✅ | ✅ (own dept) | ◔ | ❌ (self only) | 👁 read |
| Logistics | ✅ | ✅ | ✅ | ◔ | ◔ (requests) | 👁 read |
| AI Analytics | ✅ | ✅ | ✅ | 👁 read | ❌ | 👁 read |

Legend: ✅ full · ◔/◷ partial/own-scope · 👁 read-only · ❌ hidden.

> This matrix is the **target**. The current implementation derives hub access from `hubAdmin` + `hubAccess` (null = all) computed in `shared/role-dashboard.ts`. The recommendation is to seed default `hubAccess` per hierarchy tier instead of relying on per-account grants alone.

### Frontend ↔ backend gating reconciliation (flagged)

| Area | Frontend gate | Backend gate | Verdict |
|---|---|---|---|
| Attention Inbox | hidden for `deck_officer`/`viewer` | `requireAttentionInboxRole` | ✅ aligned |
| Safety Bulletins | list visible to all auth; create-only gated | create = `requireSafetyBulletinWriteRole`; **list open to all authenticated** | ✅ likely intentional (read-all, write-gated) — flagged needs-confirmation, not a confirmed gap |
| PdM platform routes | `PermissionGate` by `resource:action` | several routes use `requireRole` (role-name) | ⚠️ permission-grant users may be blocked by hardcoded role lists |
| Hub grant mutation | admin UI only | `requireSuperAdminRole` | ✅ aligned |

The **principle to enforce in implementation:** a page hidden in the UI must have a correspondingly authorized backend route; UI hiding alone is not a security control.

---

## §10. Per-role dashboard structure

The role-dashboard config (`shared/role-dashboard.ts`, `shared/schema/role-dashboards.ts`) already supports per-role widget sets + a visibility scope (`self` / `vessel` / `department` / `fleet`) with max-permissive merge for multi-role users. Recommended defaults:

| Role tier | Widgets | Scope |
|---|---|---|
| Super Admin / Admin | active_alerts, safety_status, upcoming_maintenance, user_tasks, fleet KPIs | fleet |
| Manager | active_alerts, upcoming_maintenance, safety_status, user_tasks | department/vessel |
| Supervisor | user_tasks, upcoming_maintenance, active_alerts | vessel |
| Staff / Crew | current_vessel, shift_status, user_tasks, safety_notices | self/vessel |
| Viewer | safety_status, active_alerts (read) | vessel |

Keep the "one high-impact question per widget" mapping already present (e.g. "Is it safe to operate right now?" → safety_status).

---

## §11. Hub plan — Maintenance

**Front door:** `/maint`. **Target tabs (≤6):** Overview · Work Orders · Schedules · Templates · Predictive (PdM) · Advanced.

- Collapse `pdm-dashboard`, `pdm-pack`, `pdm-schedule` into the **Predictive** tab; keep `pdm/equipment/:id` and `equipment/:id` as drill-downs.
- Move `digital-twin` + `/vessels/:id/3d` link under **Advanced**.
- Fix the dead `Acknowledge`/`Assign` buttons on the equipment hub before relocating.

## §12. Hub plan — System Admin

**Front door:** `/system`. **Target tabs (≤6):** Overview · Users & Roles · Configuration · Integrations · Audit & Diagnostics · Advanced.

- Merge `system-hub` overview cards + `diagnostics` into **Overview/Audit**.
- Pull the 8 settings routes (`settings`, `storage-settings`, `transport-settings`, `email-templates`, `email-alerts-settings`, `notification-settings`, `stormgeo-settings`, `permissions-settings`) under **Configuration** sub-tabs.
- Park `telemetry-upload`, `admin/telemetry-warehouse`, `copilot-admin`, `agent/activity` under **Advanced**.
- De-duplicate audit log + service health (currently in 3 places).

## §13. Hub plan — Crew Management

**Front door:** `/crew`. **Target tabs (≤6):** Roster · Scheduling · Hours of Rest · Certifications · Roles & Dashboards · Access.

- **Roster grouped by role:** the unified roster (`UnifiedCrewManagement`) should group rows by crew rank/role (Captain → Officers → Engineers → Ratings → Shore), collapsing the `crew-hub` vs `crew-management` overlap into one list.
- Fold `crew-scheduler` + `schedule-planner` into **Scheduling**.
- Keep Roles & Dashboards / Access tabs (admin-only) for permission management; fix the premature "config saved" toast.

## §14. Hub plan — Logistics

**Front door:** `/logistics`. **Target tabs (≤6):** Inventory · Purchase Requests · Suppliers · Service Orders/Requests · Optimization.

- The duplicate entry routes (`/vendors`, `/suppliers`, `/service-providers`, `/inventory-management`) already redirect to `/logistics?tab=…` — formalize this and remove the standalone nav entries.
- Resolve the `$—` cost display by verifying backend cost aggregation; show "not available" explicitly rather than implying zero.

## §15. Hub plan — AI Analytics

**Front door:** `/analytics`. **Target tabs (≤6):** Overview · Operations · Maintenance · Finance · Data Integrity · AI Studio/Models.

- Merge `ai-health-dashboard` into an **AI/Models** tab; fix its hardcoded stats first.
- Make `equipment-intelligence` the single risk view; the hub should **link** to sub-pages, not re-render their KPIs.
- Keep `ml-training`, `governance-dashboard`, `ai-sensor-audits`, `kb-analytics` reachable but under an Advanced/Models grouping (manager+).

## §16. Normal-User Area (separated)

Today the user portal is **Dashboard + Feedback** only — the bottom-nav hub launcher is correctly hidden without a hub-admin grant. Recommended additions for operational (non-admin) users, all role-scoped to self/vessel:

- **Today** (role dashboard widgets per §10)
- **My Tasks** / Attention Inbox (where permitted)
- **My Logs** — quick deck/engine entry for their vessel
- **Safety Notices** (read)
- **Feedback** (keep)

No hub tabs, no admin tooling. This keeps crew on a clean, task-first surface.

---

## §17. Backend / API cleanup recommendations

| Domain / route | Status | Recommendation |
|---|---|---|
| `/api/dp` (DP Monitoring) | backend, no UI | Decide: build a Fleet/OSV tab or remove. |
| `/api/charter`, `/api/vetting` | backend, no UI | OSV-specific — expose under Compliance or remove. |
| `/api/offshore-ops` | backend, no UI | Expose under Operations or remove. |
| `/api/efms` | backend, no UI | Expose under Logistics/Fuel or remove. |
| `/api/data-export` | admin/internal | Surface in System Admin → Advanced, or document as internal. |
| `/api/iot-processing`, `/api/sync`, `/api/software-updates` | system-to-system | Keep, document as non-UI; exclude from nav audits. |
| `/api/inventory/optimize` | sparse UI usage | Confirm `optimization-tools` is the intended consumer; otherwise mark preview. |
| Safety bulletins list | open to all authenticated | Confirm intended; align with UI implication. |
| `requireRole` vs `PermissionGate` mismatch | inconsistent | Standardize: routes should check the same permission model the UI uses, or the UI should gate by role name to match. |

---

## §18. Low-risk change bucket

Safe, mostly cosmetic or additive — do first.

- Remove/disable the two dead equipment-hub buttons (`Acknowledge`, `Assign`).
- Replace hardcoded AI Health stats with real queries (or hide until wired).
- Fix the analytics "Key Findings" fallback to distinguish empty vs. failed.
- Delete the two true orphan pages (`sensor-optimization.tsx`, `sensor-management.tsx`) after confirming no lazy import.
- Make success toasts (PDF export, dashboard save) fire only on settled mutations.
- Tidy duplicate nav entries that already redirect (logistics).

## §19. Medium-risk change bucket

Requires care + regression testing.

- Collapse the 4 health/risk dashboards into one canonical view with redirects.
- Merge the 8 settings routes under Configuration sub-tabs (keep deep links working).
- Consolidate PdM's 5 routes into the PdM Platform hub.
- Group the crew roster by role and unify `crew-hub`/`crew-management`.
- Reconcile `requireRole` vs `PermissionGate` on PdM and similar routes.

## §20. High-risk change bucket

Architectural / authorization — plan as separate tasks.

- Re-gate every hub/page to the recommended role hierarchy and seed default `hubAccess` per tier (touches the navigation policy + permissions service).
- Expose-or-remove decisions for the 6 backend-only domains (DP, Charter, Vetting, Offshore Ops, EFMS, Data Export) — each is a feature decision, not a refactor.
- Any change to logbook sign-off / hours-of-rest flows (statutory; needs compliance review).

---

## §21. Final prioritized roadmap

| Phase | Goal | Items | Risk |
|---|---|---|---|
| **P1 — Trust** | Stop showing fake/dead UI | §18 broken buttons, hardcoded stats, misleading fallbacks/toasts | Low |
| **P2 — Density** | One surface per concept | Collapse health dashboards, settings sprawl, PdM routes, logs consolidation | Medium |
| **P3 — Clarity** | Right role sees right thing | Crew roster by role, role-hierarchy hub gating, normal-user area | Medium → High |
| **P4 — Authorization** | UI hiding ⇒ backend enforcement | Reconcile `requireRole`/`PermissionGate`, safety-bulletin list gate | High |
| **P5 — Debt** | Resolve backend-only domains | Expose-or-remove DP/Charter/Vetting/Offshore/EFMS/Data Export | Medium |

Each phase is independently shippable. P1 is pure cleanup and can ship immediately; P3/P4 should be split into per-hub tasks to keep blast radius small.

---

## §22. High-Risk Button and Mutation Action Audit (Phase 1.5)

This section **updates and supersedes the needs-confirmation rows of §6** (items
7–9) with verified findings, and resolves the Equipment Hub contradiction (§6
items 1–2 described a now-superseded intermediate state where those buttons were
dead). Full detail: `docs/button-action-trust-verification.md`; machine-readable:
the `highRiskButtonAudit` key in the companion JSON.

**Method:** static source inspection — button → handler → mutation → backend
route → toast. Browser/runtime execution is not possible in the sandbox; the
runtime tier is authored as `tests/playwright/persona-nav.spec.ts` and the
existing `tests/playwright/journeys/equipment-hub-actions.spec.ts`.

**Truth legend:** `OK` = success only on real success, failure surfaces an error;
`SILENT-EDGE` = no false-positive but an empty/failure path is silent;
`BROKEN` = action can never succeed (missing/incorrect backend).

| Control | Mutation | Backend? | Truth | Recommendation | Risk |
|---|---|---|---|---|---|
| Equipment Hub — **Acknowledge** | `POST /api/equipment-intelligence/anomalies/:id/acknowledge` | ✅ | OK | KEEP | Low |
| Equipment Hub — **Assign** | `PUT /api/work-orders/:id` `{assignedCrewId,status:"in_progress"}` | ✅ | OK | KEEP | Low |
| System Admin — **Publish Update** | `POST /api/admin/patches/publish` (+ `/preview`) | ❌ **missing** | **BROKEN** | FIX-FIRST (build backend) or HIDE | Medium |
| ScheduleGenerator — **Export PDF toast** | client-side `jsPDF` (`exportTableToPDF`) | n/a | SILENT-EDGE | KEEP (optional polish) | Low |
| RolesDashboardsTab — **Save config** | `PUT /api/admin/role-dashboards/:roleId` | ✅ | OK | KEEP | Low |

**Resolutions:**

- **Equipment Hub Acknowledge/Assign** — the "dead button removed" report was an
  *intermediate* state; the current tree has both buttons **wired to real
  mutations and pinned by a journey test**. KEEP, no change.
- **Publish Update** — the form is fully rendered (incl. a Preview button), but
  **neither backend route exists** (`server/domains/software-updates/routes.ts`
  has only check/list/history/download/apply/rollback/backups). Every submit
  404s → error toast, so there is **no false success**, but the action can never
  succeed. This is a **missing backend feature**, documented not rebuilt
  (out of this pass's scope).
- **PDF export toast** — `exportTableToPDF` returns `false` on empty/failure and
  `true` only after save; the caller toasts only `if (success)` → **no
  false-positive**. The only gap is silence on the near-unreachable empty/failure
  path. KEEP (optional `else`-toast polish).
- **RolesDashboardsTab save** — toasts in **`onSuccess`** (not `onSettled`), with
  an `onError` failure toast; backend gated `requireSuperAdminRole`. The
  toast-on-settled concern was **unfounded**. KEEP.

**Net:** of the five high-risk controls, two are real + tested, two are correct
(no false success), and one is a missing-backend feature. **No production UI code
was changed in this pass** — confirmed-broken and edge-case items are documented
for a scoped follow-up.

---

*Generated as a read-only audit. No production routes, permissions, components, or behavior were modified. See `docs/ui-usefulness-density-audit.json` for the machine-readable, per-item dataset.*
