import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../../db";
import {
  vesselDiagrams,
  vesselDiagramVersions,
  vesselSectionMaps,
  vesselSections,
  vesselSectionPolygons,
  vesselSectionEquipmentAssignments,
  vesselThumbnailOverrides,
  vesselDiagramValidationResults,
} from "@shared/schema-runtime";
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
  ValidationSummary,
  VesselDiagramRegistryStore,
} from "../domain/types";

type SectionRow = typeof vesselSections.$inferSelect;
type PolygonRow = typeof vesselSectionPolygons.$inferSelect;

function mapDiagram(row: typeof vesselDiagrams.$inferSelect): DiagramRecord {
  return {
    id: row.id,
    vesselId: row.vesselId,
    diagramType: row.diagramType,
    title: row.title,
    description: row.description,
    status: row.status,
    activeVersionId: row.activeVersionId,
    currentSectionMapId: row.currentSectionMapId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapVersion(row: typeof vesselDiagramVersions.$inferSelect): DiagramVersionRecord {
  return {
    id: row.id,
    vesselId: row.vesselId,
    diagramId: row.diagramId,
    versionNumber: row.versionNumber,
    status: row.status,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    contentSha256: row.contentSha256,
    objectKey: row.objectKey,
    sanitizedSvg: row.sanitizedSvg,
    validationSummary: normalizeSummary(row.validationSummary),
    uploadedAt: row.uploadedAt,
  };
}

function normalizeSummary(
  summary: { blockers: number; warnings: number; checkedAt?: string } | null | undefined
): ValidationSummary | null {
  if (!summary) {
    return null;
  }
  return {
    blockers: summary.blockers,
    warnings: summary.warnings,
    checkedAt: summary.checkedAt ?? new Date(0).toISOString(),
  };
}

function mapAssignment(
  row: typeof vesselSectionEquipmentAssignments.$inferSelect
): EquipmentAssignmentRecord {
  return {
    id: row.id,
    sectionId: row.sectionId,
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName,
    assetCode: row.assetCode,
    system: row.system,
    sortOrder: row.sortOrder,
  };
}

function mapIssue(row: typeof vesselDiagramValidationResults.$inferSelect): ValidationIssue {
  return {
    severity: row.severity,
    code: row.code,
    message: row.message,
    ...(row.path ? { path: row.path } : {}),
  };
}

export class PostgresVesselDiagramRegistryStore implements VesselDiagramRegistryStore {
  async listDiagrams(ctx: RegistryContext): Promise<DiagramRecord[]> {
    const rows = await db
      .select()
      .from(vesselDiagrams)
      .where(and(eq(vesselDiagrams.orgId, ctx.orgId), eq(vesselDiagrams.vesselId, ctx.vesselId)))
      .orderBy(desc(vesselDiagrams.updatedAt));
    return rows.map(mapDiagram);
  }

  async createDiagram(ctx: RegistryContext, input: CreateDiagramInput): Promise<DiagramRecord> {
    const [row] = await db
      .insert(vesselDiagrams)
      .values({
        orgId: ctx.orgId,
        vesselId: ctx.vesselId,
        diagramType: input.diagramType,
        title: input.title,
        description: input.description,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    if (!row) throw new Error("Failed to create vessel diagram");
    return mapDiagram(row);
  }

  async getDiagram(ctx: RegistryContext, diagramId: string): Promise<DiagramRecord | null> {
    const [row] = await db
      .select()
      .from(vesselDiagrams)
      .where(
        and(
          eq(vesselDiagrams.orgId, ctx.orgId),
          eq(vesselDiagrams.vesselId, ctx.vesselId),
          eq(vesselDiagrams.id, diagramId)
        )
      )
      .limit(1);
    return row ? mapDiagram(row) : null;
  }

  async listVersions(ctx: RegistryContext, diagramId: string): Promise<DiagramVersionRecord[]> {
    const rows = await db
      .select()
      .from(vesselDiagramVersions)
      .where(
        and(
          eq(vesselDiagramVersions.orgId, ctx.orgId),
          eq(vesselDiagramVersions.vesselId, ctx.vesselId),
          eq(vesselDiagramVersions.diagramId, diagramId)
        )
      )
      .orderBy(desc(vesselDiagramVersions.versionNumber));
    return rows.map(mapVersion);
  }

  async getVersion(
    ctx: RegistryContext,
    diagramId: string,
    versionId: string
  ): Promise<DiagramVersionRecord | null> {
    const [row] = await db
      .select()
      .from(vesselDiagramVersions)
      .where(
        and(
          eq(vesselDiagramVersions.orgId, ctx.orgId),
          eq(vesselDiagramVersions.vesselId, ctx.vesselId),
          eq(vesselDiagramVersions.diagramId, diagramId),
          eq(vesselDiagramVersions.id, versionId)
        )
      )
      .limit(1);
    return row ? mapVersion(row) : null;
  }

  async addVersion(
    ctx: RegistryContext,
    diagramId: string,
    input: Omit<DiagramVersionRecord, "id" | "vesselId" | "diagramId" | "versionNumber">
  ): Promise<DiagramVersionRecord> {
    const [latest] = await db
      .select({ versionNumber: vesselDiagramVersions.versionNumber })
      .from(vesselDiagramVersions)
      .where(
        and(
          eq(vesselDiagramVersions.orgId, ctx.orgId),
          eq(vesselDiagramVersions.diagramId, diagramId)
        )
      )
      .orderBy(desc(vesselDiagramVersions.versionNumber))
      .limit(1);

    const [row] = await db
      .insert(vesselDiagramVersions)
      .values({
        orgId: ctx.orgId,
        vesselId: ctx.vesselId,
        diagramId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        status: input.status,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        contentSha256: input.contentSha256,
        objectKey: input.objectKey,
        sanitizedSvg: input.sanitizedSvg,
        validationSummary: input.validationSummary,
        uploadedBy: ctx.userId,
        uploadedAt: input.uploadedAt,
      })
      .returning();
    if (!row) throw new Error("Failed to create vessel diagram version");
    return mapVersion(row);
  }

  async setActiveVersion(
    ctx: RegistryContext,
    diagramId: string,
    versionId: string
  ): Promise<DiagramVersionRecord> {
    const [target] = await db
      .select()
      .from(vesselDiagramVersions)
      .where(
        and(
          eq(vesselDiagramVersions.orgId, ctx.orgId),
          eq(vesselDiagramVersions.vesselId, ctx.vesselId),
          eq(vesselDiagramVersions.diagramId, diagramId),
          eq(vesselDiagramVersions.id, versionId)
        )
      )
      .limit(1);
    if (!target) {
      throw notFound("Diagram version not found");
    }

    await db
      .update(vesselDiagramVersions)
      .set({ status: "superseded" })
      .where(
        and(
          eq(vesselDiagramVersions.orgId, ctx.orgId),
          eq(vesselDiagramVersions.diagramId, diagramId)
        )
      );
    const [active] = await db
      .update(vesselDiagramVersions)
      .set({ status: "active" })
      .where(eq(vesselDiagramVersions.id, versionId))
      .returning();
    await db
      .update(vesselDiagrams)
      .set({
        status: "active",
        activeVersionId: versionId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vesselDiagrams.orgId, ctx.orgId),
          eq(vesselDiagrams.vesselId, ctx.vesselId),
          eq(vesselDiagrams.id, diagramId)
        )
      );
    if (!active) throw new Error("Failed to activate vessel diagram version");
    return mapVersion(active);
  }

  async listSectionMaps(ctx: RegistryContext): Promise<SectionMapRecord[]> {
    const rows = await db
      .select()
      .from(vesselSectionMaps)
      .where(
        and(eq(vesselSectionMaps.orgId, ctx.orgId), eq(vesselSectionMaps.vesselId, ctx.vesselId))
      )
      .orderBy(desc(vesselSectionMaps.updatedAt));
    return Promise.all(rows.map((row) => this.hydrateMap(ctx, row)));
  }

  async createSectionMap(
    ctx: RegistryContext,
    input: CreateSectionMapInput
  ): Promise<SectionMapRecord> {
    const [map] = await db
      .insert(vesselSectionMaps)
      .values({
        orgId: ctx.orgId,
        vesselId: ctx.vesselId,
        diagramId: input.diagramId,
        diagramVersionId: input.diagramVersionId,
        name: input.name,
        coordinateMode: "normalized_percent",
        diagramWidth: input.diagramWidth ?? 895,
        diagramHeight: input.diagramHeight ?? 420,
        diagramKind: input.diagramKind ?? "side_elevation",
        status: "draft",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    if (!map) throw new Error("Failed to create section map");

    for (const [index, section] of (input.sections ?? []).entries()) {
      await this.insertSection(ctx, map.id, section, index);
    }
    return this.hydrateMap(ctx, map);
  }

  async getSectionMap(ctx: RegistryContext, mapId: string): Promise<SectionMapRecord | null> {
    const [row] = await db
      .select()
      .from(vesselSectionMaps)
      .where(
        and(
          eq(vesselSectionMaps.orgId, ctx.orgId),
          eq(vesselSectionMaps.vesselId, ctx.vesselId),
          eq(vesselSectionMaps.id, mapId)
        )
      )
      .limit(1);
    return row ? this.hydrateMap(ctx, row) : null;
  }

  async cloneSectionMap(
    ctx: RegistryContext,
    mapId: string,
    input: { name: string }
  ): Promise<SectionMapRecord> {
    const source = await this.getSectionMap(ctx, mapId);
    if (!source) throw notFound("Section map not found");
    const cloned = await this.createSectionMap(ctx, {
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
        equipment: section.equipment.map((assignment) => ({
          equipmentId: assignment.equipmentId ?? undefined,
          equipmentName: assignment.equipmentName,
          assetCode: assignment.assetCode ?? undefined,
          system: assignment.system ?? undefined,
        })),
      })),
    });
    await db
      .update(vesselSectionMaps)
      .set({ sourceMapId: mapId })
      .where(eq(vesselSectionMaps.id, cloned.id));
    return { ...cloned, sourceMapId: mapId };
  }

  async publishSectionMap(
    ctx: RegistryContext,
    mapId: string,
    validation: { summary: SectionMapRecord["validationSummary"]; issues: ValidationIssue[] }
  ): Promise<SectionMapRecord> {
    await db
      .update(vesselSectionMaps)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(
          eq(vesselSectionMaps.orgId, ctx.orgId),
          eq(vesselSectionMaps.vesselId, ctx.vesselId),
          eq(vesselSectionMaps.status, "published")
        )
      );
    const [row] = await db
      .update(vesselSectionMaps)
      .set({
        status: "published",
        validationSummary: validation.summary,
        publishedAt: new Date(),
        publishedBy: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vesselSectionMaps.orgId, ctx.orgId),
          eq(vesselSectionMaps.vesselId, ctx.vesselId),
          eq(vesselSectionMaps.id, mapId)
        )
      )
      .returning();
    if (!row) throw notFound("Section map not found");
    return this.hydrateMap(ctx, row);
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
    const [section] = await db
      .select({ id: vesselSections.id })
      .from(vesselSections)
      .where(
        and(
          eq(vesselSections.orgId, ctx.orgId),
          eq(vesselSections.vesselId, ctx.vesselId),
          eq(vesselSections.mapId, mapId),
          eq(vesselSections.id, sectionId)
        )
      )
      .limit(1);
    if (!section) throw notFound("Section not found");

    const [row] = await db
      .insert(vesselSectionEquipmentAssignments)
      .values({
        orgId: ctx.orgId,
        vesselId: ctx.vesselId,
        mapId,
        sectionId,
        equipmentId: input.equipmentId,
        equipmentName: input.equipmentName,
        assetCode: input.assetCode,
        system: input.system,
        createdBy: ctx.userId,
      })
      .returning();
    if (!row) throw new Error("Failed to assign equipment");
    return mapAssignment(row);
  }

  async saveValidationResults(
    ctx: RegistryContext,
    refs: { mapId?: string; diagramId?: string; diagramVersionId?: string },
    issues: ValidationIssue[]
  ): Promise<void> {
    if (!issues.length) return;
    await db.insert(vesselDiagramValidationResults).values(
      issues.map((issue) => ({
        orgId: ctx.orgId,
        vesselId: ctx.vesselId,
        diagramId: refs.diagramId,
        diagramVersionId: refs.diagramVersionId,
        mapId: refs.mapId,
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        path: issue.path,
      }))
    );
  }

  async listValidationResults(
    ctx: RegistryContext,
    refs?: { mapId?: string }
  ): Promise<ValidationIssue[]> {
    const where = refs?.mapId
      ? and(
          eq(vesselDiagramValidationResults.orgId, ctx.orgId),
          eq(vesselDiagramValidationResults.vesselId, ctx.vesselId),
          eq(vesselDiagramValidationResults.mapId, refs.mapId)
        )
      : and(
          eq(vesselDiagramValidationResults.orgId, ctx.orgId),
          eq(vesselDiagramValidationResults.vesselId, ctx.vesselId)
        );
    const rows = await db
      .select()
      .from(vesselDiagramValidationResults)
      .where(where)
      .orderBy(desc(vesselDiagramValidationResults.createdAt));
    return rows.map(mapIssue);
  }

  async upsertThumbnail(
    ctx: RegistryContext,
    input: Omit<ThumbnailRecord, "id" | "vesselId">
  ): Promise<ThumbnailRecord> {
    await db
      .update(vesselThumbnailOverrides)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: ctx.userId })
      .where(
        and(
          eq(vesselThumbnailOverrides.orgId, ctx.orgId),
          eq(vesselThumbnailOverrides.vesselId, ctx.vesselId),
          eq(vesselThumbnailOverrides.ownerType, input.ownerType),
          eq(vesselThumbnailOverrides.ownerId, input.ownerId),
          isNull(vesselThumbnailOverrides.deletedAt)
        )
      );
    const [row] = await db
      .insert(vesselThumbnailOverrides)
      .values({
        orgId: ctx.orgId,
        vesselId: ctx.vesselId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        mapId: input.mapId,
        objectKey: input.objectKey,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        contentSha256: input.contentSha256,
        fallbackMode: input.fallbackMode,
        updatedBy: ctx.userId,
      })
      .returning();
    if (!row) throw new Error("Failed to create thumbnail override");
    return {
      id: row.id,
      vesselId: row.vesselId,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      mapId: row.mapId,
      objectKey: row.objectKey,
      originalFileName: row.originalFileName,
      mimeType: row.mimeType,
      fileSizeBytes: row.fileSizeBytes,
      contentSha256: row.contentSha256,
      fallbackMode: row.fallbackMode,
      deletedAt: row.deletedAt,
    };
  }

  async getThumbnail(
    ctx: RegistryContext,
    ownerType: "section" | "equipment",
    ownerId: string
  ): Promise<ThumbnailRecord | null> {
    const [row] = await db
      .select()
      .from(vesselThumbnailOverrides)
      .where(
        and(
          eq(vesselThumbnailOverrides.orgId, ctx.orgId),
          eq(vesselThumbnailOverrides.vesselId, ctx.vesselId),
          eq(vesselThumbnailOverrides.ownerType, ownerType),
          eq(vesselThumbnailOverrides.ownerId, ownerId),
          isNull(vesselThumbnailOverrides.deletedAt)
        )
      )
      .limit(1);
    return row
      ? {
          id: row.id,
          vesselId: row.vesselId,
          ownerType: row.ownerType,
          ownerId: row.ownerId,
          mapId: row.mapId,
          objectKey: row.objectKey,
          originalFileName: row.originalFileName,
          mimeType: row.mimeType,
          fileSizeBytes: row.fileSizeBytes,
          contentSha256: row.contentSha256,
          fallbackMode: row.fallbackMode,
          deletedAt: row.deletedAt,
        }
      : null;
  }

  async deleteThumbnail(
    ctx: RegistryContext,
    ownerType: "section" | "equipment",
    ownerId: string
  ): Promise<void> {
    await db
      .update(vesselThumbnailOverrides)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: ctx.userId })
      .where(
        and(
          eq(vesselThumbnailOverrides.orgId, ctx.orgId),
          eq(vesselThumbnailOverrides.vesselId, ctx.vesselId),
          eq(vesselThumbnailOverrides.ownerType, ownerType),
          eq(vesselThumbnailOverrides.ownerId, ownerId),
          isNull(vesselThumbnailOverrides.deletedAt)
        )
      );
  }

  private async hydrateMap(
    ctx: RegistryContext,
    row: typeof vesselSectionMaps.$inferSelect
  ): Promise<SectionMapRecord> {
    const [sectionRows, polygonRows, assignmentRows] = await Promise.all([
      db
        .select()
        .from(vesselSections)
        .where(and(eq(vesselSections.orgId, ctx.orgId), eq(vesselSections.mapId, row.id)))
        .orderBy(vesselSections.sortOrder, vesselSections.sectionNo),
      db
        .select()
        .from(vesselSectionPolygons)
        .where(
          and(eq(vesselSectionPolygons.orgId, ctx.orgId), eq(vesselSectionPolygons.mapId, row.id))
        ),
      db
        .select()
        .from(vesselSectionEquipmentAssignments)
        .where(
          and(
            eq(vesselSectionEquipmentAssignments.orgId, ctx.orgId),
            eq(vesselSectionEquipmentAssignments.mapId, row.id)
          )
        )
        .orderBy(vesselSectionEquipmentAssignments.sortOrder),
    ]);

    return {
      id: row.id,
      vesselId: row.vesselId,
      diagramId: row.diagramId,
      diagramVersionId: row.diagramVersionId,
      sourceMapId: row.sourceMapId,
      name: row.name,
      coordinateMode: "normalized_percent",
      diagramWidth: row.diagramWidth,
      diagramHeight: row.diagramHeight,
      diagramKind: row.diagramKind,
      status: row.status,
      validationSummary: normalizeSummary(row.validationSummary),
      publishedAt: row.publishedAt,
      sections: sectionRows.map((section) => hydrateSection(section, polygonRows, assignmentRows)),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async insertSection(
    ctx: RegistryContext,
    mapId: string,
    section: CreateSectionInput,
    index: number
  ): Promise<void> {
    const [sectionRow] = await db
      .insert(vesselSections)
      .values({
        orgId: ctx.orgId,
        vesselId: ctx.vesselId,
        mapId,
        sectionKey: section.sectionKey,
        sectionNo: section.sectionNo,
        name: section.name,
        color: section.color,
        thumbnailFallback: section.thumbnailFallback,
        sortOrder: index,
      })
      .returning();
    if (!sectionRow) {
      throw new Error("Failed to create section map section");
    }

    await db.insert(vesselSectionPolygons).values({
      orgId: ctx.orgId,
      vesselId: ctx.vesselId,
      mapId,
      sectionId: sectionRow.id,
      pointsNormalized: section.polygonNormalized,
      labelNormalized: section.labelNormalized,
      isDraft: true,
    });

    if (section.equipment?.length) {
      await db.insert(vesselSectionEquipmentAssignments).values(
        section.equipment.map((equipment, equipmentIndex) => ({
          orgId: ctx.orgId,
          vesselId: ctx.vesselId,
          mapId,
          sectionId: sectionRow.id,
          equipmentId: equipment.equipmentId,
          equipmentName: equipment.equipmentName,
          assetCode: equipment.assetCode,
          system: equipment.system,
          sortOrder: equipmentIndex,
          createdBy: ctx.userId,
        }))
      );
    }
  }
}

function hydrateSection(
  section: SectionRow,
  polygons: PolygonRow[],
  assignments: Array<typeof vesselSectionEquipmentAssignments.$inferSelect>
): SectionRecord {
  const polygon = polygons.find((item) => item.sectionId === section.id);
  return {
    id: section.id,
    sectionKey: section.sectionKey,
    sectionNo: section.sectionNo,
    name: section.name,
    color: section.color,
    thumbnailFallback: section.thumbnailFallback,
    sortOrder: section.sortOrder,
    polygonNormalized: polygon?.pointsNormalized ?? [],
    labelNormalized: polygon?.labelNormalized ?? { x: 0.5, y: 0.5 },
    equipment: assignments.filter((item) => item.sectionId === section.id).map(mapAssignment),
  };
}

function notFound(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 404;
  return error;
}

export const postgresVesselDiagramRegistryStore = new PostgresVesselDiagramRegistryStore();
