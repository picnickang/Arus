import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../db";
import { normalizeSectionMapImageTransform } from "../domain/types";
import { vesselSectionMaps } from "@shared/schema-runtime";
import { notFound } from "./postgres-mappers";
import { updatePostgresDiagram } from "./postgres-diagram-store";
import { hydratePostgresMap, insertPostgresSection } from "./postgres-section-helpers";
import type {
  CreateSectionMapInput,
  RegistryContext,
  SectionMapRecord,
  UpdateSectionMapInput,
} from "../domain/types";

export async function listPostgresSectionMaps(ctx: RegistryContext): Promise<SectionMapRecord[]> {
  const rows = await db
    .select()
    .from(vesselSectionMaps)
    .where(
      and(eq(vesselSectionMaps.orgId, ctx.orgId), eq(vesselSectionMaps.vesselId, ctx.vesselId))
    )
    .orderBy(desc(vesselSectionMaps.updatedAt));
  return Promise.all(rows.map((row) => hydratePostgresMap(ctx, row)));
}

export async function createPostgresSectionMap(
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
    await insertPostgresSection(ctx, map.id, section, index);
  }
  if (input.diagramId) {
    await updatePostgresDiagram(ctx, input.diagramId, { currentSectionMapId: map.id });
  }
  return hydratePostgresMap(ctx, map);
}

export async function getPostgresSectionMap(
  ctx: RegistryContext,
  mapId: string
): Promise<SectionMapRecord | null> {
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
  return row ? hydratePostgresMap(ctx, row) : null;
}

export async function getPostgresSectionMapForVessel(
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
  return row ? hydratePostgresMap({ ...ctx, vesselId }, row) : null;
}

export async function updatePostgresSectionMap(
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
  return hydratePostgresMap(ctx, row);
}

export async function deletePostgresSectionMap(ctx: RegistryContext, mapId: string): Promise<void> {
  await updatePostgresSectionMap(ctx, mapId, { status: "archived" });
}

export async function clonePostgresSectionMap(
  ctx: RegistryContext,
  mapId: string,
  input: { name: string; diagramId?: string; diagramVersionId?: string }
): Promise<SectionMapRecord> {
  const source = await getPostgresSectionMap(ctx, mapId);
  if (!source) {
    throw notFound("Section map not found");
  }
  return createPostgresSectionMap(ctx, {
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
