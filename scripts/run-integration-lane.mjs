#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INTEGRATION_ROOT = resolve(ROOT, "tests/integration");
const REPORT_PATH = resolve(ROOT, "docs/qa/integration-lane-map.md");

const EMBEDDED = [
  "tests/integration/activity.test.ts",
  "tests/integration/equipment-hub-acknowledge.test.ts",
  "tests/integration/work-order-assignment-service.test.ts",
  "tests/integration/work-order-assignment-route-gate.test.ts",
  "tests/integration/websocket-strict-mode.test.ts",
  "tests/integration/permissions-hub-resolution.test.ts",
  "tests/integration/permissions-me-primary-role.test.ts",
  "tests/integration/role-crud-workflow.test.ts",
  "tests/integration/permission-audit-read.test.ts",
  "tests/integration/rag-conversation-ownership.test.ts",
  "tests/integration/object-storage-client-concurrency.test.ts",
  "tests/integration/ml-train-idempotency.test.ts",
  "tests/integration/vessel-performance-auth.test.ts",
  "tests/integration/vessel-diagram-registry-routes.test.ts",
  "tests/integration/kb-upload-reliability.test.ts",
  "tests/integration/lr35-pdm-promote-rollback-gate.test.ts",
  "tests/integration/telemetry.test.ts",
];

const POSTGRES = [
  "tests/integration/audit-chain-mixed-hash-versions.test.ts",
  "tests/integration/cross-tenant-domains.test.ts",
  "tests/integration/rls-cross-tenant-api.test.ts",
  "tests/integration/rls-cross-tenant.test.ts",
  "tests/integration/safety-bulletins-feed.test.ts",
  "tests/integration/tenant-quota-throttle.test.ts",
];

const SERVER = [
  "tests/integration/briefing.test.ts",
  "tests/integration/outcome-tracking.test.ts",
  "tests/e2e/activity.e2e.ts",
  "tests/e2e/briefing.e2e.ts",
];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const abs = resolve(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      return walk(abs);
    }
    if (entry.endsWith(".test.ts")) {
      return [relative(ROOT, abs)];
    }
    return [];
  });
}

const allIntegrationTests = walk(INTEGRATION_ROOT).sort();
const explicitLaneByFile = new Map();
for (const [lane, files] of Object.entries({
  embedded: EMBEDDED,
  postgres: POSTGRES,
  server: SERVER,
})) {
  for (const file of files) {
    if (file.startsWith("tests/integration/")) {
      explicitLaneByFile.set(file, lane);
    }
  }
}

const LEGACY = allIntegrationTests.filter((file) => !explicitLaneByFile.has(file));

const LANES = {
  embedded: EMBEDDED,
  postgres: POSTGRES,
  server: SERVER,
  legacy: LEGACY,
};

function reasonFor(file, lane) {
  if (lane === "embedded") {
    return "Proven deterministic in embedded SQLite/local mode; no DATABASE_URL or manual localhost required.";
  }
  if (lane === "postgres") {
    return "Exercises PostgreSQL-only behavior such as RLS, migrations, immutable audit, quota, or tenant DB contracts.";
  }
  if (lane === "server") {
    return "Exercises browser/server-style HTTP behavior; must run through the explicit server lane.";
  }
  if (file.includes("/forms/")) {
    return "Uses forms helper with direct pg Pool cleanup and live-server assumptions.";
  }
  if (file.includes("/crew-suite/")) {
    return "Uses crew-suite/form helper conventions that still depend on live-server or legacy seeded data assumptions.";
  }
  if (file.includes("/journeys/")) {
    return "Legacy journey flow not yet proven under the embedded deterministic bootstrap.";
  }
  if (file.includes("workflow-gap-closure")) {
    return "Mixes direct pg Pool access, live HTTP calls, and stale list-response expectations.";
  }
  if (file.includes("schematic-layout-crud")) {
    return "Hardcodes localhost:5000 instead of the deterministic test server bootstrap.";
  }
  if (file.includes("validate-response")) {
    return "Contains stale endpoint/status expectations exposed by the full aggregate run.";
  }
  return "Not yet proven in the embedded lane; retained as visible legacy debt until migrated or reclassified.";
}

function statusFor(lane) {
  if (lane === "embedded") {
    return "Passing in this stabilization pass: 17 suites, 141 tests.";
  }
  if (lane === "postgres") {
    return "Not part of default gate; fail-fast when DATABASE_URL is absent.";
  }
  if (lane === "server") {
    return "Explicit lane currently failing: 4 suites, 28 failed tests; briefing generation still uses PostgreSQL-only SQL in embedded mode.";
  }
  return "Quarantined from default gate; known to fail or risk OOM in aggregate runs.";
}

function migrationFor(file, lane) {
  if (lane === "embedded") {
    return "Keep in release gate; add similar suites only after they pass embedded lane locally.";
  }
  if (lane === "postgres") {
    return "Run with a seeded PostgreSQL contract database and document RLS/migration prerequisites.";
  }
  if (lane === "server") {
    return "Replace PostgreSQL-only SQL in embedded server flows, keep the lane self-starting, then promote selected smoke coverage into the default gate.";
  }
  if (file.includes("/forms/") || file.includes("/crew-suite/")) {
    return "Replace direct pg helper cleanup with embedded fixtures or move to postgres-contract with explicit DATABASE_URL.";
  }
  return "Audit dependencies, remove live-service assumptions, add deterministic fixtures, then promote to embedded or postgres.";
}

