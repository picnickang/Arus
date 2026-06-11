# DR Scripts

Operational scripts that back the procedures in `docs/operations/dr-runbook.md`.
None of these run inside the unit/integration test runner — they're invoked by
schedulers (cron, GitHub Actions, drill day) against real infrastructure.

## verify-backup.mjs

Restores a Postgres backup into a scratch database and validates it against the
live DB for schema parity, row-count drift, and anchor-table emptiness.

This is the automated form of §10 of the runbook (quarterly DR drill). Run it
as often as your backup cadence — a weekly green check is the cheapest
insurance against a silently-broken backup pipeline.

### Example: GitHub Actions weekly schedule

```yaml
name: dr-backup-verify
on:
  schedule:
    - cron: "0 6 * * 1" # Mondays 06:00 UTC
  workflow_dispatch:
jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: scratch
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - name: Install postgres client
        run: sudo apt-get update && sudo apt-get install -y postgresql-client
      - name: Run verification
        env:
          DATABASE_URL: ${{ secrets.PROD_READONLY_DB_URL }}
          VERIFY_DATABASE_URL: postgres://postgres:scratch@localhost:5432/postgres
          BACKUP_URL: ${{ secrets.LATEST_BACKUP_PRESIGNED_URL }}
        run: node scripts/dr/verify-backup.mjs
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: backup-verify-report
          path: /tmp/backup-verify-*.json
```

### Required env vars

| Var                           | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`                | **read-only** prod DB credential — parity reference  |
| `VERIFY_DATABASE_URL`         | scratch DB the dump is restored into (will be wiped) |
| `BACKUP_PATH` or `BACKUP_URL` | the dump to validate (custom-format `pg_dump`)       |

### Optional env vars

| Var                         | Default                         | Purpose                                                                                                                  |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ROW_COUNT_TOLERANCE_PCT`   | `20`                            | per-table row-count drift allowed                                                                                        |
| `ANCHOR_TABLES`             | `vessels,equipment,work_orders` | must be non-empty in restore                                                                                             |
| `REPORT_PATH`               | `/tmp/backup-verify-<ts>.json`  | where the JSON report lands                                                                                              |
| `ALLOW_RESTORE_ONLY_TABLES` | `true`                          | set `false` to fail on tables that exist in the restore but not live (catches stale dump files from a deprecated schema) |

### Exit codes

