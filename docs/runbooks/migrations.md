# Runbook — Running & reverting migrations safely

ARUS has **two** schema mechanisms; know which you're touching:

- **Canonical schema** — `drizzle-kit push` (`npm run db:push`) reconciles the live DB to the
  Drizzle TS schema (`shared/schema/*`). This is the source of truth.
- **Numbered SQL deltas** — `migrations/NNNN_*.sql` (+ matching `.down.sql`), applied **on top of**
  the push baseline via `scripts/run-sql-migrations.mjs`. They ALTER tables that push already
  created; they are **not** a from-empty standalone schema (see the reconcile note below).

## Apply

```
npm run db:push                              # bring schema to the Drizzle baseline
node scripts/run-sql-migrations.mjs up       # apply every NNNN_*.sql not yet recorded
```

The runner tracks applied migrations in `arus_migrations`; `up` is idempotent (skips recorded
files).

## Revert

```
node scripts/run-sql-migrations.mjs down --count 1   # revert the most recent N migrations
```

Each up file **must** ship a matching `.down.sql` (the runner fails loudly otherwise — guard LR-1A,
also checked in CI). Authoring a new migration: add both `NNNN_name.sql` and `NNNN_name.down.sql`,
and verify the down truly restores prior state.

## Before you ship a migration

- Test up→down→up on a scratch DB and diff the schema (this is what
  `scripts/check-migrations-reversible.sh` automates).
- **Known limitation:** that reversibility check currently cannot run from empty — delta `0001`
  ALTERs `equipment`, which only exists after `db:push`. So the CI step is advisory until the
  migration-reconcile work lands (tracked in `docs/SECURITY-REVIEW-FOLLOWUPS.md`). Until then,
  manually validate reverse SQL: push the baseline first, then exercise your migration's
  down→up against it.

## Production order

1. Back up / snapshot the database.
2. `npm run db:push` (baseline), then `run-sql-migrations.mjs up` (deltas).
3. Smoke-check the app boots and `/api/health/detailed` is green.
