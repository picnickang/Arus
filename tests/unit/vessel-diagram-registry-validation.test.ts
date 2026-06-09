import { describe, expect, it } from "@jest/globals";
import {
  sanitizeSvgContent,
  validateDiagramUpload,
  validateSectionMapDraft,
  validateThumbnailUpload,
} from "../../server/domains/vessel-diagram-registry/application/validation";
import type { SectionMapRecord } from "../../server/domains/vessel-diagram-registry/domain/types";

describe("vessel diagram registry validation", () => {
  it("rejects SVG scripts, event handlers, external refs, and javascript URLs", () => {
    const svg = `<svg><script>alert(1)</script><image href="https://example.com/x.png"/><a href="javascript:alert(1)" onclick="bad()"/></svg>`;
    const result = sanitizeSvgContent(svg);

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "svg_script",
        "svg_event_handler",
        "svg_javascript_url",
        "svg_external_reference",
      ])
    );
  });

  it("records blockers for unsafe diagram uploads before any version can be activated", () => {
    const result = validateDiagramUpload("org-a", "vessel-a", {
      originalFileName: "bad.svg",
      mimeType: "image/svg+xml",
      content: Buffer.from(`<svg><script>alert(1)</script></svg>`),
    });

    expect(result.contentSha256).toHaveLength(64);
    expect(result.objectKey).toContain("vessel-intelligence/orgs/org-a/vessels/vessel-a");
    expect(result.validationSummary.blockers).toBeGreaterThan(0);
    expect(result.issues.some((issue) => issue.code === "svg_script")).toBe(true);
  });

  it("blocks invalid normalized section geometry and warns on missing assignments", () => {
    const map: SectionMapRecord = {
      id: "map-a",
      vesselId: "vessel-a",
      name: "Draft map",
      coordinateMode: "normalized_percent",
      diagramWidth: 895,
      diagramHeight: 420,
      diagramKind: "side_elevation",
      imageTransform: { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 },
      status: "draft",
      sections: [
        {
          id: "section-a",
          sectionKey: "main_engine_room",
          sectionNo: 1,
          name: "Main Engine Room",
          color: "#45a858",
          sortOrder: 0,
          polygonNormalized: [
            { x: 0.1, y: 0.1 },
            { x: 1.2, y: 0.1 },
            { x: 0.4, y: 0.4 },
          ],
          labelNormalized: { x: 0.5, y: 0.5 },
          equipment: [],
          thumbnailFallback: null,
        },
      ],
    };

    const result = validateSectionMapDraft(map);

    expect(result.summary.blockers).toBe(1);
    expect(result.summary.warnings).toBe(2);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "normalized_point_out_of_range",
        "section_thumbnail_fallback_missing",
        "section_unassigned",
      ])
    );
  });

  it("rejects unsupported thumbnail media", () => {
    expect(() =>
      validateThumbnailUpload("org-a", "vessel-a", {
        ownerType: "section",
        ownerId: "section-a",
        originalFileName: "bad.html",
        mimeType: "text/html",
        content: Buffer.from("<p>bad</p>"),
      })
    ).toThrow("Invalid thumbnail upload");
  });

  it("blocks raster uploads when file bytes do not match the declared type", () => {
    const result = validateDiagramUpload("org-a", "vessel-a", {
      originalFileName: "spoofed.png",
      mimeType: "image/png",
      content: Buffer.from(`<svg viewBox="0 0 10 10"></svg>`),
    });

    expect(result.validationSummary.blockers).toBeGreaterThan(0);
    expect(result.issues.map((issue) => issue.code)).toContain("media_signature_mismatch");
  });
});
