#!/usr/bin/env node
// Task 134 — chaos variant of the WS fan-out load proof.
//
// Same two-server + shared-Redis topology as run-multi-server.mjs, but
// at a scheduled offset into the run we either pause Redis (DEBUG
// SLEEP, default) or forcibly drop every Redis client connection
// (CLIENT KILL TYPE NORMAL). Either way the app servers' subscriber
// connections in server/websocket-fanout-redis.ts are knocked out for
// CHAOS_DURATION_MS, exercising:
//
//   1. The ioredis "ready" reconnect handler → resubscribeAll() path.
//   2. The XADD-fails / PUBLISH-fails graceful fallback into the
//      in-process bus.
//   3. The XRANGE replay path catching up clients that reconnect
//      after Redis comes back.
//
// The harness picks the chaos window wall-clock times BEFORE starting
// the emitter and k6, and passes them through to ws_fanout_chaos.js as
// CHAOS_DOWN_AT_MS / CHAOS_UP_AT_MS. The k6 scenario then classifies
// every received event by its emitter-supplied `emittedAtMs`:
//
//   - emittedAtMs <  CHAOS_DOWN_AT_MS - GRACE → "pre"  (must contig.)
//   - emittedAtMs in [downAt-GRACE, upAt+GRACE] → "outage" (loss OK)
//   - emittedAtMs >  CHAOS_UP_AT_MS  + GRACE  → "post" (must contig.)
//
// Pre and post contiguity is asserted independently. Outage-window
// tags are explicitly permitted to be lost — that is the relaxation
// vs. Task 92's healthy-Redis scenario.

import { spawn } from "node:child_process";
import http from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error("[chaos] REDIS_URL is required");
  process.exit(2);
}

const PORT1 = Number.parseInt(process.env.PORT1 || "5001", 10);
const PORT2 = Number.parseInt(process.env.PORT2 || "5002", 10);
const EMIT_DURATION_MS = Number.parseInt(process.env.EMIT_DURATION_MS || "60000", 10);
const EMIT_RATE_HZ = process.env.EMIT_RATE_HZ || "20";

// When to induce chaos, measured from the moment the emitter starts.
const CHAOS_AT_MS = Number.parseInt(process.env.CHAOS_AT_MS || "20000", 10);
// How long Redis stays down.
const CHAOS_DURATION_MS = Number.parseInt(process.env.CHAOS_DURATION_MS || "5000", 10);
// Grace window around the outage edges. Events emitted within
// [downAt-GRACE, upAt+GRACE] are treated as "outage" and allowed to
// be lost. Covers in-flight publishes that committed to XADD just as
// Redis stalled.
const CHAOS_GRACE_MS = Number.parseInt(process.env.CHAOS_GRACE_MS || "1500", 10);
// "pause" → DEBUG SLEEP <s>     (stalls all commands on the server)
// "kill"  → CLIENT KILL TYPE NORMAL + TYPE PUBSUB (drops connections)
const CHAOS_MODE = (process.env.CHAOS_MODE || "pause").toLowerCase();
if (!["pause", "kill"].includes(CHAOS_MODE)) {
  console.error(`[chaos] invalid CHAOS_MODE=${CHAOS_MODE} (use pause|kill)`);
  process.exit(2);
}

