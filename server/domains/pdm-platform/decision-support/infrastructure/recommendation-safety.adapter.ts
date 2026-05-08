import type { RecommendationSafetyPort } from "../domain/ports";
import type { SafetyReview } from "../domain/types";

const BLOCKED_PATTERNS = [
  /disable\s+(alarm|interlock|shutdown|safety)/i,
  /bypass\s+(alarm|interlock|shutdown|safety)/i,
  /ignore\s+(alarm|critical|shutdown)/i,
  /operate\s+until\s+failure/i,
  /override\s+class/i,
];

const REVIEW_PATTERNS = [/continue\s+running/i, /defer/i, /postpone/i, /critical/i, /shutdown/i];

export class RecommendationSafetyAdapter implements RecommendationSafetyPort {
  reviewRecommendation(input: {
    recommendation: string;
    riskLevel: string;
    equipmentId?: string;
  }): SafetyReview {
    const trimmed = input.recommendation.trim().replace(/\s+/g, " ");
    const reasons: string[] = [];

    if (!trimmed) {
      return {
        decision: "blocked",
        reasons: ["Recommendation is empty."],
        sanitizedRecommendation: "No recommendation supplied.",
      };
    }

    if (BLOCKED_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      return {
        decision: "blocked",
        reasons: [
          "Recommendation appears to bypass alarms, interlocks, shutdowns, class requirements, or safety controls.",
        ],
        sanitizedRecommendation:
          "Escalate to the chief engineer and follow vessel safety, class, and maker procedures before operating.",
      };
    }

    if (input.riskLevel === "critical" || REVIEW_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      reasons.push("Engineer review required because the recommendation touches critical or deferral language.");
    }

    return {
      decision: reasons.length > 0 ? "needs_engineer_review" : "approved",
      reasons,
      sanitizedRecommendation: trimmed,
    };
  }
}
