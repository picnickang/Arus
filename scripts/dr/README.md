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
    - cron: "0 6 * * 1"   # Mondays 06:00 UTC
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

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | **read-only** prod DB credential — parity reference |
| `VERIFY_DATABASE_URL` | scratch DB the dump is restored into (will be wiped) |
| `BACKUP_PATH` or `BACKUP_URL` | the dump to validate (custom-format `pg_dump`) |

### Optional env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `ROW_COUNT_TOLERANCE_PCT` | `20` | per-table row-count drift allowed |
| `ANCHOR_TABLES` | `vessels,equipment,work_orders` | must be non-empty in restore |
| `REPORT_PATH` | `/tmp/backup-verify-<ts>.json` | where the JSON report lands |
| `ALLOW_RESTORE_ONLY_TABLES` | `true` | set `false` to fail on tables that exist in the restore but not live (catches stale dump files from a deprecated schema) |

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed; backup is restorable and within drift tolerance. |
| 1 | Validation failure — read the JSON report. |
| 2 | Harness error (missing inputs, couldn't connect, pg_restore not on PATH). |

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
