# ADR 001 — Knowledge Graph Substrate Choice

**Status:** Accepted
**Date:** 2026-05-19
**Push:** A2 — Knowledge Graph for Operational Reasoning
**Deciders:** ARUS Platform engineering

## Context

Push A2 introduces a first-class knowledge graph over the existing
relational truth (equipment ↔ failure-mode ↔ part ↔ supplier ↔ technician
↔ vessel) so the Copilot can answer relationship questions that JOINs
cannot answer at speed. The substrate must:

1. Honour the tenant-isolation contract enforced everywhere else in the
   stack (every row carries `org_id`; see `middleware/db-context.ts` and
   the Wave 6.6 GDPR allowlist).
2. Stay transactionally consistent with the relational source — the graph
   is a _read-side projection_, never the system of record.
3. Add minimal operational burden. ARUS already runs Postgres + Redis +
   optional TimescaleDB. A separate graph cluster would be the second-
   most operationally expensive thing in the system after the OLTP DB.
4. Support `MATCH ... WHERE n.orgId = $1`-style queries with sub-100ms
   latency at the scale of the largest single tenant (~50k equipment,
   ~500k failure-history rows, ~100k inventory movements).

## Options considered

### Option A — Apache AGE (PostgreSQL extension)

- Ships as a Postgres extension. Cypher queries execute inside the same
  Postgres backend as the relational tables.
- Tenant isolation is structural: one named graph per tenant
  (`SELECT create_graph('arus_graph_' || $orgId)`), so cross-tenant
  traversal is impossible by construction (the graph is the boundary).
- Backups, PITR, replication, Sentry instrumentation, monitoring,
  authentication — all inherited from existing Postgres ops.
- Writes can participate in the same transaction as the relational
  insert that produced them. No outbox, no eventual consistency.
- **Risks:** Newer extension; query optimiser is less mature than Neo4j
  for multi-hop traversals at high cardinality; managed-Postgres
  providers do not always allow installing `pg_age`. The Replit-managed
  PG used in dev does not expose superuser, so production deploys must
  use a Postgres image with the extension pre-installed.

### Option B — Neo4j (separate cluster)

- Industry-standard graph store. Mature Cypher implementation,
  excellent traversal performance, large ecosystem (Bloom, GDS).
- Tenant isolation is a _label_ property (`(:Equipment {orgId: $1})`)
  filtered in every query. One bad query = cross-tenant leak. This
  re-introduces the exact failure mode RLS (Push B1) is being added to
  eliminate.
- Operationally a second stateful system: separate backup pipeline,
  separate auth, separate monitoring, separate failover story. Doubles
  the DR runbook surface (see `docs/operations/dr-runbook.md`).
- Writes require a two-phase pattern (outbox → consumer → Neo4j) to
  stay consistent with Postgres. Adds latency and a failure class.

### Option C — In-process JS graph library (e.g. graphology)

- Considered and rejected: no persistence, can't be queried by
  multiple Node instances, doesn't survive restart, doesn't scale past
  a single tenant in-memory.

## Decision

**Adopt Apache AGE (Option A).** The decisive factor is tenant
isolation: putting each tenant in its own named graph makes
cross-tenant leak _physically impossible_ rather than relying on every
query to remember a `WHERE orgId = $1`. That property matters more than
the marginal traversal-performance advantage Neo4j would offer at our
scale.

Secondary factors that reinforced the choice:

- Inherits all Postgres ops investment (Wave 2.3 backup harness,
  Wave 2.7 DR runbook, Wave 6.6 GDPR delete) without bifurcation.
- Write-through can be transactional with the relational insert.
- Zero new credentials, zero new network surface, zero new on-call
  rotation.

## Consequences

- The graph is **opt-in** via `GRAPH_ENABLED=true`, mirroring the
  TimescaleDB pattern (Wave 2.8). If the extension is not installed,
  the bootstrap logs a warning and every graph adapter call degrades
  to a no-op so the application keeps booting.
- A non-AGE Postgres deployment can still run ARUS — graph-derived
  features (cross-vessel learning, failure propagation) simply return
  empty results and the Copilot tools fall back to relational JOINs.
- Production must use a Postgres image with `pg_age` installed.
  Document this in the deployment readme alongside the existing
  TimescaleDB note.
- Backfill is idempotent (`MERGE` semantics). Re-running it must never
  duplicate edges. See `scripts/graph/backfill.mjs`.

## Out of scope

- Graph-based ML edge inference. Edges come from existing relational
  data + admin-curated dependencies only.
- 3D visualisation of the dependency graph — that is Push A3.
- A general-purpose graph product surfaced to end users. The graph is
  an internal Copilot reasoning substrate.

## References

- `server/timescaledb-bootstrap.ts` — the opt-in extension pattern this
  ADR mirrors.
- `docs/architecture/strategic-pushes-sequencing.md` §A2.
- Apache AGE — https://age.apache.org/
