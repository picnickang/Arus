import type {
  CreateDiagramInput,
  CreateSectionInput,
  CreateSectionMapInput,
  DiagramUploadInput,
  RegistryContext,
  RegistrySummary,
  SectionMapRecord,
  SectionMapTemplateRecord,
  ThumbnailUploadInput,
  UpdateAssignmentInput,
  UpdateDiagramInput,
  UpdateSectionInput,
  UpdateSectionMapInput,
  VesselRegistryMediaStore,
  VesselDiagramRegistryStore,
} from "../domain/types";
import {
  assertNoBlockers,
  validateDiagramUpload,
  validateSectionGeometryPatch,
  validateSectionInput,
  validateSectionMapDraft,
  validateThumbnailUpload,
} from "./validation";

export class VesselDiagramRegistryService {
  constructor(
    private readonly store: VesselDiagramRegistryStore,
    private readonly mediaStore: VesselRegistryMediaStore = new MetadataOnlyMediaStore()
  ) {}

  async getSummary(ctx: RegistryContext): Promise<RegistrySummary> {
    const [diagrams, sectionMaps, validationIssues] = await Promise.all([
      this.store.listDiagrams(ctx),
      this.store.listSectionMaps(ctx),
      this.store.listValidationResults(ctx),
    ]);

    return {
      diagrams,
      activeDiagram: diagrams.find((diagram) => diagram.status === "active") ?? null,
      sectionMaps,
      activeSectionMap: sectionMaps.find((map) => map.status === "published") ?? null,
      validationIssues,
    };
  }

  // Batch form of getSummary so fleet-wide views fetch one response instead of
  // issuing a request per vessel (fleet hub previously did N+1 round trips).
  async getSummaries(
    actor: Omit<RegistryContext, "vesselId">,
    vesselIds: string[]
  ): Promise<Record<string, RegistrySummary>> {
    const uniqueIds = Array.from(new Set(vesselIds));
    const entries = await Promise.all(
      uniqueIds.map(
        async (vesselId) => [vesselId, await this.getSummary({ ...actor, vesselId })] as const
      )
    );
    return Object.fromEntries(entries);
  }

  listDiagrams(ctx: RegistryContext) {
    return this.store.listDiagrams(ctx);
  }

  async createDiagram(ctx: RegistryContext, input: CreateDiagramInput) {
    return this.store.createDiagram(ctx, input);
  }

  async getDiagram(ctx: RegistryContext, diagramId: string) {
    const diagram = await this.store.getDiagram(ctx, diagramId);
    if (!diagram) {
      throw notFound(`Diagram ${diagramId} not found`);
    }
    return diagram;
  }

  async updateDiagram(ctx: RegistryContext, diagramId: string, input: UpdateDiagramInput) {
    return this.store.updateDiagram(ctx, diagramId, input);
  }

  async deleteDiagram(ctx: RegistryContext, diagramId: string) {
    return this.store.deleteDiagram(ctx, diagramId);
  }

  async uploadDiagramVersion(ctx: RegistryContext, diagramId: string, input: DiagramUploadInput) {
    const diagram = await this.store.getDiagram(ctx, diagramId);
    if (!diagram) {
      throw notFound(`Diagram ${diagramId} not found`);
    }

    const validated = validateDiagramUpload(ctx.orgId, ctx.vesselId, input);
    await this.store.saveValidationResults(ctx, { diagramId }, validated.issues);
    assertNoBlockers("Diagram upload failed validation", validated.issues);

    const persistedContent = await preparePersistedContent(
      input.mimeType,
      input.content,
      validated.sanitizedSvg
    );
    const objectKey = await this.mediaStore.persist(ctx, {
      kind: "diagram",
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      content: persistedContent,
      objectKeyHint: validated.objectKey,
    });

    try {
      return await this.store.addVersion(ctx, diagramId, {
        status: "draft",
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSizeBytes: persistedContent.byteLength,
        contentSha256: validated.contentSha256,
        objectKey,
        sanitizedSvg: validated.sanitizedSvg ?? null,
        validationSummary: validated.validationSummary,
        uploadedBy: ctx.userId ?? null,
        publishedBy: null,
        publishedAt: null,
        uploadedAt: new Date(),
      });
    } catch (error) {
      await this.archiveMediaBestEffort(ctx, objectKey);
      throw error;
    }
  }

