# Hexagonal Architecture Assessment — ARUS

> **Date:** 2026-06-14
> **Scope:** `server/domains/**`, the architecture guard scripts (`scripts/check-*.mjs`),
> their baselines (`scripts/*-baseline.json`), CI wiring (`.github/workflows/ci.yml`),
> and the stated intent in `CLAUDE.md` + `docs/architecture/` + `docs/adr/`.
> **Method:** static reading of the codebase and guard machinery; all counts below were
> read directly from HEAD baselines and a layer-directory census, not estimated.

---

## 1. Executive summary

ARUS is a **pragmatically hexagonal** codebase. Ports-and-adapters is implemented
*properly* where domain complexity justifies it — a minority of rich domains have a
clean `domain → application → infrastructure → interfaces` split with explicit ports,
constructor dependency injection, and adapter implementations. The remainder are flat
`routes/service/repository` modules with no formal ports.

What makes the architecture credible is not uniform purity but **automated, ratcheting
enforcement**: ~20 guard scripts gate every CI run, several boundaries are at zero
violations and hard-gated, and the remaining debt is captured in monotonic burn-down
baselines that can only shrink. The architecture is *enforced and converging*, not
aspirational-and-decaying.

The main weaknesses are (1) the large flat tail (44 of 62 domains are not fully
layered), (2) a sizeable transitional debt in raw-DB-access and storage-coupling
baselines, and (3) documentation drift — the primary backend-architecture doc still
describes a superseded 3-layer pattern.

### Maturity scorecard

| Dimension | Rating | Basis |
|---|---|---|
| Layering fidelity | 🟠 Partial | 16/62 fully 4-layer; 40 flat; 6 partial |
| Ports & dependency inversion | 🟢 Strong (where present) | Explicit `domain/ports.ts`, constructor DI, adapters |
| Dependency direction | 🟢 Strong | Domain pure; application imports only ports/types |
| Storage boundary (raw DB in infra only) | 🟠 Transitional | 146 grandfathered violations, ratcheting down |
| Cross-domain isolation | 🟢 Strong | 0 violations + 5 explicit allowlist entries |
| Domain→repositories injection | 🟢 Clean | 0 violations, hard gate |
| Enforcement rigor | 🟢 Strong | ~20 CI guards, monotonic baselines |
| Documentation accuracy | 🔴 Drifted | `backend-modules.md` describes a superseded pattern |

---

## 2. The intended model

Per `CLAUDE.md`, each domain under `server/domains/<domain>/` should split into four
layers:

- **`domain/`** — pure business model: entities, value objects, domain events, and
  **ports** (interfaces) that adapters must implement. No external dependencies.
- **`application/`** — use-case orchestration; depends only on domain ports/types and
  receives adapters via dependency injection.
- **`infrastructure/`** — adapters implementing the ports; the **only** place allowed
  to hold a raw DB handle (raw DB access also permitted in `server/db/<area>/`).
- **`interfaces/`** — HTTP handlers/routes that call the application service.

Cross-domain imports are forbidden. The canonical schema lives in `shared/schema/*`
(dual PostgreSQL/SQLite) and is shared by all domains.

---

## 3. Layering fidelity

A directory census of the **62** domains under `server/domains/`:

| Shape | Count | Notes |
|---|---|---|
| Full 4-layer (`domain/`+`application/`+`infrastructure/`+`interfaces/`) | **16** | The hexagonal core |
| Partial (1–3 of the four layers) | **6** | `me-portal`, `ml-analytics`, `pdm-platform`, `system-admin`, `telemetry`, `workflow` |
| Flat (no standard layer dirs) | **40** | `routes.ts`/`service.ts`/`repository.ts` or thinner |

**Fully layered (exemplars):** `agent`, `certificates`, `crew`, `crew-admin`,
`crew-extensions`, `crew-tasks`, `equipment-intelligence`, `inventory`, `maintenance`,
`purchasing`, `safety-alarms`, `safety-bulletins`, `scheduled-reports`,
`schematic-layout`, `vessel-diagram-registry`, `work-orders`.

**Flat (examples):** `alerts` (`alert-runner.ts`, `service.ts`, `repository.ts`,
`routes.ts`, …), `sensors` (just `index.ts` + `routes.ts`), `permissions`
(`service.ts`/`repository.ts`/`middleware.ts`/routes, no ports).

Interpretation: layering tracks domain richness. Complex domains with real invariants
and lifecycle events earn the full hexagon; CRUD/utility/integration domains stay flat.
This is a defensible pragmatic stance — but today it is *implicit*, with no recorded
policy on which domains are intentionally exempt (see §8).

