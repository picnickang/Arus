import { createLogger } from "../../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Application:OrchestratorHelpers:ToolExecution");
import type { LLMToolCall } from "../../../../lib/llm-gateway/types";
import type { AgentRepositoryPort, KnowledgeBasePort } from "../../domain/ports";
import type { AgentConfigType } from "@shared/schema";
import type { PermissionTier, ToolDefinition } from "../../domain/types";
import { getTool } from "../../tools";
import { auditAction } from "../../../../utils/audit-helpers";
import { executeDraftAction } from "../../../../composition/agent-draft-executor.js";
import type { SafetyService } from "../safety-service";
import { parseToolArgs } from "./openai-client";

export interface ToolContext {
  orgId: string;
  userId: string | undefined;
  conversationId: string;
  userRole?: string | undefined;
  knowledgeBase?: KnowledgeBasePort | undefined;
}

export interface ToolExecutionDeps {
  repo: AgentRepositoryPort;
  safety: SafetyService;
}

export interface ToolExecutionResult {
  toolResult: Record<string, unknown>;
  toolStatus: string;
  toolError?: string | undefined;
  durationMs: number;
}

/**
 * Execute a single tool call requested by the model. Enforces:
 *   - schedule allowlist
 *   - per-org enabled-tools allowlist
 *   - RBAC for write-tier tools
 *   - input schema validation
 * On approval-gated tools, routes through `handleDraftApproval`.
 *
 * Always emits an audit-action record (best-effort).
 */
