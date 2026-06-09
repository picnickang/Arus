# ADR 002: Single-Tenant Operating Model (Authoritative)

**Status**: Accepted
**Date**: 2026-06-09
**Deciders**: Platform Engineering
**Supersedes (in part)**: ADR 001 (which remained _Proposed_ and described a
multi-tenant target state that was never adopted as the shipping model)

## Context

A repository review surfaced **two conflicting tenancy models** in the code
and docs, which is a source of confusion and a latent security-reasoning trap:

1. **Canonical, actively-mounted single-tenant path** — `server/orgIdValidation.ts`
   (its own header: _"ARUS currently runs as a single-tenant, multi-vessel
   system"_). The global middleware chain routes every request through
   `validateOrgIdHeader` / `requireOrgId`, which **force `DEFAULT_ORG_ID`** and
   **reject any other `x-org-id`** with `ORG_CONTEXT_FORBIDDEN`.

2. **Dormant, opt-in multi-tenant / RLS scaffolding** — `requireTenantAuth()`
   (`shared/config/tenant.ts`), the Postgres RLS policies in migration
   `0018_rls_policies.sql`, and the request-scoped DB context in
   `server/middleware/db-context.ts`. These activate **only** when
   `REQUIRE_TENANT_AUTH=true` or `ENABLE_PG_RLS_CONTEXT=true`, both of which
   **default off**.

ADR 001 (status _Proposed_) framed the hardcoded `default-org-id` as a
vulnerability to be removed in favor of full multi-tenancy. That migration was
never completed or adopted; the shipping product is single-tenant. Leaving both
narratives "live" makes it unclear which invariant a reviewer or new feature
should rely on.

## Decision

**ARUS ships and is supported as a single-tenant, multi-vessel system.**

- `DEFAULT_ORG_ID` is the one and only organization in a deployment. `org_id`
  columns are retained for traceability and as a forward-compatibility seam,
  **not** as an enforced isolation boundary between customers.
- The single-tenant enforcement path (`orgIdValidation.ts`) is the canonical,
  supported behavior. Client-supplied `x-org-id` other than `DEFAULT_ORG_ID` is
  rejected.
- The `REQUIRE_TENANT_AUTH` / `ENABLE_PG_RLS_CONTEXT` multi-tenant + RLS
  machinery is **retained as inert, opt-in scaffolding** for a possible future
  SaaS migration. It is **not a supported production configuration today** and
  must not be enabled without a dedicated hardening + test effort (see
  Consequences).

## Security rationale

The review flagged that, with multi-tenancy off by default, tenant isolation
rests on per-repository `WHERE org_id = …` filters with "no backstop," so a
single missing filter could leak across tenants. **In the single-tenant model
this risk is moot**: there is exactly one tenant, so a missing `org_id`
predicate cannot expose another customer's data. The genuine residual concern
was the _ambiguity_ of two models, which this ADR resolves by declaring
single-tenant authoritative.

## Why we did NOT delete the multi-tenant/RLS code

Removing the dormant path was considered and rejected for now:

- The `REQUIRE_TENANT_AUTH` / RLS flags are threaded through ~10 files
  (auth middleware, `db-context`, websocket upgrade, job processors,
  `db-config`), and RLS migration `0018` is applied to existing databases.
- Active CI guards (`check:org-context`, the LR-1B `requireOrgId` audit) depend
  on org-scoping being present on every route.
- It is a strict subset of the future-SaaS option; deleting it now would have to
  be re-implemented if multi-tenancy is ever pursued, and the change is not
  safely verifiable without the full integration suite.

Keeping it inert-by-default costs little and preserves the forward path.

## Consequences

- New code should treat `DEFAULT_ORG_ID` as the single org and **not** assume
  cross-tenant isolation guarantees.
- If multi-tenancy is ever pursued, it must be a deliberate, separately-tested
  project: enable `REQUIRE_TENANT_AUTH`, make it mandatory in production, remove
  the `DEFAULT_ORG_ID` fallback from the global chain, and add cross-tenant
  isolation tests. Re-open/replace this ADR at that time.
- ADR 001's multi-tenant target is archived as aspirational, not current.
