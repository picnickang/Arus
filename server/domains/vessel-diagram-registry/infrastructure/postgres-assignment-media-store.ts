import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../../db";
import {
  vesselDiagramValidationResults,
  vesselSectionEquipmentAssignments,
  vesselSections,
  vesselThumbnailOverrides,
} from "@shared/schema-runtime";
import { mapAssignment, mapIssue, notFound } from "./postgres-mappers";
import type {
  EquipmentAssignmentRecord,
  RegistryContext,
  ThumbnailRecord,
  UpdateAssignmentInput,
  VesselDiagramValidationIssue,
} from "../domain/types";

export async function assignPostgresEquipment(
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

export async function listPostgresEquipmentAssignments(
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

export async function updatePostgresEquipmentAssignment(
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

export async function deletePostgresEquipmentAssignment(
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

export async function savePostgresValidationResults(
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

export async function listPostgresValidationResults(
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

export async function upsertPostgresThumbnail(
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

export async function getPostgresThumbnail(
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

export async function deletePostgresThumbnail(
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
