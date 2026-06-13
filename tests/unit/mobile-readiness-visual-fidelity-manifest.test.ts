import fs from "node:fs";
import path from "node:path";

import {
  getMobileReadinessExpectedScreen,
  isMobileReadinessReplacementPath,
} from "../../client/src/features/mobile-readiness/mobile-readiness-route-contract";
import {
  MOBILE_READINESS_VISUAL_COMPARISON_ROOT,
  MOBILE_READINESS_VISUAL_VIEWPORT,
  MOBILE_READINESS_VISUAL_VIEWPORTS,
  mobileReadinessVisualFidelityCases,
} from "../playwright/mobile-readiness-visual-fidelity-contract";

describe("mobile readiness visual fidelity contract", () => {
  test("covers every replacement screen marker with a private comparison output root", () => {
    const requiredMarkers = [
      "command",
      "fleet",
      "vessel-detail",
      "vessel-diagram",
      "pdm-queue",
      "pdm-asset-case",
      "pdm-telemetry",
      "work-queue",
      "work-execution",
      "logs",
      "crew",
      "inventory",
      "settings",
    ];

    expect(MOBILE_READINESS_VISUAL_COMPARISON_ROOT).toBe("/private/tmp/arus-visual-comparison");
    expect(MOBILE_READINESS_VISUAL_VIEWPORT).toEqual({ width: 390, height: 844 });
    expect(MOBILE_READINESS_VISUAL_VIEWPORTS).toEqual([
      { width: 360, height: 800 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 414, height: 896 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
    ]);
    expect(
      new Set(mobileReadinessVisualFidelityCases.map((visualCase) => visualCase.screenMarker))
    ).toEqual(new Set(requiredMarkers));
  });

  test("requires a visual capture for every case and required viewport", () => {
    const expectedCaptureCount =
      mobileReadinessVisualFidelityCases.length * MOBILE_READINESS_VISUAL_VIEWPORTS.length;

    expect(expectedCaptureCount).toBe(78);
    expect(new Set(MOBILE_READINESS_VISUAL_VIEWPORTS.map((viewport) => viewport.width))).toEqual(
      new Set([360, 375, 390, 414, 430, 768])
    );
  });

  test("maps each visual case to an existing Figma/reference-board artifact", () => {
    for (const visualCase of mobileReadinessVisualFidelityCases) {
      expect(isMobileReadinessReplacementPath(visualCase.route)).toBe(true);
      expect(getMobileReadinessExpectedScreen(visualCase.route)).toBe(visualCase.screenMarker);
      expect(path.isAbsolute(visualCase.referenceArtifact)).toBe(false);
      expect(fs.existsSync(path.resolve(process.cwd(), visualCase.referenceArtifact))).toBe(true);
    }
  });
});
