#!/usr/bin/env node
/**
 * Main Test Runner
 * Executes all test suites with memory-efficient approach
 *
 * Usage:
 *   node client/tests/runner.mjs           # Run all tests
 *   node client/tests/runner.mjs export    # Run specific suite
 *   node client/tests/runner.mjs --list    # List available suites
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const testSuites = [
  { name: "export", file: "export.test.mjs", description: "CSV/PDF export utilities" },
  {
    name: "validation",
    file: "validation.test.mjs",
    description: "Crew and assignment validation",
  },
  { name: "stcw", file: "stcw.test.mjs", description: "STCW compliance checks" },
  { name: "dates", file: "dates.test.mjs", description: "Date utilities and calculations" },
];

async function runSuite(suite) {
  return new Promise((resolve) => {
    const testPath = join(__dirname, suite.file);
    const child = spawn("node", [testPath], {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("close", (code) => {
      resolve({ suite: suite.name, passed: code === 0 });
    });

    child.on("error", (err) => {
      console.error(`Failed to run ${suite.name}: ${err.message}`);
      resolve({ suite: suite.name, passed: false });
    });
  });
}

async function runAllSuites() {
  console.log("=".repeat(60));
  console.log("  ARUS Scheduling Test Suite");
  console.log("  Memory-efficient test runner for Replit environment");
  console.log("=".repeat(60));

  const results = [];

  for (const suite of testSuites) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`  Running: ${suite.description}`);
    console.log("─".repeat(60));

    const result = await runSuite(suite);
    results.push(result);

    // Small delay between suites to allow garbage collection
    await new Promise((r) => setTimeout(r, 100));
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("  FINAL SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  console.log(`\n  Total Suites: ${results.length}`);
  console.log(`  Passed: ${passed.length}`);
  console.log(`  Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\n  Failed Suites:");
    failed.forEach((f) => console.log(`    - ${f.suite}`));
  }

  console.log("\n" + "=".repeat(60) + "\n");

  process.exit(failed.length > 0 ? 1 : 0);
}

async function runSingleSuite(suiteName) {
  const suite = testSuites.find((s) => s.name === suiteName);

  if (!suite) {
    console.error(`Unknown test suite: ${suiteName}`);
    console.log("\nAvailable suites:");
    testSuites.forEach((s) => console.log(`  - ${s.name}: ${s.description}`));
    process.exit(1);
  }

  const result = await runSuite(suite);
  process.exit(result.passed ? 0 : 1);
}

function listSuites() {
  console.log("\nAvailable Test Suites:\n");
  testSuites.forEach((s) => {
    console.log(`  ${s.name.padEnd(12)} - ${s.description}`);
  });
  console.log("\nUsage:");
  console.log("  npm run test:quick           # Run all suites");
  console.log("  npm run test:quick export    # Run specific suite");
  console.log("");
}

// Parse arguments
const args = process.argv.slice(2);

if (args.includes("--list") || args.includes("-l")) {
  listSuites();
} else if (args.length > 0 && !args[0].startsWith("-")) {
  runSingleSuite(args[0]);
} else {
  runAllSuites();
}
