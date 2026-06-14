# ADR 003: Domain Layering Policy (Hexagonal Conformance)

**Status**: Accepted
**Date**: 2026-06-14
**Deciders**: Platform Engineering
**Related**: `CLAUDE.md` (layout & guardrails),
`docs/architecture/hexagonal-architecture-assessment.md`,
`docs/architecture/hexagonal-remediation-plan.md`

## Context

ARUS organizes the backend into ~62 domains under `server/domains/<name>/`. The
intended structure (per `CLAUDE.md`) is the hexagonal / ports-and-adapters split:

- **`domain/`** — pure entities, value objects, domain events, and **ports**
  (interfaces). No external dependencies.
- **`application/`** — use-case orchestration; depends only on domain ports/types and
  receives adapters via constructor dependency injection.
- **`infrastructure/`** — adapters implementing the ports; the **only** layer permitted
  to hold a raw DB handle (also allowed in `server/db/<area>/`).
- **`interfaces/`** — HTTP route handlers that call the application service.

A 2026-06-14 assessment found this is implemented unevenly: **16** domains are fully
4-layered, **6** are partial, and **40** are flat (`routes.ts`/`service.ts`/
`repository.ts` or thinner, with no ports). The layered-vs-flat distinction tracked
domain complexity in practice, but it was an *implicit* outcome — there was no recorded
policy stating which domains must be layered, no definition of "done," and nothing
preventing a converted domain from silently regressing to flat.

This ambiguity has the same hazard ADR-002 called out for tenancy: two coexisting
models with no authoritative statement of which one new code should follow.

## Decision

**The full 4-layer hexagonal structure is the canonical target for every domain, and
this is now an enforced, ratcheting policy.**

1. **All new domains MUST be fully 4-layered** (`domain/ application/ infrastructure/
   interfaces/`) with explicit ports and constructor DI. New flat domains are not
   permitted.
2. **Existing flat/partial domains are migration debt**, tracked as a monotonic
   burn-down toward zero (see `docs/architecture/hexagonal-remediation-plan.md`).
3. **A fully-layered domain may never regress** to partial/flat.
4. **Raw DB access is confined to `infrastructure/` regardless of layering status.**
   Even a domain that is still flat must route DB access through an `infrastructure/`
   adapter rather than touching `server/db/*` from routes/services. This is the
   `check:hex-storage` invariant and applies universally.
5. **Pure CRUD/utility/integration domains MAY petition to remain flat**, but only by
   explicit team agreement recorded in the conformance baseline — never by default, and
   still subject to rule (4).

### Enforcement

- `scripts/check-domain-conformance.mjs` classifies each domain as `full` / `partial` /
  `flat`, pins the current `full` set (which may only grow) and the `partial`+`flat`
  sets (which may only shrink), and fails CI on regression or any new non-full domain.
  Baseline: `scripts/domain-conformance-baseline.json`.
- The guard is wired into `npm run check:guards` (alongside `check:hex-storage`, which
  was previously only invoked separately) and runs as its own CI step.
- Regenerate the baseline only to **lock in gains** after a conversion:
  `node scripts/check-domain-conformance.mjs --write-baseline`.

## Consequences

- Contributors get an immediate, automated signal when a change would add architectural
  debt; the burn-down direction is enforced rather than aspirational.
- The migration is incremental: each domain conversion is an independent, shippable PR
  that lowers the `flat`/`partial` counts and the `hex-storage` / `domain-leak`
  baselines.
- When the `flat` and `partial` sets reach zero, `check:domain-conformance` becomes a
  hard gate (no non-full domains allowed) and the burn-down affordance is removed
  (remediation-plan Phase 7).
- This ADR governs structure only. It does not change the single-tenant model (ADR-002)
  or move schema ownership: `shared/schema/*` stays centralized; infrastructure adapters
  act as the anti-corruption layer over it.
