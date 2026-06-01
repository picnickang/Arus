---
name: ARUS migration runners
description: How the deploy/boot migration path and the reversibility tool relate, and the invariant that keeps them consistent.
---

# ARUS migration runners

`server/scripts/migrate.ts` is the single canonical runner for deploy/boot
(`db:migrate`, `db:migrate:deploy`, `MIGRATE_ON_BOOT`, and `scripts/post-merge.sh`).
It applies, under one advisory lock: root `migrations/NNNN_*.sql` (ledger
`arus_migrations`) + `server/migrations/*.sql` (ledger `arus_sql_migrations`),
then asserts critical objects exist (0021 hot-path indexes, 0023 FK cascades,
0024 `uq_equipment_telemetry_natural`) and fails loudly if any are missing.

`scripts/run-sql-migrations.mjs` is a separate CLI kept ONLY for reversibility
CI (`scripts/check-migrations-reversible.sh`, up/down on an ephemeral copy).

The Drizzle journal migrator is retired (not an apply path). Base schema for a
truly empty DB is still bootstrapped by `drizzle-kit push`/`generate` upstream;
the runner applies incremental migrations on top.

**Invariant — the root-migration apply logic is duplicated** between
`migrate.ts` (`applyRootSqlMigrations`) and `run-sql-migrations.mjs` (`cmdUp`).
They MUST stay in lockstep: same ledger table `arus_migrations`, same advisory
lock key `779231474`, same filename filter (`/^\d{4}_.*\.sql$/` excluding
`.down.sql`), same per-file tx + `INSERT ... ON CONFLICT DO NOTHING`.

**Why:** they were unified (the deploy path historically skipped root migrations
incl. RLS 0018 / dedup index 0024). The `.mjs` can't be imported from the
type-checked TS without tsconfig/declaration changes (tsconfig excludes
`scripts/`, no `allowJs`), so the logic was mirrored, not shared.

**How to apply:** if you change how root migrations are tracked, locked, or
ordered in one file, change the other identically — or they silently diverge
between deploy and reversibility CI.