export async function executeTool(
  deps: ToolExecutionDeps,
  tc: LLMToolCall,
  toolContext: ToolContext,
  orgId: string,
  userId: string | undefined,
  conversationId: string,
  config: AgentConfigType | null | undefined,
  runtimeAllowedTools?: string[] | null
): Promise<ToolExecutionResult> {
  const { repo, safety } = deps;
  const toolName = tc.function.name;
  const toolInput = parseToolArgs(tc.function.arguments);
  const startTime = Date.now();
  let toolResult: Record<string, unknown> = {};
  let toolStatus = "success";
  let toolError: string | undefined;

  if (
    runtimeAllowedTools &&
    toolName !== "listAvailableTools" &&
    !runtimeAllowedTools.includes(toolName)
  ) {
    return {
      toolResult: { error: `Tool ${toolName} is not in the schedule allowlist` },
      toolStatus: "error",
      toolError: "Schedule allowlist denied",
      durationMs: 0,
    };
  }

  const enabledTools = config?.enabledTools as string[] | null | undefined;
  if (
    enabledTools &&
    toolName !== "listAvailableTools" &&
    !safety.validateToolAccess(toolName, enabledTools)
  ) {
    return {
      toolResult: { error: `Tool ${toolName} is disabled` },
      toolStatus: "error",
      toolError: "Tool disabled",
      durationMs: 0,
    };
  }

  const userRole = toolContext.userRole;
  if (!safety.checkWriteToolAccess(toolName, userRole)) {
    return {
      toolResult: {
        error: `Insufficient permissions: ${toolName} requires a maintenance role (chief engineer, captain, or admin)`,
      },
      toolStatus: "error",
      toolError: "RBAC denied",
      durationMs: 0,
    };
  }

  const tool = getTool(toolName);
  if (!tool) {
    return {
      toolResult: { error: `Unknown tool: ${toolName}` },
      toolStatus: "error",
      toolError: `Unknown tool: ${toolName}`,
      durationMs: 0,
    };
  }

  if (tool.inputSchema) {
    const validation = tool.inputSchema.safeParse(toolInput);
    if (!validation.success) {
      const errMsg = `Invalid input for ${toolName}: ${validation.error.issues.map((i) => i.message).join(", ")}`;
      return {
        toolResult: { error: errMsg },
        toolStatus: "error",
        toolError: errMsg,
        durationMs: 0,
      };
    }
  }

  try {
    toolResult = await tool.execute(toolInput, toolContext);

    if (tool.requiresApproval && (toolResult as Record<string, unknown>)['requiresApproval']) {
      toolResult = await handleDraftApproval(
        deps,
        tool,
        toolResult,
        config,
        userRole,
        orgId,
        userId,
        conversationId
      );
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Tool execution failed";
    toolResult = { error: errMsg };
    toolStatus = "error";
    toolError = errMsg;
  }

  const durationMs = Date.now() - startTime;

  auditAction(
    "agent_tool_call",
    conversationId,
    "create",
    {
      toolName,
      status: toolStatus,
      durationMs,
      error: toolError,
    },
    { orgId, userId }
  ).catch((err) => {
    logger.warn("[Agent] Audit logging failed for tool call:", { details: err instanceof Error ? err.message : "unknown" });
  });

  return { toolResult, toolStatus, toolError, durationMs };
}

/**
 * Approval routing for tool calls returning `requiresApproval`.
 *
 * Auto-approves when the (riskLevel, permissionTier, userRole) combination
 * permits it AND the underlying draft action succeeds. On any failure,
 * falls back to creating a pending draft for manual review.
 */
export async function handleDraftApproval(
  deps: ToolExecutionDeps,
  tool: ToolDefinition,
  toolResult: Record<string, unknown>,
  config: AgentConfigType | null | undefined,
  userRole: string | undefined,
  orgId: string,
  userId: string | undefined,
  conversationId: string
): Promise<Record<string, unknown>> {
  const { repo, safety } = deps;
  const permissionTier = ((config?.permissionTier as string) || "strict") as PermissionTier;
  const autoApprove = safety.shouldAutoApprove(tool.riskLevel, permissionTier, userRole);

  const resultData = toolResult;
  const data = resultData['data'] as Record<string, unknown>;
  const draftType = resultData['draftType'] as string;

  if (autoApprove) {
    const execResult = await executeDraftAction(draftType, data, orgId);

    if (execResult.error) {
      const fallbackDraft = await repo.drafts.create({
        orgId,
        conversationId,
        draftType,
        title: (data?.['title'] as string) || tool.name,
        data,
        status: "pending",
        createdById: userId,
      });
      return {
        ...toolResult,
        draftId: fallbackDraft.id,
        autoApproveError: execResult.error,
        autoApproveFailed: true,
        message: `Auto-approval failed: ${execResult.error}. A pending draft has been created for manual review.`,
      };
    }

    const draft = await repo.drafts.create({
      orgId,
      conversationId,
      draftType,
      title: (data?.['title'] as string) || tool.name,
      data,
      status: "approved",
      createdById: userId,
    });
    await repo.drafts.update(draft.id, {
      ...(userId !== undefined ? { reviewedById: userId } : {}),
      reviewNote: `Auto-approved (tier: ${permissionTier}, risk: ${tool.riskLevel})`,
      ...(execResult.resultId !== undefined && { resultId: execResult.resultId }),
    });
    await repo.approvals.create({
      orgId,
      draftId: draft.id,
      conversationId,
      action: "approved",
      reviewedById: userId,
      reviewNote: `Auto-approved (tier: ${permissionTier}, risk: ${tool.riskLevel})`,
      resultId: execResult.resultId,
    });
    auditAction(
      "agent_draft",
      draft.id,
      "update",
      {
        action: "auto_approved",
        draftType,
        permissionTier,
        riskLevel: tool.riskLevel,
        approvalMode: "auto",
        resultId: execResult.resultId,
      },
      { orgId, userId }
    );
    return {
      ...toolResult,
      draftId: draft.id,
      resultId: execResult.resultId,
      autoApproved: true,
      approvalMode: "auto",
    };
  }

  // Manual approval path
  const draft = await repo.drafts.create({
    orgId,
    conversationId,
    draftType,
    title: (data?.['title'] as string) || tool.name,
    data,
    status: "pending",
    createdById: userId,
  });
  return { ...toolResult, draftId: draft.id };
}
