import type { Express, Request, Response } from "express";
import { withErrorHandling } from "../lib/route-utils";
import { logger } from "../utils/logger";

export function registerKbAskRoute(
  app: Express,
  deps: {
    generalApiRateLimit: any;
  }
) {
  const { generalApiRateLimit } = deps;

  app.post(
    "/api/kb/ask",
    generalApiRateLimit,
    withErrorHandling("kb ask", async (req: Request, res: Response) => {
      const orgId = (req as any).orgId || (req.headers["x-org-id"] as string);

      const { query, context, equipmentId, vesselId } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "query is required" });
      }

      let kbResults: any[] = [];
      let kbContext = "";
      try {
        const { searchKnowledgeBase } = await import("../vector-search-service");
        const results = await searchKnowledgeBase(query, { limit: 3, threshold: 0.3, orgId });
        kbResults = results || [];
        kbContext = kbResults
          .map((r: any) => r.content || r.text || "")
          .filter(Boolean)
          .join("\n\n");
      } catch (err) {
        logger.warn("KbAsk", "KB search failed, continuing with LLM only", err);
      }

      let answer = "";
      try {
        const { analyzeEquipmentHealth } = await import("../openai");
        if (typeof analyzeEquipmentHealth === "function") {
          const llmResult = await analyzeEquipmentHealth(
            equipmentId || "general",
            query,
            [],
            [context, kbContext].filter(Boolean).join("\n\n")
          );
          answer =
            typeof llmResult === "string"
              ? llmResult
              : llmResult?.analysis || llmResult?.response || llmResult?.text || "";
        }
      } catch (err) {
        logger.warn("KbAsk", "LLM analysis failed, returning KB results only", err);
      }

      if (!answer && kbResults.length > 0) {
        answer = kbContext;
      } else if (!answer) {
        answer =
          "I couldn't find relevant information for your query. Please try rephrasing or check the Knowledge Base for uploaded documentation.";
      }

      const sources = kbResults.map((r: any) => ({
        title: r.title || r.documentTitle || "Document",
        relevance: r.relevance || r.score || 0,
        documentId: r.documentId || r.id,
      }));

      res.json({
        answer,
        sources,
        query,
        context: context || null,
      });
    })
  );

  logger.info("KbAskRoute", "Registered POST /api/kb/ask");
}
