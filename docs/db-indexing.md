# Database Indexing Guide

This document describes how database indexes are managed in ARUS following **Option A (Gold Standard)**: migrations own index creation/changes, and boot-time only verifies.

## Architecture Overview

### Why Option A?

**Production boot MUST NOT perform heavy DDL work.** Creating indexes on large tables during application startup can:

- Cause long startup delays
- Lock tables and block queries
- Create race conditions if multiple instances start simultaneously

Instead, indexes are managed via migrations that run before deployment, and the application only verifies they exist at boot time.

## How It Works

### 1. Index Creation via Migrations

Indexes are defined in SQL migration files in the `migrations/` directory:

```
migrations/
  0000_schema-sync.sql          # Initial schema
  0002_performance_indexes.sql  # Performance indexes
  meta/_journal.json            # Migration tracking
```

### 2. Boot-Time Verification

When the application starts, `server/db-indexes.ts` verifies that required indexes exist:

**In Production (NODE_ENV=production)**:

- Checks if indexes exist using `pg_class`
- Logs an ERROR if any are missing
- Does NOT create indexes (avoids heavy DDL)
- Returns remediation instructions

**In Development**:

- Same verification check
- If `DEV_SELF_HEAL=true`, auto-creates missing indexes
- Otherwise logs a warning with `npm run db:migrate` instructions

### 3. Health Endpoint

Query `GET /api/health/db-indexes` to check index status:

```json
{
  "ok": true,
  "verified": ["idx_equipment_vessel_created", "..."],
  "missing": [],
  "lastCheckedAt": "2026-01-06T12:00:00.000Z"
}
```

## Running Migrations

### Local Development

```bash
# Run pending migrations
npm run db:migrate

# Check migration status
npm run db:migrate:status
```

### Production Deployment

```bash
# Run before app rollout (non-interactive)
npm run db:migrate:deploy
```

**Important**: Always run `db:migrate:deploy` before starting the application in production.

## Current Indexes

| Index Name                               | Table               | Columns                              | Purpose                   |
| ---------------------------------------- | ------------------- | ------------------------------------ | ------------------------- |
| `idx_equipment_vessel_created`           | equipment           | vessel_id, created_at DESC           | Equipment lists by vessel |
| `idx_maintenance_records_equipment_date` | maintenance_records | equipment_id, actual_start_time DESC | Maintenance history       |
| `idx_maintenance_records_org_id`         | maintenance_records | org_id                               | Org-scoped queries        |
| `idx_raw_telemetry_equipment_ts`         | raw_telemetry       | src, ts DESC                         | Telemetry time-series     |
| `idx_ml_models_org_status`               | ml_models           | org_id, status                       | Active model lookups      |
| `idx_pdm_alerts_asset_time`              | pdm_alerts          | asset_id, at DESC                    | Alert history by asset    |
| `idx_pdm_alerts_vessel`                  | pdm_alerts          | vessel_name, at DESC                 | Fleet-wide alert views    |

## Adding New Indexes

1. Create a new migration file:

   ```bash
   npm run db:generate
   ```

   Or manually create `migrations/NNNN_description.sql`

2. Add your index creation SQL:

   ```sql
   CREATE INDEX IF NOT EXISTS idx_my_new_index ON my_table(column1, column2 DESC);
   ```

3. Update `migrations/meta/_journal.json` to include the new migration

4. Add the index name to `REQUIRED_INDEXES` in `server/db-indexes.ts`

5. Run migrations:
   ```bash
   npm run db:migrate
   ```

## Troubleshooting

### "Missing indexes in production"

This error means migrations haven't been run. Remediation:

```bash
npm run db:migrate:deploy
```

Then restart the application.

### DEV_SELF_HEAL Mode

In development, set `DEV_SELF_HEAL=true` to auto-create missing indexes:

```bash
DEV_SELF_HEAL=true npm run dev
```

This maintains the self-healing spirit for new developer environments while keeping production safe.

## Design Rationale

1. **Migrations are the source of truth** - Index definitions live in version-controlled SQL files
2. **Boot-time is verification only** - No DDL operations during startup in production
3. **Self-healing for dev** - New environments can auto-provision via `DEV_SELF_HEAL`
4. **Operator visibility** - Health endpoint exposes index status for monitoring
5. **Safe rollouts** - Migrations run before deployment, not during
