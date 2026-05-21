/**
 * RAG Multi-Document Comparison Service
 * Handles queries that compare information across multiple documents
 */

import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Services:Rag:Comparison:Index");
import { llmGateway } from "../../../composition/llm-gateway";
import { db } from "../../../db";
import { kbDocs, kbChunks } from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";

export interface ComparisonRequest {
  query: string;
  documentIds: string[];
  maxChunksPerDoc?: number;
}

export interface DocumentContent {
  documentId: string;
  documentTitle: string;
  chunks: Array<{
    content: string;
    score: number;
  }>;
}

export interface ComparisonResult {
  answer: string;
  documents: Array<{
    documentId: string;
    documentTitle: string;
    relevantExcerpts: string[];
  }>;
  comparisonPoints: Array<{
    aspect: string;
    documents: Array<{
      documentId: string;
      documentTitle: string;
      value: string;
    }>;
  }>;
  confidence: number;
}

export class ComparisonService {
  private initialized = false;

  async initialize(_apiKey: string): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async compare(request: ComparisonRequest, orgId: string): Promise<ComparisonResult> {
    const { query, documentIds, maxChunksPerDoc = 5 } = request;

    if (documentIds.length < 2) {
      throw new Error("At least 2 documents are required for comparison");
    }

    if (documentIds.length > 5) {
      throw new Error("Maximum 5 documents can be compared at once");
    }

    const documentContents = await this.fetchDocumentContents(documentIds, orgId, maxChunksPerDoc);

    if (documentContents.length < 2) {
      throw new Error("Could not find enough documents for comparison");
    }

    if (!(await llmGateway.isAvailable())) {
      return this.generateFallbackComparison(query, documentContents);
    }

    return this.generateLLMComparison(query, documentContents, orgId);
  }

  private async fetchDocumentContents(
    documentIds: string[],
    orgId: string,
    maxChunksPerDoc: number
  ): Promise<DocumentContent[]> {
    const documents = await db
      .select({
        id: kbDocs.id,
        title: kbDocs.name,
      })
      .from(kbDocs)
      .where(inArray(kbDocs.id, documentIds));

    const documentContents: DocumentContent[] = [];

    for (const doc of documents) {
      const chunks = await db
        .select({
          content: kbChunks.text,
        })
        .from(kbChunks)
        .where(eq(kbChunks.docId, doc.id))
        .limit(maxChunksPerDoc);

      documentContents.push({
        documentId: doc.id,
        documentTitle: doc.title,
        chunks: chunks.map((c, i) => ({
          content: c.content,
          score: 1 - i * 0.1,
        })),
      });
    }

    return documentContents;
  }

  private async generateLLMComparison(
    query: string,
    documents: DocumentContent[],
    orgId?: string
  ): Promise<ComparisonResult> {
    const contextParts: string[] = [];

    for (const doc of documents) {
      const content = doc.chunks.map((c) => c.content).join("\n\n");
      contextParts.push(`=== ${doc.documentTitle} ===\n${content}`);
    }

    const systemPrompt = `You are an expert at comparing and analyzing documents. Given multiple documents, you will:
1. Answer the user's comparison question
2. Identify key differences and similarities
3. Extract specific comparison points

Return your response in JSON format:
{
  "answer": "A comprehensive comparison answer addressing the user's question",
  "comparisonPoints": [
    {
      "aspect": "Name of the aspect being compared (e.g., 'Maintenance Interval')",
      "documents": [
        {"documentTitle": "Doc 1 Title", "value": "Value from Doc 1"},
        {"documentTitle": "Doc 2 Title", "value": "Value from Doc 2"}
      ]
    }
  ]
}

Focus on factual, specific differences. Be concise but thorough.`;

    const response = await llmGateway.chat({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Documents to compare:\n\n${contextParts.join("\n\n---\n\n")}\n\nQuestion: ${query}`,
        },
      ],
      temperature: 0.3,
      maxCompletionTokens: 2000,
      jsonMode: true,
      meta: { caller: "rag-comparison", orgId, documentCount: documents.length },
    });

    const content = response.content || "{}";

    try {
      const parsed = JSON.parse(content);

      return {
        answer: parsed.answer || "Unable to generate comparison",
        documents: documents.map((doc) => ({
          documentId: doc.documentId,
          documentTitle: doc.documentTitle,
          relevantExcerpts: doc.chunks.slice(0, 2).map((c) => `${c.content.substring(0, 200)}...`),
        })),
        comparisonPoints: (parsed.comparisonPoints || []).map((point: any) => ({
          aspect: point.aspect,
          documents: point.documents.map((d: any) => ({
            documentId:
              documents.find((doc) => doc.documentTitle === d.documentTitle)?.documentId || "",
            documentTitle: d.documentTitle,
            value: d.value,
          })),
        })),
        confidence: 0.85,
      };
    } catch (parseError) {
      logger.error("[ComparisonService] Failed to parse LLM response:", undefined, parseError);
      return this.generateFallbackComparison(query, documents);
    }
  }

  private generateFallbackComparison(
    query: string,
    documents: DocumentContent[]
  ): ComparisonResult {
    const docSummaries = documents.map((doc) => {
      const preview = doc.chunks[0]?.content.substring(0, 300) || "No content available";
      return `**${doc.documentTitle}**: ${preview}...`;
    });

    return {
      answer: `Comparison of ${documents.length} documents for: "${query}"\n\n${docSummaries.join("\n\n")}`,
      documents: documents.map((doc) => ({
        documentId: doc.documentId,
        documentTitle: doc.documentTitle,
        relevantExcerpts: doc.chunks.slice(0, 2).map((c) => `${c.content.substring(0, 200)}...`),
      })),
      comparisonPoints: [],
      confidence: 0.4,
    };
  }

  async getAvailableDocuments(orgId: string): Promise<Array<{ id: string; title: string }>> {
    return await db
      .select({
        id: kbDocs.id,
        title: kbDocs.name,
      })
      .from(kbDocs)
      .where(eq(kbDocs.orgId, orgId))
      .orderBy(sql`${kbDocs.createdAt} DESC`)
      .limit(100);
  }
}

export const comparisonService = new ComparisonService();
