---
name: ARUS migrations & cloud-only domains
description: How schema changes reach dev and prod in ARUS, and the certificates template for cloud-only (PG-only) domains.
---

# Schema changes in ARUS

`drizzle-kit push` (`npm run db:push`) prompts interactively when it sees a brand-new
table (it tries to disambiguate create-vs-rename) and **fails without a TTY** in the
agent shell. For a new isolated table, either apply the DDL directly (SQL) for dev, and
**always also add a committed migration** so deployed environments get it.

**Why:** prod does not run `db:push`. Two migration paths run on deploy/boot:

1. Drizzle migrations in `migrations/` (via `db:migrate` / `db:migrate:deploy`).
2. Supplemental idempotent SQL files in `server/migrations/*.sql`, run in sorted order
   and tracked in the `arus_sql_migrations` table. Also triggered at boot when
   `MIGRATE_ON_BOOT=true` (`server/scripts/migrate.ts` → `runBootMigrations`).

**How to apply:** add `server/migrations/NNN-name.sql` with `CREATE TABLE IF NOT EXISTS`

- `CREATE INDEX IF NOT EXISTS` (idempotent, so it co-exists with a dev table created by
  hand). Match the drizzle schema's column types (e.g. `timestamp` without tz when the
  schema uses `timestamp({ mode: "date" })`).

# Cloud-only (PostgreSQL-only) domains

The `certificates` domain is the template for a cloud-only hexagonal domain: schema is
**not** registered in `shared/schema/schema-runtime`, has **no SQLite mirror**, the
infrastructure adapter imports `db` + `@shared/schema` directly (no repositories barrel,
no `IStorage` wiring), and the convergence guard `check:domain-leaks` does not require a
mirror because there are no `db*Storage` refs. Register the router in
`server/routes/domain-router-registry.ts`. `safety-bulletins` follows the same shape.
