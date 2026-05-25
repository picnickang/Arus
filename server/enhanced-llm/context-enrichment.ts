/**
 * Enhanced LLM - Context Enrichment
 *
 * RAG (Retrieval Augmented Generation) context enrichment.
 */

import type { ReportContext } from "../report-context";

/**
 * Enrich context with RAG (Retrieval Augmented Generation)
 */
export function enrichContextWithRAG(context: ReportContext): ReportContext {
  if (!context.intelligence) {
    context.intelligence = {};
  }

  const knowledgeSnippets: string[] = [];

  if (context.data.workOrders && context.data.workOrders.length > 0) {
    const criticalOrders = (context.data.workOrders as object as Array<Record<string, unknown>>)
      .filter((wo) => wo['priority'] === "critical" || wo['priority'] === "urgent")
      .slice(0, 3);

    criticalOrders.forEach((order) => {
      knowledgeSnippets.push(
        `Critical Work Order: ${order['title'] ?? order['description'] ?? "Untitled"} (${order['status']}) - ${order['description'] || "No description"}`
      );
    });
  }

  if (context.data.alerts && context.data.alerts.length > 0) {
    const criticalAlerts = (context.data.alerts as Array<Record<string, unknown>>)
      .filter((a) => a['severity'] === "critical")
      .slice(0, 3);

    criticalAlerts.forEach((alert) => {
      knowledgeSnippets.push(
        `Critical Alert: ${alert['alertType']} on ${alert['sensorType']} - ${alert['message']}`
      );
    });
  }

  if (context.intelligence.vesselLearnings) {
    const learnings = context.intelligence.vesselLearnings as {
      failurePatterns?: Array<{ description: string; confidence: number }>;
    };
    learnings.failurePatterns?.slice(0, 2).forEach((pattern) => {
      knowledgeSnippets.push(
        `Historical Pattern: ${pattern.description} (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`
      );
    });
  }

  if (context.intelligence.predictions && context.intelligence.predictions.length > 0) {
    context.intelligence.predictions.slice(0, 5).forEach((pred) => {
      const failureProb = (pred.mlPrediction.failureProbability * 100).toFixed(0);
      const healthScore = pred.mlPrediction.healthScore;
      const remainingDays = pred.mlPrediction.remainingDays;
      const method =
        pred.mlPrediction.method === "hybrid"
          ? "Hybrid ML"
          : pred.mlPrediction.method === "ml_lstm"
            ? "LSTM Neural Network"
            : "Random Forest";

      knowledgeSnippets.push(
        `ML Prediction for ${pred.equipmentName} (${pred.equipmentType}): ` +
          `${method} model predicts ${failureProb}% failure probability, ` +
          `health score ${healthScore}/100, ` +
          `estimated ${remainingDays} days until maintenance needed. ` +
          `Recommendations: ${pred.mlPrediction.recommendations.slice(0, 2).join("; ")}`
      );
    });
  }

  if (context.knowledge) {
    if (context.knowledge.documents && context.knowledge.documents.length > 0) {
      context.knowledge.documents.slice(0, 5).forEach((doc) => {
        const d = doc as {
          docType?: unknown;
          content?: unknown;
          text?: unknown;
          summary?: unknown;
          title?: unknown;
          name?: unknown;
        };
        const docType = typeof d.docType === "string" ? d.docType : "document";
        const content =
          typeof d.content === "string"
            ? d.content
            : typeof d.text === "string"
              ? d.text
              : undefined;
        const summary = typeof d.summary === "string" ? d.summary : undefined;
        const title =
          typeof d.title === "string"
            ? d.title
            : typeof d.name === "string"
              ? d.name
              : "Untitled";
        const excerpt = content?.slice(0, 500) || summary || "No content available";
        knowledgeSnippets.push(
          `KB Document [${docType.toUpperCase()}]: "${title}" - ${excerpt}${excerpt.length >= 500 ? "..." : ""}`
        );
      });
    }

    if (context.knowledge.semanticMatches && context.knowledge.semanticMatches.length > 0) {
      context.knowledge.semanticMatches.slice(0, 5).forEach((match) => {
        const m = match as {
          similarity?: unknown;
          score?: unknown;
          docType?: unknown;
          content?: unknown;
          text?: unknown;
          summary?: unknown;
          title?: unknown;
          name?: unknown;
        };
        const sim =
          typeof m.similarity === "number"
            ? m.similarity
            : typeof m.score === "number"
              ? m.score
              : undefined;
        const similarity = sim != null ? `(${(sim * 100).toFixed(0)}% match)` : "";
        const docType = typeof m.docType === "string" ? m.docType : "document";
        const content =
          typeof m.content === "string"
            ? m.content
            : typeof m.text === "string"
              ? m.text
              : undefined;
        const summary = typeof m.summary === "string" ? m.summary : undefined;
        const title =
          typeof m.title === "string"
            ? m.title
            : typeof m.name === "string"
              ? m.name
              : "Untitled";
        const excerpt = content?.slice(0, 400) || summary || "No content available";
        knowledgeSnippets.push(
          `KB Reference [${docType.toUpperCase()}] ${similarity}: "${title}" - ${excerpt}${excerpt.length >= 400 ? "..." : ""}`
        );
      });
    }
  }

  context.intelligence.knowledgeBase = knowledgeSnippets;

  return context;
}

/**
 * Serialize context for prompt
 */
export function serializeContext(context: ReportContext): string {
  const parts: string[] = [];

  if (context.data.vessels && context.data.vessels.length > 0) {
    parts.push(`Vessels: ${context.data.vessels.map((v) => v.name).join(", ")}`);
  }

  if (context.data.workOrders) {
    const wos = context.data.workOrders as object as Array<Record<string, unknown>>;
    parts.push(`Work Orders: ${wos.length} total`);
    const byPriority = {
      critical: wos.filter((wo) => wo['priority'] === "critical").length,
      urgent: wos.filter((wo) => wo['priority'] === "urgent").length,
      normal: wos.filter((wo) => wo['priority'] === "normal").length,
    };
    parts.push(
      `  - Critical: ${byPriority.critical}, Urgent: ${byPriority.urgent}, Normal: ${byPriority.normal}`
    );
  }

  if (context.intelligence?.knowledgeBase) {
    parts.push("\nKey Insights:");
    context.intelligence.knowledgeBase.slice(0, 5).forEach((snippet: string) => {
      parts.push(`  - ${snippet}`);
    });
  }

  return parts.join("\n");
}

/**
 * Build citations from context
 */
export function buildCitations(
  context: ReportContext,
  enrichedContext: ReportContext
): { source: string; relevance: number; snippet: string }[] {
  const citations: { source: string; relevance: number; snippet: string }[] = [];

  const knowledgeBase = enrichedContext.intelligence?.knowledgeBase ?? [];
  knowledgeBase.forEach((snippet: unknown, index: number) => {
    citations.push({
      source: `Knowledge Base ${index + 1}`,
      relevance: Math.max(0.6, 1 - index * 0.1),
      snippet: String(snippet),
    });
  });

  return citations.slice(0, 10);
}
