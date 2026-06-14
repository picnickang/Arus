import type { Express } from "express";
import { z } from "zod";
import { withErrorHandling } from "../lib/route-utils";
import { getConversationService } from "../services/rag";
import { suggestionEngine } from "../services/rag/suggestions";
import { exportService } from "../services/rag/export";
import { analyticsAggregator } from "../services/rag/analytics";
import { confidenceDetector } from "../services/rag/confidence";
import { comparisonService } from "../services/rag/comparison";
import { getOpenAIApiKey } from "../openai/client";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import {
  getConversationIdentity,
  toExportDate,
  type RagRouteRateLimiters,
} from "./rag-route-utils";

const comparisonSchema = z.object({
  query: z.string().min(1).max(2000),
  documentIds: z.array(z.string()).min(2).max(5),
  maxChunksPerDoc: z.number().optional(),
});

export function registerRagExtendedRoutes(
  app: Express,
  { generalApiRateLimit, reportGenerationRateLimit }: RagRouteRateLimiters
) {
  app.get(
    "/api/rag/suggestions",
    generalApiRateLimit,
    withErrorHandling("get RAG suggestions", async (_req, res) => {
      const apiKey = await getOpenAIApiKey();
      if (apiKey && !suggestionEngine.isInitialized()) {
        await suggestionEngine.initialize(apiKey);
      }

      const suggestions = await suggestionEngine.generateSuggestions(
        {
          documentTopics: ["marine maintenance", "engine systems", "safety procedures"],
        },
        5
      );

      return res.json({ success: true, suggestions });
    })
  );

  app.get(
    "/api/rag/conversations/:id/export",
    generalApiRateLimit,
    withErrorHandling("export conversation", async (req, res) => {
      const { id = "" } = req.params;
      const format = (req.query["format"] as "pdf" | "markdown") || "markdown";
      const includeCitations = req.query["includeCitations"] !== "false";
      const includeTimestamps = req.query["includeTimestamps"] !== "false";
      const { orgId, userId } = getConversationIdentity(req);

      const conversationService = getConversationService();
      const conversation = await conversationService.getOwnedConversation(id, { orgId, userId });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await conversationService.getMessages(id, 1000);

      const convAny = conversation as { conversation?: Record<string, unknown> } & Record<
        string,
        unknown
      >;
      const convObj = (convAny.conversation ?? convAny) as {
        id: string;
        title?: string;
        createdAt: string | number | Date;
      };

      const MAX_EXPORT_CONTENT_BYTES = 2 * 1024 * 1024;
      const rawMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: toExportDate(m.createdAt),
        citations: (
          m as { citations?: Array<{ documentId: string; documentTitle: string; excerpt: string }> }
        ).citations,
      }));
      const trimmed: typeof rawMessages = [];
      let runningBytes = 0;
      let truncated = false;
      const TRUNCATION_NOTICE = "\n\n[…content truncated to fit export size budget…]";
      for (let i = rawMessages.length - 1; i >= 0; i--) {
        const m = rawMessages[i];
        if (!m) {
          continue;
        }
        const size =
          Buffer.byteLength(m.content, "utf-8") +
          (m.citations?.reduce(
            (a, c) => a + Buffer.byteLength(c.documentTitle + c.excerpt, "utf-8"),
            0
          ) ?? 0);
        if (runningBytes + size > MAX_EXPORT_CONTENT_BYTES) {
          if (trimmed.length === 0) {
            const remaining = Math.max(0, MAX_EXPORT_CONTENT_BYTES - runningBytes);
            const sliceBytes = Math.max(
              0,
              remaining - Buffer.byteLength(TRUNCATION_NOTICE, "utf-8")
            );
            const head = Buffer.from(m.content, "utf-8").subarray(0, sliceBytes).toString("utf-8");
            trimmed.unshift({
              role: m.role,
              content: head + TRUNCATION_NOTICE,
              timestamp: m.timestamp,
              citations: undefined,
            });
          }
          truncated = true;
          break;
        }
        runningBytes += size;
        trimmed.unshift(m);
      }
      const exportData = {
        id: convObj.id,
        title: convObj.title || "Untitled Conversation",
        createdAt: toExportDate(convObj.createdAt),
        messages: trimmed,
      };

      const result = await exportService.exportConversation(exportData, {
        format,
        includeCitations,
        includeTimestamps,
        ...(truncated
          ? {
              footerText: `Export truncated: omitted ${rawMessages.length - trimmed.length} older message(s) to stay within the ${MAX_EXPORT_CONTENT_BYTES} byte content budget.`,
            }
          : {}),
      });

      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      if (truncated) {
        res.setHeader("X-Export-Truncated", "true");
        res.setHeader("X-Export-Omitted-Messages", String(rawMessages.length - trimmed.length));
      }
      return res.send(result.data);
    })
  );

  app.get(
    "/api/rag/analytics",
    generalApiRateLimit,
    withErrorHandling("get RAG analytics", async (_req, res) => {
      const orgId = DEFAULT_ORG_ID;

      const analytics = await analyticsAggregator.getSummary(orgId);

      return res.json({ success: true, analytics });
    })
  );

  app.post(
    "/api/rag/compare",
    reportGenerationRateLimit,
    withErrorHandling("compare documents", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const parsed = comparisonSchema.parse(req.body);

      const apiKey = await getOpenAIApiKey();
      if (!apiKey) {
        return res.status(503).json({ error: "OpenAI API key not configured" });
      }

      if (!comparisonService.isInitialized()) {
        await comparisonService.initialize(apiKey);
      }

      const result = await comparisonService.compare(parsed, orgId);

      return res.json({ success: true, result });
    })
  );

  app.get(
    "/api/rag/alerts",
    generalApiRateLimit,
    withErrorHandling("get confidence alerts", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const includeAcknowledged = req.query["includeAcknowledged"] === "true";

      const alerts = confidenceDetector.getAlerts(orgId, includeAcknowledged);

      return res.json({ success: true, alerts });
    })
  );

  app.post(
    "/api/rag/alerts/:alertId/acknowledge",
    generalApiRateLimit,
    withErrorHandling("acknowledge alert", async (req, res) => {
      const { alertId = "" } = req.params;

      const acknowledged = confidenceDetector.acknowledgeAlert(alertId);

      if (!acknowledged) {
        return res.status(404).json({ error: "Alert not found" });
      }

      return res.json({ success: true });
    })
  );
}
