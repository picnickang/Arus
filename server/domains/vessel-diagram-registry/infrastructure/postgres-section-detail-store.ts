import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import { vesselSectionMaps, vesselSectionPolygons, vesselSections } from "@shared/schema-runtime";
import { notFound } from "./postgres-mappers";
import { getPostgresSectionMap } from "./postgres-section-map-store";
import {
  getPostgresSection,
  hydratePostgresMap,
  insertPostgresSection,
  replacePostgresSectionPolygon,
  requirePostgresSection,
  touchPostgresSectionMap,
} from "./postgres-section-helpers";
import type {
  CreateSectionInput,
  NormalizedPoint,
  RegistryContext,
  SectionMapRecord,
  SectionRecord,
  UpdateSectionInput,
  VesselDiagramValidationIssue,
} from "../domain/types";

export async function addPostgresSection(
    ctx: RegistryContext,
    mapId: string,
    input: CreateSectionInput
  ): Promise<SectionRecord> {
    const map = await getPostgresSectionMap(ctx, mapId);
    if (!map) {
      throw notFound("Section map not found");
    }
    const section = await insertPostgresSection(ctx, mapId, input, map.sections.length);
    await touchPostgresSectionMap(ctx, mapId);
    return section;
  }

export async function updatePostgresSection(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: UpdateSectionInput
  ): Promise<SectionRecord> {
    await requirePostgresSection(ctx, mapId, sectionId);
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
      const current = await getPostgresSection(ctx, mapId, sectionId);
      await replacePostgresSectionPolygon(ctx, mapId, sectionId, {
        polygonNormalized: input.polygonNormalized ?? current.polygonNormalized,
        labelNormalized: input.labelNormalized ?? current.labelNormalized,
      });
    }
    await touchPostgresSectionMap(ctx, mapId);
    return getPostgresSection(ctx, mapId, sectionId);
  }

export async function deletePostgresSection(ctx: RegistryContext, mapId: string, sectionId: string): Promise<void> {
    await requirePostgresSection(ctx, mapId, sectionId);
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
    await touchPostgresSectionMap(ctx, mapId);
  }

export async function updatePostgresSectionPolygon(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string,
    input: { polygonNormalized: NormalizedPoint[]; labelNormalized: NormalizedPoint }
  ): Promise<SectionRecord> {
    await requirePostgresSection(ctx, mapId, sectionId);
    await replacePostgresSectionPolygon(ctx, mapId, sectionId, input);
    await touchPostgresSectionMap(ctx, mapId);
    return getPostgresSection(ctx, mapId, sectionId);
  }

export async function deletePostgresSectionPolygon(
    ctx: RegistryContext,
    mapId: string,
    sectionId: string
  ): Promise<SectionRecord> {
    await requirePostgresSection(ctx, mapId, sectionId);
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
    await touchPostgresSectionMap(ctx, mapId);
    return getPostgresSection(ctx, mapId, sectionId);
  }

export async function publishPostgresSectionMap(
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
    return hydratePostgresMap(ctx, row);
  }
