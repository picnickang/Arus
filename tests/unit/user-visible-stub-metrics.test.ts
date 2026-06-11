/**
 * P2 #31 — User-visible stub observability counter.
 *
 * The counter exists so the always-zero / always-default behaviour of
 * a handful of safe-degraded code paths (PdM telemetry freshness,
 * crew compliance HoR + rotation queries, AMOS maintenance-plan
 * import) is observable to operators instead of silent.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  recordUserVisibleStub,
  userVisibleStubInvokedTotal,
} from "../../server/observability/security-metrics.js";

async function readMetric(workflow: string, stub: string): Promise<number> {
  const metric = await userVisibleStubInvokedTotal.get();
  const found = metric.values.find((v) => v.labels.workflow === workflow && v.labels.stub === stub);
  return found?.value ?? 0;
}

describe("P2 #31 — userVisibleStubInvokedTotal counter", () => {
  beforeEach(() => {
    userVisibleStubInvokedTotal.reset();
  });

  it("starts at zero for an unobserved (workflow, stub) pair", async () => {
    expect(await readMetric("pdm_schedule", "telemetry_freshness_default")).toBe(0);
  });

  it("increments per call for the labelled (workflow, stub) pair", async () => {
    recordUserVisibleStub("pdm_schedule", "telemetry_freshness_default");
    recordUserVisibleStub("pdm_schedule", "telemetry_freshness_default");
    recordUserVisibleStub("pdm_schedule", "telemetry_freshness_default");
    expect(await readMetric("pdm_schedule", "telemetry_freshness_default")).toBe(3);
  });

  it("keeps counts independent across (workflow, stub) pairs", async () => {
    recordUserVisibleStub("crew_compliance_report", "hours_of_rest_unwired");
    recordUserVisibleStub("crew_compliance_report", "crew_rotation_unwired");
    recordUserVisibleStub("amos_import", "maintenance_plan_unmapped");
    recordUserVisibleStub("amos_import", "maintenance_plan_unmapped");

    expect(await readMetric("crew_compliance_report", "hours_of_rest_unwired")).toBe(1);
    expect(await readMetric("crew_compliance_report", "crew_rotation_unwired")).toBe(1);
    expect(await readMetric("amos_import", "maintenance_plan_unmapped")).toBe(2);
    expect(await readMetric("pdm_schedule", "telemetry_freshness_default")).toBe(0);
  });
});
