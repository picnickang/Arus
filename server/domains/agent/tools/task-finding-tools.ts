import { z } from "zod";
import { registerTool } from "./registry";
import { AgentTaskRepositoryAdapter } from "../infrastructure/task-repository-adapter";
import { AgentFindingRepositoryAdapter } from "../infrastructure/finding-repository-adapter";
import { AgentTaskService } from "../application/task-service";
import { AgentFindingService } from "../application/finding-service";

const taskRepo = new AgentTaskRepositoryAdapter();
const taskService = new AgentTaskService(taskRepo);
const findingRepo = new AgentFindingRepositoryAdapter();
const findingService = new AgentFindingService(findingRepo);

registerTool({
  name: "createAgentTask",
  category: "maintenance",
  riskLevel: "low-write",
  description:
    "Create a durable agent task to track an investigation, action item, or multi-step workflow. Tasks persist across conversations and can have sub-tasks, linked entities, and status tracking.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short descriptive title for the task" },
      description: { type: "string", description: "Detailed description of what needs to be done" },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "Task priority level",
      },
      source: {
        type: "string",
        enum: ["suggestion", "signal", "user", "scheduled"],
        description: "What triggered this task",
      },
      equipmentId: { type: "string", description: "Related equipment ID if applicable" },
      vesselId: { type: "string", description: "Related vessel ID if applicable" },
      predictionId: { type: "string", description: "Related prediction ID if applicable" },
      parentTaskId: { type: "string", description: "Parent task ID for sub-task decomposition" },
    },
    required: ["title"],
  },
  inputSchema: z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    source: z.enum(["suggestion", "signal", "user", "scheduled"]).optional(),
    equipmentId: z.string().optional(),
    vesselId: z.string().optional(),
    predictionId: z.string().optional(),
    parentTaskId: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(input: Record<string, unknown>, ctx) {
    try {
      const task = await taskService.create({
        orgId: ctx.orgId,
        title: input["title"] as string,
        description: (input["description"] as string) || null,
        priority: (input["priority"] as string) || "medium",
        source: (input["source"] as string) || "user",
        equipmentId: (input["equipmentId"] as string) || null,
        vesselId: (input["vesselId"] as string) || null,
        predictionId: (input["predictionId"] as string) || null,
        parentTaskId: (input["parentTaskId"] as string) || null,
        conversationId: ctx.conversationId || null,
      });
      return {
        taskId: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        message: `Task created: "${task.title}" (ID: ${task.id})`,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to create task" };
    }
  },
});

registerTool({
  name: "recordFinding",
  category: "analytics",
  riskLevel: "low-write",
  description:
    "Record a structured finding from an investigation — anomaly, recommendation, risk assessment, or compliance gap. Findings are linked to tasks and surface in the Findings Feed.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title summarizing the finding" },
      findingType: {
        type: "string",
        enum: ["anomaly", "recommendation", "risk", "compliance_gap"],
        description: "Classification of the finding",
      },
      severity: {
        type: "string",
        enum: ["info", "warning", "critical"],
        description: "Severity level",
      },
      evidenceSummary: { type: "string", description: "Evidence and data supporting this finding" },
      recommendedAction: { type: "string", description: "Recommended next steps or actions" },
      taskId: { type: "string", description: "ID of the parent task this finding belongs to" },
      equipmentId: { type: "string", description: "Related equipment ID" },
      vesselId: { type: "string", description: "Related vessel ID" },
      entityType: {
        type: "string",
        description: "Type of related entity (e.g., work_order, alert)",
      },
      entityId: { type: "string", description: "ID of the related entity" },
    },
    required: ["title"],
  },
  inputSchema: z.object({
    title: z.string().min(1).max(500),
    findingType: z.enum(["anomaly", "recommendation", "risk", "compliance_gap"]).optional(),
    severity: z.enum(["info", "warning", "critical"]).optional(),
    evidenceSummary: z.string().max(5000).optional(),
    recommendedAction: z.string().max(2000).optional(),
    taskId: z.string().optional(),
    equipmentId: z.string().optional(),
    vesselId: z.string().optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(input: Record<string, unknown>, ctx) {
    try {
      const finding = await findingService.create({
        orgId: ctx.orgId,
        title: input["title"] as string,
        findingType: (input["findingType"] as string) || "recommendation",
        severity: (input["severity"] as string) || "info",
        evidenceSummary: (input["evidenceSummary"] as string) || null,
        recommendedAction: (input["recommendedAction"] as string) || null,
        taskId: (input["taskId"] as string) || null,
        equipmentId: (input["equipmentId"] as string) || null,
        vesselId: (input["vesselId"] as string) || null,
        entityType: (input["entityType"] as string) || null,
        entityId: (input["entityId"] as string) || null,
        conversationId: ctx.conversationId || null,
        metadata: {},
      });
      return {
        findingId: finding.id,
        title: finding.title,
        findingType: finding.findingType,
        severity: finding.severity,
        taskId: finding.taskId,
        message: `Finding recorded: "${finding.title}" (ID: ${finding.id})`,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to record finding" };
    }
  },
});
