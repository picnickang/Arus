# WebSocket Horizontal Scale-out

**Push:** B2 — WebSocket Fan-out & Horizontal Scale.
**Substrate:** Redis Pub/Sub + Redis Streams (ADR 002).
**Audience:** Platform operators, deployment configuration owners.

## When to enable

Single-instance deployments (most dev environments, the default Replit
dev workflow) do **not** need this. The WebSocket server already works
end-to-end against the in-process fan-out bus and the in-memory replay
buffer.

Turn this on when:
- More than one Node instance serves `/ws` behind a load balancer, OR
- You want autoscale-out for WebSocket-heavy tenants, OR
- You want clients that briefly disconnect (mobile sleep, transient
  network loss) to receive missed events on reconnect rather than just
  the live stream from that point forward.

## How to enable

Set on every Node instance:

```
WS_REDIS_FANOUT=true
REDIS_HOST=…           # already used by the rate-limiter and cache
REDIS_PORT=6379
REDIS_PASSWORD=…
```

Boot sequence (in `server/routes.ts`):

1. If `WS_REDIS_FANOUT=true`, install `RedisFanoutBus` on the
   `getFanoutBus()` singleton **before** `new TelemetryWebSocketServer`.
2. The WS server picks up the active bus on construction; nothing else
   changes.

The Redis bus extends the in-process bus, so every locally-published
event still dispatches synchronously to local clients — Redis only
carries the peer-to-peer hop.

## Sticky sessions — remove from the load balancer

Pre-B2, the load balancer needed `/ws` session affinity because a
client connected to node A would never hear about events published on
node B. With `WS_REDIS_FANOUT=true` this is no longer true — every
node sees every event for the channels its clients have subscribed to.

Concretely, in your LB config:

- **Replit Deployments:** the platform default (no session affinity)
  works as-is — no action required.
- **AWS ALB / NLB:** set target group `stickiness.enabled = false` for
  the listener that forwards `/ws`.
- **nginx:** remove `ip_hash;` from the upstream block. The default
  round-robin balancer is correct.
- **Kubernetes Service / Ingress:** remove
  `service.spec.sessionAffinity: ClientIP` (set it back to `None`).
  Ingress controllers usually default to round-robin; verify any
  controller-specific stickiness annotations are absent.

Verification: bring up two instances, point a load-tester at `/ws`,
confirm both instances are receiving roughly equal upgrade traffic
(`setWebSocketConnections` gauge in Prometheus / `getConnectedClients`
in admin diagnostics).

## Autoscale signal

WS-bearing workloads scale on two metrics:

1. **CPU utilization** (already standard).
2. **WS connection count per instance** — exposed by the existing
   `setWebSocketConnections(this.clients.size)` gauge in
   `server/observability.ts`. Threshold to start with: scale out at
   ≥4,000 connections per instance; scale in below 1,500.

### Replit deployment autoscale

In `.replit` or the deployment UI:

- Mode: `autoscale`.
- Min instances: 1 (single-instance traffic is the common case).
- Max instances: tune to expected concurrent WS connections / 4,000.
- Scaling signal: CPU (built-in). The WS-connection metric is exposed
  for observability but the platform's autoscaler only currently
  consumes CPU — use the connection gauge to *validate* scale events
  after the fact and to tune the max-instances ceiling.

### Kubernetes HPA (reference)

```
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: arus-ws
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: arus-ws
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: arus_websocket_connections
        target:
          type: AverageValue
          averageValue: "3500"
```

The `arus_websocket_connections` gauge name maps to whichever
Prometheus exporter your deployment uses; check `server/observability.ts`
for the canonical metric registration.

## k6 spike — acceptance harness

`tests/load/spike.js` is the synthetic load script from Wave 2.6.
Re-run it with the env var pointed at the LB front-door:

```
BASE_URL=https://<deployment>.replit.app k6 run tests/load/spike.js
```

Pass criteria (per the test's `thresholds` block):
- `http_req_failed` rate < 5%.
- p95 `http_req_duration` < 1500ms.

With `WS_REDIS_FANOUT=true` and round-robin LB, autoscale should
trigger a scale-out during the 1-minute plateau at 100 VUs and stay
stable.

## Operational notes

- The Redis bus opens a second connection (`.duplicate()`) for the
  subscriber side, since ioredis cannot run pub/sub commands on a
  connection that is also serving regular commands. This doubles the
  Redis connection count per Node — budget for it.
- If Redis goes down, the WS layer **degrades to in-process delivery**
  (the `redis-client.ts` circuit breaker opens; the fan-out bus falls
  back to its in-memory ring). Cross-node delivery stops, but local
  delivery and the local replay buffer keep working — the surface
  doesn't fail closed.
- Replay window is 5 minutes (`REPLAY_WINDOW_MS` in
  `server/websocket-fanout.ts`). Longer-window persistence is the
  remit of the event-streaming spine (Push B3), not the WS layer.
- The `eventId` format is `<unix-ms>-<seq>` to stay byte-compatible
  with Redis Stream IDs; clients (`client/src/hooks/useWebSocket.ts`)
  parse and compare numerically.

## References

- ADR 002 — `docs/architecture/adr/002-websocket-fanout.md`.
- `server/websocket-fanout.ts` — abstraction + in-process default.
- `server/websocket-fanout-redis.ts` — Redis-backed adapter.
- `server/websocket.ts` — server integration & replay protocol.
- `client/src/hooks/useWebSocket.ts` — client reconnect cursor.
