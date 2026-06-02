# Authenticated Navigation Verification

> **Status:** Static (code-inspection) verification of the post-cleanup navigation,
> hub gating, and route protection. Runtime browser login is **not possible in the
> sandbox** (Playwright cannot launch a browser here, and integration tests crash
> under cloud-mode db-config), so this pass verifies the **gating logic and route
> wiring by reading the source**, and pins the redirect contract with a unit test.
> **Date:** 2026-06-02
> **Companion tests:** `tests/unit/legacy-redirects-pdm.test.ts`,
> `tests/unit/navigation-canonical.test.ts`.

---

## 1. How navigation gating actually works (verified)

| Concern | Source of truth | Mechanism |
|---|---|---|
| Hub/route definitions | `client/src/config/navigationConfig.ts` | `navigationCategories` (8 categories), `routeResourceMap`, `ROUTE_HUB_MAP` |
| Role → portal | `client/src/application/navigation/role-navigation-policy.ts` | `getPortalForRole` ("admin" vs "user") |
| Role → visible hubs | same file | `getPrimaryCategoriesForRole`, `filterCategoriesByHubAccess` |
| Bottom-nav visibility | `client/src/components/BottomNav.tsx` | `isAdminPortalAccess` + `filterCategoriesByHubAccess` + per-user overrides |
| Route protection | `client/src/App.tsx` | `AdminPortalRouteGuard` (Tier 1 portal access → Tier 2 hub access via `permissions.hubAccess`) |
| Permission grants | `client/src/contexts/PermissionsContext.tsx` | `usePermissions`, `hasPermission(resource, action)`, `hubAdmin`, `hubAccess` (from `/api/permissions/me`) |
| Landing surface | `client/src/pages/home.tsx` | `HomePage` pivots: admin → `WorkflowCommandCenter`, user → `UserDashboard` |

**Two-tier client gate (verified in `AdminPortalRouteGuard`):**
1. **Portal access** — a non-admin-portal role hitting an admin route is redirected to `/`.
2. **Hub access** — an admin-portal user without the route's hub in `permissions.hubAccess`
   (resolved via `resolveRouteHubId`) is redirected.

**Security principle (confirmed against backend):** UI hiding is **not** the security
boundary — every gated route has a correspondingly authorized backend route. The
audit's four gating reconciliations (§4 below) confirm front/back alignment.

---

## 2. Persona / hub matrix (static expectation)

Derived from `getPrimaryCategoriesForRole` + the role templates. This is what the
gating logic **should** produce per persona. Runtime confirmation is deferred to
CI (Playwright `nav-matrix.spec.ts`), which exercises the same matrix in a browser.

| Persona (role id) | Portal | Hubs expected | PdM lifecycle (manage_config) |
|---|---|---|---|
| `super_admin` | admin | all | ✅ |
| `admin` | admin | all (system, maintenance, crew, logistics, analytics) | ✅ |
| `company_admin` | admin | all | ✅ |
| `fleet_manager` | admin | maintenance, crew, analytics (no system) | ❌ (view only via template) |
| `captain` / `vessel_master` | admin | maintenance, crew, analytics (scoped) | override only |
| `chief_engineer` | admin | maintenance, logistics, analytics | ✅ |
| `chief_officer` | admin | maintenance, crew (scoped) | ❌ (view only) |
| `technician` / `crew_member` | user | none (UserDashboard) | ❌ |
| `deck_officer` | user | none; Attention Inbox hidden | ❌ |
| `viewer` | user | read-only surfaces | ❌ |

> The PdM column reflects the template grants (see `docs/permission-backfill-notes.md`).
> For **existing** orgs seeded before the templates carried `predictive_maintenance`,
> admin/super_admin will be missing the grant until the backfill is applied — that is
> the one known runtime gap and it is fixed by the backfill script, not a code defect.

---

## 3. Legacy route / redirect verification (Phase 2)

