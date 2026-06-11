import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import { normalizeSectionMapImageTransform } from "../domain/types";
import {
  vesselSectionEquipmentAssignments,
  vesselSectionMaps,
  vesselSectionPolygons,
  vesselSections,
} from "@shared/schema-runtime";
import { hydrateSection, notFound, normalizeSummary } from "./postgres-mappers";
import type {
  CreateSectionInput,
  NormalizedPoint,
  RegistryContext,
  SectionMapRecord,
  SectionRecord,
} from "../domain/types";

type SectionRow = typeof vesselSections.$inferSelect;

export async function hydratePostgresMap(
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

export async function insertPostgresSection(
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

export async function requirePostgresSection(
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

export async function getPostgresSection(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string
  ): Promise<SectionRecord> {
    const [sectionRow, polygonRows, assignmentRows] = await Promise.all([
      requirePostgresSection(ctx, mapId, sectionId),
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

export async function replacePostgresSectionPolygon(
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

export async function touchPostgresSectionMap(ctx: RegistryContext, mapId: string): Promise<void> {
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
