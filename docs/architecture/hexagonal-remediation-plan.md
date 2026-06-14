# Hexagonal Architecture Remediation Plan

> **Date:** 2026-06-14
> **Companion to:** `docs/architecture/hexagonal-architecture-assessment.md`
> **Policy:** `docs/adr/003-domain-layering-policy.md`
> **Goal:** Convert all flat/partial domains to the full 4-layer hexagonal structure and
> drive the `hex-storage` (146) and `domain-leak` (582) baselines to zero — as an
> enforced, ratcheting, phase-by-phase program.

---

## 1. Why

The assessment found ARUS is *pragmatically* hexagonal: 16 of 62 domains are fully
4-layered, 6 partial, 40 flat. The remaining structural debt is captured by guard
baselines:

| Baseline | Metric | Current |
|---|---|---|
| `domain-conformance-baseline.json` | full / partial / flat domains | 16 / 6 / 40 |
| `hex-storage-baseline.json` | raw DB access outside `infrastructure/` | 146 files |
| `domain-leak-baseline.json` | dynamic imports / route-storage / cross-domain storage | 399 / 103 / 80 (582) |
| `duplicate-types-baseline.json` | duplicate domain types (8 hard-gated to 1) | 225 |

All are monotonic ratchets: CI blocks any increase, so the program cannot regress while
it progresses.

## 2. What changed already (Phase 0 — landed)

- **Governance scaffolding** so progress is measurable and regressions are blocked:
  - `scripts/check-domain-conformance.mjs` + `scripts/domain-conformance-baseline.json`
    classify and pin domain layering (full may only grow; flat/partial may only shrink).
  - `check:hex-storage` **and** `check:domain-conformance` folded into `npm run check:guards`
    (`check:hex-storage` was previously CI-only), plus an explicit CI step.
  - `docs/adr/003-domain-layering-policy.md` makes the 4-layer target authoritative.
- **Documentation drift fixed:** `docs/architecture/backend-modules.md` rewritten to the
  4-layer model; reconciliation note added to `docs/architecture/bounded-contexts.md`.

## 2a. Immediate cleanup — pre-existing hex-storage drift (DONE — 2026-06-14)

When `check:hex-storage` was folded into `check:guards`, the guard went **red against its
baseline**: HEAD had **157** raw-DB-access files vs. the 146-file baseline (generated
2026-06-10) — **12 new** violations and **1 resolved**. Investigation showed the drift was
**not new debt**: 11 of the 12 files were added on 2026-06-12 by the "Reduce long-file
baseline to 68" refactor, which split four files **already on the hex-storage baseline**
(`work-order-service.ts`, `service-request-routes.ts`, `wo-so-bridge-routes.ts`,
`po-routes.ts`) into smaller helper modules. The db imports rode along into the split
pieces, so the same debt simply spread across more files — inflating the file count the
guard tracks. Every new leaker was a private helper imported by exactly one already-
baselined parent.

Resolution (no baseline growth — the guard is now green at **146 == baseline**):

- **Genuine fixes (debt reduced):**
  - `server/composition/access-seeding.ts` — imported only `isLocalMode` (a mode flag, not
    the db handle); repointed to its real source `server/config/runtimeEnv`.
  - `server/domains/permissions/repository-access-queries.ts` — pure data-access helper;
    moved into `server/domains/permissions/infrastructure/` (the sanctioned db layer).
- **Consolidate via injection** — for the split helpers of baselined parents, the parent
  (the single owner of the db import) now injects the handle/port into its helpers, so the
  helpers no longer import the db barrel. A type-only `import type { db }` provides the
  injected-handle type without a runtime dependency (type-only imports are exempt). Applied
  to: `service-request-{read,edit,review}-routes.ts` (parent `service-request-routes.ts`),
  `work-order-service-operations/{clone,completion,lifecycle,queries}.ts` (parent
  `work-order-service.ts`), `wo-so-bridge-operations.ts` (parent `wo-so-bridge-routes.ts`),
  `po-fulfillment-routes.ts` (parent `po-routes.ts`), and
  `agent/application/suggestion-engine-support.ts` (caller `suggestion-engine.ts`).

Injection is a **stopgap consolidation**, not the end state — these parents are still on
the baseline and remain targets for the per-domain conversion (§3) and the Phase 6
drive-to-zero. The point was to restore a green ratchet without hiding debt.

## 3. The per-domain conversion recipe

This is the repeatable template every conversion PR follows. It is derived from the
already-converted domains (`maintenance`, `inventory`, `crew-tasks`, `work-orders`).

**Key invariant:** `infrastructure/` is the **only** layer allowed to import
`server/db/*` or the `server/repositories` barrel (enforced by `check:hex-storage` and
`check:domain-repositories-imports`). Adapters wrap the existing
`db*Storage`/`server/repositories` surface — no schema is moved.

