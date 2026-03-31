import { db } from "../../../db";
import { eq, desc, and } from "drizzle-orm";
import { failurePredictions } from "@shared/schema";
import { registerTool } from "./registry";

registerTool({
  name: "getFailurePredictions",
  description: "Get AI-generated failure predictions for equipment. Shows predicted failures, confidence, and remaining useful life.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "Equipment ID to get predictions for" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
    required: ["equipmentId"],
  },
  requiresApproval: false,
  async execute(input: { equipmentId: string; limit?: number }, ctx) {
    const predictions = await db.select().from(failurePredictions)
      .where(and(
        eq(failurePredictions.equipmentId, input.equipmentId),
        eq(failurePredictions.orgId, ctx.orgId),
      ))
      .orderBy(desc(failurePredictions.predictionTimestamp))
      .limit(input.limit || 10);

    return {
      total: predictions.length,
      predictions: predictions.map(p => ({
        id: p.id, equipmentId: p.equipmentId,
        failureMode: p.failureMode, failureProbability: p.failureProbability,
        predictedFailureDate: p.predictedFailureDate,
        remainingUsefulLife: p.remainingUsefulLife,
        riskLevel: p.riskLevel, predictionTimestamp: p.predictionTimestamp,
      })),
    };
  },
});
