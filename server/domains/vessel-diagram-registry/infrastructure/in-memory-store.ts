import { randomUUID } from "node:crypto";
import type {
  CreateDiagramInput,
  CreateSectionInput,
  CreateSectionMapInput,
  DiagramRecord,
  DiagramVersionRecord,
  EquipmentAssignmentRecord,
  NormalizedPoint,
  RegistryContext,
  SectionMapRecord,
  SectionRecord,
  ThumbnailRecord,
  UpdateAssignmentInput,
  UpdateDiagramInput,
  UpdateSectionInput,
  UpdateSectionMapInput,
  VesselDiagramValidationIssue,
  VesselDiagramVersionStatus,
  VesselDiagramRegistryStore,
} from "../domain/types";

function now(): Date {
  return new Date();
}

function buildSection(input: CreateSectionInput, index: number): SectionRecord {
  const sectionId = randomUUID();
  return {
    id: sectionId,
    sectionKey: input.sectionKey,
    sectionNo: input.sectionNo,
    name: input.name,
    color: input.color,
    thumbnailFallback: input.thumbnailFallback ?? null,
    sortOrder: index,
    polygonNormalized: input.polygonNormalized,
    labelNormalized: input.labelNormalized,
    equipment:
      input.equipment?.map((equipment, equipmentIndex) => ({
        id: randomUUID(),
        sectionId,
        equipmentId: equipment.equipmentId ?? null,
        equipmentName: equipment.equipmentName,
        assetCode: equipment.assetCode ?? null,
        system: equipment.system ?? null,
        sortOrder: equipmentIndex,
      })) ?? [],
  };
}

export class InMemoryVesselDiagramRegistryStore implements VesselDiagramRegistryStore {
  private readonly diagrams = new Map<string, DiagramRecord>();
  private readonly versions = new Map<string, DiagramVersionRecord>();
  private readonly maps = new Map<string, SectionMapRecord>();
  private readonly thumbnails = new Map<string, ThumbnailRecord>();
  private readonly validationResults: Array<
    VesselDiagramValidationIssue & { vesselId: string; mapId?: string }
  > = [];

  async listDiagrams(ctx: RegistryContext): Promise<DiagramRecord[]> {
    return [...this.diagrams.values()].filter((diagram) => diagram.vesselId === ctx.vesselId);
  }