  async setActiveVersion(ctx: RegistryContext, diagramId: string, versionId: string) {
    return this.store.setActiveVersion(ctx, diagramId, versionId);
  }

  async publishDiagramVersion(ctx: RegistryContext, diagramId: string, versionId: string) {
    return this.store.setActiveVersion(ctx, diagramId, versionId);
  }

  async archiveDiagramVersion(ctx: RegistryContext, diagramId: string, versionId: string) {
    return this.store.updateVersionStatus(ctx, diagramId, versionId, "archived");
  }

  async restoreDiagramVersionAsDraft(ctx: RegistryContext, diagramId: string, versionId: string) {
    return this.store.updateVersionStatus(ctx, diagramId, versionId, "draft");
  }

  async getActiveVersion(ctx: RegistryContext, diagramId: string) {
    const diagram = await this.getDiagram(ctx, diagramId);
    if (!diagram.activeVersionId) {
      return null;
    }
    return this.store.getVersion(ctx, diagramId, diagram.activeVersionId);
  }

  listVersions(ctx: RegistryContext, diagramId: string) {
    return this.store.listVersions(ctx, diagramId);
  }

  async getDiagramVersionMedia(ctx: RegistryContext, diagramId: string, versionId: string) {
    const version = await this.store.getVersion(ctx, diagramId, versionId);
    if (!version) {
      throw notFound(`Diagram version ${versionId} not found`);
    }
    return version;
  }

  listSectionMaps(ctx: RegistryContext) {
    return this.store.listSectionMaps(ctx);
  }

  async getSectionMap(ctx: RegistryContext, mapId: string) {
    const map = await this.store.getSectionMap(ctx, mapId);
    if (!map) {
      throw notFound(`Section map ${mapId} not found`);
    }
    return map;
  }

  async createSectionMap(ctx: RegistryContext, input: CreateSectionMapInput) {
    const issues = input.sections?.flatMap(validateSectionInput) ?? [];
    assertNoBlockers("Section map contains invalid geometry", issues);
    return this.store.createSectionMap(ctx, input);
  }

  async updateSectionMap(ctx: RegistryContext, mapId: string, input: UpdateSectionMapInput) {
    return this.store.updateSectionMap(ctx, mapId, input);
  }

  async deleteSectionMap(ctx: RegistryContext, mapId: string) {
    return this.store.deleteSectionMap(ctx, mapId);
  }

  async cloneSectionMap(
    ctx: RegistryContext,
    mapId: string,
    input: { name: string; diagramId?: string; diagramVersionId?: string }
  ) {
    return this.store.cloneSectionMap(ctx, mapId, input);
  }

  async cloneSectionMapFromVessel(
    ctx: RegistryContext,
    sourceVesselId: string,
    sourceMapId: string,
    input: { name: string; diagramId?: string; diagramVersionId?: string }
  ) {
    const source = await this.store.getSectionMapForVessel(ctx, sourceVesselId, sourceMapId);
    if (!source) {
      throw notFound("Source section map not found");
    }
    return this.createSectionMap(ctx, {
      name: input.name,
      diagramId: input.diagramId,
      diagramVersionId: input.diagramVersionId,
      sourceMapId: source.id,
      diagramWidth: source.diagramWidth,
      diagramHeight: source.diagramHeight,
      diagramKind: source.diagramKind,
      imageTransform: source.imageTransform,
      sections: sectionsFromMap(source, { copyEquipment: false }),
    });
  }

  async createSectionMapFromTemplate(
    ctx: RegistryContext,
    templateId: string,
    input: { name?: string; diagramId?: string; diagramVersionId?: string }
  ) {
    const template = getSectionMapTemplate(templateId);
    if (!template) {
      throw notFound("Section map template not found");
    }
    return this.createSectionMap(ctx, {
      name: input.name ?? `${template.name} draft`,
      diagramId: input.diagramId,
      diagramVersionId: input.diagramVersionId,
      diagramWidth: template.diagramWidth,
      diagramHeight: template.diagramHeight,
      diagramKind: template.diagramKind,
      sections: template.sections,
    });
  }

  listSectionMapTemplates() {
    return SECTION_MAP_TEMPLATES;
  }