---

## 4. Ports & dependency inversion (where present)

In the layered domains the pattern is textbook ports-and-adapters.

**Ports are explicit** — `server/domains/maintenance/domain/ports.ts`:

```ts
export interface IMaintenanceScheduleRepository {
  findAll(orgId: string, equipmentId?: string, status?: string): Promise<MaintenanceScheduleEntity[]>;
  findById(id: string, orgId?: string): Promise<MaintenanceScheduleEntity | undefined>;
  create(schedule: CreateScheduleCommand): Promise<MaintenanceScheduleEntity>;
  // …
}
export interface IEventPublisher {
  publish(event: MaintenanceDomainEvent): Promise<void>;
}
```

**Application depends on abstractions, wired via constructor DI** —
`maintenance/application/maintenance-service.ts` takes `IMaintenanceScheduleRepository`,
`IMaintenanceTemplateRepository`, `IEventPublisher`; the composition (`application/index.ts`)
instantiates the concrete adapters from `infrastructure/` and injects them. The domain
layer imports nothing external; the application layer imports only `type`s from
`../domain/*`.

**A genuinely advanced port: the transactional outbox** —
`server/domains/work-orders/domain/ports.ts`:

```ts
publish(event: WorkOrderDomainEvent, tx?: unknown): Promise<PostCommitEmit | null>;
publishBatch(events: WorkOrderDomainEvent[], tx?: unknown): Promise<PostCommitEmit | null>;
```

The publisher accepts the transaction and returns a post-commit hook, so in-process
emission is deferred until after the DB commits — avoiding the classic "event fired,
transaction rolled back" inconsistency. This is a sign of real architectural maturity
in the core domains.

In the flat domains there are no ports: e.g. `alerts/service.ts` imports the concrete
`alertsRepository` directly, and `sensors/routes.ts` accesses the DB inline in handlers.

---

## 5. Boundary enforcement

Architecture is enforced by regex guard scripts (not ESLint import rules) wired into
CI. `npm run check:guards` aggregates ~20 checks; the storage-boundary guard runs
separately in CI (`.github/workflows/ci.yml`) and via `check:contract-ratchets`.

| Guard (script) | What it enforces | Status @ HEAD |
|---|---|---|
| `check:domain-boundaries` | No cross-domain imports between `server/domains/X` and `…/Y` | **0** violations; 5 allowlisted exceptions (mostly `permissions/middleware`) |
| `check:domain-repositories-imports` | `domain`/`application`/`interfaces` may not import `server/repositories` directly (must use ports + DI) | **0** violations (hard gate) |
| `check:hex-storage` | Raw DB handle (`server/db/*`, `server/db-config`) only in infrastructure / allowed layers | **146** grandfathered (burn-down) |
| `check:domain-leaks` | Dynamic imports, route-level `db*Storage`, cross-domain `db*Storage` | **582** total (burn-down) |
| `check:type-debt` → `check:dup-types` | Duplicate exported domain types | **225** tracked; 8 canonicals hard-gated to reach 1 |
| `check:type-debt` → `check:typed-casts` | `as <ConcreteType>` casts | **1020** (ratchet-down) |
| `check:type-debt` → `check:zod-escape` | `z.any`/`z.unknown`/`passthrough`/`catchall` escape hatches | **22** allowlisted; new hits fail CI |
| `check:ts-burndown` (CI) | TypeScript compile errors | **0** |
| `check:route-registration` | Routes registered only via the domain-router-registry | enforced |
| `check:schema-imports` / `check:storage-imports` | Server uses `shared/schema-runtime`; retired `server/storage.ts` banned | enforced |

All baselines are **monotonic-decrease**: a regenerate-only ratchet. The repeated
`NEVER add new entries — refactor instead` notes in the baseline files show the intent
is one-way decay toward zero.

---

## 6. Where the architecture leaks

1. **Raw DB access outside infrastructure — 146 files** (`hex-storage-baseline.json`).
   The hexagon's most important invariant (DB handle confined to adapters) is the
   most-violated, spread across legacy service-layer code and not-yet-converted domains.
   Capped and shrinking, but the single largest structural debt.

2. **Domain leaks — 582 total** (`domain-leak-baseline.json`):
   - **399 dynamic imports** — `await import()` defeats static boundary analysis and
     hides coupling (much of it legitimate boot/scheduler wiring, but it weakens the
     guarantees the other guards provide).
   - **103 route-level `db*Storage`** accesses — interfaces reaching past the service
     layer straight to storage.
   - **80 cross-domain `db*Storage`** references — domain X reading another domain's
     storage handle, i.e. logical cross-domain coupling that the *import*-based
     cross-domain guard does not catch.

