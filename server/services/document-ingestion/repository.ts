import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:DocumentIngestion:Repository");
import { db } from "../../db";
import {
  kbDocs,
  kbChunks,
  kbDocVersions,
  type InsertKbChunk,
  type KbDoc,
  type KbDocVersion,
} from "@shared/schema";
import { eq, and, or, sql } from "drizzle-orm";
import type { DocumentMetadata } from "./types";
import type { ChunkWithEmbedding } from "./embedder";

export async function createDocument(params: {
  orgId: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  numChunks: number;
  metadata: DocumentMetadata;
  uploadedBy?: string;
  equipmentId?: string;
}): Promise<KbDoc> {
  const [doc] = await db
    .insert(kbDocs)
    .values({
      orgId: params.orgId,
      equipmentId: params.equipmentId || null,
      name: params.fileName,
      source: params.fileName,
      fileType: params.fileType,
      sizeBytes: params.sizeBytes,
      numChunks: params.numChunks,
      metadata: params.metadata,
      uploadedBy: params.uploadedBy,
      status: "completed",
    })
    .returning();

  return doc;
}

export async function updateDocumentForProcessing(params: {
  documentId: string;
  orgId: string;
  fileType: string;
  sizeBytes: number;
  numChunks: number;
  metadata: DocumentMetadata;
}): Promise<KbDoc> {
  const [updated] = await db
    .update(kbDocs)
    .set({
      fileType: params.fileType,
      sizeBytes: params.sizeBytes,
      numChunks: params.numChunks,
      metadata: params.metadata,
      status: "processing",
    })
    .where(and(eq(kbDocs.id, params.documentId), eq(kbDocs.orgId, params.orgId)))
    .returning();

  if (!updated) {
    throw new Error(
      `Document ${params.documentId} not found or access denied for org ${params.orgId}`
    );
  }

  return updated;
}

export async function markDocumentCompleted(
  docId: string,
  orgId: string,
  metadata: DocumentMetadata
): Promise<void> {
  await db
    .update(kbDocs)
    .set({ status: "completed", metadata })
    .where(and(eq(kbDocs.id, docId), eq(kbDocs.orgId, orgId)));
}

export async function updateDocumentMetadata(
  docId: string,
  metadata: DocumentMetadata
): Promise<void> {
  await db.update(kbDocs).set({ metadata }).where(eq(kbDocs.id, docId));
}

export async function insertChunks(docId: string, chunks: ChunkWithEmbedding[]): Promise<void> {
  const records: Array<Omit<InsertKbChunk, "id" | "createdAt">> = chunks.map((chunk) => ({
    docId,
    text: chunk.text,
    embedding: chunk.embedding as object as InsertKbChunk["embedding"],
    ord: chunk.ord,
  }));

  await db.insert(kbChunks).values(records);
}

export async function deleteDocument(docId: string, orgId: string): Promise<void> {
  const doc = await db.query.kbDocs.findFirst({
    where: (docs, { and, eq }) => and(eq(docs.id, docId), eq(docs.orgId, orgId)),
  });

  if (!doc) {
    throw new Error("Document not found or access denied");
  }

  await db.delete(kbDocs).where(eq(kbDocs.id, docId));
  logger.info(`[DocIngestion:Repo] Deleted document: ${docId}`);
}

export async function getDocument(docId: string, orgId: string): Promise<KbDoc | null> {
  const doc = await db.query.kbDocs.findFirst({
    where: (docs, { and, eq }) => and(eq(docs.id, docId), eq(docs.orgId, orgId)),
  });
  return doc || null;
}

export async function listDocuments(orgId: string): Promise<KbDoc[]> {
  return db.query.kbDocs.findMany({
    where: (docs, { eq }) => eq(docs.orgId, orgId),
    orderBy: (docs, { desc }) => [desc(docs.createdAt)],
  });
}

export async function listDocumentsWithAccess(
  orgId: string,
  userId: string | null,
  userRoles: string[]
): Promise<KbDoc[]> {
  const rolesArray = userRoles.length > 0 ? `{${userRoles.join(",")}}` : "{}";
  return await db
    .select()
    .from(kbDocs)
    .where(
      and(
        eq(kbDocs.orgId, orgId),
        or(
          eq(kbDocs.visibility, "org"),
          userId
            ? and(eq(kbDocs.visibility, "private"), eq(kbDocs.uploadedBy, userId))
            : sql`false`,
          sql`${kbDocs.visibility} = 'role-based' AND ${kbDocs.allowedRoles} && ${rolesArray}::text[]`
        )
      )
    )
    .orderBy(sql`${kbDocs.createdAt} DESC`);
}

export async function canAccessDocument(
  docId: string,
  orgId: string,
  userId: string,
  userRoles: string[]
): Promise<boolean> {
  const doc = await getDocument(docId, orgId);
  if (!doc) {
    return false;
  }

  if (doc.visibility === "org") {
    return true;
  }
  if (doc.visibility === "private" && doc.uploadedBy === userId) {
    return true;
  }
  if (doc.visibility === "role-based" && doc.allowedRoles) {
    return doc.allowedRoles.some((role) => userRoles.includes(role));
  }
  return false;
}

export async function updateDocumentVersion(
  docId: string,
  orgId: string,
  userId: string,
  changeType: "updated" | "replaced",
  changeNotes?: string
): Promise<{ doc: KbDoc; version: KbDocVersion }> {
  const existingDoc = await getDocument(docId, orgId);
  if (!existingDoc) {
    throw new Error("Document not found");
  }

  const newVersion = (existingDoc.version || 1) + 1;

  const [versionRecord] = await db
    .insert(kbDocVersions)
    .values({
      docId,
      version: newVersion,
      changeType,
      changedBy: userId,
      previousMetadata: existingDoc.metadata,
      changeNotes,
      sizeBytes: existingDoc.sizeBytes,
      numChunks: existingDoc.numChunks,
    })
    .returning();

  const [updatedDoc] = await db
    .update(kbDocs)
    .set({
      version: newVersion,
      updatedAt: new Date(),
    })
    .where(and(eq(kbDocs.id, docId), eq(kbDocs.orgId, orgId)))
    .returning();

  return { doc: updatedDoc, version: versionRecord };
}

export async function getDocumentVersionHistory(
  docId: string,
  orgId: string
): Promise<KbDocVersion[]> {
  const doc = await getDocument(docId, orgId);
  if (!doc) {
    throw new Error("Document not found");
  }

  return db.query.kbDocVersions.findMany({
    where: (versions, { eq }) => eq(versions.docId, docId),
    orderBy: (versions, { desc }) => [desc(versions.version)],
  });
}

export async function updateDocumentVisibility(
  docId: string,
  orgId: string,
  visibility: "org" | "private" | "role-based",
  allowedRoles?: string[]
): Promise<KbDoc> {
  const [updated] = await db
    .update(kbDocs)
    .set({
      visibility,
      allowedRoles: visibility === "role-based" ? allowedRoles : null,
      updatedAt: new Date(),
    })
    .where(and(eq(kbDocs.id, docId), eq(kbDocs.orgId, orgId)))
    .returning();

  if (!updated) {
    throw new Error("Document not found or access denied");
  }
  return updated;
}

export async function recordDocumentCreation(
  docId: string,
  userId: string | null,
  sizeBytes: number,
  numChunks: number
): Promise<void> {
  await db.insert(kbDocVersions).values({
    docId,
    version: 1,
    changeType: "created",
    changedBy: userId,
    sizeBytes,
    numChunks,
  });
}
