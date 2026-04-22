import { db } from "../../../db";
import { eq, count } from "drizzle-orm";
import type {
  KnowledgeBasePort,
  KnowledgeBaseCitation,
} from "../domain/ports";

export function createKnowledgeBaseAdapter(): KnowledgeBasePort {
  return {
    async search(orgId, query, options) {
      try {
        const { RagOrchestrator } = await import("../../../services/rag/orchestrator");
        const orchestrator = new RagOrchestrator({
          enableQueryRewrite: true,
          enableCache: true,
          enableConversationContext: false,
          enableFeedbackReranking: false,
        });

        const result = await orchestrator.ask({
          orgId,
          query,
          maxSources: options?.maxSources ?? 5,
          threshold: options?.threshold ?? 0.1,
        });

        const citations: KnowledgeBaseCitation[] = result.citations.map((c) => ({
          docId: c.docId,
          docName: c.docName,
          chunkId: c.chunkId,
          text: c.text,
          relevance: c.relevance,
          ord: c.ord,
        }));

        return {
          answer: result.answer,
          citations,
          sourceChunkIds: result.sourceChunkIds,
          modelUsed: result.modelUsed,
          cached: result.cached,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Knowledge base search failed";
        console.warn("[KBAdapter] search failed:", message);
        return {
          answer: "",
          citations: [],
          sourceChunkIds: [],
          modelUsed: "none",
          cached: false,
          error: `Unable to search the knowledge base: ${message}`,
        };
      }
    },

    async listDocuments(orgId) {
      try {
        const { kbDocs } = await import("@shared/schema/rag");
        const docs = await db
          .select({
            id: kbDocs.id,
            name: kbDocs.name,
            fileType: kbDocs.fileType,
            uploadedAt: kbDocs.createdAt,
            chunkCount: kbDocs.numChunks,
            sizeBytes: kbDocs.sizeBytes,
            status: kbDocs.status,
          })
          .from(kbDocs)
          .where(eq(kbDocs.orgId, orgId))
          .orderBy(kbDocs.createdAt);

        return docs.map((d) => ({
          id: d.id,
          name: d.name,
          fileType: d.fileType,
          uploadedAt: d.uploadedAt,
          chunkCount: d.chunkCount ?? 0,
          sizeBytes: d.sizeBytes,
          status: d.status,
        }));
      } catch (err) {
        console.warn("[KBAdapter] listDocuments failed:", err instanceof Error ? err.message : "unknown");
        return [];
      }
    },

    async getStats(orgId) {
      try {
        const { kbDocs, kbChunks } = await import("@shared/schema/rag");

        const [docCount] = await db
          .select({ total: count() })
          .from(kbDocs)
          .where(eq(kbDocs.orgId, orgId));

        const [chunkCount] = await db
          .select({ total: count() })
          .from(kbChunks)
          .innerJoin(kbDocs, eq(kbChunks.docId, kbDocs.id))
          .where(eq(kbDocs.orgId, orgId));

        return {
          totalDocs: docCount?.total ?? 0,
          totalChunks: chunkCount?.total ?? 0,
        };
      } catch (err) {
        console.warn("[KBAdapter] getStats failed:", err instanceof Error ? err.message : "unknown");
        return { totalDocs: 0, totalChunks: 0 };
      }
    },

    async ingestDocument(orgId, fileName, fileBuffer, fileType, uploadedBy) {
      const { ingestDocument } = await import("../../../services/document-ingestion");
      type SupportedFileType = "pdf" | "png" | "jpg" | "jpeg" | "docx" | "xlsx" | "txt" | "md";
      const supportedTypes: SupportedFileType[] = ["pdf", "png", "jpg", "jpeg", "docx", "xlsx", "txt", "md"];
      const normalizedType = fileType.toLowerCase().replace(/^\./, "");

      function isSupportedFileType(t: string): t is SupportedFileType {
        return (supportedTypes as string[]).includes(t);
      }

      if (!isSupportedFileType(normalizedType)) {
        throw new Error(`Unsupported file type for KB ingestion: ${fileType}`);
      }

      const result = await ingestDocument({
        orgId,
        fileName,
        fileBuffer,
        fileType: normalizedType,
        uploadedBy,
      }, { skipValidation: false });

      return {
        docId: result.docId,
        chunkCount: result.chunksCreated,
      };
    },
  };
}

export const knowledgeBaseAdapter = createKnowledgeBaseAdapter();
