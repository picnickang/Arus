/**
 * Lightweight test utilities for memory-constrained environments
 * Uses Node.js built-in assert module
 */

import assert from "assert";

let currentSuite = "";
let suiteResults = { passed: 0, failed: 0, errors: [] };

export function describe(name, fn) {
  currentSuite = name;
  console.log(`\n📋 ${name}:`);
  fn();
}

export function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    suiteResults.passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    suiteResults.failed++;
    suiteResults.errors.push({ suite: currentSuite, test: name, error: error.message });
  }
}

export function expect(value) {
  return {
    toBe(expected) {
      assert.strictEqual(value, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(value, expected);
    },
    toBeTruthy() {
      assert.ok(value);
    },
    toBeFalsy() {
      assert.ok(!value);
    },
    toBeNull() {
      assert.strictEqual(value, null);
    },
    toBeUndefined() {
      assert.strictEqual(value, undefined);
    },
    toBeDefined() {
      assert.notStrictEqual(value, undefined);
    },
    toBeGreaterThan(expected) {
      assert.ok(value > expected, `Expected ${value} > ${expected}`);
    },
    toBeGreaterThanOrEqual(expected) {
      assert.ok(value >= expected, `Expected ${value} >= ${expected}`);
    },
    toBeLessThan(expected) {
      assert.ok(value < expected, `Expected ${value} < ${expected}`);
    },
    toBeLessThanOrEqual(expected) {
      assert.ok(value <= expected, `Expected ${value} <= ${expected}`);
    },
    toContain(expected) {
      if (typeof value === "string") {
        assert.ok(value.includes(expected), `Expected "${value}" to contain "${expected}"`);
      } else if (Array.isArray(value)) {
        assert.ok(value.includes(expected), `Expected array to contain ${expected}`);
      }
    },
    toHaveLength(expected) {
      assert.strictEqual(value.length, expected);
    },
    toMatch(pattern) {
      assert.match(value, pattern);
    },
    toThrow(expectedError) {
      let threw = false;
      try {
        value();
      } catch (e) {
        threw = true;
        if (expectedError) {
          assert.ok(
            e.message.includes(expectedError),
            `Expected error "${expectedError}" but got "${e.message}"`
          );
        }
      }
      assert.ok(threw, "Expected function to throw");
    },
    not: {
      toBe(expected) {
        assert.notStrictEqual(value, expected);
      },
      toEqual(expected) {
        assert.notDeepStrictEqual(value, expected);
      },
      toContain(expected) {
        if (typeof value === "string") {
          assert.ok(!value.includes(expected), `Expected "${value}" not to contain "${expected}"`);
        } else if (Array.isArray(value)) {
          assert.ok(!value.includes(expected), `Expected array not to contain ${expected}`);
        }
      },
    },
  };
}

export function getResults() {
  return { ...suiteResults };
}

export function resetResults() {
  suiteResults = { passed: 0, failed: 0, errors: [] };
}

export function printSummary() {
  console.log("\n" + "─".repeat(50));
  console.log(`\n📊 Results: ${suiteResults.passed} passed, ${suiteResults.failed} failed`);

  if (suiteResults.errors.length > 0) {
    console.log("\n❌ Failed Tests:");
    suiteResults.errors.forEach(({ suite, test, error }) => {
      console.log(`  • ${suite} > ${test}`);
      console.log(`    ${error}`);
    });
  }

  return suiteResults.failed === 0;
}