  async createDiagram(ctx: RegistryContext, input: CreateDiagramInput): Promise<DiagramRecord> {
    const diagram: DiagramRecord = {
      id: randomUUID(),
      vesselId: ctx.vesselId,
      diagramType: input.diagramType,
      title: input.title,
      description: input.description ?? null,
      status: "draft",
      activeVersionId: null,
      currentSectionMapId: null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.diagrams.set(diagram.id, diagram);
    return diagram;
  }

  async getDiagram(ctx: RegistryContext, diagramId: string): Promise<DiagramRecord | null> {
    const diagram = this.diagrams.get(diagramId);
    return diagram?.vesselId === ctx.vesselId ? diagram : null;
  }

  async updateDiagram(
    ctx: RegistryContext,
    diagramId: string,
    input: UpdateDiagramInput
  ): Promise<DiagramRecord> {
    const diagram = await this.getDiagram(ctx, diagramId);
    if (!diagram) {
      throw notFound("Diagram not found");
    }
    if (input.title !== undefined) {diagram.title = input.title;}
    if (input.description !== undefined) {diagram.description = input.description;}
    if (input.status !== undefined) {diagram.status = input.status;}
    if (input.activeVersionId !== undefined) {diagram.activeVersionId = input.activeVersionId;}
    if (input.currentSectionMapId !== undefined) {diagram.currentSectionMapId = input.currentSectionMapId;}
    diagram.updatedAt = now();
    return diagram;
  }

  async deleteDiagram(ctx: RegistryContext, diagramId: string): Promise<void> {
    await this.updateDiagram(ctx, diagramId, { status: "archived" });
  }

  async listVersions(ctx: RegistryContext, diagramId: string): Promise<DiagramVersionRecord[]> {
    return [...this.versions.values()].filter(
      (version) => version.vesselId === ctx.vesselId && version.diagramId === diagramId
    );
  }

  async getVersion(
    ctx: RegistryContext,
    diagramId: string,
    versionId: string
  ): Promise<DiagramVersionRecord | null> {
    const version = this.versions.get(versionId);
    return version?.vesselId === ctx.vesselId && version.diagramId === diagramId ? version : null;
  }

  async addVersion(
    ctx: RegistryContext,
    diagramId: string,
    input: Omit<DiagramVersionRecord, "id" | "vesselId" | "diagramId" | "versionNumber">
  ): Promise<DiagramVersionRecord> {
    const currentVersions = await this.listVersions(ctx, diagramId);
    const version: DiagramVersionRecord = {
      ...input,
      id: randomUUID(),
      vesselId: ctx.vesselId,
      diagramId,
      versionNumber: currentVersions.length + 1,
    };
    this.versions.set(version.id, version);
    return version;
  }

  async setActiveVersion(
    ctx: RegistryContext,
    diagramId: string,
    versionId: string
  ): Promise<DiagramVersionRecord> {
    const diagram = await this.getDiagram(ctx, diagramId);
    const version = this.versions.get(versionId);
    if (
      !diagram ||
      !version ||
      version.diagramId !== diagramId ||
      version.vesselId !== ctx.vesselId
    ) {
      throw notFound("Diagram version not found");
    }
    for (const item of await this.listVersions(ctx, diagramId)) {
      item.status = item.id === versionId ? "active" : "superseded";
    }
    diagram.status = "active";
    diagram.activeVersionId = versionId;
    diagram.updatedAt = now();
    version.status = "active";
    version.publishedBy = ctx.userId ?? null;
    version.publishedAt = now();
    return version;
  }

  async updateVersionStatus(
    ctx: RegistryContext,
    diagramId: string,
    versionId: string,
    status: VesselDiagramVersionStatus
  ): Promise<DiagramVersionRecord> {
    if (status === "active") {
      return this.setActiveVersion(ctx, diagramId, versionId);
    }
    const diagram = await this.getDiagram(ctx, diagramId);
    const version = await this.getVersion(ctx, diagramId, versionId);
    if (!diagram || !version) {
      throw notFound("Diagram version not found");
    }
    version.status = status;
    if (status === "archived" && diagram.activeVersionId === versionId) {
      diagram.activeVersionId = null;
      diagram.status = "draft";
      diagram.updatedAt = now();
    }
    return version;
  }

  async listSectionMaps(ctx: RegistryContext): Promise<SectionMapRecord[]> {
    return [...this.maps.values()].filter((map) => map.vesselId === ctx.vesselId);
  }

  async createSectionMap(
    ctx: RegistryContext,
    input: CreateSectionMapInput
  ): Promise<SectionMapRecord> {
    const map: SectionMapRecord = {
      id: randomUUID(),
      vesselId: ctx.vesselId,
      diagramId: input.diagramId ?? null,
      diagramVersionId: input.diagramVersionId ?? null,
      sourceMapId: input.sourceMapId ?? null,
      name: input.name,
      coordinateMode: "normalized_percent",
      diagramWidth: input.diagramWidth ?? 895,
      diagramHeight: input.diagramHeight ?? 420,
      diagramKind: input.diagramKind ?? "side_elevation",
      status: "draft",
      validationSummary: null,
      publishedAt: null,
      sections: input.sections?.map(buildSection) ?? [],
      createdAt: now(),
      updatedAt: now(),
    };
    this.maps.set(map.id, map);
    if (map.diagramId) {
      const diagram = await this.getDiagram(ctx, map.diagramId);
      if (diagram) {
        diagram.currentSectionMapId = map.id;
        diagram.updatedAt = now();
      }
    }
    return map;
  }

  async getSectionMap(ctx: RegistryContext, mapId: string): Promise<SectionMapRecord | null> {
    const map = this.maps.get(mapId);
    return map?.vesselId === ctx.vesselId ? map : null;
  }

  async getSectionMapForVessel(
    _ctx: RegistryContext,
    vesselId: string,
    mapId: string
  ): Promise<SectionMapRecord | null> {
    const map = this.maps.get(mapId);
    return map?.vesselId === vesselId ? map : null;
  }

  async updateSectionMap(
    ctx: RegistryContext,
    mapId: string,
    input: UpdateSectionMapInput
  ): Promise<SectionMapRecord> {
    const map = await this.getSectionMap(ctx, mapId);
    if (!map) {
      throw notFound("Section map not found");
    }
    if (input.name !== undefined) {map.name = input.name;}
    if (input.diagramId !== undefined) {map.diagramId = input.diagramId;}
    if (input.diagramVersionId !== undefined) {map.diagramVersionId = input.diagramVersionId;}
    if (input.sourceMapId !== undefined) {map.sourceMapId = input.sourceMapId;}
    if (input.diagramWidth !== undefined) {map.diagramWidth = input.diagramWidth;}
    if (input.diagramHeight !== undefined) {map.diagramHeight = input.diagramHeight;}
    if (input.diagramKind !== undefined) {map.diagramKind = input.diagramKind;}
    if (input.status !== undefined) {map.status = input.status;}
    map.updatedAt = now();
    return map;
  }

  async deleteSectionMap(ctx: RegistryContext, mapId: string): Promise<void> {
    await this.updateSectionMap(ctx, mapId, { status: "archived" });
  }

  async cloneSectionMap(
    ctx: RegistryContext,
    mapId: string,
    input: { name: string; diagramId?: string; diagramVersionId?: string }
  ): Promise<SectionMapRecord> {
    const source = await this.getSectionMap(ctx, mapId);
    if (!source) {
      throw notFound("Section map not found");
    }
    return this.createSectionMap(ctx, {
      name: input.name,
      diagramId: input.diagramId ?? source.diagramId ?? undefined,
      diagramVersionId: input.diagramVersionId ?? source.diagramVersionId ?? undefined,
      sourceMapId: source.id,
      diagramWidth: source.diagramWidth,
      diagramHeight: source.diagramHeight,
      diagramKind: source.diagramKind,
      sections: source.sections.map((section) => ({
        sectionKey: section.sectionKey,
        sectionNo: section.sectionNo,
        name: section.name,
        color: section.color,
        polygonNormalized: section.polygonNormalized,
        labelNormalized: section.labelNormalized,
        thumbnailFallback: section.thumbnailFallback ?? undefined,
        equipment: section.equipment.map((equipment) => ({
          equipmentId: equipment.equipmentId ?? undefined,
          equipmentName: equipment.equipmentName,
          assetCode: equipment.assetCode ?? undefined,
          system: equipment.system ?? undefined,
        })),
      })),
    });
  }

  async addSection(
    ctx: RegistryContext,
    mapId: string,
    input: CreateSectionInput
  ): Promise<SectionRecord> {
    const map = await this.getSectionMap(ctx, mapId);
    if (!map) {
      throw notFound("Section map not found");
    }
    const section = buildSection(input, map.sections.length);
    map.sections.push(section);
    map.updatedAt = now();
    return section;
  }

  async updateSection(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: UpdateSectionInput
  ): Promise<SectionRecord> {
    const section = await this.findSection(ctx, mapId, sectionId);
    if (input.sectionKey !== undefined) {section.section.sectionKey = input.sectionKey;}
    if (input.sectionNo !== undefined) {section.section.sectionNo = input.sectionNo;}
    if (input.name !== undefined) {section.section.name = input.name;}
    if (input.color !== undefined) {section.section.color = input.color;}
    if (input.thumbnailFallback !== undefined) {section.section.thumbnailFallback = input.thumbnailFallback;}
    if (input.labelNormalized !== undefined) {section.section.labelNormalized = input.labelNormalized;}
    if (input.polygonNormalized !== undefined) {section.section.polygonNormalized = input.polygonNormalized;}
    section.map.updatedAt = now();
    return section.section;
  }

  async deleteSection(ctx: RegistryContext, mapId: string, sectionId: string): Promise<void> {
    const map = await this.getSectionMap(ctx, mapId);
    if (!map) {
      throw notFound("Section map not found");
    }
    const nextSections = map.sections.filter((section) => section.id !== sectionId);
    if (nextSections.length === map.sections.length) {
      throw notFound("Section not found");
    }
    map.sections = nextSections.map((section, index) => ({ ...section, sortOrder: index }));
    map.updatedAt = now();
  }

  async updateSectionPolygon(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: { polygonNormalized: NormalizedPoint[]; labelNormalized: NormalizedPoint }
  ): Promise<SectionRecord> {
    return this.updateSection(ctx, mapId, sectionId, input);
  }

  async deleteSectionPolygon(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string
  ): Promise<SectionRecord> {
    return this.updateSection(ctx, mapId, sectionId, { polygonNormalized: [] });
  }

  async publishSectionMap(
    ctx: RegistryContext,
    mapId: string,
    validation: { summary: SectionMapRecord["validationSummary"]; issues: VesselDiagramValidationIssue[] }
  ): Promise<SectionMapRecord> {
    const map = await this.getSectionMap(ctx, mapId);
    if (!map) {
      throw notFound("Section map not found");
    }
    for (const other of await this.listSectionMaps(ctx)) {
      if (other.status === "published") {
        other.status = "archived";
      }
    }
    map.status = "published";
    map.validationSummary = validation.summary;
    map.publishedAt = now();
    map.updatedAt = now();
    return map;
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
  ): Promise<EquipmentAssignmentRecord> {
    const map = await this.getSectionMap(ctx, mapId);
    const section = map?.sections.find((item) => item.id === sectionId);
    if (!map || !section) {
      throw notFound("Section not found");
    }
    const assignment: EquipmentAssignmentRecord = {
      id: randomUUID(),
      sectionId,
      equipmentId: input.equipmentId ?? null,
      equipmentName: input.equipmentName,
      assetCode: input.assetCode ?? null,
      system: input.system ?? null,
      sortOrder: section.equipment.length,
    };
    section.equipment.push(assignment);
    return assignment;
  }

  async listEquipmentAssignments(
    ctx: RegistryContext,
    mapId: string
  ): Promise<EquipmentAssignmentRecord[]> {
    const map = await this.getSectionMap(ctx, mapId);
    if (!map) {
      throw notFound("Section map not found");
    }
    return map.sections.flatMap((section) => section.equipment);
  }

  async updateEquipmentAssignment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    assignmentId: string,
    input: UpdateAssignmentInput
  ): Promise<EquipmentAssignmentRecord> {
    const { section } = await this.findSection(ctx, mapId, sectionId);
    const assignment = section.equipment.find((item) => item.id === assignmentId);
    if (!assignment) {
      throw notFound("Equipment assignment not found");
    }
    if (input.equipmentId !== undefined) {assignment.equipmentId = input.equipmentId;}
    if (input.equipmentName !== undefined) {assignment.equipmentName = input.equipmentName;}
    if (input.assetCode !== undefined) {assignment.assetCode = input.assetCode;}
    if (input.system !== undefined) {assignment.system = input.system;}
    return assignment;
  }

