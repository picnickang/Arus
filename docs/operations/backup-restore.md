# Backup & Restore — Operational Reference

LR-3 Task 6. This document is the operator's authoritative reference
for backup creation, retention, restoration, and verification. The
LR-2 DR drill harness (`scripts/dr/provision-ephemeral.mjs`) and the
LR-3 restore-smoke suite (`scripts/dr/restore-smoke.mjs`) are the
mechanical tools; this doc is the policy.

## 1. What we back up

| Source | Mechanism | Frequency | Retention |
|--------|-----------|-----------|-----------|
| PostgreSQL primary | `pg_dump --format=custom` to object storage | every 6h + on-deploy | 30 days hot, 1 year cold |
| Object storage (KB docs, GLB models, ML artifacts) | bucket versioning | continuous | 90 days versions |
| Redis (replay ring) | not backed up | n/a — recoverable from PG | — |
| Schema migrations | git (source of truth) | n/a | repository lifetime |
| Audit log table (`admin_audit_log`) | included in PG dump + replicated to cold bucket | daily | 7 years (compliance) |

We do **not** back up: build artifacts, mockup sandbox, ephemeral
test fixtures, log files (they go to Loki when enabled).

## 2. Where backups live

- **Hot tier** — object-storage bucket `$BACKUP_BUCKET` under
  `pg-dump/YYYY/MM/DD/dump-<ISO>.dump`. Versioning enabled.
- **Cold tier** — cross-region replicated copy, `STANDARD_IA`
  storage class. Lifecycle policy archives to `GLACIER` after 30
  days, expires after 365 days.

Bucket layout, lifecycle config, and the cross-region replication
rule are documented in `scripts/dr/README.md` (LR-2 base) and
configured via Terraform in `infra/object-storage/` (TODO LR-4
when infra is moved out of Console UI).

## 3. Restore procedure (planned)

For DR drills or any planned restore against a non-production
target:

```bash
# 1. Discover backups
node scripts/dr/list-backups.mjs --since=7d

# 2. Provision ephemeral DB
node scripts/dr/provision-ephemeral.mjs \
  --backup-url=$BACKUP_URL \
  --label=drill-$(date +%Y%m%d)

# 3. Run smoke suite against the restored DB
node scripts/dr/restore-smoke.mjs --db-url=$EPHEMERAL_DB_URL

# 4. Tear down (provision-ephemeral does this in finally{})
```

For a planned **production** restore, see
[`runbooks/failed-migration-recovery.md`](runbooks/failed-migration-recovery.md)
§2c — the policy gate is that smoke must pass first.

## 4. Restore smoke suite

`scripts/dr/restore-smoke.mjs` exercises the surfaces that catch
the failure modes we have hit before:

- **Connectivity** — open a pool, run `SELECT 1`.
- **Migration head** — confirm `__drizzle_migrations` matches
  `shared/schema/` head.
- **Tenant isolation** — RLS smoke: insert two orgs, confirm a
  query as one cannot see the other.
- **Object-storage cross-reference** — every `kb_documents.storage_key`
  row resolves to a HEAD 200 in the configured bucket (sampled).
- **Reference data** — pinned counts for global lookup tables
  (units, equipment classes) match the snapshot.

The script exits non-zero on any failure. Wired into the
`restore-smoke` validation step (see `scripts/dr/restore-smoke.mjs`).

## 5. Retention policy

- **Hot PG dumps** — 30 days minimum. Set by lifecycle rule, not
  manual cleanup. **Never** delete a dump < 30 days old without
  on-call lead approval.
- **Cold tier** — 1 year compliance hold. Deletion suspended.
- **Object versions** — 90 days. Older versions purged automatically.

## 6. Drill cadence

- **Monthly** — full restore drill into ephemeral environment by
  on-call. Tracked in the wave doc. Outcome: GREEN / YELLOW / RED
  with attached `restore-smoke.mjs` log.
- **Quarterly** — game-day exercise involving product + support
  representing a customer-visible restore.

## 7. RTO / RPO targets

| Metric | Target | Notes |
|--------|--------|-------|
| RPO (recovery point) | ≤ 6 h | matches dump cadence |
| RTO (recovery time, single tenant) | ≤ 1 h | restore + smoke + cutover |
| RTO (full region) | ≤ 4 h | requires standby in cold region |

Targets are pinned for the pilot launch; revisit after the first
production incident or at LR-5 (post-launch hardening).