Using `alerts` as the worked example:

1. **`domain/`** — pure, imports nothing outside `./`:
   - `types.ts` — entities & command types (e.g. `AlertEntity`, `CreateAlertCommand`).
   - `events.ts` — typed domain events (e.g. `AlertConfiguredEvent`, `AlertFiredEvent`).
   - `ports.ts` — interfaces per current repository (`IAlertRepository`,
     `IAlertSettingsRepository`, `IEventPublisher`, `IEmailAdapter`).
2. **`infrastructure/`** — adapters implementing the ports; the only DB-touching layer:
   - `alert-repository-adapter.ts` — wraps `dbAlertStorage` (today imported by
     `alerts/repository.ts`), `implements IAlertRepository`, maps rows → domain entities.
   - `event-publisher-adapter.ts` — wraps the domain event bus, `implements IEventPublisher`.
   - mirror existing reference: `server/domains/maintenance/infrastructure/schedule-repository-adapter.ts`.
3. **`application/`** — use-case orchestration with constructor DI:
   - `alerts-service.ts` — `AlertsApplicationService` taking ports in its constructor
     (move business logic out of the flat `service.ts`).
   - `index.ts` — composition root: instantiate adapters from `infrastructure/`, inject
     into the service, export the wired singleton (mirror
     `server/domains/maintenance/application/index.ts`).
4. **`interfaces/`** — HTTP layer:
   - `routes.ts` (+ `settings-routes.ts`) — call the application service singleton; never
     import adapters or `dbAlertStorage` directly. Preserve the exact public route paths.
   - `index.ts` — export `registerAlertsRoutes(app, deps)` etc.
5. **Domain `index.ts`** — `export * from "./domain" | "./application" | "./infrastructure" | "./interfaces"`.
   Registration continues via `server/routes/domain-router-registry.ts` /
   `domain-router-config-core.ts` — the registry entry's `functionName` is unchanged, so
   no wiring churn.
6. **Background jobs / evaluators** (`alert-runner.ts`, `crew-alert-evaluators.ts`) — pure
   logic moves into `domain/`; side-effecting wrappers become `interfaces/`/`infrastructure/`
   adapters that delegate to the application service.
7. **Lock in the gains** — regenerate baselines downward and confirm counts dropped:
   ```
   node scripts/check-hex-storage-boundaries.mjs --write-baseline
   node scripts/check-domain-leaks.mjs --write-baseline
   node scripts/check-domain-conformance.mjs --write-baseline
   ```

**Per-PR checklist:** no public route changes · `requireOrgId` untouched ·
`npm run check` green · `npm run check:guards` green · baselines strictly lower ·
behavior covered by existing integration tests.

## 3a. Phase 1 status — `alerts` (landed)

The **alerts core** (configurations, notifications, suppressions, comments,
escalation, clear-all) is fully converted to the 4-layer structure and is the
canonical worked example of the recipe above:

- `domain/` — `types.ts` (entity/command aliases over `@shared/schema` + the
  `AlertsWsBroadcaster` transport contract), `events.ts` (entity-type/operation
  value space), `ports.ts` (`IAlertRepository`, `IAlertEventPublisher`,
  `IAlertRealtimeNotifier`, `IWorkOrderEscalator`).
- `infrastructure/` — `alert-repository-adapter.ts` (wraps `dbAlertStorage`; the
  only alerts layer touching `server/repositories`), `event-publisher-adapter.ts`
  (wraps `recordAndPublish`, MQTT reliable-sync, ack metrics), and
  `work-order-escalation-adapter.ts` (lazy `workOrderService` delegate — replaces
  the route's old `await import("../../repositories")`, which the repos-imports
  guard now forbids in `interfaces/`).
- `application/` — `AlertsApplicationService` (constructor DI of the four ports)
  + `index.ts` composition root exporting the wired `alertsAppService`.
- `interfaces/` — `routes.ts` calling the app service; **exact public route paths
  preserved**. Escalation's work-order WebSocket broadcast is passed as an
  `onWorkOrderCreated` callback so `interfaces/` stays off `server/repositories`.
- Old flat `repository.ts`/`service.ts`/`routes.ts` removed; `index.ts` re-exports
  the layers and keeps the pre-conversion public names as aliases.

Result: `alerts` moved **flat → full** (conformance baseline regenerated:
17 full / 7 partial / 38 flat); `check`, `check:guards`, and the public-api-paths
audit are green.

