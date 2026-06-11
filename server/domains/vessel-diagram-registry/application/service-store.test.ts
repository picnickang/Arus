import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { VesselDiagramRegistryService } from "./service.js";
import { InMemoryVesselDiagramRegistryStore } from "../infrastructure/in-memory-store.js";
import type {
  DiagramUploadInput,
  RegistryContext,
  VesselRegistryMediaStore,
  PersistRegistryMediaInput,
} from "../domain/types.js";

const ctx: RegistryContext = {
  orgId: "org-coverage",
  vesselId: "vessel-alpha",
  userId: "admin-1",
};

const otherCtx: RegistryContext = {
  ...ctx,
  vesselId: "vessel-beta",
};

const safeSvgUpload: DiagramUploadInput = {
  originalFileName: "side-elevation.svg",
  mimeType: "image/svg+xml",
  content: Buffer.from(`<svg viewBox="0 0 895 420"><path d="M0 0h10v10z"/></svg>`),
};

function section(name = "Main Engine Room") {
  return {
    sectionKey: name.toLowerCase().replace(/\W+/g, "_"),
    sectionNo: 1,
    name,
    color: "#45a858",
    polygonNormalized: [
      { x: 0.2, y: 0.2 },
      { x: 0.4, y: 0.2 },
      { x: 0.4, y: 0.4 },
      { x: 0.2, y: 0.4 },
    ],
    labelNormalized: { x: 0.3, y: 0.3 },
    thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    equipment: [
      {
        equipmentId: "eq-1",
        equipmentName: "Main Engine",
        assetCode: "ME-01",
        system: "Propulsion",
      },
    ],
  };
}

class RecordingMediaStore implements VesselRegistryMediaStore {
  persisted: PersistRegistryMediaInput[] = [];
  archived: string[] = [];

  async persist(_ctx: RegistryContext, input: PersistRegistryMediaInput): Promise<string> {
    this.persisted.push(input);
    return `object://${input.kind}/${input.originalFileName}/${this.persisted.length}`;
  }

  async archive(_ctx: RegistryContext, objectKey: string): Promise<void> {
    this.archived.push(objectKey);
  }
}

