/**
 * Storage Regression Test Harness
 * Validates critical storage operations before and after refactoring
 */

import { storage } from "../storage";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const TEST_ORG_ID = "test-regression-org";

async function runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, passed: true, duration: Date.now() - start };
  } catch (error) {
    return { 
      name, 
      passed: false, 
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start 
    };
  }
}

export async function runStorageRegressionTests(): Promise<{ passed: number; failed: number; results: TestResult[] }> {
  const results: TestResult[] = [];

  // Basic connectivity test
  results.push(await runTest("Storage instance exists", async () => {
    if (!storage) {throw new Error("Storage not initialized");}
  }));

  // Equipment CRUD
  results.push(await runTest("Equipment: list", async () => {
    const equipment = await storage.getEquipment(TEST_ORG_ID);
    if (!Array.isArray(equipment)) {throw new Error("Expected array");}
  }));

  // Vessels CRUD
  results.push(await runTest("Vessels: list", async () => {
    const vessels = await storage.getVessels(TEST_ORG_ID);
    if (!Array.isArray(vessels)) {throw new Error("Expected array");}
  }));

  // Work Orders CRUD
  results.push(await runTest("Work Orders: list", async () => {
    const workOrders = await storage.getWorkOrders(TEST_ORG_ID);
    if (!Array.isArray(workOrders)) {throw new Error("Expected array");}
  }));

  // Crew CRUD
  results.push(await runTest("Crew: list", async () => {
    const crew = await storage.getCrew(TEST_ORG_ID);
    if (!Array.isArray(crew)) {throw new Error("Expected array");}
  }));

  // Parts/Inventory CRUD
  results.push(await runTest("Parts: list", async () => {
    const parts = await storage.getParts(TEST_ORG_ID);
    if (!Array.isArray(parts)) {throw new Error("Expected array");}
  }));

  // Alert configurations
  results.push(await runTest("Alert Configs: list", async () => {
    const configs = await storage.getAlertConfigurations(TEST_ORG_ID);
    if (!Array.isArray(configs)) {throw new Error("Expected array");}
  }));

  // Maintenance schedules
  results.push(await runTest("Maintenance Schedules: list", async () => {
    const schedules = await storage.getMaintenanceSchedules(TEST_ORG_ID);
    if (!Array.isArray(schedules)) {throw new Error("Expected array");}
  }));

  // Deck log daily (logbook)
  results.push(await runTest("Deck Log Daily: list", async () => {
    const logs = await storage.getDeckLogDaily(TEST_ORG_ID);
    if (!Array.isArray(logs)) {throw new Error("Expected array");}
  }));

  // Engine log daily (logbook)
  results.push(await runTest("Engine Log Daily: list", async () => {
    const logs = await storage.getEngineLogDaily(TEST_ORG_ID);
    if (!Array.isArray(logs)) {throw new Error("Expected array");}
  }));

  // STCW Rest sheets
  results.push(await runTest("STCW Rest Sheets: list", async () => {
    const sheets = await storage.getCrewRestSheets(TEST_ORG_ID);
    if (!Array.isArray(sheets)) {throw new Error("Expected array");}
  }));

  // Sensor configurations
  results.push(await runTest("Sensor Configs: list", async () => {
    const configs = await storage.getSensorConfigurations(TEST_ORG_ID);
    if (!Array.isArray(configs)) {throw new Error("Expected array");}
  }));

  // Calculate results
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, results };
}

// Run tests and output results
export async function executeRegressionTests(): Promise<void> {
  console.log(`\n${  "=".repeat(60)}`);
  console.log("STORAGE REGRESSION TEST SUITE");
  console.log(`${"=".repeat(60)  }\n`);

  const { passed, failed, results } = await runStorageRegressionTests();

  for (const result of results) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} | ${result.name} (${result.duration}ms)`);
    if (!result.passed && result.error) {
      console.log(`       Error: ${result.error}`);
    }
  }

  console.log(`\n${  "-".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"-".repeat(60)  }\n`);

  if (failed > 0) {
    throw new Error(`${failed} regression tests failed`);
  }
}

// Auto-run if executed directly
executeRegressionTests().catch(console.error);
