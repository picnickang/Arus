/**
 * RAG Suggestion Engine
 * Generates contextual question suggestions based on documents and conversation history
 */

import { createLogger } from "../../../lib/structured-logger";
import { llmGateway } from "../../../composition/llm-gateway";
const logger = createLogger("Services:Rag:Suggestions:Index");

export interface SuggestionContext {
  documentSummaries?: Array<{ title: string; summary: string }>;
  conversationHistory?: Array<{ role: string; content: string }>;
  recentQueries?: string[];
  documentTopics?: string[];
}

export interface Suggestion {
  question: string;
  category: "maintenance" | "safety" | "operations" | "technical" | "general";
  relevance: number;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  maintenance: ["maintenance", "repair", "service", "inspect", "replace", "check", "schedule"],
  safety: ["safety", "hazard", "emergency", "protective", "warning", "caution", "danger"],
  operations: ["operate", "start", "stop", "run", "procedure", "process", "workflow"],
  technical: ["specification", "parameter", "setting", "configuration", "calibration", "tolerance"],
  general: [],
};

export class SuggestionEngine {
  private initialized = false;
  private cachedSuggestions: Map<string, { suggestions: Suggestion[]; timestamp: number }> =
    new Map();
  private cacheTTL = 300000;

  async initialize(_apiKey: string): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async generateSuggestions(context: SuggestionContext, count: number = 5): Promise<Suggestion[]> {
    const cacheKey = this.buildCacheKey(context);
    const cached = this.cachedSuggestions.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.suggestions.slice(0, count);
    }

    if (!(await llmGateway.isAvailable())) {
      return this.generateFallbackSuggestions(context, count);
    }

    try {
      const suggestions = await this.generateWithLLM(context, count);
      this.cachedSuggestions.set(cacheKey, {
        suggestions,
        timestamp: Date.now(),
      });
      return suggestions;
    } catch (error) {
      logger.error("[SuggestionEngine] LLM generation failed:", undefined, error);
      return this.generateFallbackSuggestions(context, count);
    }
  }

  private async generateWithLLM(context: SuggestionContext, count: number): Promise<Suggestion[]> {
    const prompt = this.buildPrompt(context, count);

    const response = await llmGateway.chat({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that generates relevant questions for a marine maintenance knowledge base. Generate exactly ${count} questions that would be useful for marine engineers and crew.

Return ONLY a JSON array of objects with this format:
[{"question": "...", "category": "maintenance|safety|operations|technical|general"}]

No explanation, just the JSON array.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxCompletionTokens: 500,
      meta: { caller: "rag-suggestion-engine", suggestionCount: count },
    });

    const content = response.content || "[]";

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed as Array<{ question: string; category?: Suggestion["category"] }>).map(
        (item, index) => ({
          question: item.question,
          category: item.category || "general",
          relevance: 1 - index * 0.1,
        })
      );
    } catch (parseError) {
      logger.error("[SuggestionEngine] Failed to parse LLM response:", undefined, parseError);
      return this.generateFallbackSuggestions(context, count);
    }
  }

  private buildPrompt(context: SuggestionContext, count: number): string {
    const parts: string[] = [];

    if (context.documentSummaries && context.documentSummaries.length > 0) {
      parts.push("Available documents:");
      for (const doc of context.documentSummaries.slice(0, 5)) {
        parts.push(`- ${doc.title}: ${doc.summary.substring(0, 100)}...`);
      }
    }

    if (context.documentTopics && context.documentTopics.length > 0) {
      parts.push(`\nTopics covered: ${context.documentTopics.join(", ")}`);
    }

    if (context.conversationHistory && context.conversationHistory.length > 0) {
      parts.push("\nRecent conversation:");
      for (const msg of context.conversationHistory.slice(-3)) {
        parts.push(`${msg.role}: ${msg.content.substring(0, 100)}...`);
      }
    }

    if (context.recentQueries && context.recentQueries.length > 0) {
      parts.push(`\nRecent queries: ${context.recentQueries.slice(0, 5).join("; ")}`);
    }

    parts.push(`\nGenerate ${count} diverse, useful follow-up questions.`);

    return parts.join("\n");
  }

  private generateFallbackSuggestions(context: SuggestionContext, count: number): Suggestion[] {
    const templates: Array<{ template: string; category: Suggestion["category"] }> = [
      { template: "What are the maintenance intervals for {topic}?", category: "maintenance" },
      { template: "How do I troubleshoot {topic} issues?", category: "technical" },
      {
        template: "What safety precautions should I take when working with {topic}?",
        category: "safety",
      },
      { template: "What is the proper procedure for {topic}?", category: "operations" },
      { template: "What are the specifications for {topic}?", category: "technical" },
      { template: "How do I perform routine checks on {topic}?", category: "maintenance" },
      { template: "What are common problems with {topic}?", category: "technical" },
      { template: "How do I calibrate {topic}?", category: "operations" },
    ];

    const topics = this.extractTopics(context);
    const suggestions: Suggestion[] = [];

    for (let i = 0; i < Math.min(count, templates.length); i++) {
      const template = templates[i];
      const topic = topics[i % topics.length] || "marine equipment";
      suggestions.push({
        question: template.template.replace("{topic}", topic),
        category: template.category,
        relevance: 1 - i * 0.1,
      });
    }

    return suggestions;
  }

  private extractTopics(context: SuggestionContext): string[] {
    const topics: string[] = [];

    if (context.documentTopics) {
      topics.push(...context.documentTopics);
    }

    if (context.documentSummaries) {
      for (const doc of context.documentSummaries) {
        topics.push(doc.title.replace(/\.[^.]+$/, ""));
      }
    }

    if (context.conversationHistory) {
      for (const msg of context.conversationHistory) {
        const nouns = msg.content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
        if (nouns) {
          topics.push(...nouns.slice(0, 2));
        }
      }
    }

    return [...new Set(topics)].slice(0, 10);
  }

  private buildCacheKey(context: SuggestionContext): string {
    const parts: string[] = [];

    if (context.documentSummaries) {
      parts.push(context.documentSummaries.map((d) => d.title).join(","));
    }

    if (context.conversationHistory) {
      parts.push(
        context.conversationHistory
          .slice(-2)
          .map((m) => m.content.substring(0, 50))
          .join("|")
      );
    }

    return parts.join("::") || "default";
  }

  categorizeQuestion(question: string): Suggestion["category"] {
    const lowerQuestion = question.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (category === "general") {
        continue;
      }
      if (keywords.some((kw) => lowerQuestion.includes(kw))) {
        return category as Suggestion["category"];
      }
    }

    return "general";
  }

  clearCache(): void {
    this.cachedSuggestions.clear();
  }
}

export const suggestionEngine = new SuggestionEngine();