The Phase-1 cleanup folded the standalone PdM routes into the Equipment
Intelligence and PdM Platform hubs. Redirects are configured in
`routeMigrations` (`navigationConfig.ts`) and consolidated into `legacyRedirects`
(`client/src/routes/legacy-redirects.ts`); `buildRedirectTarget` (`App.tsx`)
merges the live `window.location.search` (query) and `.hash` (deep link) onto the
target so tab deep-links survive.

| Legacy route | Canonical target | Verified |
|---|---|---|
| `/pdm-dashboard` | `/equipment-intelligence` | ✅ unit test |
| `/health-monitor` | `/equipment-intelligence` | ✅ unit test |
| `/pdm-pack` | `/pdm-platform?tab=diagnostics` | ✅ unit test (tab preserved) |
| `/pdm/schedule` | `/pdm-platform?tab=schedule` | ✅ unit test (tab preserved) |

Other consolidations (`/compliance/findings`, `/inventory-management`,
`/vendors`, `/deck-logbook`, `/engine-logbook`, `/devices`, …) remain wired in
`routeMigrations`. `navigation-canonical.test.ts` additionally pins that no
in-app link builds a dead `"/maint?…"`, `"/crew?…"`, or `"/system?…"` hub-query
URL, and that `legacyRedirects` stays populated.

**Result:** all four retired PdM routes resolve to a non-self, non-empty
canonical target with tab deep-links preserved. Pinned by
`tests/unit/legacy-redirects-pdm.test.ts` (4 tests, passing).

---

## 4. Frontend ↔ backend gating reconciliation (Phase 4)

From the audit (`gatingMismatches`), re-verified against current source:

| Area | Frontend gate | Backend gate | Verdict |
|---|---|---|---|
| Attention Inbox | hidden for `deck_officer`/`viewer` | `requireAttentionInboxRole` | ✅ aligned |
| Safety Bulletins list | list visible to all auth; create gated | list open to all auth; create = `requireSafetyBulletinWriteRole` | ✅ intentional read-all / write-gated (documented inline on GET route) |
| PdM platform routes | `PermissionGate` / hub gate on `predictive_maintenance` | lifecycle mutations use `requirePermission("predictive_maintenance","manage_config")` | ✅ resolved — both sides gate on the resource (backfill closes the data gap for old orgs) |
| Hub grant mutation | admin UI only | `requireSuperAdminRole` | ✅ aligned |

No remaining front/back gating **mismatch**. The only residual is a **data**
gap (missing grants on pre-existing orgs), addressed by the backfill — not a
code mismatch.

---

## 5. Button / action trust re-verification (Phase 4)

The audit's `brokenActions` flagged as **verified** were re-read in current source:

| Control | File | Previous issue | Current state |
|---|---|---|---|
| `Acknowledge` | `equipment-hub.tsx` | no `onClick` (dead) | ✅ wired to `acknowledgeAnomaly()`, `disabled` when no active anomaly, pending state |
| `Assign` | `equipment-hub.tsx` | no `onClick` (dead) | ✅ wired to `assignWork({workOrderId, crewId})` against real WO/crew data |
| `Models Active` | `ai-health-dashboard.tsx` | hardcoded `3` | ✅ bound to deployed-model count; `—` while loading |
| `Last Training` | `ai-health-dashboard.tsx` | hardcoded `"7 days ago"` | ✅ computed from data; `"No training yet"` when none |
| Analytics Key Findings | `analytics-hub.tsx` | "all normal" masked failures | ✅ distinguishes `hasErrors` ("Findings unavailable…") from genuinely-empty |
| Logistics cost | `logistics-hub.tsx` | `"$—"` on null | ✅ `formatCurrency` returns `"N/A"`; bound to real `estimatedTotalCost` |

**Reported-but-unverified** items from the audit (`confidence: "reported"`) were
**resolved in the Phase-1.5 pass** — see `docs/button-action-trust-verification.md`:
`system-administration` "Publish Update" is **confirmed broken** (the frontend
calls `POST /api/admin/patches/publish` + `/preview`, but **neither backend route
exists** → 404; documented, not rebuilt); `ScheduleGeneratorPanel` PDF toast has
**no false-positive** (success fires only on real success) with only a silent
empty/failure edge path; `RolesDashboardsTab` save toasts in **`onSuccess`** (not
`onSettled`) — the concern was unfounded.

