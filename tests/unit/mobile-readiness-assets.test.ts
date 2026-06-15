import { describe, expect, it } from "@jest/globals";
import {
  getMobileReadinessAsset,
  listMobileReadinessAssets,
} from "@/features/mobile-readiness/mobile-readiness-assets";

describe("mobile readiness asset registry", () => {
  it("declares the required recreated asset classes from the reference board", () => {
    const assets = listMobileReadinessAssets();
    const ids = new Set(assets.map((asset) => asset.id));

    for (const requiredId of [
      "vessel-atlas",
      "vessel-borealis",
      "vessel-corvus",
      "avatar-alex",
      "avatar-michael",
      "avatar-sarah",
      "avatar-daniel",
      "work-compressor",
      "work-motor",
      "work-gauge",
      "diagram-side-elevation",
      "telemetry-risk-chart",
      "icon-readiness-check",
      "fallback-generic",
    ]) {
      expect(ids.has(requiredId)).toBe(true);
    }

    expect(new Set(assets.map((asset) => asset.kind))).toEqual(
      new Set(["vessel-thumbnail", "crew-avatar", "work-photo", "diagram", "chart", "icon"])
    );
  });

  it("marks Figma-locked image replacements honestly and keeps every asset browser-resolvable", () => {
    const assets = listMobileReadinessAssets();
    const productionAssets = assets.filter((asset) => asset.id !== "fallback-generic");
    const fallbackAssets = assets.filter((asset) => asset.status === "fallback");

    expect(productionAssets.every((asset) => asset.status === "recreated")).toBe(true);
    expect(fallbackAssets).toHaveLength(1);
    expect(fallbackAssets[0]?.id).toBe("fallback-generic");
    expect(assets.every((asset) => asset.src.startsWith("data:image/svg+xml;utf8,"))).toBe(true);
    expect(
      assets.every(
        (asset) =>
          asset.alt.length > 0 &&
          asset.figmaSource.length > 0 &&
          /reference|fallback|Figma|visual-match/i.test(asset.figmaSource)
      )
    ).toBe(true);
  });

  it("resolves stale asset ids to the declared fallback instead of throwing", () => {
    expect(getMobileReadinessAsset("vessel-atlas")).toMatchObject({
      id: "vessel-atlas",
      status: "recreated",
      kind: "vessel-thumbnail",
    });

    expect(getMobileReadinessAsset("missing-reference-asset")).toMatchObject({
      id: "fallback-generic",
      status: "fallback",
      kind: "icon",
    });
  });
});
