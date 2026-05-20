#!/usr/bin/env node
// Task 92 — harness that boots two app servers against a shared Redis,
// runs the WS fan-out emitter + k6 scenario, then tears everything down.
//
// REDIS_URL must be set (see tests/load/WS_FANOUT.md). PORT1/PORT2 are
// optional; defaults 5001/5002 avoid colliding with the normal dev
// workflow on 5000.
import { spawn } from "node:child_process";
import http from "node:http";
import { setTimeout as sleep } from "node:timers/promises";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error("[harness] REDIS_URL is required");
  process.exit(2);
}

const PORT1 = Number.parseInt(process.env.PORT1 || "5001", 10);
const PORT2 = Number.parseInt(process.env.PORT2 || "5002", 10);
const EMIT_DURATION_MS = process.env.EMIT_DURATION_MS || "120000";
const EMIT_RATE_HZ = process.env.EMIT_RATE_HZ || "10";

function startServer(port) {
  console.log(`[harness] starting server on :${port}`);
  return spawn("npx", ["tsx", "server/index.ts"], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development",
      REDIS_URL,
      // Keep both servers on the same fan-out posture; flip on for a
      // strict-mode regression run.
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

const s1 = startServer(PORT1);
const s2 = startServer(PORT2);
procs.push(s1, s2);

try {
  await Promise.all([waitHealth(PORT1), waitHealth(PORT2)]);
  console.log(`[harness] both servers healthy on :${PORT1} and :${PORT2}`);

  const emitter = spawn("node", ["tests/load/ws-fanout/emitter.mjs"], {
    env: {
      ...process.env,
      REDIS_URL,
      EMIT_DURATION_MS,
      EMIT_RATE_HZ,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  procs.push(emitter);

  // Give the emitter a head start so VUs see live events on the very
  // first connection (rather than only via replay).
  await sleep(1000);

  const k6 = spawn("k6", ["run", "tests/load/ws_fanout.js"], {
    env: {
      ...process.env,
      WS_URL_1: `ws://localhost:${PORT1}/ws`,
      WS_URL_2: `ws://localhost:${PORT2}/ws`,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  procs.push(k6);

  const k6Code = await new Promise((resolve) => k6.on("exit", (c) => resolve(c ?? 1)));
  try {
    emitter.kill("SIGTERM");
  } catch {
    /* already gone */
  }
  shutdown(k6Code);
} catch (err) {
  console.error("[harness] fatal", err);
  shutdown(1);
}