| Code | Meaning                                                                   |
| ---- | ------------------------------------------------------------------------- |
| 0    | All checks passed; backup is restorable and within drift tolerance.       |
| 1    | Validation failure — read the JSON report.                                |
| 2    | Harness error (missing inputs, couldn't connect, pg_restore not on PATH). |

### What "drift tolerance" means

The backup is by definition older than live. A 20% delta on `audit_log` is
normal; a 20% delta on `vessels` is alarming (vessels don't churn). Adjust
`ROW_COUNT_TOLERANCE_PCT` based on your traffic profile, or pin specific
high-churn tables in a follow-up by extending the harness with per-table
tolerance overrides.

### Refusing to validate empty backups

If the dump file is <1024 bytes the harness refuses to run and exits non-zero.
This catches the common "the backup job ran successfully and produced a 0-byte
file" failure mode that would otherwise validate green.

## provision-ephemeral.mjs (LR-2)

End-to-end DR drill harness. Provisions a uniquely-named ephemeral database
inside a Postgres cluster you point it at, restores a backup (or the bundled
fixture) into it, runs `verify-backup.mjs` against it, then drops the database.

```bash
# Drill against the latest production backup
EPHEMERAL_DB_URL=postgres://postgres:scratch@localhost:5432/postgres \
DATABASE_URL=$PROD_READONLY_DB_URL \
BACKUP_URL=$LATEST_BACKUP_PRESIGNED_URL \
node scripts/dr/provision-ephemeral.mjs

# Drill against the bundled fixture (no prod credentials required)
EPHEMERAL_DB_URL=postgres://postgres:scratch@localhost:5432/postgres \
DATABASE_URL=$DEV_DB_URL \
node scripts/dr/provision-ephemeral.mjs --fixture
```

Exit codes mirror `verify-backup.mjs`. The ephemeral DB is named
`arus_drdrill_<ts>_<uuid>` and is always dropped (with `FORCE`) on exit,
even if validation fails — there are no orphaned databases to clean up
manually after a failed drill.

### Fixture dump

`scripts/dr/fixtures/baseline.dump` is checked in as the smallest dump
that exercises the verifier end-to-end. Regenerate it from a scrubbed
dev DB whenever the schema changes shape:

```bash
pg_dump --format=custom --no-owner --no-privileges $DEV_DB_URL \
  > scripts/dr/fixtures/baseline.dump
```

Before checking in, audit the dump with `pg_restore -l` to confirm no
PII tables made it in. The fixture exists so first-time wiring and
"is the harness itself healthy?" smoke runs do NOT require a real
prod backup URL on the runner.

## Object-storage backup policy (LR-2)

Backups live in a dedicated object-storage bucket; the same bucket also holds
versioned copies of every retention-managed artifact (`telemetry-warehouse-export`
Parquet files, KB documents). The policy is intentionally simple — operators
should be able to recite it from memory.

### Bucket layout

```
backups/
  postgres/
    YYYY/MM/DD/arus-<env>-YYYYMMDD-HHMMSS.dump   # custom-format pg_dump
    YYYY/MM/DD/arus-<env>-YYYYMMDD-HHMMSS.sha256 # integrity sidecar
  manifests/
    arus-<env>-latest.json                       # pointer to most-recent dump
telemetry-warehouse/
  orgId=<orgId>/date=YYYY-MM-DD/part-0.parquet   # exporter-managed; see docs/telemetry-warehouse-export.md
```

### Versioning and retention

| Class                    | Versioning                                      | Retention                                                 | Lifecycle                                                                   |
| ------------------------ | ----------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `backups/postgres/**`    | **enabled** (S3 versioning / object versioning) | 35 days for current versions, 7 days for non-current      | Daily full dump; weekly dumps kept 90 days under `backups/postgres/weekly/` |
| `backups/manifests/**`   | enabled                                         | indefinite                                                | Single-key overwrite; old versions retained for audit                       |
| `telemetry-warehouse/**` | enabled                                         | per `TELEMETRY_WAREHOUSE_RETENTION_DAYS` env (default 90) | Exporter prunes on every run; bucket lifecycle is a backstop                |

Versioning is non-negotiable for the `backups/postgres/**` prefix — without
it, a single accidental `aws s3 rm` (or its equivalent) destroys every
recovery point in one motion. With versioning, the same `rm` only creates
delete markers that the previous-version restore can step over.

### Access policy

| Principal                               | Access                                                        | Why                                                                                   |
| --------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Backup-writer service account           | `s3:PutObject`, `s3:ListBucket` on `backups/postgres/**` only | Least privilege — cannot delete prior versions even if compromised                    |
| DR-restore role (assumed during drills) | `s3:GetObject`, `s3:GetObjectVersion`, `s3:ListBucket`        | Read-only — drills cannot mutate the canonical backup set                             |
| Human operators                         | NO direct access                                              | All restores go through the audited DR-restore role; humans assume the role per-drill |
| Application runtime                     | NO access to `backups/**`                                     | The app reads/writes `telemetry-warehouse/**` only                                    |

### Cross-region replication

The `backups/postgres/**` prefix replicates asynchronously to a second
region with a separate AWS account / cloud project. Cross-region copies
also have versioning enabled and a 35-day retention. The replica bucket is
never written to directly — it exists solely to survive a region-level
outage or a credential-compromise blast radius in the primary account.

### What the on-call should check weekly

1. `provision-ephemeral.mjs` GitHub Actions workflow is green.
2. The most-recent object in `backups/postgres/YYYY/MM/DD/` is <26 hours old.
3. Bucket versioning is still `Enabled` (drift detection via AWS Config or equivalent).
4. The replica-region bucket has a matching object count for the prior 7 days.

Anything red here means recovery is at risk — file a P1 the same shift.