describe("VesselDiagramRegistryService with in-memory store", () => {
  let store: InMemoryVesselDiagramRegistryStore;
  let media: RecordingMediaStore;
  let service: VesselDiagramRegistryService;

  beforeEach(() => {
    store = new InMemoryVesselDiagramRegistryStore();
    media = new RecordingMediaStore();
    service = new VesselDiagramRegistryService(store, media);
  });

  it("batches per-vessel summaries, dedupes ids, and scopes each to its vessel", async () => {
    const alphaDiagram = await service.createDiagram(ctx, {
      diagramType: "side_elevation",
      title: "Alpha side elevation",
    });
    await service.createDiagram(otherCtx, {
      diagramType: "deck_plan",
      title: "Beta deck plan",
    });

    const summaries = await service.getSummaries({ orgId: ctx.orgId, userId: ctx.userId }, [
      ctx.vesselId,
      otherCtx.vesselId,
      ctx.vesselId, // duplicate must not produce extra work or entries
      "vessel-without-records",
    ]);

    expect(Object.keys(summaries).sort()).toEqual(
      [ctx.vesselId, otherCtx.vesselId, "vessel-without-records"].sort()
    );
    expect(summaries[ctx.vesselId].diagrams).toHaveLength(1);
    expect(summaries[ctx.vesselId].diagrams[0].id).toBe(alphaDiagram.id);
    expect(summaries[otherCtx.vesselId].diagrams).toHaveLength(1);
    expect(summaries[otherCtx.vesselId].diagrams[0].title).toBe("Beta deck plan");
    expect(summaries["vessel-without-records"]).toMatchObject({
      diagrams: [],
      activeDiagram: null,
      sectionMaps: [],
    });
  });

  it("keeps diagrams, versions, section maps, assignments, and thumbnails tenant-scoped", async () => {
    const diagram = await service.createDiagram(ctx, {
      diagramType: "side_elevation",
      title: "Side elevation",
      description: "Primary vessel schematic",
    });
    const hidden = await service.createDiagram(otherCtx, {
      diagramType: "deck_plan",
      title: "Other vessel deck plan",
    });

    expect(await service.listDiagrams(ctx)).toHaveLength(1);
    await expect(service.getDiagram(ctx, hidden.id)).rejects.toMatchObject({ statusCode: 404 });

    const version = await service.uploadDiagramVersion(ctx, diagram.id, safeSvgUpload);
    expect(version.versionNumber).toBe(1);
    expect(version.objectKey).toContain("object://diagram");
    expect(media.persisted[0].content.toString("utf8")).toContain("<svg");

    const active = await service.publishDiagramVersion(ctx, diagram.id, version.id);
    expect(active.status).toBe("active");
    expect(active.publishedBy).toBe(ctx.userId);
    expect(await service.getActiveVersion(ctx, diagram.id)).toMatchObject({ id: version.id });

    const map = await service.createSectionMap(ctx, {
      name: "Draft sections",
      diagramId: diagram.id,
      diagramVersionId: version.id,
      sections: [section()],
    });
    expect((await service.getDiagram(ctx, diagram.id)).currentSectionMapId).toBe(map.id);

    const added = await service.addSection(ctx, map.id, section("Bow Thruster Room"));
    const assignment = await service.assignEquipment(ctx, map.id, added.id, {
      equipmentName: "Bow Thruster",
      assetCode: "BT-01",
      system: "Maneuvering",
    });
    expect(await service.listEquipmentAssignments(ctx, map.id)).toHaveLength(3);

    const updatedAssignment = await service.updateEquipmentAssignment(
      ctx,
      map.id,
      added.id,
      assignment.id,
      { equipmentId: "eq-bt", equipmentName: "Bow Thruster Motor", assetCode: null }
    );
    expect(updatedAssignment).toMatchObject({
      equipmentId: "eq-bt",
      equipmentName: "Bow Thruster Motor",
      assetCode: null,
    });

    const thumb = await service.uploadThumbnail(ctx, {
      ownerType: "section",
      ownerId: added.id,
      mapId: map.id,
      originalFileName: "section.svg",
      mimeType: "image/svg+xml",
      content: Buffer.from(`<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`),
    });
    expect(thumb.fallbackMode).toBe("manual");
    expect(await service.getThumbnailMedia(ctx, "section", added.id)).toMatchObject({
      ownerId: added.id,
      ownerType: "section",
    });

    await service.deleteThumbnail(ctx, "section", added.id);
    await expect(service.getThumbnailMedia(ctx, "section", added.id)).rejects.toMatchObject({
      statusCode: 404,
    });

    await service.deleteEquipmentAssignment(ctx, map.id, added.id, assignment.id);
    expect(await service.listEquipmentAssignments(ctx, map.id)).toHaveLength(2);

    await service.deleteSection(ctx, map.id, added.id);
    expect((await service.getSectionMap(ctx, map.id)).sections).toHaveLength(1);
  });

  it("implements each replacement behavior with real draft-map side effects", async () => {
    const diagram = await service.createDiagram(ctx, {
      diagramType: "side_elevation",
      title: "Replaceable schematic",
    });
    const baseVersion = await service.uploadDiagramVersion(ctx, diagram.id, safeSvgUpload);
    const sourceMap = await service.createSectionMap(ctx, {
      name: "Published source",
      diagramId: diagram.id,
      diagramVersionId: baseVersion.id,
      sections: [section()],
    });
    await service.publishSectionMap(ctx, sourceMap.id);

    const keepExisting = await service.uploadDiagramVersionWithBehavior(
      ctx,
      diagram.id,
      safeSvgUpload,
      { mode: "keep_existing", mapName: "Overlay draft" }
    );
    expect(keepExisting.draftMap).toMatchObject({
      sourceMapId: sourceMap.id,
      name: "Overlay draft",
      status: "draft",
    });
    expect(keepExisting.draftMap?.sections[0].equipment).toHaveLength(1);
    expect(keepExisting.warnings.join(" ")).toContain("cloned as a draft overlay");

    const blank = await service.uploadDiagramVersionWithBehavior(ctx, diagram.id, safeSvgUpload, {
      mode: "start_blank",
      mapName: "Blank map",
    });
    expect(blank.draftMap?.sections).toEqual([]);

    const template = await service.uploadDiagramVersionWithBehavior(
      ctx,
      diagram.id,
      safeSvgUpload,
      {
        mode: "copy_template",
        templateId: "tugboat",
      }
    );
    expect(template.draftMap?.sections.map((item) => item.name)).toEqual(
      expect.arrayContaining(["Engine Room", "Wheelhouse"])
    );

    const sourceDiagram = await service.createDiagram(otherCtx, {
      diagramType: "side_elevation",
      title: "Template vessel",
    });
    const sourceVesselMap = await service.createSectionMap(otherCtx, {
      name: "Other vessel sections",
      diagramId: sourceDiagram.id,
      sections: [section("Cargo Pump Room")],
    });

    const copied = await service.uploadDiagramVersionWithBehavior(ctx, diagram.id, safeSvgUpload, {
      mode: "copy_vessel",
      sourceVesselId: otherCtx.vesselId,
      sourceMapId: sourceVesselMap.id,
    });
    expect(copied.draftMap).toMatchObject({ sourceMapId: sourceVesselMap.id });
    expect(copied.draftMap?.sections[0]).toMatchObject({
      name: "Cargo Pump Room",
      equipment: [],
    });
    expect(copied.warnings.join(" ")).toContain("Equipment assignments were not copied");
  });

  it("persists side-elevation calibration through map edits, clones, and replacement overlays", async () => {
    const diagram = await service.createDiagram(ctx, {
      diagramType: "side_elevation",
      title: "Calibrated side elevation",
    });
    const version = await service.uploadDiagramVersion(ctx, diagram.id, safeSvgUpload);
    const calibration = { scaleX: 1.15, scaleY: 0.9, offsetX: 0.04, offsetY: -0.03 };
    const sourceMap = await service.createSectionMap(ctx, {
      name: "Calibrated draft",
      diagramId: diagram.id,
      diagramVersionId: version.id,
      imageTransform: calibration,
      sections: [section()],
    });

    expect(sourceMap.imageTransform).toEqual(calibration);

    const updated = await service.updateSectionMap(ctx, sourceMap.id, {
      imageTransform: { scaleX: 1.05, scaleY: 1.2, offsetX: -0.02, offsetY: 0.01 },
    });
    expect(updated.imageTransform).toEqual({
      scaleX: 1.05,
      scaleY: 1.2,
      offsetX: -0.02,
      offsetY: 0.01,
    });

    const cloned = await service.cloneSectionMap(ctx, updated.id, { name: "Calibration clone" });
    expect(cloned.imageTransform).toEqual(updated.imageTransform);

    await service.publishSectionMap(ctx, updated.id);
    const keepExisting = await service.uploadDiagramVersionWithBehavior(
      ctx,
      diagram.id,
      safeSvgUpload,
      { mode: "keep_existing", mapName: "Calibration overlay" }
    );
    expect(keepExisting.draftMap?.imageTransform).toEqual(updated.imageTransform);
  });

  it("validates blockers, archives active records, clones maps, and records validation issues", async () => {
    const diagram = await service.createDiagram(ctx, {
      diagramType: "side_elevation",
      title: "Validation schematic",
    });

    await expect(
      service.uploadDiagramVersion(ctx, diagram.id, {
        ...safeSvgUpload,
        content: Buffer.from(`<svg><script>alert(1)</script></svg>`),
      })
    ).rejects.toThrow("Diagram upload failed validation");

    const version = await service.uploadDiagramVersion(ctx, diagram.id, safeSvgUpload);
    const invalidMap = await store.createSectionMap(ctx, {
      name: "Invalid draft",
      diagramId: diagram.id,
      diagramVersionId: version.id,
      sections: [
        {
          ...section("Invalid"),
          polygonNormalized: [
            { x: 0.1, y: 0.1 },
            { x: 1.4, y: 0.1 },
            { x: 0.2, y: 0.2 },
          ],
          thumbnailFallback: undefined,
          equipment: [],
        },
      ],
    });

    const validation = await service.validateSectionMap(ctx, invalidMap.id);
    expect(validation.summary.blockers).toBeGreaterThan(0);
    await expect(service.publishSectionMap(ctx, invalidMap.id)).rejects.toThrow(
      "Section map cannot be published"
    );
    await expect(
      service.updateSection(ctx, invalidMap.id, invalidMap.sections[0].id, {
        polygonNormalized: [
          { x: 0.1, y: 0.1 },
          { x: 0.2, y: 0.2 },
        ],
      })
    ).rejects.toThrow("Section contains invalid geometry");
    await expect(
      service.updateSection(ctx, invalidMap.id, invalidMap.sections[0].id, {
        labelNormalized: { x: 2, y: 0.5 },
      })
    ).rejects.toThrow("Section contains invalid geometry");

    const fixed = await service.updateSection(ctx, invalidMap.id, invalidMap.sections[0].id, {
      polygonNormalized: section().polygonNormalized,
      labelNormalized: section().labelNormalized,
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    });
    await service.assignEquipment(ctx, invalidMap.id, fixed.id, { equipmentName: "Generator" });
    const published = await service.publishSectionMap(ctx, invalidMap.id);
    expect(published.status).toBe("published");

    const cloned = await service.cloneSectionMap(ctx, published.id, { name: "Cloned draft" });
    expect(cloned).toMatchObject({ sourceMapId: published.id, name: "Cloned draft" });

    await service.archiveDiagramVersion(ctx, diagram.id, version.id);
    expect(await service.getActiveVersion(ctx, diagram.id)).toBeNull();
    const restored = await service.restoreDiagramVersionAsDraft(ctx, diagram.id, version.id);
    expect(restored.status).toBe("draft");

    await service.deleteSectionMap(ctx, cloned.id);
    expect((await service.getSectionMap(ctx, cloned.id)).status).toBe("archived");
    await service.deleteDiagram(ctx, diagram.id);
    expect((await service.getDiagram(ctx, diagram.id)).status).toBe("archived");
  });

  it("surfaces missing source/template/assignment errors without mutating unrelated vessels", async () => {
    const diagram = await service.createDiagram(ctx, {
      diagramType: "side_elevation",
      title: "Error paths",
    });
    const version = await service.uploadDiagramVersion(ctx, diagram.id, safeSvgUpload);
    const map = await service.createSectionMap(ctx, {
      name: "Editable draft",
      diagramId: diagram.id,
      diagramVersionId: version.id,
      sections: [section()],
    });

    await expect(service.getDiagram(otherCtx, diagram.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.getSectionMap(otherCtx, map.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(() => service.getSectionMapTemplate("missing-template")).toThrow(
      "Section map template not found"
    );
    await expect(
      service.uploadDiagramVersionWithBehavior(ctx, diagram.id, safeSvgUpload, {
        mode: "copy_vessel",
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.cloneSectionMap(ctx, "missing-map", { name: "Nope" })
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      service.updateEquipmentAssignment(ctx, map.id, map.sections[0].id, "missing-assignment", {
        equipmentName: "Nope",
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.deleteSection(ctx, map.id, "missing-section")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("preserves the original version-store error when upload cleanup archive fails", async () => {
    const diagram = await service.createDiagram(ctx, {
      diagramType: "side_elevation",
      title: "Cleanup error precedence",
    });
    const original = new Error("add version failed");
    jest.spyOn(store, "addVersion").mockRejectedValueOnce(original);
    jest.spyOn(media, "archive").mockRejectedValueOnce(new Error("archive failed"));

    await expect(service.uploadDiagramVersion(ctx, diagram.id, safeSvgUpload)).rejects.toThrow(
      "add version failed"
    );
    expect(media.archive).toHaveBeenCalledTimes(1);
  });

  it("preserves the original thumbnail-store error when upload cleanup archive fails", async () => {
    const original = new Error("thumbnail upsert failed");
    jest.spyOn(store, "upsertThumbnail").mockRejectedValueOnce(original);
    jest.spyOn(media, "archive").mockRejectedValueOnce(new Error("archive failed"));

    await expect(
      service.uploadThumbnail(ctx, {
        ownerType: "section",
        ownerId: "section-a",
        mapId: "map-a",
        originalFileName: "thumb.svg",
        mimeType: "image/svg+xml",
        content: Buffer.from(`<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`),
      })
    ).rejects.toThrow("thumbnail upsert failed");
    expect(media.archive).toHaveBeenCalledTimes(1);
  });
});
