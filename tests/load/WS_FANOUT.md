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

## Scheduled CI run (Task 133)

`.github/workflows/ws-fanout-nightly.yml` runs this same harness at
04:00 UTC every night (and on `workflow_dispatch`) against an ephemeral
Redis 7 + Postgres 16 service pair. The job:

1. Installs `k6` from the official APT repo.
2. Boots Postgres + Redis as GitHub Actions services and applies
   migrations.
3. Invokes `node tests/load/ws-fanout/run-multi-server.mjs`, capturing
   combined harness + emitter + k6 output into
   `artifacts/ws-fanout/run.log` via `tee` under `set -o pipefail`.
4. Uploads `artifacts/ws-fanout/` as a workflow artifact
   (`ws-fanout-nightly-<run_id>`, 14-day retention) on every run —
   pass or fail — for triage.

The k6 `thresholds` block already fails the run on any
`ws_events_missed`, `ws_gaps_detected`, or `ws_handshake_failures`, and
the harness propagates k6's exit code, so any dropped event fails the
scheduled job.

`workflow_dispatch` exposes `ws_vus` and `ws_reconnects` inputs so
operators can rerun the proof with a bigger load on demand without
editing the workflow file.

## Chaos variant — Redis blip mid-run (Task 134)

The default scenario asserts zero loss while Redis stays healthy. The
chaos variant proves the documented recovery guarantees in
`server/websocket-fanout-redis.ts` still hold when Redis goes away
mid-run:

1. **ioredis `ready` → `resubscribeAll()`** — when the subscriber
   socket reconnects after a blip, every `(orgId, channel)` with a
   non-zero local refcount gets re-`SUBSCRIBE`d before the next peer
   publish arrives.
2. **Graceful XADD / PUBLISH fallback** — if a publish hits Redis
   mid-blip, the publisher falls through to the in-process bus so
   local clients still get the event (cross-node peers may miss it
   until the stream comes back).
3. **XRANGE replay after recovery** — clients that reconnect after
   Redis is healthy fill the gap from the per-channel stream.

### Run it

```bash
REDIS_URL=redis://localhost:6379 \
  node tests/load/ws-fanout/run-chaos.mjs
```

The harness picks the outage's absolute wall-clock window (`downAt`
and `upAt`) BEFORE the emitter and k6 start, passes them through to
`tests/load/ws_fanout_chaos.js` as `CHAOS_DOWN_AT_MS` /
`CHAOS_UP_AT_MS`, then knocks Redis offline for `CHAOS_DURATION_MS`
at `downAt`.

### Chaos-specific knobs

| Env var               | Default   | Meaning                                                                                                  |
| --------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `CHAOS_AT_MS`         | `20000`   | Offset from emitter start when the outage begins.                                                        |
| `CHAOS_DURATION_MS`   | `5000`    | How long Redis stays offline.                                                                            |
| `CHAOS_GRACE_MS`      | `1500`    | Slack added to each side of the outage window when classifying events. Covers in-flight publishes.       |
| `CHAOS_MODE`          | `pause`   | `pause` → `DEBUG SLEEP <s>` (stalls every command server-side). `kill` → `CLIENT KILL TYPE NORMAL+PUBSUB` (drops connections only — gentler, exercises the resubscribe handler in isolation). |
| `EMIT_DURATION_MS`    | `60000`   | Must comfortably exceed `CHAOS_AT_MS + CHAOS_DURATION_MS` plus k6 hold time so a healthy post-outage tail exists. |

### Pass criteria

Each VU classifies every received event by its emitter-stamped
`emittedAtMs`:

- `pre`    — `emittedAtMs < downAt - GRACE` → contiguity required.
- `outage` — inside `[downAt - GRACE, upAt + GRACE]` → loss permitted.
- `post`   — `emittedAtMs > upAt + GRACE` → contiguity required.

Thresholds:

- `ws_events_missed_strict` — **MUST be 0**. Any gap inside the pre
  or post window means recovery failed.
- `ws_gaps_detected_strict` — **MUST be 0**. Same condition,
  per-VU.
- `ws_handshake_failures` — **MUST be 0**.
- `ws_outage_events_lost` — informational only. Tracks the per-VU
  loss tolerated inside the outage band; expected to be non-zero in
  `pause` mode when the publisher path stalls.

If the strict counters are zero but `ws_outage_events_lost` is also
zero, peers caught everything via XRANGE replay on the post-outage
reconnect — the strongest recovery shape.

### Scheduled CI run (Task 145)

`.github/workflows/ws-fanout-chaos-nightly.yml` runs the chaos harness
on the same nightly cadence as the healthy proof (04:30 UTC, 30 min
after `ws-fanout-nightly.yml`) as a two-job matrix — once with
`CHAOS_MODE=pause` and once with `CHAOS_MODE=kill` — so a regression
in either the `XADD/PUBLISH` fallback + `XRANGE` replay path (`pause`)
or the `resubscribe-on-ready` path (`kill`) fails the scheduled run
independently. The job:

1. Enables `DEBUG SLEEP` on the ephemeral Redis service
   (`CONFIG SET enable-debug-command yes`) — required by `pause` mode.
2. Invokes `node tests/load/ws-fanout/run-chaos.mjs` with `CHAOS_MODE`
   pinned by the matrix axis, capturing combined harness + emitter +
   k6 output into `artifacts/ws-fanout-chaos/run-<mode>.log`.
3. Parses the k6 end-of-run counters out of that log into a
   per-mode `summary-<mode>.json` sidecar and a `$GITHUB_STEP_SUMMARY`
   table (received / outage-lost / strict-missed / handshake-failed /
   max-tag), so trends across nightly runs can be reconstructed from
   the archived artifacts without re-running the proof.
4. Uploads `artifacts/ws-fanout-chaos/` as a per-mode workflow artifact
   (`ws-fanout-chaos-<mode>-<run_id>`, 30-day retention) on every run.
5. On a *scheduled* failure (not `workflow_dispatch`), opens a GitHub
   issue tagged `area/ws-bus` + `alert/scheduled-proof` so whoever
   owns `server/websocket-fanout-redis.ts` is paged through normal
   issue-triage.

`workflow_dispatch` exposes `chaos_mode` (`pause` / `kill` / `both`),
`chaos_duration_ms`, and `emit_duration_ms` inputs for on-demand reruns.

## Out of scope

- Production deployment of the two-server config.
- Changes to the fan-out implementation itself (covered by Task 91 —
  multi-tenant isolation).
- General HTTP load testing (already covered by `steady.js` /
  `spike.js`).
