# Runbook — Tenant Isolation Response

Trigger conditions:

- Alert: `TenantQuotaBlockedTelemetry`, `TenantQuotaHttp429Sustained`.
- Manual report: a tenant sees another tenant's data, OR a tenant's
  load is degrading neighbours.

This runbook covers **two distinct failure modes** — _isolation
breach_ (a correctness incident) and _noisy neighbour_ (a capacity
incident). They have very different responses.

## A. Isolation breach (correctness — SEV-1 by default)

If there is any credible report of cross-tenant data leakage, treat
it as SEV-1 even before you have confirmed it.

1. **Freeze writes for the suspected route.** Set the route into
   maintenance via the admin settings panel; this returns 503 to
   all callers and prevents further contamination.
2. **Capture the request trace.** Pull the correlation IDs from the
   reporter's screenshot/HAR and grep:
   ```
   rg "correlationId=<id>" -t log
   ```
3. **Confirm with a query.** Re-issue the request server-side with
   the reporter's session, check the returned `orgId` matches the
   session's tenant. RLS should be the fail-closed perimeter
   (`server/middleware/tenant-isolation.ts`); if RLS is in place,
   the leak must be in an application-level cache or a global
   broadcast (`WS_TENANT_STRICT_MODE` defence-in-depth lives in
   `server/websocket-fanout.ts`).
4. **Decide rollback vs hotfix.** If a deploy in the last 24h touched
   the leaked surface, roll back. Otherwise, write the hotfix on a
   branch, run the integration test
   `tests/integration/websocket-strict-mode.test.ts` plus targeted
   RLS tests, and ship.
5. **Notify affected tenants** within regulatory window (most
   contracts: 72h). Coordinate with legal.

## B. Noisy neighbour (capacity — SEV-2/3)

A single tenant is consuming a disproportionate share of resources
without breaching isolation. The quota layer already shields
neighbours; this runbook helps you decide whether to lift, hold, or
hard-cap.

1. **Identify the tenant** from the alert label
   `{org_id="..."}` in Grafana → Tenant Security panel.
2. **Quantify** — current rate vs the tenant's 30-day baseline. If
   the spike is < 3× baseline and no neighbour is feeling it,
   raise the per-tenant quota in admin settings (`tenant_quotas`
   table) by 50% and continue monitoring.
3. **If quotas already exhausted at HTTP layer** (`arus_http_requests_total{code="429"}` ≥ 1/sec for 15 min):
   - Reach out to the tenant's account owner. Confirm intent.
   - Either raise the quota (commercial decision) or apply
     `WS_ORG_CONNECTION_LIMIT` per-process to cap their WS
     consumption (see `websocket-outage.md`).
4. **If the spike is malicious** (auth-spray, scraping):
   - Block at the edge via the proxy / CDN.
   - Rotate the tenant's API keys.
   - Open SEV-2 incident; treat as a security event.

## Recovery checklist

- [ ] Alert cleared for ≥ 2× `for:` window.
- [ ] Affected tenants notified (breach only).
- [ ] Post-mortem ticket filed.
- [ ] Quota tables reverted to baseline OR new baseline documented
      in `docs/architecture/waves.md`.
