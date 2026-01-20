/**
 * RAG Confidence Detection Service
 * Detects low-confidence responses and generates alerts
 */

export interface ConfidenceConfig {
  lowConfidenceThreshold: number;
  minChunksRequired: number;
  minAverageScore: number;
  alertOnLowConfidence: boolean;
}

export interface ConfidenceResult {
  score: number;
  level: "high" | "medium" | "low";
  factors: ConfidenceFactor[];
  recommendation?: string;
}

export interface ConfidenceFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface LowConfidenceAlert {
  id: string;
  queryText: string;
  confidenceScore: number;
  factors: ConfidenceFactor[];
  timestamp: Date;
  orgId: string;
  conversationId?: string;
  acknowledged: boolean;
}

const DEFAULT_CONFIG: ConfidenceConfig = {
  lowConfidenceThreshold: 0.4,
  minChunksRequired: 2,
  minAverageScore: 0.6,
  alertOnLowConfidence: true,
};

export class ConfidenceDetector {
  private config: ConfidenceConfig;
  private alerts: Map<string, LowConfidenceAlert> = new Map();
  private alertListeners: Array<(alert: LowConfidenceAlert) => void> = [];

  constructor(config: Partial<ConfidenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  evaluateConfidence(
    query: string,
    retrievedChunks: Array<{ content: string; score: number }>,
    responseLength?: number
  ): ConfidenceResult {
    const factors: ConfidenceFactor[] = [];

    const chunkCountFactor = this.evaluateChunkCount(retrievedChunks.length);
    factors.push(chunkCountFactor);

    const scoreFactor = this.evaluateRetrievalScores(retrievedChunks);
    factors.push(scoreFactor);

    const coverageFactor = this.evaluateQueryCoverage(query, retrievedChunks);
    factors.push(coverageFactor);

    const diversityFactor = this.evaluateSourceDiversity(retrievedChunks);
    factors.push(diversityFactor);

    if (responseLength !== undefined) {
      const lengthFactor = this.evaluateResponseLength(responseLength);
      factors.push(lengthFactor);
    }

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight;

    const level = this.scoreToLevel(weightedScore);
    const recommendation = this.generateRecommendation(level, factors);

    return {
      score: Math.round(weightedScore * 100) / 100,
      level,
      factors,
      recommendation,
    };
  }

  private evaluateChunkCount(count: number): ConfidenceFactor {
    let score: number;
    let description: string;

    if (count === 0) {
      score = 0;
      description = "No relevant documents found";
    } else if (count < this.config.minChunksRequired) {
      score = 0.3;
      description = `Only ${count} relevant chunk(s) found`;
    } else if (count < 3) {
      score = 0.6;
      description = "Limited relevant content available";
    } else if (count < 5) {
      score = 0.8;
      description = "Good amount of relevant content";
    } else {
      score = 1.0;
      description = "Extensive relevant content available";
    }

    return {
      name: "chunk_count",
      score,
      weight: 0.25,
      description,
    };
  }

  private evaluateRetrievalScores(chunks: Array<{ score: number }>): ConfidenceFactor {
    if (chunks.length === 0) {
      return {
        name: "retrieval_score",
        score: 0,
        weight: 0.35,
        description: "No retrieval scores available",
      };
    }

    const avgScore = chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length;
    const topScore = Math.max(...chunks.map((c) => c.score));

    let score: number;
    let description: string;

    if (avgScore >= this.config.minAverageScore && topScore >= 0.8) {
      score = 1.0;
      description = "Excellent semantic match with documents";
    } else if (avgScore >= 0.5 && topScore >= 0.7) {
      score = 0.7;
      description = "Good semantic match with documents";
    } else if (avgScore >= 0.3) {
      score = 0.4;
      description = "Moderate semantic match";
    } else {
      score = 0.2;
      description = "Weak semantic match - query may not be covered";
    }

    return {
      name: "retrieval_score",
      score,
      weight: 0.35,
      description,
    };
  }

  private evaluateQueryCoverage(
    query: string,
    chunks: Array<{ content: string }>
  ): ConfidenceFactor {
    if (chunks.length === 0) {
      return {
        name: "query_coverage",
        score: 0,
        weight: 0.2,
        description: "No content to evaluate coverage",
      };
    }

    const queryTerms = this.extractKeyTerms(query);
    const combinedContent = chunks.map((c) => c.content.toLowerCase()).join(" ");

    let matchedTerms = 0;
    for (const term of queryTerms) {
      if (combinedContent.includes(term.toLowerCase())) {
        matchedTerms++;
      }
    }

    const coverage = queryTerms.length > 0 ? matchedTerms / queryTerms.length : 0;

    let description: string;
    if (coverage >= 0.8) {
      description = "Query terms well covered by documents";
    } else if (coverage >= 0.5) {
      description = "Partial query term coverage";
    } else {
      description = "Many query terms not found in documents";
    }

    return {
      name: "query_coverage",
      score: coverage,
      weight: 0.2,
      description,
    };
  }

  private evaluateSourceDiversity(chunks: Array<{ content: string }>): ConfidenceFactor {
    if (chunks.length <= 1) {
      return {
        name: "source_diversity",
        score: chunks.length === 1 ? 0.5 : 0,
        weight: 0.1,
        description: chunks.length === 1 ? "Single source available" : "No sources",
      };
    }

    const contentHashes = chunks.map((c) => this.simpleHash(c.content.substring(0, 100)));
    const uniqueSources = new Set(contentHashes).size;
    const diversityRatio = uniqueSources / chunks.length;

    return {
      name: "source_diversity",
      score: diversityRatio,
      weight: 0.1,
      description:
        diversityRatio >= 0.7
          ? "Information from diverse sources"
          : "Information concentrated in few sources",
    };
  }

  private evaluateResponseLength(length: number): ConfidenceFactor {
    let score: number;
    let description: string;

    if (length < 50) {
      score = 0.3;
      description = "Very short response may indicate uncertainty";
    } else if (length < 200) {
      score = 0.7;
      description = "Moderate response length";
    } else if (length < 1000) {
      score = 1.0;
      description = "Comprehensive response";
    } else {
      score = 0.9;
      description = "Long response";
    }

    return {
      name: "response_length",
      score,
      weight: 0.1,
      description,
    };
  }

  private extractKeyTerms(query: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been",
      "being", "have", "has", "had", "do", "does", "did", "will",
      "would", "could", "should", "may", "might", "must", "shall",
      "can", "need", "dare", "ought", "used", "to", "of", "in",
      "for", "on", "with", "at", "by", "from", "as", "into",
      "through", "during", "before", "after", "above", "below",
      "between", "under", "again", "further", "then", "once",
      "here", "there", "when", "where", "why", "how", "all",
      "each", "few", "more", "most", "other", "some", "such",
      "no", "nor", "not", "only", "own", "same", "so", "than",
      "too", "very", "just", "and", "but", "if", "or", "because",
      "until", "while", "what", "which", "who", "whom", "this",
      "that", "these", "those", "am", "it", "its", "i", "me", "my",
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !stopWords.has(term));
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private scoreToLevel(score: number): ConfidenceResult["level"] {
    if (score >= 0.7) return "high";
    if (score >= this.config.lowConfidenceThreshold) return "medium";
    return "low";
  }

  private generateRecommendation(
    level: ConfidenceResult["level"],
    factors: ConfidenceFactor[]
  ): string | undefined {
    if (level === "high") return undefined;

    const weakFactors = factors.filter((f) => f.score < 0.5).map((f) => f.name);

    if (weakFactors.includes("chunk_count")) {
      return "Consider uploading more relevant documentation to the knowledge base.";
    }
    if (weakFactors.includes("retrieval_score")) {
      return "The question may not be well covered by existing documents. Try rephrasing or adding related documentation.";
    }
    if (weakFactors.includes("query_coverage")) {
      return "Some query terms were not found. The answer may be incomplete.";
    }

    return "Response confidence is lower than usual. Verify the answer against source documents.";
  }

  async createAlert(
    query: string,
    confidence: ConfidenceResult,
    orgId: string,
    conversationId?: string
  ): Promise<LowConfidenceAlert | null> {
    if (confidence.level !== "low" || !this.config.alertOnLowConfidence) {
      return null;
    }

    const alert: LowConfidenceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      queryText: query,
      confidenceScore: confidence.score,
      factors: confidence.factors,
      timestamp: new Date(),
      orgId,
      conversationId,
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);

    for (const listener of this.alertListeners) {
      try {
        listener(alert);
      } catch (error) {
        console.error("[ConfidenceDetector] Alert listener error:", error);
      }
    }

    return alert;
  }

  getAlerts(orgId: string, includeAcknowledged: boolean = false): LowConfidenceAlert[] {
    return Array.from(this.alerts.values())
      .filter((a) => a.orgId === orgId && (includeAcknowledged || !a.acknowledged))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  onAlert(listener: (alert: LowConfidenceAlert) => void): void {
    this.alertListeners.push(listener);
  }

  getConfig(): ConfidenceConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<ConfidenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const confidenceDetector = new ConfidenceDetector();