---

## 6. Verification tiers (Phase 1.5)

This verification is delivered in **three explicit tiers**. Be precise about
which claim rests on which tier.

### 6a. Static verification (done — source inspection)
The gating logic, route wiring, and front/back reconciliation in §§1–5 are
verified by **reading current source**. No browser involved.

### 6b. Automated runtime-logic verification (done — runs in sandbox + CI)
Deterministic tests that exercise the **policy layer** the runtime consumes:

| Test | What it pins |
|---|---|
| `tests/unit/persona-navigation.test.ts` | All **11 personas** → correct portal + exactly the allowed hubs; partial-admin hub subsetting; tampered override can't widen hubs. |
| `tests/unit/legacy-redirects-pdm.test.ts` | Retired PdM routes resolve to canonical targets (tab deep-links preserved). |
| `tests/unit/navigation-canonical.test.ts` | No in-app link builds a dead hub `?query` URL; `legacyRedirects` stays wired. |
| `tests/unit/pdm-backfill-planner.test.ts` | Backfill safety (idempotent, no dup, no re-enable, scoped). |

Run: `npx jest tests/unit --forceExit`.

### 6c. Manual / browser runtime verification (still required — CI or local only)
True login → landing → nav visibility → direct-URL block → logout → re-login
**cannot run in the sandbox** (Playwright cannot launch a browser; integration
tests crash under cloud-mode db-config). Authored and ready for CI:

| Spec | Coverage | Command |
|---|---|---|
| `tests/playwright/persona-nav.spec.ts` | 11 personas: client-role personas via `ROLE_STORAGE_KEY`; hub-grant admins (Maintenance/Crew/Logistics/none) via seeded users from env (`PERSONA_ADMIN_*_USER/PASS`), `test.skip` when absent. | `npx playwright test persona-nav` |
| `tests/playwright/nav-matrix.spec.ts` | roles × viewports nav regression. | `npx playwright test nav-matrix` |

**Still-required manual steps** before declaring runtime green: (1) seed the four
hub-grant admin users and supply their env creds; (2) run both Playwright specs
in CI / on a browser-capable host; (3) confirm a revoked hub disappears after
re-login (the seeded-persona re-login assertion covers this once creds exist).

---

## 7. Persona coverage matrix (Phase 1.5)

| # | Persona | Tier 6b (unit) | Tier 6c (browser) |
|---|---|---|---|
| 1 | Super Admin | ✅ | ✅ client-role |
| 2 | Admin (all hubs) | ✅ | ✅ client-role |
| 3 | Admin — Maintenance only | ✅ (hub filter) | ⏳ seeded user |
| 4 | Admin — Crew only | ✅ (hub filter) | ⏳ seeded user |
| 5 | Admin — Logistics only | ✅ (hub filter) | ⏳ seeded user |
| 6 | Admin — no hubs | ✅ (hub filter) | ⏳ seeded user |
| 7 | Maintenance user (chief_engineer) | ✅ | ✅ client-role |
| 8 | Crew user | ✅ | ✅ client-role |
| 9 | Logistics user | ✅ | ✅ client-role |
| 10 | Viewer / Auditor | ✅ | ✅ client-role |
| 11 | Normal user (deck_officer) | ✅ | ✅ client-role |

✅ = covered & runnable now (unit) / authored (browser); ⏳ = authored, needs a
seeded backend user + browser host to execute.

---

## 8. Limitations of this verification

- **No live login in the sandbox.** Browser + integration tests cannot run here;
  the runtime tier (6c) is authored but executes only in CI / a browser host.
- **Hub-grant admins need seeded users.** Personas 3–6 depend on server
  `hubAccess` from `/api/permissions/me`, which a localStorage hint cannot set —
  they require real seeded accounts (env-driven, skipped when absent).
- **Backfill verified by dry-run + unit tests.** The DB path runs in CI/staging;
  the decision logic is pinned by `pdm-backfill-planner.test.ts` (runs here).