  getSectionMapTemplate(templateId: string) {
    const template = getSectionMapTemplate(templateId);
    if (!template) {
      throw notFound("Section map template not found");
    }
    return template;
  }

  async uploadDiagramVersionWithBehavior(
    ctx: RegistryContext,
    diagramId: string,
    input: DiagramUploadInput,
    behavior: {
      mode?: "keep_existing" | "start_blank" | "copy_vessel" | "copy_template";
      sourceVesselId?: string;
      sourceMapId?: string;
      templateId?: string;
      mapName?: string;
    }
  ) {
    const version = await this.uploadDiagramVersion(ctx, diagramId, input);
    const diagram = await this.getDiagram(ctx, diagramId);
    const mode = behavior.mode ?? "keep_existing";
    const mapName = behavior.mapName ?? `${diagram.title} v${version.versionNumber} draft map`;
    let draftMap: SectionMapRecord | null = null;
    const warnings: string[] = [];

    if (mode === "keep_existing") {
      const maps = await this.listSectionMaps(ctx);
      const source =
        maps.find((map) => map.id === diagram.currentSectionMapId) ??
        maps.find((map) => map.status === "published") ??
        maps[0];
      if (source) {
        draftMap = await this.createSectionMap(ctx, {
          name: mapName,
          diagramId,
          diagramVersionId: version.id,
          sourceMapId: source.id,
          diagramWidth: source.diagramWidth,
          diagramHeight: source.diagramHeight,
          diagramKind: diagram.diagramType,
          imageTransform: source.imageTransform,
          sections: sectionsFromMap(source, { copyEquipment: true }),
        });
        warnings.push(
          "Existing normalized polygons were cloned as a draft overlay; validate alignment before publishing."
        );
      } else {
        draftMap = await this.createSectionMap(ctx, {
          name: mapName,
          diagramId,
          diagramVersionId: version.id,
          diagramKind: diagram.diagramType,
          sections: [],
        });
        warnings.push("No existing map was available, so a blank draft map was created.");
      }
    }

    if (mode === "start_blank") {
      draftMap = await this.createSectionMap(ctx, {
        name: mapName,
        diagramId,
        diagramVersionId: version.id,
        diagramKind: diagram.diagramType,
        sections: [],
      });
    }

    if (mode === "copy_vessel") {
      if (!behavior.sourceVesselId || !behavior.sourceMapId) {
        throw validationError("Copy from another vessel requires source vessel and map");
      }
      draftMap = await this.cloneSectionMapFromVessel(
        ctx,
        behavior.sourceVesselId,
        behavior.sourceMapId,
        { name: mapName, diagramId, diagramVersionId: version.id }
      );
      warnings.push(
        "Equipment assignments were not copied unless explicitly rematched on this vessel."
      );
    }

    if (mode === "copy_template") {
      draftMap = await this.createSectionMapFromTemplate(
        ctx,
        behavior.templateId ?? "custom_blank",
        {
          name: mapName,
          diagramId,
          diagramVersionId: version.id,
        }
      );
    }

    return { version, draftMap, warnings };
  }

  async addSection(ctx: RegistryContext, mapId: string, input: CreateSectionInput) {
    assertNoBlockers("Section contains invalid geometry", validateSectionInput(input));
    return this.store.addSection(ctx, mapId, input);
  }

  async updateSection(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: UpdateSectionInput
  ) {
    if (input.polygonNormalized !== undefined || input.labelNormalized !== undefined) {
      assertNoBlockers(
        "Section contains invalid geometry",
        validateSectionGeometryPatch({
          sectionKey: input.sectionKey ?? "section",
          ...(input.polygonNormalized !== undefined
            ? { polygonNormalized: input.polygonNormalized }
            : {}),
          ...(input.labelNormalized !== undefined
            ? { labelNormalized: input.labelNormalized }
            : {}),
        })
      );
    }
    return this.store.updateSection(ctx, mapId, sectionId, input);
  }

  async deleteSection(ctx: RegistryContext, mapId: string, sectionId: string) {
    return this.store.deleteSection(ctx, mapId, sectionId);
  }

  async updateSectionPolygon(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: {
      polygonNormalized: CreateSectionInput["polygonNormalized"];
      labelNormalized: CreateSectionInput["labelNormalized"];
    }
  ) {
    return this.store.updateSectionPolygon(ctx, mapId, sectionId, input);
  }

