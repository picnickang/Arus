# Runbook — Incident Response (general)

Use this runbook when:
- An alert from `ops/prometheus/rules.yaml` pages you and a more
  specific runbook below does not apply.
- A user-visible outage is reported via support.

For specific surfaces, jump to:
- [tenant-isolation-response.md](tenant-isolation-response.md)
- [failed-migration-recovery.md](failed-migration-recovery.md)
- [websocket-outage.md](websocket-outage.md)
- [ai-promotion-rollback.md](ai-promotion-rollback.md)

## 1. Triage (first 5 minutes)

1. **Acknowledge the page** in PagerDuty within 5 minutes.
2. Open the **System Health** dashboard
   (`ops/grafana/system-health.json`). Note the trip time and which
   SLI moved first.
3. Declare severity:
   - **SEV-1** — production data loss, tenant cross-contamination,
     auth broken for all users, or > 50% error rate sustained 5 min.
   - **SEV-2** — single tenant down, single surface degraded > 10 min.
   - **SEV-3** — partial degradation, no user-visible loss.
4. Open `#incident-<yyyymmdd>-<short-name>` Slack channel. Pin the
   alert URL, dashboard link, and the on-call commander.

## 2. Stabilise

Priority order — never skip:

1. **Stop the bleeding.** If a deploy in the last 60 min correlates,
   roll it back via `npm run deploy:rollback` or the Replit Deployments
   UI. Do this *before* root-cause analysis.
2. **Shed load** if the issue is capacity:
   - WebSocket: lower `WS_ORG_CONNECTION_LIMIT` to the p95 healthy
     value (see Grafana → WS Fan-out).
   - HTTP: enable `MAINTENANCE_MODE=1` on the noisiest route via
     the admin settings panel.
   - Telemetry ingest: per-tenant quotas are already enforced; check
     `arus_telemetry_batch_quota_blocked_total` for noisy neighbours.
3. **Preserve evidence.** Snapshot recent logs:
   ```
   node scripts/dr/snapshot-logs.mjs --since=2h --out=artifacts/incidents/<id>
   ```

## 3. Communicate

- T+0–15 min: post initial status to status page.
- Every 30 min: cadence updates until resolved.
- On resolve: post mortem within 5 business days. Template in
  `docs/operations/postmortem-template.md` (TODO LR-4).

## 4. Recover

1. Verify the alert clears for ≥ 2× its `for:` window before
   declaring "resolved".
2. Re-enable any features disabled in §2 in reverse order.
3. Run targeted smoke:
   ```
   npm run test:smoke
   k6 run tests/load/smoke.js
   ```

## 5. Decommission the incident

- Move PagerDuty incident to "resolved" only after smoke is green.
- Archive Slack channel.
- File post-mortem ticket.
- Update this runbook if any step here proved wrong or missing.