3. **Schema centralization trade-off.** `shared/schema/*` is shared by all domains, so
   domains do not own their persistence model. This is a deliberate compromise for the
   dual PG/SQLite single-tenant design, but it means "infrastructure-only DB access"
   is the real isolation boundary — and that boundary still has 146 holes.

4. **Type duplication — 225.** Repeated domain types blur model ownership; the 8
   hard-gated canonicals (`Vessel`, `Equipment`, `TelemetryReading`, `CrewMember`,
   `Crew`, `WorkOrder`, `WorkOrderTask`, `WorkOrderPart`) are already collapsed toward 1.

---

## 7. Documentation drift

- **`docs/architecture/backend-modules.md` is stale.** It documents the superseded
  3-layer `index.ts/routes.ts/service.ts/repository.ts` module pattern and a
  routes.ts-deduplication migration, contradicting the 4-layer hexagonal model in
  `CLAUDE.md` and the actual `server/domains/` tree. A contributor following this doc
  would build the wrong shape.
- **`docs/architecture/bounded-contexts.md`** maps ~160 tables to **8 bounded
  contexts** with a microservices-extraction roadmap, but the runtime split is **62
  domains** — far finer-grained and not aligned 1:1 with the 8 contexts. The two views
  are useful but unreconciled.

---

## 8. Recommendations (prioritized)

1. **Fix the docs (low effort, high value).** Rewrite or deprecate
   `backend-modules.md` to describe the 4-layer hexagonal model, and add a short note
   reconciling the 62 runtime domains with the 8 bounded contexts in
   `bounded-contexts.md`. Make `CLAUDE.md` the single source of truth and link to it.
2. **Keep ratcheting the two big baselines down.** `hex-storage` (146) and
   `domain-leaks` (582) are the real structural debt. Prioritize converting the
   highest-traffic flat domains' DB access into `infrastructure/` adapters, and prefer
   static imports over `await import()` where feasible.
3. **Record the layering policy as an ADR.** Decide explicitly whether flat CRUD/utility
   domains are *intentionally exempt* from the full hexagon or are unconverted debt.
   Today the 16-vs-44 split is implicit; an ADR (e.g. "domains with non-trivial
   invariants or lifecycle events must be fully layered; pure CRUD may stay flat")
   turns an accident into a decision.
4. **Add a domain-conformance guard (optional).** A script that classifies each domain
   as `full / partial / flat` and pins the current set would (a) prevent silent
   regression of layered domains back to flat and (b) give a burn-down metric for the
   conversion effort — mirroring the existing baseline pattern.
5. **Fold `check:hex-storage` into `check:guards`** (or document why it is intentionally
   separate). It is the most important architectural guard yet is absent from the
   aggregate that `CLAUDE.md` tells contributors to run before pushing; it is currently
   only caught by CI.

---

## 9. Appendix — key references

- Exemplar domain: `server/domains/maintenance/{domain/ports.ts, application/, infrastructure/}`
- Outbox port: `server/domains/work-orders/domain/ports.ts`
- Flat domains: `server/domains/{alerts,sensors,permissions}/`
- Guards: `scripts/check-{hex-storage-boundaries,domain-boundaries,domain-leaks,domain-repositories-imports}.mjs`
- Baselines: `scripts/{hex-storage,domain-leak,domain-repositories,duplicate-types,typed-casts,ts-burndown}-baseline.json`, `scripts/zod-escape-allowlist.json`
- Wiring: `package.json` (`check:guards`, `check:type-debt`, `check:contract-ratchets`), `.github/workflows/ci.yml`
- Intent: `CLAUDE.md`; `docs/architecture/{backend-modules,bounded-contexts}.md`; `docs/adr/00{1,2}-*.md`

### Counts as read from HEAD (2026-06-14)

| Metric | Value |
|---|---|
| Domains total / full-4-layer / partial / flat | 62 / 16 / 6 / 40 |
| hex-storage violations | 146 |
| domain-leaks (dynamic / route-storage / cross-domain) | 582 (399 / 103 / 80) |
| domain→repositories violations | 0 |
| cross-domain import violations / allowlist | 0 / 5 |
| duplicate types (tracked / hard-gated canonicals) | 225 / 8 |
| typed casts | 1020 |
| zod escape-hatch allowlist | 22 |
| TypeScript errors | 0 |