  async deleteSectionPolygon(ctx: RegistryContext, mapId: string, sectionId: string) {
    return this.store.deleteSectionPolygon(ctx, mapId, sectionId);
  }

  async validateSectionMap(ctx: RegistryContext, mapId: string) {
    const map = await this.store.getSectionMap(ctx, mapId);
    if (!map) {
      throw notFound(`Section map ${mapId} not found`);
    }
    const validation = validateSectionMapDraft(map);
    await this.store.saveValidationResults(ctx, { mapId }, validation.issues);
    return validation;
  }

  async publishSectionMap(ctx: RegistryContext, mapId: string) {
    const validation = await this.validateSectionMap(ctx, mapId);
    assertNoBlockers(
      "Section map cannot be published until blockers are resolved",
      validation.issues
    );
    return this.store.publishSectionMap(ctx, mapId, validation);
  }

  async assignEquipment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: {
      equipmentId?: string;
      equipmentName: string;
      assetCode?: string;
      system?: string;
    }
  ) {
    return this.store.assignEquipment(ctx, mapId, sectionId, input);
  }

  listEquipmentAssignments(ctx: RegistryContext, mapId: string) {
    return this.store.listEquipmentAssignments(ctx, mapId);
  }

  updateEquipmentAssignment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    assignmentId: string,
    input: UpdateAssignmentInput
  ) {
    return this.store.updateEquipmentAssignment(ctx, mapId, sectionId, assignmentId, input);
  }

  deleteEquipmentAssignment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    assignmentId: string
  ) {
    return this.store.deleteEquipmentAssignment(ctx, mapId, sectionId, assignmentId);
  }

  async uploadThumbnail(ctx: RegistryContext, input: ThumbnailUploadInput) {
    const validated = validateThumbnailUpload(ctx.orgId, ctx.vesselId, input);
    const persistedContent = await preparePersistedContent(
      input.mimeType,
      input.content,
      validated.sanitizedSvg
    );
    const objectKey = await this.mediaStore.persist(ctx, {
      kind: input.ownerType === "section" ? "section-thumbnail" : "equipment-thumbnail",
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      content: persistedContent,
      objectKeyHint: validated.objectKey,
    });

    try {
      return await this.store.upsertThumbnail(ctx, {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        mapId: input.mapId ?? null,
        objectKey,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSizeBytes: persistedContent.byteLength,
        contentSha256: validated.contentSha256,
        fallbackMode: "manual",
        deletedAt: null,
      });
    } catch (error) {
      await this.archiveMediaBestEffort(ctx, objectKey);
      throw error;
    }
  }

  deleteThumbnail(ctx: RegistryContext, ownerType: "section" | "equipment", ownerId: string) {
    return this.store.deleteThumbnail(ctx, ownerType, ownerId);
  }

  async getThumbnailMedia(
    ctx: RegistryContext,
    ownerType: "section" | "equipment",
    ownerId: string
  ) {
    const thumbnail = await this.store.getThumbnail(ctx, ownerType, ownerId);
    if (!thumbnail) {
      throw notFound(`${ownerType} thumbnail not found`);
    }
    return thumbnail;
  }

  private async archiveMediaBestEffort(ctx: RegistryContext, objectKey: string): Promise<void> {
    try {
      await this.mediaStore.archive(ctx, objectKey);
    } catch {
      // Preserve the original store failure; cleanup is best-effort only.
    }
  }
}

function notFound(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 404;
  return error;
}

function validationError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}

function sectionsFromMap(
  source: SectionMapRecord,
  options: { copyEquipment: boolean }
): CreateSectionInput[] {
  return source.sections.map((section) => ({
    sectionKey: section.sectionKey,
    sectionNo: section.sectionNo,
    name: section.name,
    color: section.color,
    polygonNormalized: section.polygonNormalized,
    labelNormalized: section.labelNormalized,
    thumbnailFallback:
      section.thumbnailFallback ??
      "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    equipment: options.copyEquipment
      ? section.equipment.map((assignment) => ({
          equipmentId: assignment.equipmentId ?? undefined,
          equipmentName: assignment.equipmentName,
          assetCode: assignment.assetCode ?? undefined,
          system: assignment.system ?? undefined,
        }))
      : [],
  }));
}

