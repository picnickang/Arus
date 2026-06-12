import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deriveHubHealthFields } from "../../server/domains/equipment-intelligence/domain/hub-health";

const PAGE = readFileSync(join(process.cwd(), "client/src/pages/pdm-platform.tsx"), "utf8");

const MOBILE_SCREENS = readFileSync(
  join(process.cwd(), "client/src/features/mobile-readiness/MobileReadinessScreens.tsx"),
  "utf8"
);
const MOBILE_MODEL = readFileSync(
  join(process.cwd(), "client/src/features/mobile-readiness/mobile-readiness-model.ts"),
  "utf8"
);

describe("pdm-platform mobile readiness replacement", () => {
  it("delegates the legacy tabbed page to the mobile PdM risk queue", () => {
    expect(PAGE).toContain("MobilePdmPage");
    expect(PAGE).not.toMatch(/VALID_TABS|OPERATOR_TABS|ML_OPS_TABS|hasPermission\(/);
  });

  it("keeps operator-facing PdM evidence, queue, and advanced telemetry visible", () => {
    expect(MOBILE_SCREENS).toContain("MobilePdmPage");
    expect(MOBILE_SCREENS).toContain("PdM Risk Queue");
    expect(MOBILE_SCREENS).toContain("Telemetry Evidence");
    expect(MOBILE_SCREENS).toContain("MobilePdmAssetCasePage");
    expect(MOBILE_SCREENS).toContain("MobilePdmTelemetryPage");
    expect(MOBILE_SCREENS).toContain("/telemetry");
    expect(MOBILE_SCREENS).toContain('params.get("view") === "telemetry"');
    expect(MOBILE_SCREENS).toContain("data-nav-variant={variant}");
    expect(MOBILE_MODEL).toContain("Latest Abnormal Readings");
    expect(MOBILE_MODEL).toContain("Recommended Next Action");
    expect(MOBILE_MODEL).toContain('"machineryOps"');
  });

  it("keeps equipment deep links on the PdM replacement route", () => {
    const routes = readFileSync(join(process.cwd(), "client/src/routes/maintenance.ts"), "utf8");
    expect(routes).toContain('"/pdm/equipment/:equipmentId/telemetry"');
    expect(routes).toContain('"/pdm/equipment/:equipmentId"');
    expect(routes).toContain("component: PdmPlatform");
  });
});

describe("equipment hub honest health derivation", () => {
  it("returns nulls (not fake-healthy defaults) when no score or prediction exists", () => {
    expect(deriveHubHealthFields(null, null)).toEqual({
      health: null,
      rul: null,
      confidence: null,
    });
  });

  it("passes through real values when present", () => {
    expect(
      deriveHubHealthFields(62, { remainingUsefulLife: 38, failureProbability: 0.81 })
    ).toEqual({ health: 62, rul: 38, confidence: 81 });
  });

  it("never resurrects the historical 100/365/85 fabrications", () => {
    const empty = deriveHubHealthFields(null, {});
    expect(empty.health).not.toBe(100);
    expect(empty.rul).not.toBe(365);
    expect(empty.confidence).not.toBe(85);
  });
});
