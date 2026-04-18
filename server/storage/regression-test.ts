/**
 * Storage Regression Test Harness
 * Validates critical storage operations using direct repository imports
 */

import { dbEquipmentStorage, dbAlertStorage, dbInventoryStorage, dbMaintenanceStorage, dbSensorsStorage, dbCrewStorage } from "../repositories";
import { vesselService, workOrderService } from "../repositories";
import { deckLogStorage, engineLogStorage } from "../repositories";
import { dbStcwStorage } from "../repositories";

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

  results.push(await runTest("Equipment: list", async () => {
    const equipment = await dbEquipmentStorage.getEquipmentRegistry(TEST_ORG_ID);
    if (!Array.isArray(equipment)) {throw new Error("Expected array");}
  }));

  results.push(await runTest("Vessels: list", async () => {
    const vessels = await vesselService.getVessels(TEST_ORG_ID);
    if (!Array.isArray(vessels)) {throw new Error("Expected array");}
  }));

  results.push(await runTest("Work Orders: list", async () => {
    const workOrders = await workOrderService.getWorkOrdersWithDetails(undefined, TEST_ORG_ID);
    if (!Array.isArray(workOrders)) {throw new Error("Expected array");}
  }));

  results.push(await runTest("Crew: list", async () => {
    const crew = await dbCrewStorage.getCrew(TEST_ORG_ID);
    if (!Array.isArray(crew)) {throw new Error("Expected array");}
  }));

  results.push(await runTest("Parts: list", async () => {
    const parts = await dbInventoryStorage.getParts(TEST_ORG_ID);
    if (!Array.isArray(parts)) {throw new Error("Expected array");}
  }));

  results.push(await runTest("Alert Configs: list", async () => {
    const configs = await dbAlertStorage.getAlertConfigurations(TEST_ORG_ID);
    if (!Array.isArray(configs)) {throw new Error("Expected array");}
  }));

  results.push(await runTest("Maintenance Schedules: list", async () => {
    const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, TEST_ORG_ID);
    if (!Array.isArray(schedules)) {throw new Error("Expected array");}
  }));

  results.push(await runTest("Deck Log Daily: list", async () => {
    const logs = await deckLogStorage.getDeckLogDaily(TEST_ORG_ID);
    if (!Array.isArray(logs)) {throw new Error("Expected array");}
  }));

  results.push(await runTest("Engine Log Daily: list", async () => {
    const logs = await engineLogStorage.getEngineLogDaily(TEST_ORG_ID);
    if (!Array.isArray(logs)) {throw new Error("Expected array");}
  }));

  results.push(await runTest("STCW Rest: list", async () => {
    const sheets = await dbStcwStorage.getCrewRestRange();
    if (!Array.isArray(sheets)) {throw new Error("Expected array");}
  }));

  results.push(await runTest("Sensor Configs: list", async () => {
    const configs = await dbSensorsStorage.getSensorConfigurations(TEST_ORG_ID);
    if (!Array.isArray(configs)) {throw new Error("Expected array");}
  }));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, results };
}

export async function executeRegressionTests(): Promise<void> {
  console.log(`\n${  "=".repeat(60)}`);
  console.log("STORAGE REGRESSION TEST SUITE");
  console.log(`${"=".repeat(60)  }\n`);

  const { passed, failed, results } = await runStorageRegressionTests();

  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL";
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

executeRegressionTests().catch(console.error);
