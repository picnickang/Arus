/**
 * Diagnostics Routes - Test Suite Endpoints
 */

import { Router, Request, Response } from "express";
import { logger } from "../../utils/logger.js";
import type { SmokeSuite } from "./types.js";

const smokeSuites: SmokeSuite[] = [
  {
    name: "health-smoke",
    description: "Quick health check of diagnostics endpoints",
    file: "server/diagnostics-smoke-tests.ts",
    category: "smoke",
    runnable: true,
  },
  {
    name: "equipment-smoke",
    description: "Equipment and vessel endpoint smoke tests",
    file: "server/diagnostics-smoke-tests.ts",
    category: "smoke",
    runnable: true,
  },
  {
    name: "work-orders-smoke",
    description: "Work orders and inventory smoke tests",
    file: "server/diagnostics-smoke-tests.ts",
    category: "smoke",
    runnable: true,
  },
  {
    name: "alerts-smoke",
    description: "Alert system endpoint smoke tests",
    file: "server/diagnostics-smoke-tests.ts",
    category: "smoke",
    runnable: true,
  },
  {
    name: "database-smoke",
    description: "Database connectivity smoke tests",
    file: "server/diagnostics-smoke-tests.ts",
    category: "smoke",
    runnable: true,
  },
  {
    name: "crew-smoke",
    description: "Crew management endpoint smoke tests",
    file: "server/diagnostics-smoke-tests.ts",
    category: "smoke",
    runnable: true,
  },
  {
    name: "integration-lite",
    description: "Comprehensive integration tests (20 tests across 7 categories)",
    file: "server/tests/integration-lite.test.ts",
    category: "integration",
    runnable: true,
  },
];

const jestSuites: SmokeSuite[] = [
  {
    name: "engine-room-logbook",
    description: "Engine Room Logbook auto-fill, hourly entries, generators, anomalies",
    file: "server/tests/engine-room-logbook.test.ts",
    category: "logbook",
    runnable: false,
  },
  {
    name: "deck-logbook",
    description: "Deck Logbook voyage entries, weather, fuel/emissions",
    file: "server/tests/deck-logbook.test.ts",
    category: "logbook",
    runnable: false,
  },
  {
    name: "stcw-compliance",
    description: "STCW Hours of Rest compliance validation",
    file: "server/tests/stcw-compliance.test.ts",
    category: "compliance",
    runnable: false,
  },
  {
    name: "work-orders-inventory",
    description: "Work order lifecycle and inventory management",
    file: "server/tests/work-orders-inventory.test.ts",
    category: "operations",
    runnable: false,
  },
  {
    name: "alerts-engine",
    description: "Alert configuration, triggering, and notifications",
    file: "server/tests/alerts-engine.test.ts",
    category: "alerts",
    runnable: false,
  },
  {
    name: "database-integrity",
    description: "Database schema, constraints, and sync validation",
    file: "server/tests/database-integrity.test.ts",
    category: "database",
    runnable: false,
  },
  {
    name: "performance-stress",
    description: "Throughput, latency, and stress testing",
    file: "server/tests/performance-stress.test.ts",
    category: "performance",
    runnable: false,
  },
];

const testSuites = [...smokeSuites, ...jestSuites];
const testResults: Map<
  string,
  {
    status: "running" | "passed" | "failed";
    output: string;
    startedAt: string;
    completedAt?: string;
    tests?: unknown[];
  }
> = new Map();

function formatSmokeTestOutput(result: {
  suite: string;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  tests: Array<{ name: string; passed: boolean; duration: number; error?: string }>;
  timestamp: string;
}): string {
  let output = `\n🧪 Smoke Test Suite: ${result.suite}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const test of result.tests) {
    output += `${test.passed ? "✅" : "❌"} ${test.name} (${test.duration}ms)\n`;
    if (test.error) {
      output += `   └─ ${test.error}\n`;
    }
  }
  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 Results: ${result.passed}/${result.total} passed`;
  if (result.failed > 0) {
    output += ` (${result.failed} failed)`;
  }
  output += `\n⏱️  Duration: ${result.duration}ms\n🕐 Completed: ${result.timestamp}\n`;
  return output;
}

