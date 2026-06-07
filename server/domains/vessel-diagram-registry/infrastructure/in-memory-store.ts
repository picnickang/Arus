import { randomUUID } from "node:crypto";
import type {
  CreateDiagramInput,
  CreateSectionInput,
  CreateSectionMapInput,
  DiagramRecord,
  DiagramVersionRecord,
  EquipmentAssignmentRecord,
  RegistryContext,
  SectionMapRecord,
  SectionRecord,
  ThumbnailRecord,
  ValidationIssue,
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
    ValidationIssue & { vesselId: string; mapId?: string }
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
      sourceMapId: null,
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
    return map;
  }

  async getSectionMap(ctx: RegistryContext, mapId: string): Promise<SectionMapRecord | null> {
    const map = this.maps.get(mapId);
    return map?.vesselId === ctx.vesselId ? map : null;
  }

  async cloneSectionMap(
    ctx: RegistryContext,
    mapId: string,
    input: { name: string }
  ): Promise<SectionMapRecord> {
    const source = await this.getSectionMap(ctx, mapId);
    if (!source) {
      throw notFound("Section map not found");
    }
    return this.createSectionMap(ctx, {
      name: input.name,
      diagramId: source.diagramId ?? undefined,
      diagramVersionId: source.diagramVersionId ?? undefined,
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

  async publishSectionMap(
    ctx: RegistryContext,
    mapId: string,
    validation: { summary: SectionMapRecord["validationSummary"]; issues: ValidationIssue[] }
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

  async saveValidationResults(
    ctx: RegistryContext,
    refs: { mapId?: string },
    issues: ValidationIssue[]
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
  ): Promise<ValidationIssue[]> {
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
}

function notFound(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 404;
  return error;
}
