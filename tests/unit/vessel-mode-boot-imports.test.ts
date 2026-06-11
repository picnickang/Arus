/**
 * Vessel-mode boot regression: the update-system modules must not run
 * cloud-only guards at module-eval time.
 *
 * Two historical landmines crashed LOCAL_MODE boots:
 *  - update-checker.ts exported `updateChecker = getUpdateChecker()` — a
 *    top-level promise that rejected via assertCloudMode (uncatchable
 *    unhandled rejection).
 *  - patch-applicator.ts exported `new PatchApplicator()` — the constructor
 *    calls assertCloudMode at import time.
 *
 * Executing these imports inside the unit lane is not possible (their graph
 * trips a pre-existing jest resolution gap: the @shared/schema-runtime mock's
 * re-export chain lacks the ML schema exports), so this pins the SOURCE
 * contract — no top-level instantiation — plus the on-demand guard behavior
 * via the lightweight cloud-guards module, which does import cleanly.
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import path from "node:path";

// Jest runs from the repo root; the unit lane is ESM (no __dirname).
const root = process.cwd();

function source(rel: string): string {
  return readFileSync(path.join(root, rel), "utf-8");
}

describe("vessel-mode update-system boot contract", () => {
  it("update-checker has no top-level eager singleton promise", () => {
    const src = source("server/services/update-checker.ts");
    // The lazy accessor must exist; the floating module-eval promise must not.
    expect(src).toMatch(/export async function getUpdateChecker\(/);
    expect(src).not.toMatch(/export const updateChecker\s*[:=]/);
    // No top-level invocation of the accessor outside the function body.
    expect(src).not.toMatch(/^\s*(?:export\s+const\s+\w+\s*=\s*)?getUpdateChecker\(\);?\s*$/m);
  });

  it("patch-applicator constructs its cloud-only singleton lazily", () => {
    const src = source("server/services/patch-applicator.ts");
    expect(src).toMatch(/export function getPatchApplicator\(/);
    expect(src).not.toMatch(/export const patchApplicator\s*=/);
    // `new PatchApplicator()` may only appear inside the lazy getter.
    const instantiations = src.match(/new PatchApplicator\(\)/g) ?? [];
    expect(instantiations).toHaveLength(1);
    const getterBody = src.slice(src.indexOf("export function getPatchApplicator"));
    expect(getterBody).toContain("new PatchApplicator()");
  });

  it("no module destructures the removed eager exports", () => {
    const schedulerSrc = source("server/services/update-scheduler.ts");
    expect(schedulerSrc).not.toMatch(/import\s*\{[^}]*\bpatchApplicator\b[^}]*\}/);
    const routesSrc = source("server/domains/software-updates/routes.ts");
    expect(routesSrc).not.toMatch(/\{\s*patchApplicator\s*\}\s*=\s*await import/);
  });

  it("assertCloudMode still fails closed in vessel mode — on demand only", async () => {
    process.env["LOCAL_MODE"] = "true";
    process.env["DEPLOYMENT_MODE"] = "VESSEL";
    const { assertCloudMode } = await import("../../server/utils/cloud-guards");
    expect(() => assertCloudMode("Test Feature")).toThrow(/cloud-only/i);
  });
});
