import { db } from "../../../db";
import { eq, desc, and } from "drizzle-orm";
import { failurePredictions } from "@shared/schema";
import { z } from "zod";
import { registerTool } from "./registry";

function classifyConfidence(probability: number | null | undefined): {
  level: string;
  label: string;
  warning?: string;
} {
  const p = Number(probability) || 0;
  if (p >= 0.8) {
    return { level: "high", label: "High confidence" };
  }
  if (p >= 0.6) {
    return { level: "medium", label: "Medium confidence" };
  }
  return {
    level: "low",
    label: "Low confidence",
    warning:
      "This prediction has low confidence (below 0.6). Treat with caution and verify with additional inspections.",
  };
}

registerTool({
  name: "getFailurePredictions",
  category: "predictions",
  riskLevel: "read",
  description:
    "Get AI-generated failure predictions for equipment. Shows predicted failures, confidence levels, and remaining useful life. Low-confidence predictions (below 0.6) are flagged with warnings.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "Equipment ID to get predictions for" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
    required: ["equipmentId"],
  },
  inputSchema: z.object({ equipmentId: z.string().min(1), limit: z.number().optional() }),
  requiresApproval: false,
  // @ts-ignore -- bulk-silence
  async execute(input: { equipmentId: string; limit?: number }, ctx) {
    const predictions = await db
      .select()
      .from(failurePredictions)
      .where(
        and(
          eq(failurePredictions.equipmentId, input.equipmentId),
          eq(failurePredictions.orgId, ctx.orgId)
        )
      )
      .orderBy(desc(failurePredictions.predictionTimestamp))
      .limit(input.limit || 10);

    const lowConfidenceCount = predictions.filter(
      (p) => (Number(p.failureProbability) || 0) < 0.6
    ).length;

    return {
      total: predictions.length,
      lowConfidenceCount,
      confidenceNotice:
        lowConfidenceCount > 0
          ? `${lowConfidenceCount} of ${predictions.length} predictions have low confidence. These should be verified with manual inspections.`
          : undefined,
      predictions: predictions.map((p) => {
        const confidence = classifyConfidence(p.failureProbability);
        return {
          id: p.id,
          equipmentId: p.equipmentId,
          failureMode: p.failureMode,
          failureProbability: p.failureProbability,
          predictedFailureDate: p.predictedFailureDate,
          remainingUsefulLife: p.remainingUsefulLife,
          riskLevel: p.riskLevel,
          predictionTimestamp: p.predictionTimestamp,
          confidence,
        };
      }),
    };
  },
});