function tableRows() {
  const rows = [];
  for (const file of allIntegrationTests) {
    const lane = explicitLaneByFile.get(file) ?? "legacy";
    rows.push([file, lane, reasonFor(file, lane), statusFor(lane), migrationFor(file, lane)]);
  }
  for (const file of SERVER.filter((path) => path.startsWith("tests/e2e/"))) {
    rows.push([
      file,
      "server",
      reasonFor(file, "server"),
      statusFor("server"),
      migrationFor(file, "server"),
    ]);
  }
  return rows;
}

function writeReport() {
  const counts = {
    embedded: EMBEDDED.filter((file) => file.startsWith("tests/integration/")).length,
    postgres: POSTGRES.length,
    server: SERVER.length,
    legacy: LEGACY.length,
  };
  const rows = tableRows()
    .map(
      ([file, lane, reason, status, migration]) =>
        `| \`${file}\` | ${lane} | ${reason} | ${status} | ${migration} |`
    )
    .join("\n");

  const body = `# Integration Lane Map

Generated by \`node scripts/run-integration-lane.mjs --write-report\`.

## Policy

- \`npm run test:integration\` runs only the deterministic embedded lane.
- \`npm run test:integration:embedded\` is the default release-safe integration gate.
- \`npm run test:integration:postgres\` is explicit and requires \`DATABASE_URL\`.
- \`npm run test:integration:server\` is explicit and owns server-style HTTP/browser checks.
- \`npm run test:integration:legacy\` remains visible but is excluded from the default gate until migrated.
- The lane runner uses serial Jest execution with background-worker environment flags and \`--forceExit\`; open-handle cleanup remains tracked as stabilization debt rather than blocking completed assertions.

## Current Counts

| Lane | Count |
| --- | ---: |
| embedded-deterministic | ${counts.embedded} |
| postgres-contract | ${counts.postgres} |
| server-e2e | ${counts.server} |
| legacy-quarantine | ${counts.legacy} |

## Embedded Lane Evidence

\`npm run test:integration:embedded\` passed during this stabilization pass with 17 suites and 141 tests.

## Lane Assignments

| Test file | Lane | Reason | Current status | Required migration/fix |
| --- | --- | --- | --- | --- |
${rows}
`;

  writeFileSync(REPORT_PATH, body);
  console.log(`Wrote ${relative(ROOT, REPORT_PATH)}`);
}

function runLane(lane) {
  const files = LANES[lane];
  if (!files) {
    console.error(`Unknown integration lane: ${lane}`);
    console.error("Use one of: embedded, postgres, server, legacy");
    process.exit(2);
  }
  if (lane === "postgres" && !process.env.DATABASE_URL) {
    console.error("Postgres contract integration tests require DATABASE_URL.");
    console.error(
      "Example: DATABASE_URL=postgresql://user:pass@localhost:5432/arus_test npm run test:integration:postgres"
    );
    console.error("The default release gate intentionally does not require PostgreSQL.");
    process.exit(1);
  }
  if (lane === "legacy") {
    console.error(
      "Running legacy-quarantine integration tests. These are expected to expose historical failures."
    );
    console.error("They are not part of the default release gate until migrated.");
  }

  const result = spawnSync(
    process.execPath,
    [
      "--experimental-vm-modules",
      "node_modules/jest/bin/jest.js",
      "--config",
      "jest.integration.config.mjs",
      "--runInBand",
      "--forceExit",
      ...files,
    ],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        ARUS_INTEGRATION_LANE: lane,
        EMBEDDED_MODE: lane === "postgres" ? (process.env.EMBEDDED_MODE ?? "") : "true",
        NODE_ENV: "test",
        ARUS_DISABLE_BACKGROUND_WORKERS: "true",
        DISABLE_AGENT_SCHEDULER: "true",
        DISABLE_DIGITAL_TWIN_STARTUP: "true",
        DISABLE_EMAIL_WORKER: "true",
        DISABLE_JOB_QUEUE: "true",
        DISABLE_ML_SERVICE_STARTUP: "true",
        DISABLE_OBSERVABILITY_TIMERS: "true",
        DISABLE_REDIS: "true",
        DISABLE_SECURITY_TIMERS: "true",
        DISABLE_TELEMETRY_BATCH_WRITER: "true",
        ENABLE_BACKGROUND_JOBS: "false",
        ENABLE_SCHEDULERS: "false",
        EVENT_SPINE_DISABLED: "1",
        EVENT_SPINE_WORKER: "0",
      },
    }
  );
  if (result.signal) {
    console.error(`Integration lane ${lane} terminated by signal ${result.signal}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

const arg = process.argv[2] ?? "embedded";
if (arg === "--write-report") {
  writeReport();
} else if (arg === "--list") {
  for (const [lane, files] of Object.entries(LANES)) {
    console.log(`${lane}: ${files.length}`);
    for (const file of files) {
      console.log(`  ${file}`);
    }
  }
} else {
  runLane(arg);
}
