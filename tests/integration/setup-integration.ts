/**
 * Integration-only bootstrap.
 *
 * Some integration specs exercise services directly instead of going through
 * createTestApp(). Keep them on the same deterministic embedded SQLite path
 * used by app-backed tests.
 */

import { readFileSync } from "node:fs";

import { startIntegrationTestServer } from "./utils/test-server.js";

process.env["TEST_BASE_URL"] ||= "http://127.0.0.1:5000";

type RunningServer = Awaited<ReturnType<typeof startIntegrationTestServer>>;

let integrationServer: RunningServer | undefined;

function currentTestPath(): string {
  return expect.getState().testPath ?? "";
}

function currentTestSource(): string {
  const path = currentTestPath();
  if (!path) {
    return "";
  }
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function usesModuleRegistryMocks(source: string): boolean {
  return /jest\.unstable_mockModule\([^)]*("drizzle-orm"|'drizzle-orm'|"[^"]*server\/db-config"|'[^']*server\/db-config')/s.test(
    source
  );
}

function needsFetchBackedServer(source: string): boolean {
  return (
    source.includes("TEST_BASE_URL") ||
    source.includes("http://localhost:5000") ||
    source.includes('from "./forms/_helpers"') ||
    source.includes('from "../forms/_helpers"') ||
    source.includes('from "./crew-suite/helpers"') ||
    source.includes('from "../crew-suite/helpers"')
  );
}

beforeAll(async () => {
  const source = currentTestSource();
  if (usesModuleRegistryMocks(source)) {
    return;
  }

  if (process.env["EMBEDDED_MODE"] !== "true" && process.env["LOCAL_MODE"] !== "true") {
    return;
  }

  const { initializeLocalDatabase } = await import("../../server/db-config.js");
  await initializeLocalDatabase();

  if (needsFetchBackedServer(source)) {
    integrationServer = await startIntegrationTestServer({ port: 5000 });
    process.env["TEST_BASE_URL"] = integrationServer.baseUrl;
  }
}, 60000);

afterAll(async () => {
  if (integrationServer) {
    await integrationServer.close();
    integrationServer = undefined;
  }
}, 60000);
