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

## 2a. Immediate cleanup — pre-existing hex-storage drift (do first)

As of 2026-06-14 the `hex-storage` guard is **already red against its baseline**: HEAD
has **157** raw-DB-access files vs. the 146-file baseline (generated 2026-06-10) — **12
new** violations and **1 resolved**. This drift accrued after the baseline and is
unrelated to the governance changes in Phase 0; folding `check:hex-storage` into
`check:guards` simply surfaces it. **Do not raise the baseline to hide these** — fix the
files (move DB access into an `infrastructure/` adapter or a `server/repositories` port),
then regenerate the baseline downward.

New violations to fix (then `node scripts/check-hex-storage-boundaries.mjs --write-baseline`):

- `server/composition/access-seeding.ts`
- `server/domains/agent/application/suggestion-engine-support.ts`
- `server/domains/permissions/repository-access-queries.ts`
- `server/purchasing/po-fulfillment-routes.ts`
- `server/routes/service-request-edit-routes.ts`
- `server/routes/service-request-read-routes.ts`
- `server/routes/service-request-review-routes.ts`
- `server/routes/wo-so-bridge-operations.ts`
- `server/services/domains/work-order-service-operations/{clone,completion,lifecycle,queries}.ts`

Also drop the now-resolved entry `server/routes/service-request-routes.ts` from the
baseline (a legitimate ratchet-down).

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

## 4. Phasing

Ordered for dependency safety, mirroring the extraction order in
`docs/architecture/bounded-contexts.md` (Fleet/Asset cores stabilize before their
consumers). Each phase is independently shippable.

| Phase | Scope | Outcome |
|---|---|---|
| **0** | Governance scaffolding + this plan (landed) | Ratchets in place |
| **1** | **Reference conversion:** `alerts` end-to-end | Canonical template; refine recipe/ADR |
| **2** | High-traffic flat domains: `compliance`, `condition-monitoring`, `logbook`, `notifications`, `scheduling`, `sync` | Largest leak concentration removed |
| **3** | Telemetry/sensing: `telemetry` (partial→full), `sensors`, `sensor-management`, `iot-processing`, `devices` | Highest-volume context layered |
| **4** | ML/analytics: `ml-analytics`, `ml-pipeline`, `pdm-platform`, `insights`, flat `equipment` family | Predictive path layered |
| **5** | Remaining flat tail + partials: `permissions`, `settings`, `system-admin`, `me-portal`, `workflow`, long tail; resolve the 5 cross-domain import allowlist entries | `flat`/`partial` → near zero |
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
