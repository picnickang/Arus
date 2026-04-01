import { z } from "zod";
import { registerTool } from "./registry";

registerTool({
  name: "searchKnowledgeBase",
  description: "Search the organization's Knowledge Base for information from uploaded documents such as maintenance manuals, technical specifications, regulatory procedures, equipment guides, and other reference materials. Returns an AI-generated answer with citations referencing the source documents. Use this tool when the user asks about procedures, regulations, technical specs, or any topic that may be covered in uploaded documentation rather than live operational data.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query — a question or topic to look up in the knowledge base documents",
      },
      maxSources: {
        type: "number",
        description: "Maximum number of source documents to retrieve (default 5)",
      },
    },
    required: ["query"],
  },
  inputSchema: z.object({
    query: z.string().min(1),
    maxSources: z.number().int().min(1).max(20).optional(),
  }),
  requiresApproval: false,
  async execute(input, ctx) {
    if (!ctx.knowledgeBase) {
      return { error: "Knowledge Base is not available" };
    }

    const { query, maxSources } = input as { query: string; maxSources?: number };

    const result = await ctx.knowledgeBase.search(ctx.orgId, query, {
      maxSources: maxSources ?? 5,
    });

    if (result.error) {
      return {
        error: result.error,
        documentsFound: 0,
        suggestion: "The Knowledge Base search encountered an error. Please try again or contact an administrator.",
      };
    }

    if (!result.citations.length) {
      return {
        answer: result.answer,
        documentsFound: 0,
        suggestion: "No matching documents found. Try rephrasing your query or check if relevant documents have been uploaded to the Knowledge Base.",
      };
    }

    const formattedCitations = result.citations.map((c, i) => ({
      ref: `[${i + 1}]`,
      document: c.docName,
      relevance: `${(c.relevance * 100).toFixed(0)}%`,
      excerpt: c.text.length > 200 ? c.text.slice(0, 200) + "..." : c.text,
    }));

    return {
      answer: result.answer,
      citations: formattedCitations,
      documentsFound: result.citations.length,
      sourceDocuments: [...new Set(result.citations.map((c) => c.docName))],
      cached: result.cached,
    };
  },
});

registerTool({
  name: "listKnowledgeBaseDocs",
  description: "List all documents available in the organization's Knowledge Base. Shows document names, types, upload dates, and chunk counts. Use this tool when the user asks what documents or reference materials are available, or wants to know what's been uploaded to the knowledge base.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  inputSchema: z.object({}),
  requiresApproval: false,
  async execute(_input, ctx) {
    if (!ctx.knowledgeBase) {
      return { error: "Knowledge Base is not available" };
    }

    const [docs, stats] = await Promise.all([
      ctx.knowledgeBase.listDocuments(ctx.orgId),
      ctx.knowledgeBase.getStats(ctx.orgId),
    ]);

    if (docs.length === 0) {
      return {
        documents: [],
        totalDocuments: 0,
        totalChunks: 0,
        message: "No documents have been uploaded to the Knowledge Base yet.",
      };
    }

    const documentList = docs.map((d) => ({
      name: d.name,
      type: d.fileType || "unknown",
      uploadedAt: d.uploadedAt.toISOString(),
      chunks: d.chunkCount,
      sizeKB: d.sizeBytes ? Math.round(d.sizeBytes / 1024) : null,
      status: d.status,
    }));

    return {
      documents: documentList,
      totalDocuments: stats.totalDocs,
      totalChunks: stats.totalChunks,
    };
  },
});
