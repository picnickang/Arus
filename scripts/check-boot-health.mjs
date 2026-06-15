#!/usr/bin/env node
/**
 * Boot-health guard.
 *
 * Spawns the dev server, waits for "Domain routers registered (N modules)",
 * and asserts:
 *   1. The expected module count is reached (default: 114).
 *   2. Zero "Failed to register" lines appear in startup output.
 *   3. The "ARUS application is now live" line is emitted.
 *
 * This is the safety net that catches the dynamic-import trap: when a file
 * referenced via `await import(config.importPath)` is deleted by mistake,
 * domain-router-registry.ts logs "Failed to register <Name>" but the process
 * keeps running and TypeScript still compiles. Without this check, such
 * regressions only surface as 404s in production.
 *
 * Wire into CI as: `node scripts/check-boot-health.mjs`
 * Configure expected count via env: BOOT_EXPECTED_MODULES=114
 * If DATABASE_URL is absent, the guard boots deterministic embedded mode so
 * route-registration health does not depend on ambient cloud credentials.
 */

import { spawn } from "node:child_process";

const EXPECTED_MODULES = Number(process.env.BOOT_EXPECTED_MODULES ?? 114);
const TIMEOUT_MS = Number(process.env.BOOT_TIMEOUT_MS ?? 180_000);
const PORT = process.env.PORT ?? "0";
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const deterministicEmbeddedEnv = hasDatabaseUrl
  ? {}
  : {
      DISABLE_EMAIL_WORKER: "true",
      DISABLE_TELEMETRY_BATCH_WRITER: "true",
      EMBEDDED_MODE: "true",
      ENABLE_AUTO_REPLAN: "false",
      ENABLE_BACKGROUND_JOBS: "false",
      ENABLE_SCHEDULERS: "false",
      ENABLE_SYNC_SERVICES: "false",
      ENABLE_UPDATE_SYSTEM: "false",
      EVENT_SPINE_ANALYTICS: "0",
      EVENT_SPINE_DISABLED: "1",
      EVENT_SPINE_WORKER: "0",
      LOCAL_MODE: "true",
      SESSION_SECRET: "boot-health-session-secret-not-for-production",
    };

const child = spawn("npm", ["run", "dev"], {
  env: {
    ...process.env,
    ...deterministicEmbeddedEnv,
    NODE_ENV: "development",
    PORT,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
let resolved = false;

const timeout = setTimeout(() => {
  if (!resolved) {
    const tail = output.slice(-4000);
    finish(
      1,
      `Timed out after ${TIMEOUT_MS}ms waiting for boot to complete.` +
        (tail ? `\n--- last output ---\n${tail}` : "")
    );
  }
}, TIMEOUT_MS);

function finish(code, message) {
  resolved = true;
  clearTimeout(timeout);
  try {
    child.kill("SIGTERM");
  } catch {}
  if (message) console.log(message);
  process.exit(code);
}

function check() {
  const moduleMatch = output.match(/Domain routers registered \((\d+) modules\)/);
  const liveMatch = /ARUS application is now live/.test(output);
  const failedRegs = (output.match(/Failed to register/g) ?? []).length;

  if (!moduleMatch || !liveMatch) return;

  const actual = Number(moduleMatch[1]);
  const errors = [];
  if (actual !== EXPECTED_MODULES) {
    errors.push(`Module count mismatch: expected ${EXPECTED_MODULES}, got ${actual}.`);
  }
  if (failedRegs !== 0) {
    errors.push(
      `Found ${failedRegs} "Failed to register" line(s) — a dynamic-import target is missing.`
    );
    const failLines = output.split("\n").filter((l) => l.includes("Failed to register"));
    for (const line of failLines) errors.push(`  ${line.trim()}`);
  }

  if (errors.length > 0) {
    finish(1, "❌ Boot health check FAILED:\n" + errors.join("\n"));
  } else {
    finish(0, `✓ Boot health OK: ${actual} modules registered, 0 failures, app live.`);
  }
}

child.stdout.on("data", (d) => {
  output += d.toString();
  check();
});
child.stderr.on("data", (d) => {
  output += d.toString();
  check();
});

child.on("exit", (code) => {
  if (!resolved) {
    finish(
      1,
      `Process exited (code=${code}) before reaching boot-complete state.\n--- last output ---\n${output.slice(-2000)}`
    );
  }
});
