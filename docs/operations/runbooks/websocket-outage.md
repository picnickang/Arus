# Runbook — WebSocket Outage

Trigger conditions:
- Alert: `WsConnectionsZero`, `WsConnectionsRejectedSpike`,
  `WsNightlyFanoutFailed`.
- User report: "the page is no longer updating live" / "I have to
  refresh to see new readings".

ARUS's WebSocket fan-out is documented in
[`websocket-scale-out.md`](../websocket-scale-out.md). This runbook
is the operator's quick path; read the design doc for context.

## 1. Decide the failure mode

Open Grafana → **WebSocket Fan-out** dashboard. Three signatures:

| Signature | Likely cause | Section |
|-----------|--------------|---------|
| `connections_active == 0` everywhere | Proxy or upgrade path broken | §2 |
| `connections_rejected_total{reason="cap_exceeded"}` rising for one org | LR-3 cap working as designed (or set too low) | §3 |
| `connections_active` healthy but client UI not updating | Fan-out gap — Redis or `WS_TENANT_STRICT_MODE` | §4 |

## 2. Upgrade path broken (no connections at all)

1. From the shell:
   ```
   curl -i \
     -H "Connection: Upgrade" -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     $REPLIT_DEV_DOMAIN/ws
   ```
   Expect HTTP 101 Switching Protocols. If you see a 4xx/5xx, the
   reverse proxy or the upgrade route is broken.
2. Check structured logs for `WebSocket upgrade rejected`. The
   reason string tells you whether auth failed
   (`UNAUTHENTICATED`/`INVALID_TOKEN`/`SESSION_EXPIRED`) or the
   server itself bounced the request.
3. If auth is the cause and `REQUIRE_TENANT_AUTH=1` was just turned
   on, roll back the env var until clients re-auth.
4. If the WS server has stalled, restart the workflow:
   ```
   # via Replit UI: restart "Start application"
   ```

## 3. Per-org cap exceeded

The per-org cap is configured via `WS_ORG_CONNECTION_LIMIT`
(LR-3). When a tenant hits the cap:

- New upgrades return close code `4290`
  (`ORG_CONNECTION_LIMIT_EXCEEDED`).
- Counter `arus_websocket_connections_rejected_total{org_id, reason="cap_exceeded"}` ticks.
- Gauge `arus_websocket_connections_active_per_org{org_id}` plateaus
  at the cap.

Decision tree:

1. **Is this a normal load pattern for the tenant?** Compare to the
   tenant's 30-day p95 of `connections_active_per_org`. If above
   p95 by < 50%, raise `WS_ORG_CONNECTION_LIMIT` and redeploy.
2. **Is the tenant leaking sockets?** Look for a high reconnection
   rate (`arus_websocket_reconnections_total{reason}`). If yes,
   ask the tenant's frontend owner to confirm they call `ws.close()`
   on page unload.
3. **Malicious / runaway client?** Coordinate with security; rotate
   the tenant's tokens.

If you set the cap incorrectly:

```bash
# unset cap entirely (no behavior change vs pre-LR-3)
unset WS_ORG_CONNECTION_LIMIT

# or raise it
export WS_ORG_CONNECTION_LIMIT=500
```

The cap is read at handshake time — **no restart required**.

## 4. Fan-out gap (UI not updating despite active connections)

1. Check Redis health:
   ```
   redis-cli -u "$REDIS_URL" PING
   redis-cli -u "$REDIS_URL" INFO clients
   ```
2. If `WS_TENANT_STRICT_MODE=true` and a publisher is calling
   `wsServer.broadcast(channel, data)` without an explicit
   `orgId`, the broadcast is **dropped** with a structured warning.
   Grep:
   ```
   rg "WS_TENANT_STRICT_MODE dropped SYSTEM_ORG_ID broadcast"
   ```
   Fix the publisher to pass an explicit `orgId`.
3. Run the nightly fan-out proof on demand to confirm:
   ```
   gh workflow run ws-fanout-nightly.yml
   ```

## 5. Resolve

- Alert cleared for ≥ 2× `for:` window.
- Spot-check the fleet dashboard with a known-good tenant —
  observable updates within 2 s.
- File post-mortem if SEV-2+.