  async deleteEquipmentAssignment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    assignmentId: string
  ): Promise<void> {
    const { section } = await this.findSection(ctx, mapId, sectionId);
    const nextAssignments = section.equipment.filter((item) => item.id !== assignmentId);
    if (nextAssignments.length === section.equipment.length) {
      throw notFound("Equipment assignment not found");
    }
    section.equipment = nextAssignments.map((assignment, index) => ({
      ...assignment,
      sortOrder: index,
    }));
  }

  async saveValidationResults(
    ctx: RegistryContext,
    refs: { mapId?: string },
    issues: VesselDiagramValidationIssue[]
  ): Promise<void> {
    this.validationResults.push(
      ...issues.map((issue) => ({
        ...issue,
        vesselId: ctx.vesselId,
        ...(refs.mapId ? { mapId: refs.mapId } : {}),
      }))
    );
  }

  async listValidationResults(
    ctx: RegistryContext,
    refs?: { mapId?: string }
  ): Promise<VesselDiagramValidationIssue[]> {
    return this.validationResults.filter(
      (issue) => issue.vesselId === ctx.vesselId && (!refs?.mapId || issue.mapId === refs.mapId)
    );
  }

  async upsertThumbnail(
    ctx: RegistryContext,
    input: Omit<ThumbnailRecord, "id" | "vesselId">
  ): Promise<ThumbnailRecord> {
    const key = `${ctx.vesselId}:${input.ownerType}:${input.ownerId}`;
    const thumbnail: ThumbnailRecord = {
      ...input,
      id: this.thumbnails.get(key)?.id ?? randomUUID(),
      vesselId: ctx.vesselId,
    };
    this.thumbnails.set(key, thumbnail);
    return thumbnail;
  }

  async getThumbnail(
    ctx: RegistryContext,
    ownerType: "section" | "equipment",
    ownerId: string
  ): Promise<ThumbnailRecord | null> {
    const key = `${ctx.vesselId}:${ownerType}:${ownerId}`;
    const thumbnail = this.thumbnails.get(key);
    return thumbnail && !thumbnail.deletedAt ? thumbnail : null;
  }

  async deleteThumbnail(
    ctx: RegistryContext,
    ownerType: "section" | "equipment",
    ownerId: string
  ): Promise<void> {
    const key = `${ctx.vesselId}:${ownerType}:${ownerId}`;
    const thumbnail = this.thumbnails.get(key);
    if (thumbnail) {
      thumbnail.deletedAt = now();
    }
  }

  private async findSection(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string
  ): Promise<{ map: SectionMapRecord; section: SectionRecord }> {
    const map = await this.getSectionMap(ctx, mapId);
    const section = map?.sections.find((item) => item.id === sectionId);
    if (!map || !section) {
      throw notFound("Section not found");
    }
    return { map, section };
  }
}

function notFound(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 404;
  return error;
}
