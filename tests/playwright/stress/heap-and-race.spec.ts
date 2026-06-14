import { expect, test, type ConsoleMessage } from "@playwright/test";

import {
  installRoleFixtures,
  isBenignConsoleError,
  loginRole,
  navigateWithinAuthenticatedSpa,
} from "../helpers/spa-auth";
import { buildNavTargets } from "../helpers/hub-targets";

/**
 * Stress lane (`@stress`) — ADVISORY. Two probes over the full nav set with a
 * mocked deterministic backend:
 *
 *  (a) Heap-leak loop: walk every nav target for N cycles, force GC via CDP
 *      (`HeapProfiler.collectGarbage`, enabled by the project's
 *      `--js-flags=--expose-gc`) and sample the post-GC JS heap. Asserts the
 *      heap plateaus rather than growing unbounded across cycles. Heap numbers
 *      are coarse + chromium-only — thresholds are starting points to calibrate
 *      from real nightly runs, which is why this lane is non-blocking.
 *
 *  (b) Rapid-fire nav race: fire client-side navigations across many targets
 *      WITHOUT awaiting settle, to surface races (e.g. queries firing during an
 *      auth/route transition — the class the 401-retry fix addressed). Asserts
 *      zero console / page errors accumulate and the shell stays healthy.
 */

const CYCLES = 5;
const HEAP_GROWTH_RATIO = 1.5; // end heap must stay under 1.5x the warm-up baseline
const HEAP_GROWTH_ABS_BYTES = 50 * 1024 * 1024; // ...and under +50 MB absolute
const RAPID_FIRE_COUNT = 40;

interface HeapUsage {
  usedSize: number;
  totalSize: number;
}

test.describe("client stress @stress", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Heap sampling + --expose-gc are chromium-only.");
    await installRoleFixtures(page, { role: "system_admin", hidePerfOverlay: true });
    await loginRole(page, "system_admin");
  });

  test("repeated navigation does not leak the JS heap", async ({ page }) => {
    test.setTimeout(180_000);
    const targets = buildNavTargets();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.enable");

    const sampleHeapAfterGc = async (): Promise<number> => {
      await cdp.send("HeapProfiler.collectGarbage");
      const usage = (await cdp.send("Runtime.getHeapUsage")) as HeapUsage;
      return usage.usedSize;
    };

    const samples: number[] = [];
    let baseline = 0;
    for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
      for (const target of targets) {
        await navigateWithinAuthenticatedSpa(page, target.href);
        await page.waitForTimeout(25);
      }
      const heap = await sampleHeapAfterGc();
      samples.push(heap);
      // Cycle 1 is warm-up (lazy chunks, first-paint allocation) — use it as the baseline.
      if (cycle === 1) {
        baseline = heap;
      }
    }

    const end = samples[samples.length - 1]!;
    const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;
    // eslint-disable-next-line no-console -- surfaced in the report for threshold calibration.
    console.log(
      `[stress] heap per cycle: ${samples.map(mb).join(" → ")} (baseline ${mb(baseline)})`
    );

    expect(baseline, "warm-up heap baseline should be measurable").toBeGreaterThan(0);
    expect(
      end,
      `heap grew to ${mb(end)} from baseline ${mb(baseline)} (> ${HEAP_GROWTH_RATIO}x)`
    ).toBeLessThan(baseline * HEAP_GROWTH_RATIO);
    expect(
      end - baseline,
      `heap grew +${mb(end - baseline)} over ${CYCLES - 1} cycles (> ${mb(HEAP_GROWTH_ABS_BYTES)})`
    ).toBeLessThan(HEAP_GROWTH_ABS_BYTES);
  });

  test("rapid-fire navigation surfaces no console or page errors", async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error" && !isBenignConsoleError(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => pageErrors.push(`${err.name}: ${err.message}`));

    const targets = buildNavTargets().slice(0, RAPID_FIRE_COUNT);
    for (const target of targets) {
      // No settle between hops — deliberately race the route/query lifecycle.
      await navigateWithinAuthenticatedSpa(page, target.href);
      await page.waitForTimeout(15);
    }
    // Let the final burst's queries/renders flush before asserting.
    await page.waitForTimeout(1500);

    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText("404 Page Not Found", { exact: false })).toHaveCount(0);
    expect(
      consoleErrors,
      `console errors during rapid-fire nav:\n${consoleErrors.join("\n")}`
    ).toEqual([]);
    expect(pageErrors, `page errors during rapid-fire nav:\n${pageErrors.join("\n")}`).toEqual([]);
  });
});