function startServer(port) {
  console.log(`[chaos] starting server on :${port}`);
  return spawn("npx", ["tsx", "server/index.ts"], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development",
      REDIS_URL,
      WS_TENANT_STRICT_MODE: process.env.WS_TENANT_STRICT_MODE || "false",
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
}

async function waitHealth(port, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}/api/healthz`, (r) => {
        r.resume();
        resolve(r.statusCode === 200);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await sleep(1000);
  }
  throw new Error(`server on :${port} not healthy within ${timeoutMs}ms`);
}

const procs = [];
function shutdown(code = 0) {
  for (const p of procs) {
    try {
      p.kill("SIGTERM");
    } catch {
      /* already dead */
    }
  }
  process.exit(code);
}
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => shutdown(130));
}

/**
 * Knock Redis offline for `durationMs`.
 *
 * For "pause" we fire DEBUG SLEEP on a dedicated control connection.
 * The command itself blocks the server-side thread for the requested
 * duration, so every other client (publisher + subscriber on both app
 * servers) sees commands stall and ultimately reconnect. We do NOT
 * await DEBUG SLEEP — we want to return control to the harness so it
 * can sleep for the same window and then move on.
 *
 * For "kill" we run CLIENT KILL twice on a fresh connection (NORMAL +
 * PUBSUB). All publisher / subscriber sockets are torn down; ioredis
 * reconnects, hits `ready`, and resubscribeAll() fires. There is no
 * actual command stall, so it's the gentler variant — use it to prove
 * the resubscribe handler alone rather than the full degraded path.
 */
async function induceChaos(durationMs) {
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  if (CHAOS_MODE === "pause") {
    const c = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await c.connect();
    console.log(`[chaos] pausing redis via DEBUG SLEEP ${seconds}s`);
    // Fire-and-forget; the harness's own sleep gates progression.
    c.call("DEBUG", "SLEEP", String(seconds))
      .catch((err) => console.warn(`[chaos] DEBUG SLEEP returned: ${err}`))
      .finally(() => {
        c.disconnect();
      });
    return;
  }
  // kill mode
  const c = new Redis(REDIS_URL, { lazyConnect: true });
  await c.connect();
  console.log(`[chaos] killing all client connections (CLIENT KILL)`);
  try {
    await c.call("CLIENT", "KILL", "TYPE", "NORMAL");
  } catch (err) {
    console.warn(`[chaos] CLIENT KILL TYPE NORMAL failed: ${err}`);
  }
  try {
    await c.call("CLIENT", "KILL", "TYPE", "PUBSUB");
  } catch (err) {
    console.warn(`[chaos] CLIENT KILL TYPE PUBSUB failed: ${err}`);
  }
  await c.quit().catch(() => c.disconnect());
}

const s1 = startServer(PORT1);
const s2 = startServer(PORT2);
procs.push(s1, s2);

try {
  await Promise.all([waitHealth(PORT1), waitHealth(PORT2)]);
  console.log(`[chaos] both servers healthy on :${PORT1} and :${PORT2}`);

  // Pin the wall-clock chaos window NOW, before emitter/k6 start, so
  // every component (harness, emitter, k6) shares the same absolute
  // ms reference. We give a 1s lead-in so the emitter has produced a
  // handful of pre-outage tags by the time the chaos window opens.
  const startAtMs = Date.now() + 1_000;
  const downAtMs = startAtMs + CHAOS_AT_MS;
  const upAtMs = downAtMs + CHAOS_DURATION_MS;
  console.log(
    `[chaos] schedule: start=${startAtMs} down=${downAtMs} up=${upAtMs} grace=${CHAOS_GRACE_MS}ms mode=${CHAOS_MODE}`
  );

  const emitter = spawn("node", ["tests/load/ws-fanout/emitter.mjs"], {
    env: {
      ...process.env,
      REDIS_URL,
      EMIT_DURATION_MS: String(EMIT_DURATION_MS),
      EMIT_RATE_HZ,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  procs.push(emitter);

  const k6 = spawn("k6", ["run", "tests/load/ws_fanout_chaos.js"], {
    env: {
      ...process.env,
      WS_URL_1: `ws://localhost:${PORT1}/ws`,
      WS_URL_2: `ws://localhost:${PORT2}/ws`,
      CHAOS_DOWN_AT_MS: String(downAtMs),
      CHAOS_UP_AT_MS: String(upAtMs),
      CHAOS_GRACE_MS: String(CHAOS_GRACE_MS),
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  procs.push(k6);

  // Schedule the chaos window concurrently with the running k6.
  const chaosTask = (async () => {
    const waitDown = downAtMs - Date.now();
    if (waitDown > 0) await sleep(waitDown);
    try {
      await induceChaos(CHAOS_DURATION_MS);
    } catch (err) {
      console.warn(`[chaos] induceChaos failed: ${err}`);
    }
    const waitUp = upAtMs - Date.now();
    if (waitUp > 0) await sleep(waitUp);
    console.log(`[chaos] outage window ended at ${Date.now()}`);
  })();

  const k6Code = await new Promise((resolve) => k6.on("exit", (c) => resolve(c ?? 1)));
  await chaosTask.catch(() => {});
  try {
    emitter.kill("SIGTERM");
  } catch {
    /* already gone */
  }
  shutdown(k6Code);
} catch (err) {
  console.error("[chaos] fatal", err);
  shutdown(1);
}
