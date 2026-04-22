import { z } from "zod";
import { registerTool } from "./registry";
import { db } from "../../../db";
import { failurePredictions, crew } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

interface CostImpactData {
  estimatedRepairCost?: number;
  estimatedDowntime?: number;
  revenueImpact?: number;
}

async function fetchPredictionCostContext(
  equipmentId: string,
  orgId: string,
): Promise<{ costImpact: CostImpactData | null; confidence: number | null; failureMode: string | null }> {
  try {
    const [pred] = await db
      .select({
        costImpact: failurePredictions.costImpact,
        failureProbability: failurePredictions.failureProbability,
        failureMode: failurePredictions.failureMode,
      })
      .from(failurePredictions)
      .where(
        and(
          eq(failurePredictions.equipmentId, equipmentId),
          eq(failurePredictions.orgId, orgId),
        ),
      )
      .orderBy(desc(failurePredictions.predictionTimestamp))
      .limit(1);
    if (!pred) {return { costImpact: null, confidence: null, failureMode: null };}
    return {
      costImpact: (pred.costImpact as CostImpactData) || null,
      confidence: pred.failureProbability,
      failureMode: pred.failureMode,
    };
  } catch {
    return { costImpact: null, confidence: null, failureMode: null };
  }
}

async function fetchOrgLaborRate(orgId: string): Promise<number | null> {
  try {
    const [result] = await db
      .select({ avgRate: sql<number>`AVG(${crew.hourlyRate})` })
      .from(crew)
      .where(and(eq(crew.orgId, orgId), sql`${crew.hourlyRate} IS NOT NULL AND ${crew.hourlyRate} > 0`));
    return result?.avgRate ?? null;
  } catch {
    return null;
  }
}

function buildAutoJustification(
  costImpact: CostImpactData,
  confidence: number | null,
  failureMode: string | null,
): string {
  const fmt = (v: number) => (v >= 1000 ? `~$${(v / 1000).toFixed(0)}K` : `~$${v.toFixed(0)}`);
  const parts: string[] = [];
  if (confidence != null) {
    parts.push(`Prediction confidence: ${(confidence * 100).toFixed(0)}%`);
  }
  if (failureMode) {
    parts.push(`Failure mode: ${failureMode}`);
  }
  if (costImpact.estimatedRepairCost != null) {
    parts.push(`Estimated repair cost: ${fmt(costImpact.estimatedRepairCost)}`);
  }
  if (costImpact.revenueImpact != null) {
    parts.push(`Estimated failure impact: ${fmt(costImpact.revenueImpact)}`);
  }
  if (costImpact.estimatedRepairCost != null && costImpact.revenueImpact != null) {
    const savings = costImpact.revenueImpact - costImpact.estimatedRepairCost;
    if (savings > 0) {
      parts.push(`Potential savings from preventive action: ${fmt(savings)}`);
    } else if (savings === 0) {
      parts.push(`Net cost variance: $0 (repair cost equals failure impact)`);
    } else {
      parts.push(`Net cost: repair exceeds failure impact by ${fmt(Math.abs(savings))}`);
    }
  }
  if (costImpact.estimatedDowntime != null) {
    parts.push(`Estimated downtime: ${costImpact.estimatedDowntime}h`);
  }
  if (parts.length === 0) {return "";}
  return `${parts.join(". ")  }.`;
}

const draftWorkOrderInput = z.object({
  equipmentId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "critical"]),
  estimatedHours: z.number().optional(),
  estimatedCostPerHour: z.number().optional(),
  estimatedPartsCost: z.number().optional(),
  costJustification: z.string().optional(),
  predictionId: z.number().optional(),
  type: z.string().optional(),
});

registerTool({
  name: "draftWorkOrder",
  category: "work-orders",
  riskLevel: "high-write",
  description: "Create a DRAFT work order for maintenance. This does NOT create the work order directly — it creates a draft that requires human approval. For prediction-triggered work orders, cost fields are auto-populated from the prediction's cost impact data.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "The equipment this work order is for" },
      title: { type: "string", description: "Short title for the work order" },
      description: { type: "string", description: "Detailed description of work to be done" },
      priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Priority level" },
      estimatedHours: { type: "number", description: "Estimated labor hours" },
      estimatedCostPerHour: { type: "number", description: "Estimated labor cost per hour in USD" },
      estimatedPartsCost: { type: "number", description: "Estimated parts/materials cost in USD" },
      costJustification: { type: "string", description: "Financial justification for the work order, including prediction confidence, estimated failure cost, and repair cost rationale" },
      predictionId: { type: "number", description: "ID of the failure prediction that triggered this work order (enables auto-population of cost fields)" },
      type: { type: "string", description: "Work type: preventive, corrective, predictive, inspection" },
    },
    required: ["equipmentId", "title", "description", "priority"],
  },
  inputSchema: draftWorkOrderInput,
  requiresApproval: true,
  async execute(input: Record<string, unknown>, ctx) {
    const validated = draftWorkOrderInput.parse(input);
    const { equipmentId, title, description, priority, estimatedHours, predictionId } = validated;
    const inputType = validated.type || "corrective";
    let costJustification = validated.costJustification;
    let estimatedCostPerHour = validated.estimatedCostPerHour;
    let estimatedPartsCost = validated.estimatedPartsCost;

    const isPredictionTriggered = predictionId != null
      || inputType === "predictive";

    if (!costJustification && isPredictionTriggered) {
      const predContext = await fetchPredictionCostContext(equipmentId, ctx.orgId);
      if (predContext.costImpact) {
        const autoJustification = buildAutoJustification(
          predContext.costImpact,
          predContext.confidence,
          predContext.failureMode,
        );
        if (autoJustification) {costJustification = autoJustification;}
        if (estimatedPartsCost == null && predContext.costImpact.estimatedRepairCost) {
          estimatedPartsCost = Math.round(predContext.costImpact.estimatedRepairCost * 0.4);
        }
      }
    }

    if (estimatedCostPerHour == null) {
      const orgRate = await fetchOrgLaborRate(ctx.orgId);
      if (orgRate != null) {
        estimatedCostPerHour = Math.round(orgRate * 100) / 100;
      }
    }

    const estimatedLaborCost =
      estimatedHours != null && estimatedCostPerHour != null
        ? estimatedHours * estimatedCostPerHour
        : undefined;

    return {
      draftType: "work_order",
      data: {
        equipmentId,
        title,
        description,
        priority,
        estimatedHours,
        estimatedCostPerHour,
        estimatedLaborCost,
        estimatedPartsCost,
        costJustification,
        type: inputType,
        orgId: ctx.orgId,
      },
      requiresApproval: true,
      message: `Draft work order created: "${title}" for equipment ${equipmentId}.${estimatedLaborCost != null ? ` Estimated labor cost: $${estimatedLaborCost.toFixed(0)}.` : ""}${estimatedPartsCost != null ? ` Estimated parts cost: $${estimatedPartsCost.toFixed(0)}.` : ""}${costJustification ? ` Justification: ${costJustification}` : ""} This requires approval before becoming an actual work order.`,
    };
  },
});
