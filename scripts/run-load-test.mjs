#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const SCENARIOS = {
  smoke: "tests/load/smoke.js",
  steady: "tests/load/steady.js",
  spike: "tests/load/spike.js",
  "ws-fanout": "tests/load/ws_fanout.js",
};

function hasCommand(command) {
  const probe = spawnSync(command, ["--version"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return probe.status === 0;
}

function run(command, args, options = {}) {
  const child = spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
    ...options,
  });
  return child.status ?? 1;
}

const scenario = process.argv[2] ?? "smoke";
const script = SCENARIOS[scenario];

if (!script) {
  console.error(`[load-test] Unknown scenario: ${scenario}`);
  console.error(`[load-test] Valid scenarios: ${Object.keys(SCENARIOS).join(", ")}`);
  process.exit(2);
}

if (!existsSync(resolve(ROOT, script))) {
  console.error(`[load-test] Scenario file missing: ${script}`);
  process.exit(2);
}

const runner = process.env.K6_RUNNER ?? "local";
const baseUrl = process.env.BASE_URL ?? "http://localhost:5000";

if (runner === "docker") {
  if (!hasCommand("docker")) {
    console.error(
      "[load-test] Docker runner requested, but `docker` is not installed or not on PATH."
    );
    process.exit(127);
  }
  process.exit(
    run("docker", [
      "run",
      "--rm",
      "--network",
      "host",
      "-e",
      `BASE_URL=${baseUrl}`,
      ...(process.env.K6_SESSION_TOKEN ? ["-e", "K6_SESSION_TOKEN"] : []),
      "-v",
      `${ROOT}:/workspace:ro`,
      "-w",
      "/workspace",
      "grafana/k6:latest",
      "run",
      script,
    ])
  );
}

if (!hasCommand("k6")) {
  console.error("[load-test] `k6` is not installed or not on PATH.");
  console.error(
    "[load-test] Install it with `brew install k6`, or run with `K6_RUNNER=docker` if Docker is available."
  );
  console.error(`[load-test] Example: BASE_URL=${baseUrl} npm run test:load:smoke`);
  process.exit(127);
}

process.exit(run("k6", ["run", script]));
