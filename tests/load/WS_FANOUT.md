# WebSocket fan-out load proof (Task 92)

Proves that two app servers behind a shared Redis fan-out reliably
deliver every event to every subscribed WebSocket client across
repeated reconnects, exercising both the live `Pub/Sub` path and the
`XRANGE`-backed replay window documented in ADR 002.

## What it tests

- N k6 VUs are split evenly across two app servers (`:5001` and
  `:5002`) sharing one Redis. Each VU subscribes to channel
  `loadtest`.
- An out-of-band emitter publishes numbered events (`{ tag: 0, 1, 2,
  ... }`) on that channel via Redis using the exact wire format from
  `server/websocket-fanout-redis.ts` (`arus:wsstream:<org>:<channel>`
  stream + `arus:ws:<org>:<channel>` pub/sub).
- Each VU reconnects `WS_RECONNECTS` times during its iteration,
  sending its `lastEventIds` cursor on every resubscribe so the
  server's replay path fills the dead-time gap.
- Pass criteria: for each VU, the set of received `tag` values must
  be contiguous from first-seen to last-seen. Any hole counts as a
  dropped event (`ws_events_missed`) and fails the run. Connections
  that stay within the 5-minute replay window must lose **zero**
  events.

## Prerequisites

- Local Redis reachable on `REDIS_URL` (e.g. `redis://localhost:6379`).
- `k6` installed on `$PATH` (out-of-band; the rest of the repo
  installs it via `tests/load/`'s own README).
- Two free ports — defaults `5001` and `5002`. Override with `PORT1`
  / `PORT2`.

## One-shot run (boots both servers + emitter + k6)

```bash
REDIS_URL=redis://localhost:6379 \
  node tests/load/ws-fanout/run-multi-server.mjs
```

The harness:

1. Spawns `tsx server/index.ts` twice with `PORT=5001` and `PORT=5002`,
   both pointing at the same `REDIS_URL` and `NODE_ENV=development`.
2. Waits for `GET /api/healthz` on both ports.
3. Starts `tests/load/ws-fanout/emitter.mjs` (default 10 Hz for 120 s
   — tune via `EMIT_RATE_HZ` and `EMIT_DURATION_MS`).
4. Runs `k6 run tests/load/ws_fanout.js` against both ports.
5. Tears everything down with the k6 exit code.

## Manual run (debug a single piece)

```bash
# terminal 1
REDIS_URL=redis://localhost:6379 PORT=5001 NODE_ENV=development \
  npx tsx server/index.ts

# terminal 2
REDIS_URL=redis://localhost:6379 PORT=5002 NODE_ENV=development \
  npx tsx server/index.ts

# terminal 3 — keep emitting throughout the k6 run
REDIS_URL=redis://localhost:6379 EMIT_RATE_HZ=10 EMIT_DURATION_MS=120000 \
  node tests/load/ws-fanout/emitter.mjs

# terminal 4
WS_URL_1=ws://localhost:5001/ws WS_URL_2=ws://localhost:5002/ws \
  k6 run tests/load/ws_fanout.js
```

## Tuning knobs

| Env var                  | Default            | Meaning                                  |
| ------------------------ | ------------------ | ---------------------------------------- |
| `WS_VUS`                 | `20`               | k6 virtual users (split across servers). |
| `WS_RECONNECTS`          | `3`                | Reconnect cycles per VU iteration.       |
| `WS_HOLD_MS`             | `20000`            | Connection lifetime per cycle (ms).      |
| `WS_RECONNECT_GAP_MS`    | `500`              | Dead-time between cycles (must be ≪ 5min). |
| `WS_CHANNEL`             | `loadtest`         | Fan-out channel name.                    |
| `WS_ORG`                 | `default-org-id`   | Tenant the emitter publishes under.      |
| `EMIT_RATE_HZ`           | `10`               | Events per second from the emitter.      |
| `EMIT_DURATION_MS`       | `120000`           | Emitter runtime; must exceed k6 runtime. |
| `WS_TENANT_STRICT_MODE`  | `false`            | Set `true` to rerun with Task 91 strict mode (clients only subscribe to their own tenant — the emitter publishes to that tenant so delivery still passes). |

## Interpreting results

- `checks` — `ws handshake 101` should be 100%.
- `ws_events_received` — total deduped events seen across all VUs.
- `ws_events_missed` — **MUST be 0**. Non-zero means a hole was
  detected inside a VU's contiguous-tag window.
- `ws_gaps_detected` — number of VUs that observed at least one hole.
- `ws_handshake_failures` — non-zero indicates an upgrade-level
  failure (auth, port not listening, etc.) before delivery testing
  even started.

The k6 `thresholds` block fails the run if any of these breach
`count==0`.

## Out of scope

- Production deployment of the two-server config.
- Changes to the fan-out implementation itself (covered by Task 91 —
  multi-tenant isolation).
- General HTTP load testing (already covered by `steady.js` /
  `spike.js`).
