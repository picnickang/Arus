import type {
  CreateDiagramInput,
  CreateSectionMapInput,
  DiagramUploadInput,
  RegistryContext,
  RegistrySummary,
  ThumbnailUploadInput,
  VesselRegistryMediaStore,
  VesselDiagramRegistryStore,
} from "../domain/types";
import {
  assertNoBlockers,
  validateDiagramUpload,
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

  listDiagrams(ctx: RegistryContext) {
    return this.store.listDiagrams(ctx);
  }

  async createDiagram(ctx: RegistryContext, input: CreateDiagramInput) {
    return this.store.createDiagram(ctx, input);
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
        status: "uploaded",
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSizeBytes: persistedContent.byteLength,
        contentSha256: validated.contentSha256,
        objectKey,
        sanitizedSvg: validated.sanitizedSvg ?? null,
        validationSummary: validated.validationSummary,
        uploadedAt: new Date(),
      });
    } catch (error) {
      await this.mediaStore.archive(ctx, objectKey);
      throw error;
    }
  }

  async setActiveVersion(ctx: RegistryContext, diagramId: string, versionId: string) {
    return this.store.setActiveVersion(ctx, diagramId, versionId);
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

  async createSectionMap(ctx: RegistryContext, input: CreateSectionMapInput) {
    const issues = input.sections?.flatMap(validateSectionInput) ?? [];
    assertNoBlockers("Section map contains invalid geometry", issues);
    return this.store.createSectionMap(ctx, input);
  }

  async cloneSectionMap(ctx: RegistryContext, mapId: string, input: { name: string }) {
    return this.store.cloneSectionMap(ctx, mapId, input);
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
      await this.mediaStore.archive(ctx, objectKey);
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
}

function notFound(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 404;
  return error;
}

class MetadataOnlyMediaStore implements VesselRegistryMediaStore {
  async persist(
    _ctx: RegistryContext,
    input: { objectKeyHint: string }
  ): Promise<string> {
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
