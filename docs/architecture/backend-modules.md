# Backend Architecture: Domain Modules

> **Canonical layering reference.** Domains follow the **4-layer hexagonal**
> (ports-and-adapters) structure. The authoritative summary lives in `CLAUDE.md`
> ("Layout"); the policy is `docs/adr/003-domain-layering-policy.md`; the current
> conformance state and migration roadmap are in
> `docs/architecture/hexagonal-architecture-assessment.md` and
> `docs/architecture/hexagonal-remediation-plan.md`.
>
> **History:** an earlier version of this document described a 3-layer
> `routes.ts / service.ts / repository.ts` module pattern and a routes.ts route-
> deduplication migration. That pattern is **superseded** by the hexagonal model
> below. Domains still in the flat shape are tracked migration debt, not the target.

## Overview

The ARUS backend is organized into domains under `server/domains/<domain>/`. Each
domain is a hexagon: a pure core surrounded by adapters, with dependencies pointing
**inward** toward the domain. Cross-domain imports are forbidden (enforced by
`check:domain-boundaries`), and raw DB access is confined to the `infrastructure/`
layer (enforced by `check:hex-storage`).

## The 4-layer structure

```
server/domains/<domain>/
├── domain/           # Pure business core — entities, value objects, domain
│   ├── types.ts      #   events, and PORTS (interfaces). No external deps.
│   ├── events.ts
│   ├── ports.ts
│   └── index.ts
├── application/      # Use-case orchestration. Depends only on domain ports/
│   ├── <name>-service.ts   #   types; receives adapters via constructor DI.
│   └── index.ts            #   index.ts is the composition root (wires adapters).
├── infrastructure/  # Adapters IMPLEMENTING the ports. The ONLY layer allowed
│   ├── <name>-repository-adapter.ts   #   to import server/db/* or the
│   ├── event-publisher-adapter.ts     #   server/repositories barrel.
│   └── index.ts
└── interfaces/       # HTTP route handlers that call the application service.
    ├── routes.ts     #   Never touch the DB or adapters directly.
    └── index.ts      #   Exports registerXxxRoutes(app, deps).
```

### Dependency direction

```
interfaces ──▶ application ──▶ domain (ports + types)
                                  ▲
infrastructure ───────────────────┘   (implements ports; injected at the edge)
```

- `domain/` imports nothing outside itself.
- `application/` imports only `type`s and port interfaces from `../domain`.
- `infrastructure/` imports the ports it implements (and may import `server/db/*` /
  `server/repositories`).
- `interfaces/` imports the wired application service from `../application`.

## Layer responsibilities

### `domain/`
- Entities, value objects, command/result types, and typed domain events.
- **Ports**: interfaces every adapter must satisfy (e.g. `IXxxRepository`,
  `IEventPublisher`). Pure — no I/O, no framework, no DB.

### `application/`
- Orchestrates use cases over the ports; enforces business rules; publishes domain
  events.
- Receives all dependencies via constructor injection (no direct imports of concrete
  adapters or `server/repositories`).
- `application/index.ts` is the **composition root**: it instantiates the concrete
  adapters from `infrastructure/` and injects them, exporting the wired singleton.

### `infrastructure/`
- Adapters that implement the domain ports — repositories, event publishers, external
  service clients.
- The **only** layer permitted to hold a raw DB handle (also allowed under
  `server/db/<area>/`). Maps persistence rows ⇄ domain entities (anti-corruption).

### `interfaces/`
- HTTP request/response handling, input validation (Zod), rate limiting, error
  formatting.
- Delegates to the application service; never calls adapters or the DB directly.
- Exports route-registration functions plugged in via the domain router registry.

## Conventions

### Route registration

A domain's `interfaces/index.ts` exports a registration function:

```typescript
export function registerXxxRoutes(
  app: Express,
  deps: {
    writeOperationRateLimit: RequestHandler;
    criticalOperationRateLimit: RequestHandler;
    generalApiRateLimit: RequestHandler;
  }
): void | Promise<void> {
  // app.get("/api/xxx", deps.generalApiRateLimit, requireOrgId, handler) ...
}
```

It is wired in `server/routes/domain-router-config-core.ts` and mounted by
`server/routes/domain-router-registry.ts` (`registerAllDomainRouters`). The domain's
top-level `index.ts` re-exports all four layers:

```typescript
export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export * from "./interfaces";
```

### Tenant isolation

Every non-public route goes through `requireOrgId` (single-tenant model, ADR-002):

```typescript
app.get("/api/xxx", requireOrgId, async (req, res) => {
  const orgId = (req as AuthenticatedRequest).orgId;
  // ...
});
```

The unauthenticated surface is an exact-match allowlist in
`server/bootstrap/public-api-paths.ts`.

## Reference implementations

Study these fully-layered domains when adding or converting one:

- `server/domains/maintenance/` — clean adapter-wraps-legacy-storage style.
- `server/domains/inventory/` — mixed legacy repository + storage adapter.
- `server/domains/crew-tasks/` — Drizzle directly inside `infrastructure/`.
- `server/domains/work-orders/` — transactional-outbox event publisher port.

## Enforcement

| Guard | Enforces |
|---|---|
| `check:domain-boundaries` | No cross-domain imports |
| `check:hex-storage` | Raw DB access only in `infrastructure/` (+ allowed roots) |
| `check:domain-repositories-imports` | `domain`/`application`/`interfaces` may not import `server/repositories` |
| `check:domain-conformance` | Domain layering ratchet (full may only grow; flat/partial only shrink) |
| `check:route-registration` | Routes registered only via the domain router registry |

Run `npm run check:guards` before pushing.

## Related documentation

- `CLAUDE.md` — canonical layout & guardrails
- `docs/adr/003-domain-layering-policy.md` — layering policy
- `docs/architecture/hexagonal-architecture-assessment.md` — current state
- `docs/architecture/hexagonal-remediation-plan.md` — migration roadmap
- `docs/architecture/bounded-contexts.md` — domain → bounded-context mapping
