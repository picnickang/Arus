# Database Schema

PostgreSQL is the primary database (Drizzle ORM, ~292 tables across the
domain modules in this directory). `shared/sqlite-schema/` mirrors a
subset for offline vessel mode; `shared/schema-runtime.ts` switches
between them at runtime.

## Entry points — which import to use

| You are writing…                       | Import from                                  |
| -------------------------------------- | -------------------------------------------- |
| Server runtime code (queries, inserts) | `@shared/schema-runtime` (enforced by `check:schema-imports`) |
| Types, zod insert schemas, validation  | `@shared/schema`                             |
| Schema definition files themselves     | sibling modules (`./core`, `./base`, …)      |

Direct imports of `@shared/schema/<module>` from app code are
discouraged — they bypass the dual-DB mode switch.

## Module map

Foundations: `base.ts` (builders + re-exported Drizzle primitives),
`core.ts` (organizations, users, system/email settings), `sync.ts`.

Domains: `vessels`, `equipment`, `work-orders`, `maintenance`, `alerts`
(incl. email/notification queues), `inventory`, `purchasing`, `costs`,
`crew`, `crew-tasks`, `logbooks`, `compliance` (incl. GDPR/PDPA tables),
`certificates`, `safety-alarms`, `safety-bulletins`, `telemetry`,
`sensors`, `iot-edge`, `dtc`, `ml-analytics-{core,advanced}` (+
`ml-analytics.ts` aggregator, `ml-training-pipeline`,
`pdm-feature-store`), `digital-twin` (asset twins, simulations, AR/3D
assets), `agent`, `rag`, `knowledge-base`, `insights`, `optimizer`,
`permissions`, `role-dashboards`, `sso`, `admin` (audit, sessions,
health, integrations), `ops-deployment` (software patches, fleet
updates), `scheduled-reports`, `scheduling-settings`, `stormgeo`,
`equipment-dependencies`, `external-data-cache`, `diagnostic-runs`,
`import-manifest`, `vessel-diagram-registry`.

Everything is re-exported through `index.ts`; `shared/schema.ts` is a
legacy facade over it. New tables go in the domain module they belong
to — if none fits, add a module rather than growing `admin.ts`.

## Rules (enforced by `npm run check:guards`)

1. **Every table-defining module must be listed in `drizzle.config.ts`**
   (`check:drizzle-config`). Fresh databases are bootstrapped with
   `npm run db:push`; a module missing from the config silently gets no
   tables.
2. **New tables use the `base.ts` builders** (`check:schema-builders`):
   `...uuidPrimaryKey()`, `...tenantColumn(organizations)`,
   `...timestamps()`. Hand-rolled equivalents are how org_id columns
   lost their FK and timestamps drifted. Existing tables are
   grandfathered in `scripts/check-schema-builders.mjs` — shrink that
   list, don't grow it.
3. **PG/SQLite parity** (`check:schema`): tables that exist on both
   sides must keep column parity; known gaps live in
   `scripts/drift-baseline.json`. Decide explicitly whether a new table
   is cloud-only (`cloudOnly()` in `schema-runtime.ts`) or synced
   (add the SQLite twin in `shared/sqlite-schema/`).

## Numeric policy (migration 0041)

- **Money** (costs, prices, rates, amounts, savings):
  `numeric("col", { precision: 12, scale: 2, mode: "number" })`
- **Quantities** (stock, order quantities): `numeric(…, scale: 3, mode: "number")`
- **Cost multipliers**: `numeric(6, 3, mode: "number")`
- **Measurements, durations, scores, ratios, probabilities**: `real()` —
  floats are the right type for measured/derived values.
- `mode: "number"` keeps TS types `number`. Caveat: raw `sql` aggregates
  (`SUM(...)`) and `.execute()` rows bypass Drizzle's decoding and
  return numeric as **string** — cast `::float8` in the SQL or wrap in
  `Number()` at the boundary.
- Legacy string-mode `numeric` columns (e.g. `vessels.dayRateSgd`) stay
  string-mode; their consumers parse strings.

## Status columns

Status/severity sets are enforced twice: zod enums in the schema/
validation modules, and CHECK constraints in the database (migration
0042: `work_orders.status` + `priority`, `purchase_requests.status`,
`purchase_orders.status`, `crew_alerts.severity`). When adding a status
value, update **both** the zod enum and the CHECK constraint in one
migration.

## Schema-change checklist

1. Edit the Drizzle module (builders for new tables; FKs with explicit
   `onDelete`; org-scoped unique keys, not global).
2. New module? Add it to `drizzle.config.ts` and `index.ts`.
3. Write `migrations/NNNN_name.sql` **and** `NNNN_name.down.sql` —
   idempotent (`IF NOT EXISTS` / `DO $$` guards). The TS schema and the
   migration must produce the same DDL: fresh DBs come from `db:push`,
   existing DBs from `npm run db:migrate`.
4. Load-bearing index/FK/column? Extend the assertion arrays in
   `server/scripts/migrate.ts` (`REQUIRED_INDEXES`, `REQUIRED_FKS`,
   `REQUIRED_COLUMNS`) so a skipped migration fails the deploy loudly.
5. Verify: `npm run check && npm run check:guards`, then against a
   scratch DB: `npm run db:push` (fresh) / `npm run db:migrate` +
   `node scripts/run-sql-migrations.mjs down --count 1 && … up`
   (reversibility), `npm run test:unit`.