export function registerTestsRoutes(router: Router) {
  router.get("/test-suites", (req: Request, res: Response) => {
    const suitesWithStatus = testSuites.map((suite) => ({
      ...suite,
      lastRun: testResults.get(suite.name) || null,
    }));
    res.json({
      suites: suitesWithStatus,
      totalCount: testSuites.length,
      categories: [...new Set(testSuites.map((s) => s.category))],
    });
  });

  router.post("/test-suites/:name/run", async (req: Request, res: Response) => {
    const { name = "" } = req.params;
    const suite = testSuites.find((s) => s.name === name);
    if (!suite) {
      res.status(404).json({ error: `Test suite '${name}' not found` });
      return;
    }
    if (!suite.runnable) {
      res.status(400).json({
        error: `Test suite '${name}' requires too much memory to run in-app. Use CI/CD pipeline or run locally with: npx jest ${suite.file} --forceExit`,
      });
      return;
    }
    if (testResults.get(name)?.status === "running") {
      res.status(409).json({ error: `Test suite '${name}' is already running` });
      return;
    }
    testResults.set(name, {
      status: "running",
      output: "Starting smoke tests...\n",
      startedAt: new Date().toISOString(),
    });
    res.json({
      message: `Test suite '${name}' started`,
      status: "running",
      startedAt: testResults.get(name)?.startedAt,
    });
    try {
      const { smokeTestSuites } = await import("../../diagnostics-smoke-tests.js");
      const runner = (
        smokeTestSuites as object as Record<
          string,
          () => Promise<{
            suite: string;
            passed: number;
            failed: number;
            total: number;
            duration: number;
            tests: Array<{ name: string; passed: boolean; duration: number; error?: string }>;
            timestamp: string;
          }>
        >
      )[name];
      if (runner) {
        const result = await runner();
        const output = formatSmokeTestOutput(result);
        testResults.set(name, {
          status: result.failed === 0 ? "passed" : "failed",
          output,
          startedAt: testResults.get(name)?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          tests: result.tests,
        });
        logger.info(
          "Diagnostics",
          `Smoke test '${name}' completed: ${result.passed}/${result.total} passed`
        );
      } else {
        throw new Error(`Smoke test runner not found for: ${name}`);
      }
    } catch (error) {
      testResults.set(name, {
        status: "failed",
        output: `Error: ${error instanceof Error ? error.message : String(error)}`,
        startedAt: testResults.get(name)?.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
      logger.error(
        "Diagnostics",
        `Smoke test '${name}' failed`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

  router.get("/test-suites/:name/status", (req: Request, res: Response) => {
    const { name = "" } = req.params;
    const result = testResults.get(name);
    if (!result) {
      res.json({ status: "not_run", message: "Test has not been run yet" });
      return;
    }
    res.json(result);
  });

  router.get("/test-simulators", (req: Request, res: Response) => {
    const simulators = [
      {
        name: "vessel-simulator",
        description: "Physics-aware vessel telemetry simulation",
        file: "server/vessel-simulator.ts",
        capabilities: [
          "Engine RPM patterns",
          "Thermal dynamics",
          "Vibration components",
          "Fault injection",
          "Multiple vessel types",
        ],
      },
      {
        name: "logbook-test-simulator",
        description: "Logbook-specific telemetry patterns",
        file: "server/tests/helpers/logbook-test-simulator.ts",
        capabilities: [
          "Main engine telemetry",
          "Generator telemetry",
          "Weather data",
          "Position tracking",
          "Fuel consumption",
          "Anomaly injection",
        ],
      },
      {
        name: "stress-test",
        description: "High-throughput telemetry stress testing",
        file: "server/vessel-simulator.ts",
        capabilities: [
          "Configurable message rate",
          "Batch writer integration",
          "Performance metrics",
        ],
      },
    ];
    res.json({ simulators, totalCount: simulators.length });
  });
}
