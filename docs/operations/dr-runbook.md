# ARUS Disaster Recovery Runbook

**Wave 2.7** — operational playbook for restoring the ARUS platform after a destructive incident. This document is the human counterpart to Wave 2.3/2.4 (DR infra, out of repo scope).

**Scope:** what to do, in what order, with what command, when something has gone irrecoverably wrong with the cloud-hosted production deployment of ARUS (Express + PostgreSQL + Redis + optional TimescaleDB/Loki/Sentry/OTel).

**Audience:** on-call engineer with shell + cloud-console access, no prior context on the failure.

---

## 0. Service Level Objectives

| Tier                              | Target                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------ |
| RTO (full platform restore)       | **2 h**                                                                        |
| RPO (max acceptable data loss)    | **5 min** (PITR window)                                                        |
| RTO (read-only / degraded mode)   | **30 min**                                                                     |
| Telemetry ingestion gap tolerated | **15 min** (edge devices buffer locally per `compliance/telemetry-resilience`) |

PITR window is set by the WAL retention on the managed Postgres provider (Neon/RDS). If that retention is shorter than 5 min in your environment, this RPO is aspirational — adjust the provider config first.

---

## 1. Incident Classification

Decide the scenario before touching anything. Each tier maps to a different procedure below.

| Class                                                        | Trigger                                                                                | Procedure                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------- |
| **A. App-tier outage**                                       | All `/api/healthz` 5xx; DB reachable from a bastion; no data loss suspected            | §4                                  |
| **B. Database corruption / accidental DROP / bad migration** | Queries succeed but return wrong/missing data; recent destructive DDL/DML in audit log | §5 (PITR)                           |
| **C. Region-wide outage**                                    | Provider dashboard red; multiple services down                                         | §6 (cross-region failover)          |
| **D. Suspected data exfiltration / ransomware**              | IDS alert, unusual egress, unknown admin session                                       | §7 (containment + forensic restore) |
| **E. Tenant-level corruption**                               | One `org_id` reports bad data, rest of platform healthy                                | §8 (tenant-scoped restore)          |

If you cannot classify within 5 minutes, **declare Class C** and proceed conservatively.

---

## 2. Pre-flight Checks (every scenario)

Before any restore, capture state. The post-incident review will need this.

```bash
# 1. Snapshot the current (broken) DB so we can compare after restore
pg_dump "$DATABASE_URL" --format=custom --file=/tmp/pre-restore-$(date +%s).dump

# 2. Snapshot Redis keyspace
redis-cli --rdb /tmp/pre-restore-$(date +%s).rdb

# 3. Capture last 1h of app logs (Loki if enabled, else stdout scraper)
#    LOKI_URL set per Wave 2.2
curl -G "$LOKI_URL/loki/api/v1/query_range" \
  --data-urlencode 'query={service="arus"}' \
  --data-urlencode "start=$(date -u -d '1 hour ago' +%s)000000000" \
  --data-urlencode "end=$(date -u +%s)000000000" \
  > /tmp/pre-restore-logs-$(date +%s).json

# 4. Capture last 50 background jobs (Wave 0.1 ring buffer)
curl -s "$PROD_URL/api/health/background-jobs" > /tmp/pre-restore-jobs.json

# 5. Note current admin sessions so we can re-issue MFA challenges (Wave 1.2)
psql "$DATABASE_URL" -c "SELECT id, user_id, last_seen_at, mfa_verified FROM user_sessions WHERE revoked_at IS NULL;"
```

If you cannot connect to the DB at all, skip 1/5 and jump to §5 or §6.

---

## 3. Communications

The moment you have classified the incident:

1. Page secondary on-call (4-eye rule for destructive ops).
2. Post in `#arus-incidents` Slack channel: `class`, `affected scope`, `eta`.
3. Flip the public status page to **Investigating** (or **Identified** once §1 is done).
4. If Class B/D, freeze deployments — set `DEPLOY_LOCK=true` in your CI/CD config so no merge can push.
5. If GDPR-relevant (Class D, EU tenants affected), start the 72h breach-notification clock per `server/domains/gdpr/`.

---

## 4. Class A — App-tier Outage

The DB and Redis are fine; the Node process is wedged or crash-looping.

### 4.1 Diagnose

