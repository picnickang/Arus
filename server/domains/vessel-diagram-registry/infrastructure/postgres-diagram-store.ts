import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "../../../db";
import { vesselDiagrams, vesselDiagramVersions } from "@shared/schema-runtime";
import { mapDiagram, mapVersion, notFound } from "./postgres-mappers";
import type {
  CreateDiagramInput,
  DiagramRecord,
  DiagramVersionRecord,
  RegistryContext,
  UpdateDiagramInput,
  VesselDiagramVersionStatus,
} from "../domain/types";

export async function listPostgresDiagrams(ctx: RegistryContext): Promise<DiagramRecord[]> {
    const rows = await db
      .select()
      .from(vesselDiagrams)
      .where(and(eq(vesselDiagrams.orgId, ctx.orgId), eq(vesselDiagrams.vesselId, ctx.vesselId)))
      .orderBy(desc(vesselDiagrams.updatedAt));
    return rows.map(mapDiagram);
  }

export async function createPostgresDiagram(ctx: RegistryContext, input: CreateDiagramInput): Promise<DiagramRecord> {
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

export async function getPostgresDiagram(ctx: RegistryContext, diagramId: string): Promise<DiagramRecord | null> {
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

export async function updatePostgresDiagram(
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

export async function deletePostgresDiagram(ctx: RegistryContext, diagramId: string): Promise<void> {
    await updatePostgresDiagram(ctx, diagramId, { status: "archived" });
  }

export async function listPostgresVersions(ctx: RegistryContext, diagramId: string): Promise<DiagramVersionRecord[]> {
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

export async function getPostgresVersion(
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

export async function addPostgresVersion(
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

export async function setPostgresActiveVersion(
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

export async function updatePostgresVersionStatus(
    ctx: RegistryContext,
    diagramId: string,
    versionId: string,
    status: VesselDiagramVersionStatus
  ): Promise<DiagramVersionRecord> {
    if (status === "active") {
      return setPostgresActiveVersion(ctx, diagramId, versionId);
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
      const diagram = await getPostgresDiagram(ctx, diagramId);
      if (diagram?.activeVersionId === versionId) {
        await updatePostgresDiagram(ctx, diagramId, { activeVersionId: null, status: "draft" });
      }
    }
    return mapVersion(row);
  }
