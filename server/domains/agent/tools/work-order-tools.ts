import { z } from "zod";
import { registerTool } from "./registry";

registerTool({
  name: "draftWorkOrder",
  description: "Create a DRAFT work order for maintenance. This does NOT create the work order directly — it creates a draft that requires human approval.",
  parameters: {
    type: "object",
    properties: {
      equipmentId: { type: "string", description: "The equipment this work order is for" },
      title: { type: "string", description: "Short title for the work order" },
      description: { type: "string", description: "Detailed description of work to be done" },
      priority: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Priority level" },
      estimatedHours: { type: "number", description: "Estimated labor hours" },
      type: { type: "string", description: "Work type: preventive, corrective, predictive, inspection" },
    },
    required: ["equipmentId", "title", "description", "priority"],
  },
  inputSchema: z.object({
    equipmentId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    priority: z.enum(["low", "medium", "high", "critical"]),
    estimatedHours: z.number().optional(),
    type: z.string().optional(),
  }),
  requiresApproval: true,
  async execute(input: { equipmentId: string; title: string; description: string; priority: string; estimatedHours?: number; type?: string }, ctx) {
    return {
      draftType: "work_order",
      data: {
        equipmentId: input.equipmentId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        estimatedHours: input.estimatedHours,
        type: input.type || "corrective",
        orgId: ctx.orgId,
      },
      requiresApproval: true,
      message: `Draft work order created: "${input.title}" for equipment ${input.equipmentId}. This requires approval before becoming an actual work order.`,
    };
  },
});