```bash
# Healthcheck
curl -i "$PROD_URL/api/healthz"

# Sentry (Wave 0.4) — last 15 min of errors
#   open https://sentry.io/organizations/<org>/issues/?project=<id>&statsPeriod=15m

# Background jobs (Wave 0.1)
curl -s "$PROD_URL/api/health/background-jobs" | jq .

# OTel traces (Wave 2.1) for the slow/failing endpoint
#   open Tempo/Jaeger UI, filter service="arus", error=true
```

### 4.2 Restore

In order — stop as soon as one works.

1. **Restart the app workflow.** Most app-tier outages are a wedged process.
   ```bash
   # On Replit deployments
   #   use Deployments → Restart in the UI
   # On k8s
   kubectl rollout restart deployment/arus
   ```
2. **Rollback to the previous deploy.** If 1 didn't fix it and the incident started right after a release.
   ```bash
   # Replit
   #   use Deployments → Rollback to the previous green build
   # k8s
   kubectl rollout undo deployment/arus
   ```
3. **Flush Redis** (if circuit breaker is open and won't reset — see `redis-circuit-breaker.ts`).
   ```bash
   redis-cli FLUSHDB
   # Caches will repopulate; rate limits will reset (acceptable trade-off)
   ```
4. **Disable the offending feature flag** (Wave 0.6).
   ```bash
   psql "$DATABASE_URL" -c \
     "INSERT INTO feature_flag_overrides (flag_key, scope, enabled)
      VALUES ('<flag>', 'global', false)
      ON CONFLICT DO UPDATE SET enabled=false;"
   # Auto-refresh picks it up within 60s; no restart needed.
   ```

### 4.3 Verify

```bash
curl "$PROD_URL/api/healthz"            # 200
curl "$PROD_URL/api/v1/vessels" \
     -H "Authorization: Bearer $SMOKE_TOKEN" \
     -o /dev/null -w "%{http_code} %{time_total}s\n"   # 200 < 500ms
# Smoke run from a checked-out repo (Wave 2.6):
BASE_URL="$PROD_URL" k6 run tests/load/smoke.js
```

---

## 5. Class B — Database PITR Restore

The data is wrong; the app process may or may not be running.

### 5.1 Identify the recovery point

You want the latest timestamp **before** the destructive event.

```bash
# Search audit log for the destructive statement
psql "$DATABASE_URL" -c "
  SELECT created_at, actor_user_id, action, target_table, payload
  FROM admin_audit_log
  WHERE action ~* '(drop|truncate|delete)'
    AND created_at > now() - interval '6 hours'
  ORDER BY created_at DESC
  LIMIT 50;"
```

Note the `created_at` of the bad statement. Recovery target = that timestamp **minus 30 seconds** (give yourself a margin; PITR resolution is sub-second on managed Postgres).

### 5.2 Restore to a parallel database

**Never** restore over the live DB. Restore to a fresh instance, validate, then cut over.

```bash
# Neon (managed Postgres on Replit deployments)
#   1. Console → Branches → Create branch
#   2. Source: main
#   3. Type: "Point in time"
#   4. Timestamp: <recovery-target>
#   5. Name: restore-<incident-id>
#   This produces a new DATABASE_URL — call it $RESTORE_URL.

# RDS
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier arus-prod \
  --target-db-instance-identifier arus-restore-$(date +%s) \
  --restore-time <recovery-target-iso8601>
```

### 5.3 Validate the restore

```bash
# Schema parity
psql "$RESTORE_URL" -c "\dt" | wc -l
psql "$DATABASE_URL" -c "\dt" | wc -l    # row count should match (modulo dropped tables)

# Row counts for the affected tables
psql "$RESTORE_URL" -c "SELECT count(*) FROM <affected_table>;"

# Spot-check a known-good record (e.g. a vessel registered last week)
psql "$RESTORE_URL" -c "SELECT * FROM vessels WHERE imo_number = '<known-imo>';"

# Run the convergence guardrail scripts against the restore
DATABASE_URL=$RESTORE_URL npm run check:schema-drift
DATABASE_URL=$RESTORE_URL npm run check:domain-leaks
```

### 5.4 Cut over

```bash
# 1. Drain: put app into maintenance mode
psql "$DATABASE_URL" -c \
  "INSERT INTO feature_flag_overrides (flag_key, scope, enabled)
   VALUES ('maintenance_mode', 'global', true)
   ON CONFLICT DO UPDATE SET enabled=true;"
# Wait 90s for the 60s flag refresh + in-flight requests.

# 2. Final delta capture from live DB into restore (manual; only do this if
#    you can prove the destructive event only touched specific tables and the
#    rest of the DB has legitimate post-incident writes you want to keep).
#    Otherwise SKIP — accept the data loss between recovery-target and now.

# 3. Repoint the app
#    Update DATABASE_URL secret → $RESTORE_URL value
#    Trigger app restart (see §4.2 step 1)

# 4. Lift maintenance mode
psql "$RESTORE_URL" -c \
  "UPDATE feature_flag_overrides SET enabled=false WHERE flag_key='maintenance_mode';"
```

### 5.5 Post-cutover

- Telemetry edge devices will replay their local buffer (per `compliance/telemetry-resilience`). Expect a 5–15 min ingestion spike — do not interpret this as an attack.
- Background jobs that were in-flight at the moment of the destructive event are now lost. The pg-boss processors are idempotent on `clientMutationId` (Wave 2.5), but jobs without it must be re-triggered manually. Check `pgboss_bg.job` table on the restore for `state='active'` rows older than 1h and either retry or archive them.
- Revoke all sessions issued between recovery-target and cutover; force re-login.
  ```bash
  psql "$RESTORE_URL" -c \
    "UPDATE user_sessions SET revoked_at = now() WHERE created_at > '<recovery-target>';"
  ```

---

## 6. Class C — Region Failover

The primary cloud region is unreachable.

### 6.1 Prerequisites (set up in advance — not during the incident)

- Cross-region read replica of Postgres in a paired region.
- Container image mirrored to the paired region's registry.
- DNS TTL on the public hostname set to ≤60s.
- `ARUS_REGION` env var per deployment so logs and metrics carry region tags.

### 6.2 Promote

```bash
# Postgres (Neon — read-replica branch)
#   Console → branch → Promote to primary
# RDS
aws rds promote-read-replica --db-instance-identifier arus-prod-dr-replica

# Note the new write endpoint → $DR_DATABASE_URL
```

### 6.3 Bring up the app in the DR region

```bash
# Update the deployment's DATABASE_URL to $DR_DATABASE_URL
# Update REDIS_URL to the DR Redis (which starts cold — caches will rebuild)
# Apply the deploy in the DR region
```

### 6.4 Repoint DNS

```bash
# Route53 (or your DNS provider)
#   Change A/ALIAS record for arus.example.com → DR LB endpoint
#   TTL: 60s
# Verify propagation:
dig arus.example.com +short
```

### 6.5 Verify

Same checks as §4.3. Additionally:

```bash
# Confirm edge devices are reconnecting
psql "$DR_DATABASE_URL" -c \
  "SELECT count(*), max(last_heartbeat_at)
   FROM equipment_heartbeats
   WHERE last_heartbeat_at > now() - interval '5 minutes';"
```

### 6.6 Failback (after the primary region returns)

Do **not** rush failback. Run on DR for at least 24h to confirm stability. When ready, treat it as another Class C event in reverse: promote the (now-healed) primary as a read replica, then promote back.

---

## 7. Class D — Suspected Compromise

**Containment first. Investigation second. Restoration third.**

### 7.1 Contain

```bash
# 1. Revoke ALL active sessions
psql "$DATABASE_URL" -c "UPDATE user_sessions SET revoked_at = now() WHERE revoked_at IS NULL;"

# 2. Rotate all secrets in the deployment's secret store:
#    - SESSION_SECRET (forces all signed cookies invalid)
#    - DATABASE_URL credentials
#    - OPENAI_API_KEY
#    - KMS_KEY_ID grant (Wave 1.3 — revoke the IAM principal, not the key)
#    - SSO IdP shared secrets (Wave 1.1)
#    - LOKI_BEARER_TOKEN / SENTRY_DSN if exposed
# 3. Force-rotate every user's MFA secret (Wave 1.2):
psql "$DATABASE_URL" -c \
  "UPDATE users SET mfa_secret = NULL, mfa_enrolled_at = NULL;"
# 4. Block the suspicious IP at the LB/WAF
```

### 7.2 Preserve evidence

Snapshot **before** restoring. Forensic-grade copies into a separate, locked-down bucket.

```bash
pg_dump "$DATABASE_URL" --format=custom --file=evidence-db-$(date +%s).dump
redis-cli --rdb evidence-redis-$(date +%s).rdb
# Pull last 7d of logs from Loki into the evidence bucket
```

### 7.3 Restore

PITR to the last known-clean timestamp (per §5), then audit-diff between the clean point and now to identify what the attacker touched.

### 7.4 Notify

- Security lead (immediately).
- DPO if EU tenants: 72h GDPR clock starts at **detection**, not declaration.
- Affected tenants per their contractual SLA.

---

## 8. Class E — Tenant-scoped Restore

One `org_id` is corrupted, the rest of the platform is healthy. Restoring the whole DB would lose hours of legitimate cross-tenant writes — don't do that.

### 8.1 Restore to parallel DB (§5.1–5.3)

### 8.2 Extract the single tenant

```bash
# For each table that carries org_id (allowlist — see server/domains/gdpr/tenant-delete-service.ts
# for the canonical list, it's the same set), dump only the affected tenant:

export TENANT_ID="<affected-org-id>"

for table in $(cat scripts/dr/org-scoped-tables.txt); do
  psql "$RESTORE_URL" -c \
    "\COPY (SELECT * FROM $table WHERE org_id = '$TENANT_ID') TO '/tmp/restore-$table.csv' CSV HEADER"
done
```

### 8.3 Apply to live DB

```bash
# In one transaction:
psql "$DATABASE_URL" <<SQL
BEGIN;
SELECT set_config('app.current_org_id', '$TENANT_ID', true);
-- DELETE corrupted tenant rows, INSERT from CSVs in dependency order
-- (run scripts/dr/apply-tenant-restore.sh which encodes the order)
COMMIT;
SQL
```

### 8.4 Verify

```bash
# Hit a tenant-scoped endpoint as a user from that org
curl -H "Authorization: Bearer $TENANT_SMOKE_TOKEN" "$PROD_URL/api/v1/vessels"
```

---

## 9. Post-Incident

Within 5 business days of the incident:

1. **Blameless post-mortem.** Template at `docs/operations/post-mortem-template.md` (create if missing).
2. **Update this runbook.** If a step was wrong, missing, or ambiguous — fix it now while it's fresh.
3. **Audit log review.** Confirm the destructive event made it into `admin_audit_log` (if not, that's a P0 follow-up).
4. **Restore drill scheduling.** This runbook is only as good as its last rehearsal. Drill quarterly.

---

## 10. Drill Checklist (run quarterly)

Pick a Tuesday morning. Notify the team. Drill against a staging clone, never prod.

- [ ] Class A: kill the app process, verify restart restores service in <5 min.
- [ ] Class B: simulate a `DELETE FROM vessels WHERE imo_number LIKE '9%'`, restore via PITR, time the procedure end-to-end. Target <2h.
- [ ] Class C: failover staging from primary to DR region, run smoke (`k6 run tests/load/smoke.js`), failback. Target <30 min.
- [ ] Class D: rotate one non-critical secret, confirm app continues serving (validates rotation procedure without an actual incident).
- [ ] Class E: pick a test tenant, corrupt its data, restore via §8. Target <1h.

Record times in `docs/operations/dr-drill-log.md`. If any drill misses its target by >50%, file a P1 ticket to fix the gap.

---

## Cross-references

| If you need...                | See                                                       |
| ----------------------------- | --------------------------------------------------------- |
| Background job state          | `server/background-jobs.ts` (Wave 0.1)                    |
| Feature flag overrides        | `server/infrastructure/feature-flags.ts` (Wave 0.6)       |
| Idempotency keys for replay   | `server/middleware/idempotency.ts` (Wave 2.5)             |
| Tenant table allowlist        | `server/domains/gdpr/tenant-delete-service.ts` (Wave 6.6) |
| Telemetry edge buffering      | `compliance/telemetry-resilience` (Operational layer)     |
| Smoke/steady/spike load tests | `tests/load/` (Wave 2.6)                                  |
