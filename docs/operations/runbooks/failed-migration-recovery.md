# Runbook — Failed Migration Recovery

Trigger conditions:

- Alert: `MigrationApplyFailed`, `MigrationDriftDetected`.
- `npm run db:push` exits non-zero in deploy.
- App boot fails with `column "..." does not exist` or
  `relation "..." does not exist`.

ARUS uses Drizzle migrations. Production database changes are
applied by `npm run db:push --force` against a versioned schema in
`shared/schema/`. All migrations must be reversible — the guard
`scripts/check-migrations-reversible.sh` is part of CI.

## 1. Identify the failed state

```
npm run db:status
```

This prints the last applied migration, the head of the migrations
folder, and any drift detected by
`scripts/audit-schema-drift.ts`.

Three possible states:

- **Partial apply** — migration N started but did not finish. Some
  DDL committed, some did not.
- **Drift** — production schema diverges from `shared/schema/`
  without a migration explaining the difference (someone ran ad-hoc
  DDL, or a previous restore landed an older snapshot).
- **Forward-only failure** — migration applied cleanly in dev but
  failed in prod (data shape, FK violation, lock timeout).

## 2. Restore options, in order of preference

### 2a. Roll forward (preferred)

If the migration is forward-only and the failure is data-related
(e.g. NOT NULL on a column with existing nulls), write a corrective
migration:

```
npm run db:generate
# add the corrective DDL / DML in the generated file
npm run db:push
```

### 2b. Roll back the migration

For DDL changes that did not yet ship application code depending
on them:

```
npm run db:rollback -- --to <last-known-good-name>
```

`db:rollback` runs the `down` block of each migration in reverse.
**Stop and call on-call lead if rollback fails** — do not run
ad-hoc DDL.

### 2c. Restore from backup (last resort)

If 2a and 2b are not options (e.g. data loss already committed):

1. Identify the most recent backup that pre-dates the bad migration
   (see `scripts/dr/README.md` and the backup-restore doc).
2. Run the restore-smoke suite against an ephemeral DB to confirm
   the backup is good:
   ```
   node scripts/dr/restore-smoke.mjs --backup=<path-or-url>
   ```
3. Coordinate maintenance window with product. Restore takes
   ~10 min per 10 GB.
4. Restore:
   ```
   node scripts/dr/restore.mjs --backup=<path> --target=<prod-url>
   ```
5. Re-apply migrations up to the last known good, **excluding** the
   one that failed.

## 3. Verify

- `npm run db:status` shows no drift.
- App boot succeeds; `/healthz` returns 200.
- Smoke: `npm run test:smoke`.
- Watch error rate on the System Health dashboard for 30 min.

## 4. Post-incident

- File post-mortem.
- If the failure was rollback-blocked DDL (e.g. column drop), add
  the pattern to `scripts/check-migrations-reversible.sh` so the
  same shape cannot ship again.
- Update `shared/schema/` snapshots so drift detection clears.