const TEMPLATE_COLORS = ["#2563eb", "#16a34a", "#f97316", "#d946ef", "#06b6d4", "#eab308"];

function templateSections(prefix: string, names: string[]): CreateSectionInput[] {
  return names.map((name, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 0.08 + column * 0.28;
    const y = 0.18 + row * 0.24;
    return {
      sectionKey: `${prefix}_${index + 1}`,
      sectionNo: index + 1,
      name,
      color: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length],
      polygonNormalized: [
        { x, y },
        { x: x + 0.22, y },
        { x: x + 0.22, y: y + 0.16 },
        { x, y: y + 0.16 },
      ],
      labelNormalized: { x: x + 0.11, y: y + 0.08 },
      thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
      equipment: [],
    };
  });
}

export const SECTION_MAP_TEMPLATES: SectionMapTemplateRecord[] = [
  {
    id: "osv_workboat",
    name: "OSV / Workboat",
    vesselType: "OSV / Workboat",
    description: "Balanced working deck, machinery, accommodation, bridge, and utility zones.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("osv", [
      "Aft Working Deck",
      "Main Engine Room",
      "Cargo / Utility Deck",
      "Accommodation",
      "Bridge",
      "Bow / Forepeak",
    ]),
  },
  {
    id: "ahts",
    name: "AHTS",
    vesselType: "Anchor Handling Tug Supply",
    description: "Stern roller, winch deck, machinery, accommodation, bridge, and bow sections.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("ahts", [
      "Stern Roller",
      "Winch Deck",
      "Main Machinery",
      "Accommodation",
      "Bridge",
      "Forward Store",
    ]),
  },
  {
    id: "psv",
    name: "PSV",
    vesselType: "Platform Supply Vessel",
    description: "Cargo deck and tank/service sections for supply operations.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("psv", [
      "Aft Cargo Deck",
      "Mud / Brine Tanks",
      "Engine Room",
      "Accommodation",
      "Bridge",
      "Bow Thruster Room",
    ]),
  },
  {
    id: "tugboat",
    name: "Tugboat",
    vesselType: "Tugboat",
    description: "Compact towing vessel section starter.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("tug", [
      "Aft Deck",
      "Engine Room",
      "Galley",
      "Wheelhouse",
      "Forepeak",
    ]),
  },
  {
    id: "pilot_vessel",
    name: "Pilot Vessel",
    vesselType: "Pilot Vessel",
    description: "Fast craft operating sections.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("pilot", [
      "Aft Deck",
      "Machinery",
      "Passenger Cabin",
      "Bridge",
      "Foredeck",
    ]),
  },
  {
    id: "crew_boat",
    name: "Crew Boat",
    vesselType: "Crew Boat",
    description: "Crew transport layout starter.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: templateSections("crew", [
      "Aft Deck",
      "Engine Room",
      "Passenger Cabin",
      "Bridge",
      "Bow",
    ]),
  },
  {
    id: "custom_blank",
    name: "Custom Blank",
    vesselType: "Custom",
    description: "Blank map with no sections.",
    diagramKind: "side_elevation",
    diagramWidth: 895,
    diagramHeight: 420,
    sections: [],
  },
];

function getSectionMapTemplate(templateId: string): SectionMapTemplateRecord | null {
  return SECTION_MAP_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

class MetadataOnlyMediaStore implements VesselRegistryMediaStore {
  async persist(_ctx: RegistryContext, input: { objectKeyHint: string }): Promise<string> {
    return input.objectKeyHint;
  }

  async archive(): Promise<void> {}
}

async function preparePersistedContent(
  mimeType: string,
  content: Buffer,
  sanitizedSvg?: string
): Promise<Buffer> {
  if (sanitizedSvg) {
    return Buffer.from(sanitizedSvg, "utf8");
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
    return content;
  }

  const { default: sharp } = await import("sharp");
  const image = sharp(content, { failOn: "error" }).rotate();
  if (mimeType === "image/png") {
    return image.png().toBuffer();
  }
  if (mimeType === "image/jpeg") {
    return image.jpeg().toBuffer();
  }
  return image.webp().toBuffer();
}
