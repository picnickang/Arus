import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "../../../db";
import { normalizeSectionMapImageTransform } from "../domain/types";
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
  ValidationSummary,
  VesselDiagramVersionStatus,
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
    uploadedBy: row.uploadedBy,
    publishedBy: row.publishedBy ?? null,
    publishedAt: row.publishedAt ?? null,
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

function mapIssue(
  row: typeof vesselDiagramValidationResults.$inferSelect
): VesselDiagramValidationIssue {
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
    if (!row) {
      throw new Error("Failed to create vessel diagram");
    }
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

  async updateDiagram(
    ctx: RegistryContext,
    diagramId: string,
    input: UpdateDiagramInput
  ): Promise<DiagramRecord> {
    const updates: Partial<typeof vesselDiagrams.$inferInsert> = {
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };
    if (input.title !== undefined) {
      updates.title = input.title;
    }
    if (input.description !== undefined) {
      updates.description = input.description;
    }
    if (input.status !== undefined) {
      updates.status = input.status;
    }
    if (input.activeVersionId !== undefined) {
      updates.activeVersionId = input.activeVersionId;
    }
    if (input.currentSectionMapId !== undefined) {
      updates.currentSectionMapId = input.currentSectionMapId;
    }

    const [row] = await db
      .update(vesselDiagrams)
      .set(updates)
      .where(
        and(
          eq(vesselDiagrams.orgId, ctx.orgId),
          eq(vesselDiagrams.vesselId, ctx.vesselId),
          eq(vesselDiagrams.id, diagramId)
        )
      )
      .returning();
    if (!row) {
      throw notFound("Diagram not found");
    }
    return mapDiagram(row);
  }

  async deleteDiagram(ctx: RegistryContext, diagramId: string): Promise<void> {
    await this.updateDiagram(ctx, diagramId, { status: "archived" });
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
    return db.transaction(async (tx) => {
      const [diagram] = await tx
        .select({ id: vesselDiagrams.id })
        .from(vesselDiagrams)
        .where(
          and(
            eq(vesselDiagrams.orgId, ctx.orgId),
            eq(vesselDiagrams.vesselId, ctx.vesselId),
            eq(vesselDiagrams.id, diagramId)
          )
        )
        .limit(1)
        .for("update");
      if (!diagram) {
        throw notFound("Diagram not found");
      }

      const [latest] = await tx
        .select({ versionNumber: vesselDiagramVersions.versionNumber })
        .from(vesselDiagramVersions)
        .where(
          and(
            eq(vesselDiagramVersions.orgId, ctx.orgId),
            eq(vesselDiagramVersions.vesselId, ctx.vesselId),
            eq(vesselDiagramVersions.diagramId, diagramId)
          )
        )
        .orderBy(desc(vesselDiagramVersions.versionNumber))
        .limit(1);

      const [row] = await tx
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
          uploadedBy: input.uploadedBy ?? ctx.userId ?? null,
          publishedBy: input.publishedBy ?? null,
          publishedAt: input.publishedAt ?? null,
          uploadedAt: input.uploadedAt,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create vessel diagram version");
      }
      return mapVersion(row);
    });
  }

  async setActiveVersion(
    ctx: RegistryContext,
    diagramId: string,
    versionId: string
  ): Promise<DiagramVersionRecord> {
    return db.transaction(async (tx) => {
      const [diagram] = await tx
        .select({ id: vesselDiagrams.id })
        .from(vesselDiagrams)
        .where(
          and(
            eq(vesselDiagrams.orgId, ctx.orgId),
            eq(vesselDiagrams.vesselId, ctx.vesselId),
            eq(vesselDiagrams.id, diagramId)
          )
        )
        .limit(1)
        .for("update");
      if (!diagram) {
        throw notFound("Diagram not found");
      }

      const [target] = await tx
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
        .limit(1)
        .for("update");
      if (!target) {
        throw notFound("Diagram version not found");
      }

      const publishedAt = new Date();
      await tx
        .update(vesselDiagramVersions)
        .set({ status: "superseded" })
        .where(
          and(
            eq(vesselDiagramVersions.orgId, ctx.orgId),
            eq(vesselDiagramVersions.vesselId, ctx.vesselId),
            eq(vesselDiagramVersions.diagramId, diagramId),
            ne(vesselDiagramVersions.id, versionId)
          )
        );
      const [active] = await tx
        .update(vesselDiagramVersions)
        .set({
          status: "active",
          publishedBy: ctx.userId ?? null,
          publishedAt,
        })
        .where(
          and(
            eq(vesselDiagramVersions.orgId, ctx.orgId),
            eq(vesselDiagramVersions.vesselId, ctx.vesselId),
            eq(vesselDiagramVersions.diagramId, diagramId),
            eq(vesselDiagramVersions.id, versionId)
          )
        )
        .returning();
      await tx
        .update(vesselDiagrams)
        .set({
          status: "active",
          activeVersionId: versionId,
          updatedBy: ctx.userId,
          updatedAt: publishedAt,
        })
        .where(
          and(
            eq(vesselDiagrams.orgId, ctx.orgId),
            eq(vesselDiagrams.vesselId, ctx.vesselId),
            eq(vesselDiagrams.id, diagramId)
          )
        );
      if (!active) {
        throw new Error("Failed to activate vessel diagram version");
      }
      return mapVersion(active);
    });
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
    const [row] = await db
      .update(vesselDiagramVersions)
      .set({ status })
      .where(
        and(
          eq(vesselDiagramVersions.orgId, ctx.orgId),
          eq(vesselDiagramVersions.vesselId, ctx.vesselId),
          eq(vesselDiagramVersions.diagramId, diagramId),
          eq(vesselDiagramVersions.id, versionId)
        )
      )
      .returning();
    if (!row) {
      throw notFound("Diagram version not found");
    }

    if (status === "archived") {
      const diagram = await this.getDiagram(ctx, diagramId);
      if (diagram?.activeVersionId === versionId) {
        await this.updateDiagram(ctx, diagramId, { activeVersionId: null, status: "draft" });
      }
    }
    return mapVersion(row);
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
        sourceMapId: input.sourceMapId,
        name: input.name,
        coordinateMode: "normalized_percent",
        diagramWidth: input.diagramWidth ?? 895,
        diagramHeight: input.diagramHeight ?? 420,
        diagramKind: input.diagramKind ?? "side_elevation",
        imageTransform: normalizeSectionMapImageTransform(input.imageTransform),
        status: "draft",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    if (!map) {
      throw new Error("Failed to create section map");
    }

    for (const [index, section] of (input.sections ?? []).entries()) {
      await this.insertSection(ctx, map.id, section, index);
    }
    if (input.diagramId) {
      await this.updateDiagram(ctx, input.diagramId, { currentSectionMapId: map.id });
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

  async getSectionMapForVessel(
    ctx: RegistryContext,
    vesselId: string,
    mapId: string
  ): Promise<SectionMapRecord | null> {
    const [row] = await db
      .select()
      .from(vesselSectionMaps)
      .where(
        and(
          eq(vesselSectionMaps.orgId, ctx.orgId),
          eq(vesselSectionMaps.vesselId, vesselId),
          eq(vesselSectionMaps.id, mapId)
        )
      )
      .limit(1);
    return row ? this.hydrateMap({ ...ctx, vesselId }, row) : null;
  }

  async updateSectionMap(
    ctx: RegistryContext,
    mapId: string,
    input: UpdateSectionMapInput
  ): Promise<SectionMapRecord> {
    const updates: Partial<typeof vesselSectionMaps.$inferInsert> = {
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    };
    if (input.name !== undefined) {
      updates.name = input.name;
    }
    if (input.diagramId !== undefined) {
      updates.diagramId = input.diagramId;
    }
    if (input.diagramVersionId !== undefined) {
      updates.diagramVersionId = input.diagramVersionId;
    }
    if (input.sourceMapId !== undefined) {
      updates.sourceMapId = input.sourceMapId;
    }
    if (input.diagramWidth !== undefined) {
      updates.diagramWidth = input.diagramWidth;
    }
    if (input.diagramHeight !== undefined) {
      updates.diagramHeight = input.diagramHeight;
    }
    if (input.diagramKind !== undefined) {
      updates.diagramKind = input.diagramKind;
    }
    if (input.imageTransform !== undefined) {
      updates.imageTransform = normalizeSectionMapImageTransform(input.imageTransform);
    }
    if (input.status !== undefined) {
      updates.status = input.status;
    }

    const [row] = await db
      .update(vesselSectionMaps)
      .set(updates)
      .where(
        and(
          eq(vesselSectionMaps.orgId, ctx.orgId),
          eq(vesselSectionMaps.vesselId, ctx.vesselId),
          eq(vesselSectionMaps.id, mapId)
        )
      )
      .returning();
    if (!row) {
      throw notFound("Section map not found");
    }
    return this.hydrateMap(ctx, row);
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
      imageTransform: source.imageTransform,
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
    const section = await this.insertSection(ctx, mapId, input, map.sections.length);
    await this.touchSectionMap(ctx, mapId);
    return section;
  }

  async updateSection(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: UpdateSectionInput
  ): Promise<SectionRecord> {
    await this.requireSection(ctx, mapId, sectionId);
    const sectionUpdates: Partial<typeof vesselSections.$inferInsert> = { updatedAt: new Date() };
    if (input.sectionKey !== undefined) {
      sectionUpdates.sectionKey = input.sectionKey;
    }
    if (input.sectionNo !== undefined) {
      sectionUpdates.sectionNo = input.sectionNo;
    }
    if (input.name !== undefined) {
      sectionUpdates.name = input.name;
    }
    if (input.color !== undefined) {
      sectionUpdates.color = input.color;
    }
    if (input.thumbnailFallback !== undefined) {
      sectionUpdates.thumbnailFallback = input.thumbnailFallback;
    }
    if (Object.keys(sectionUpdates).length > 1) {
      await db
        .update(vesselSections)
        .set(sectionUpdates)
        .where(
          and(
            eq(vesselSections.orgId, ctx.orgId),
            eq(vesselSections.vesselId, ctx.vesselId),
            eq(vesselSections.mapId, mapId),
            eq(vesselSections.id, sectionId)
          )
        );
    }
    if (input.polygonNormalized !== undefined || input.labelNormalized !== undefined) {
      const current = await this.getSection(ctx, mapId, sectionId);
      await this.replaceSectionPolygon(ctx, mapId, sectionId, {
        polygonNormalized: input.polygonNormalized ?? current.polygonNormalized,
        labelNormalized: input.labelNormalized ?? current.labelNormalized,
      });
    }
    await this.touchSectionMap(ctx, mapId);
    return this.getSection(ctx, mapId, sectionId);
  }

  async deleteSection(ctx: RegistryContext, mapId: string, sectionId: string): Promise<void> {
    await this.requireSection(ctx, mapId, sectionId);
    await db
      .delete(vesselSections)
      .where(
        and(
          eq(vesselSections.orgId, ctx.orgId),
          eq(vesselSections.vesselId, ctx.vesselId),
          eq(vesselSections.mapId, mapId),
          eq(vesselSections.id, sectionId)
        )
      );
    await this.touchSectionMap(ctx, mapId);
  }

  async updateSectionPolygon(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: { polygonNormalized: NormalizedPoint[]; labelNormalized: NormalizedPoint }
  ): Promise<SectionRecord> {
    await this.requireSection(ctx, mapId, sectionId);
    await this.replaceSectionPolygon(ctx, mapId, sectionId, input);
    await this.touchSectionMap(ctx, mapId);
    return this.getSection(ctx, mapId, sectionId);
  }

  async deleteSectionPolygon(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string
  ): Promise<SectionRecord> {
    await this.requireSection(ctx, mapId, sectionId);
    await db
      .delete(vesselSectionPolygons)
      .where(
        and(
          eq(vesselSectionPolygons.orgId, ctx.orgId),
          eq(vesselSectionPolygons.vesselId, ctx.vesselId),
          eq(vesselSectionPolygons.mapId, mapId),
          eq(vesselSectionPolygons.sectionId, sectionId)
        )
      );
    await this.touchSectionMap(ctx, mapId);
    return this.getSection(ctx, mapId, sectionId);
  }

  async publishSectionMap(
    ctx: RegistryContext,
    mapId: string,
    validation: {
      summary: SectionMapRecord["validationSummary"];
      issues: VesselDiagramValidationIssue[];
    }
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
    if (!row) {
      throw notFound("Section map not found");
    }
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
    if (!section) {
      throw notFound("Section not found");
    }

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
    if (!row) {
      throw new Error("Failed to assign equipment");
    }
    return mapAssignment(row);
  }

  async listEquipmentAssignments(
    ctx: RegistryContext,
    mapId: string
  ): Promise<EquipmentAssignmentRecord[]> {
    const rows = await db
      .select()
      .from(vesselSectionEquipmentAssignments)
      .where(
        and(
          eq(vesselSectionEquipmentAssignments.orgId, ctx.orgId),
          eq(vesselSectionEquipmentAssignments.vesselId, ctx.vesselId),
          eq(vesselSectionEquipmentAssignments.mapId, mapId)
        )
      )
      .orderBy(vesselSectionEquipmentAssignments.sortOrder);
    return rows.map(mapAssignment);
  }

  async updateEquipmentAssignment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    assignmentId: string,
    input: UpdateAssignmentInput
  ): Promise<EquipmentAssignmentRecord> {
    const updates: Partial<typeof vesselSectionEquipmentAssignments.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.equipmentId !== undefined) {
      updates.equipmentId = input.equipmentId;
    }
    if (input.equipmentName !== undefined) {
      updates.equipmentName = input.equipmentName;
    }
    if (input.assetCode !== undefined) {
      updates.assetCode = input.assetCode;
    }
    if (input.system !== undefined) {
      updates.system = input.system;
    }
    const [row] = await db
      .update(vesselSectionEquipmentAssignments)
      .set(updates)
      .where(
        and(
          eq(vesselSectionEquipmentAssignments.orgId, ctx.orgId),
          eq(vesselSectionEquipmentAssignments.vesselId, ctx.vesselId),
          eq(vesselSectionEquipmentAssignments.mapId, mapId),
          eq(vesselSectionEquipmentAssignments.sectionId, sectionId),
          eq(vesselSectionEquipmentAssignments.id, assignmentId)
        )
      )
      .returning();
    if (!row) {
      throw notFound("Equipment assignment not found");
    }
    return mapAssignment(row);
  }

  async deleteEquipmentAssignment(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    assignmentId: string
  ): Promise<void> {
    await db
      .delete(vesselSectionEquipmentAssignments)
      .where(
        and(
          eq(vesselSectionEquipmentAssignments.orgId, ctx.orgId),
          eq(vesselSectionEquipmentAssignments.vesselId, ctx.vesselId),
          eq(vesselSectionEquipmentAssignments.mapId, mapId),
          eq(vesselSectionEquipmentAssignments.sectionId, sectionId),
          eq(vesselSectionEquipmentAssignments.id, assignmentId)
        )
      );
  }

  async saveValidationResults(
    ctx: RegistryContext,
    refs: { mapId?: string; diagramId?: string; diagramVersionId?: string },
    issues: VesselDiagramValidationIssue[]
  ): Promise<void> {
    if (!issues.length) {
      return;
    }
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
  ): Promise<VesselDiagramValidationIssue[]> {
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
    if (!row) {
      throw new Error("Failed to create thumbnail override");
    }
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
      imageTransform: normalizeSectionMapImageTransform(row.imageTransform),
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
  ): Promise<SectionRecord> {
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

    const [polygonRow] = await db
      .insert(vesselSectionPolygons)
      .values({
        orgId: ctx.orgId,
        vesselId: ctx.vesselId,
        mapId,
        sectionId: sectionRow.id,
        pointsNormalized: section.polygonNormalized,
        labelNormalized: section.labelNormalized,
        isDraft: true,
      })
      .returning();

    let assignmentRows: Array<typeof vesselSectionEquipmentAssignments.$inferSelect> = [];
    if (section.equipment?.length) {
      assignmentRows = await db
        .insert(vesselSectionEquipmentAssignments)
        .values(
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
        )
        .returning();
    }
    return hydrateSection(sectionRow, polygonRow ? [polygonRow] : [], assignmentRows);
  }

  private async requireSection(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string
  ): Promise<SectionRow> {
    const [section] = await db
      .select()
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
    if (!section) {
      throw notFound("Section not found");
    }
    return section;
  }

  private async getSection(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string
  ): Promise<SectionRecord> {
    const [sectionRow, polygonRows, assignmentRows] = await Promise.all([
      this.requireSection(ctx, mapId, sectionId),
      db
        .select()
        .from(vesselSectionPolygons)
        .where(
          and(
            eq(vesselSectionPolygons.orgId, ctx.orgId),
            eq(vesselSectionPolygons.vesselId, ctx.vesselId),
            eq(vesselSectionPolygons.mapId, mapId),
            eq(vesselSectionPolygons.sectionId, sectionId)
          )
        ),
      db
        .select()
        .from(vesselSectionEquipmentAssignments)
        .where(
          and(
            eq(vesselSectionEquipmentAssignments.orgId, ctx.orgId),
            eq(vesselSectionEquipmentAssignments.vesselId, ctx.vesselId),
            eq(vesselSectionEquipmentAssignments.mapId, mapId),
            eq(vesselSectionEquipmentAssignments.sectionId, sectionId)
          )
        )
        .orderBy(vesselSectionEquipmentAssignments.sortOrder),
    ]);
    return hydrateSection(sectionRow, polygonRows, assignmentRows);
  }

  private async replaceSectionPolygon(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: { polygonNormalized: NormalizedPoint[]; labelNormalized: NormalizedPoint }
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(vesselSectionPolygons)
        .where(
          and(
            eq(vesselSectionPolygons.orgId, ctx.orgId),
            eq(vesselSectionPolygons.vesselId, ctx.vesselId),
            eq(vesselSectionPolygons.mapId, mapId),
            eq(vesselSectionPolygons.sectionId, sectionId)
          )
        );
      await tx.insert(vesselSectionPolygons).values({
        orgId: ctx.orgId,
        vesselId: ctx.vesselId,
        mapId,
        sectionId,
        pointsNormalized: input.polygonNormalized,
        labelNormalized: input.labelNormalized,
        isDraft: true,
      });
    });
  }

  private async touchSectionMap(ctx: RegistryContext, mapId: string): Promise<void> {
    await db
      .update(vesselSectionMaps)
      .set({ updatedAt: new Date(), updatedBy: ctx.userId })
      .where(
        and(
          eq(vesselSectionMaps.orgId, ctx.orgId),
          eq(vesselSectionMaps.vesselId, ctx.vesselId),
          eq(vesselSectionMaps.id, mapId)
        )
      );
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