**Phase 1b — crew evaluator decoupling (landed).** The crew alert evaluators no
longer reach into `dbCrewStorage` via the repositories barrel. They now depend on
an injected `ICrewAlertDataPort` (declared in `evaluators/types.ts` and carried on
`EvaluationContext`); the concrete adapter lives in
`server/composition/alert-crew-data.ts` — **outside `server/domains/`**, which is
the key trick: any file *under* `alerts/` that names `dbCrewStorage` is counted as
a cross-domain leak (the checker regex matches even comments/types), so the
adapter must live in the composition layer. The provider is wired through the
`AlertSettings` route deps (registry → `registerAlertSettingsRoutes` →
`runCrewAlerts`/`runAllCrewAlertEvaluators`). Result: the three `alerts → crew`
cross-domain leaks are gone (domain-leak baseline regenerated 582 → 579).

**Still deferred (flat support under `alerts/`):** the **settings** subsystem
(`settings-*.ts`, `settings/*`) and `email-templates-service.ts` (structural
reorg into layers — no cross-domain leak delta); `hor-alerts.ts`'s `dbStcwStorage`
and `alert-runner.ts`'s `vesselService`/`dbUserStorage` (not currently counted by
the leak heuristic, but the same composition-port pattern applies); and physically
relocating the evaluators/runner into the hexagonal layer folders. Each is a
self-contained follow-up.

## 4. Phasing

Ordered for dependency safety, mirroring the extraction order in
`docs/architecture/bounded-contexts.md` (Fleet/Asset cores stabilize before their
consumers). Each phase is independently shippable.

| Phase | Scope | Outcome |
|---|---|---|
| **0** | Governance scaffolding + this plan (landed) | Ratchets in place |
| **1** | **Reference conversion:** `alerts` core (landed); **1b** crew-evaluator decoupling (landed); settings/email reorg + evaluator relocation remain | Canonical template; refine recipe/ADR |
| **2** | High-traffic flat domains (landed): `notifications`, `condition-monitoring`, `compliance`, `scheduling` full; `logbook` corrections slice full (deck/engine flat support); `sync` inventory-decoupled via composition seam (flat; full layering deferred) | Largest leak concentration removed |
| **3** | Telemetry/sensing (landed): `devices`, `telemetry` (partial→full), `sensors`, `sensor-management` full; `iot-processing` flat (no storage — orchestration, deferred) | Highest-volume context layered |
| **4** | ML/analytics: `insights` + `ml-pipeline` leak-decoupled (landed; flat); `equipment` (landed) **partial→full** — lifecycle slice + all hex-storage + cross-domain entries cleared, then `routes.ts`/`lifecycle-routes.ts`→`interfaces/`; `ml-analytics` (landed) **partial→full**; `pdm-platform` (landed) **partial→full** — meta-domain already leak-free + storage-confined; added aggregated top-level `domain/`/`application/`/`interfaces/` barrels over its layered sub-contexts, registry now mounts the 15 sub-routers via the `interfaces/` barrel | Predictive path layered |
| **5** | Remaining flat tail + partials: `workflow` (landed) **partial→full** — top-level `infrastructure/` barrel aggregating the operator-experience sub-context adapters; `permissions`, `settings`, `system-admin`, `me-portal`, long tail remain; resolve the 5 cross-domain import allowlist entries | `flat`/`partial` → near zero |
| **6** | Drive baselines to zero: hex-storage 146→0; domain-leaks 582→0 (static imports, route-storage→service, cross-domain storage→events/ports); flip 8 duplicate-type hard-gates to 1 | Debt eliminated |
| **7** | **Lock-in:** make `check:domain-conformance` a hard gate (no flat allowed); drop the burn-down affordance | Architecture self-enforcing |

## 5. Tracking & guardrails

- Every phase PR must **lower, never raise** the `hex-storage`, `domain-leak`, and
  `domain-conformance` baselines; CI enforces this automatically.
- **No public route surface changes** during conversion — `interfaces/` keeps identical
  paths; `requireOrgId` and the public-api-paths allowlist
  (`server/bootstrap/public-api-paths.ts`) remain untouched.
- **Schema stays centralized** in `shared/schema/*` per ADR-002 (single-tenant);
  adapters are the anti-corruption layer, not new schema ownership.
- Prefer **static imports over `await import()`** when converting, to shrink the
  `dynamicImports` leak category — except where lazy loading is required for boot order.

## 6. References

- Recipe exemplars: `server/domains/{maintenance,inventory,crew-tasks,work-orders}/`
- Registry: `server/routes/{domain-router-registry,domain-router-config-core}.ts`
- Guards: `scripts/check-{hex-storage-boundaries,domain-leaks,domain-repositories-imports,domain-conformance}.mjs`
- Baselines: `scripts/{hex-storage,domain-leak,domain-conformance,duplicate-types}-baseline.json`
- Policy & assessment: `docs/adr/003-domain-layering-policy.md`,
  `docs/architecture/hexagonal-architecture-assessment.md`
