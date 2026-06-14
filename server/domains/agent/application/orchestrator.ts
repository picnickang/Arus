import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Application:Orchestrator");
import type { LLMContentPart } from "../../../lib/llm-gateway/types";
import type { AgentRepositoryPort, KnowledgeBasePort } from "../domain/ports";
import type { AgentRunResult, AgentSignal, FileAttachment } from "../domain/types";
import { SafetyService } from "./safety-service";
import { auditAction } from "../../../utils/audit-helpers";
import { buildIngestionSystemMessage } from "../infrastructure/kb-ingestion-helper";
import type { AgentConversation } from "@shared/schema";

import { processAttachments as processAttachmentsHelper } from "./orchestrator-helpers/attachment-processor";
import type { ToolContext } from "./orchestrator-helpers/tool-execution";
import { buildSignalPrompt, getCompactionConfig } from "./orchestrator-helpers/loop-helpers";
import {
  appendAgentFileContext,
  buildAgentMessages,
} from "./orchestrator-helpers/context";
import { executeAgentLoop } from "./orchestrator-helpers/iteration-loop";
import type { LoopResult, RunContext } from "./orchestrator-types";

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class AgentOrchestrator {
  private safety: SafetyService;
  private knowledgeBase?: KnowledgeBasePort | undefined;

  constructor(
    private repo: AgentRepositoryPort,
    knowledgeBase?: KnowledgeBasePort
  ) {
    this.safety = new SafetyService(repo);
    this.knowledgeBase = knowledgeBase;
  }

  // ===== PUBLIC API =====

  async run(
    orgId: string,
    userId: string | undefined,
    conversationId: string | undefined,
    userMessage: string,
    userRole?: string,
    options?: { toolAllowlist?: string[] | null; maxTokenBudget?: number }
  ): Promise<AgentRunResult> {
    const ctx = await this.initRun(orgId, userId, conversationId, userMessage, userRole);

    const runStartTime = Date.now();
    await this.auditRunLifecycle("run_start", ctx.conversation.id, orgId, userId, {
      model: ctx.model,
      maxIterations: ctx.maxIterations,
    });

    // Persist user message
    await this.persistUserMessage(ctx.conversation.id, ctx.sanitizedMessage);

    // Build context
    const openaiMessages = await buildAgentMessages(this.repo, ctx);

    // Append file-reference context for previously uploaded files
    await appendAgentFileContext(ctx.conversation.id, orgId, openaiMessages);

    try {
      const result = await executeAgentLoop(
        { repo: this.repo, safety: this.safety },
        ctx,
        openaiMessages,
        {
          mode: "sync",
          maxTokenBudget: options?.maxTokenBudget,
          runtimeAllowlist: options?.toolAllowlist,
        }
      );

      await this.completeRun(ctx, result, runStartTime, orgId, userId);

      return {
        conversationId: ctx.conversation.id,
        toolCalls: result.toolCallTraces,
        finalResponse: result.finalResponse,
        toolCallCount: result.toolCallCount,
        totalTokens: result.totalTokens,
      };
    } catch (err) {
      await this.auditRunLifecycle("run_error", ctx.conversation.id, orgId, userId, {
        model: ctx.model,
        durationMs: Date.now() - runStartTime,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  async processSignal(signal: AgentSignal): Promise<AgentRunResult> {
    const prompt = buildSignalPrompt(signal);
    const result = await this.run(signal.orgId, undefined, undefined, prompt, "admin", {
      maxTokenBudget: 4000,
    });

    if (signal.suggestionId) {
      try {
        await this.repo.suggestions.update(signal.suggestionId, {
          actedOn: true,
          status: "acted",
        });
      } catch {
        // Non-critical
      }
    }

    try {
      const existing = await this.repo.conversations.get(result.conversationId, signal.orgId);
      const existingMeta = (existing?.metadata as Record<string, unknown>) || {};
      const provenance = {
        ...existingMeta,
        triggerType: "prediction_signal",
        triggerId: String(signal.predictionId),
        signalType: signal.type,
        equipmentId: signal.equipmentId,
        failureProbability: signal.failureProbability,
        riskLevel: signal.riskLevel,
        modelId: signal.modelId ?? null,
        confidenceInterval: signal.confidenceInterval ?? null,
      };
      await this.repo.conversations.update(result.conversationId, {
        metadata: provenance,
      } as Partial<AgentConversation>);
    } catch {
      // Non-critical
    }

    try {
      await auditAction(
        "agent_signal",
        result.conversationId,
        "create",
        {
          lifecycle: "signal_triggered",
          triggerType: "prediction_signal",
          triggerId: String(signal.predictionId),
          signalType: signal.type,
          equipmentId: signal.equipmentId,
          failureProbability: signal.failureProbability,
          riskLevel: signal.riskLevel,
          modelId: signal.modelId ?? null,
          autoTriggered: true,
        },
        { orgId: signal.orgId }
      );
    } catch {
      // Non-critical
    }

    logger.info(
      `[AgentOrchestrator] Signal processed: ${signal.type} for equipment ${signal.equipmentId} ` +
        `(prediction #${signal.predictionId}, probability: ${signal.failureProbability}) → conversation ${result.conversationId}`
    );

    return result;
  }

  async runWithAttachments(
    orgId: string,
    userId: string | undefined,
    conversationId: string | undefined,
    userMessage: string,
    attachments: FileAttachment[],
    userRole?: string
  ): Promise<AgentRunResult> {
    // Multimodal defaults to gpt-4o for vision support
    const ctx = await this.initRun(orgId, userId, conversationId, userMessage, userRole, "gpt-4o");

    const runStartTime = Date.now();
    await this.auditRunLifecycle("run_start", ctx.conversation.id, orgId, userId, {
      model: ctx.model,
      maxIterations: ctx.maxIterations,
      mode: "attachments",
    });

    // Build multipart content & register files / ingest to KB
    const { contentParts, displayContent, kbIngested } = await this.processAttachments(
      ctx.conversation.id,
      orgId,
      userId,
      ctx.sanitizedMessage,
      attachments
    );

    // Persist user message (with file descriptions)
    await this.persistUserMessage(ctx.conversation.id, displayContent);

    // Persist KB ingestion system message if any
    if (kbIngested.length > 0) {
      const systemContent = buildIngestionSystemMessage(kbIngested);
      await this.repo.messages.create({
        conversationId: ctx.conversation.id,
        role: "system",
        content: systemContent,
      });
    }

    // Build context
    const openaiMessages = await buildAgentMessages(this.repo, ctx);

    // Append file-reference context
    await appendAgentFileContext(ctx.conversation.id, orgId, openaiMessages);

    try {
      const result = await executeAgentLoop(
        { repo: this.repo, safety: this.safety },
        ctx,
        openaiMessages,
        {
          mode: "sync",
          contentParts,
        }
      );

      await this.completeRun(ctx, result, runStartTime, orgId, userId, "attachments");

      return {
        conversationId: ctx.conversation.id,
        toolCalls: result.toolCallTraces,
        finalResponse: result.finalResponse,
        toolCallCount: result.toolCallCount,
        totalTokens: result.totalTokens,
      };
    } catch (err) {
      await this.auditRunLifecycle("run_error", ctx.conversation.id, orgId, userId, {
        model: ctx.model,
        durationMs: Date.now() - runStartTime,
        mode: "attachments",
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  async runStream(
    orgId: string,
    userId: string | undefined,
    conversationId: string | undefined,
    userMessage: string,
    onChunk: (chunk: string) => void,
    userRole?: string
  ): Promise<AgentRunResult> {
    const ctx = await this.initRun(orgId, userId, conversationId, userMessage, userRole);

    const runStartTime = Date.now();
    await this.auditRunLifecycle("run_start", ctx.conversation.id, orgId, userId, {
      model: ctx.model,
      maxIterations: ctx.maxIterations,
      mode: "stream",
    });

    // Persist user message
    await this.persistUserMessage(ctx.conversation.id, ctx.sanitizedMessage);

    // Build context
    const openaiMessages = await buildAgentMessages(this.repo, ctx);

    try {
      const result = await executeAgentLoop(
        { repo: this.repo, safety: this.safety },
        ctx,
        openaiMessages,
        {
          mode: "stream",
          onChunk,
        }
      );

      // In stream mode the final response is persisted after the loop (not inside)
      await this.repo.messages.create({
        conversationId: ctx.conversation.id,
        role: "assistant",
        content: result.finalResponse,
        tokenCount: result.totalTokens,
        model: ctx.model,
      });
      await this.repo.conversations.incrementMessageCount(ctx.conversation.id, result.totalTokens);

      await this.completeRun(ctx, result, runStartTime, orgId, userId, "stream");

      onChunk(`${JSON.stringify({ type: "done", conversationId: ctx.conversation.id })}\n`);

      return {
        conversationId: ctx.conversation.id,
        toolCalls: result.toolCallTraces,
        finalResponse: result.finalResponse,
        toolCallCount: result.toolCallCount,
        totalTokens: result.totalTokens,
      };
    } catch (err) {
      await this.auditRunLifecycle("run_error", ctx.conversation.id, orgId, userId, {
        model: ctx.model,
        durationMs: Date.now() - runStartTime,
        mode: "stream",
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  // ===== SHARED INITIALISATION =====

  /**
   * Common set-up for every run variant: create OpenAI client, load config,
   * sanitise input, resolve or create conversation, check token budget.
   */
  private async initRun(
    orgId: string,
    userId: string | undefined,
    conversationId: string | undefined,
    userMessage: string,
    userRole?: string,
    modelOverride?: string
  ): Promise<RunContext> {
    const config = await this.repo.config.get(orgId);
    const model = modelOverride || config?.defaultModel || "gpt-4o-mini";
    const maxIterations = config?.maxIterationsPerRun || 10;
    const customPrompt = config?.customSystemPrompt;
    const sanitizedMessage = this.safety.sanitizeInput(userMessage);

    let conversation: AgentConversation;
    if (conversationId) {
      const existing = await this.repo.conversations.get(conversationId, orgId);
      if (!existing) {
        throw new Error("Conversation not found");
      }
      conversation = existing;
      const budgetCheck = await this.safety.checkTokenBudget(orgId, conversationId, config || {});
      if (!budgetCheck.allowed) {
        throw new Error(budgetCheck.reason);
      }
    } else {
      conversation = await this.repo.conversations.create({
        orgId,
        userId,
        title: sanitizedMessage.slice(0, 100),
        status: "active",
        metadata: {},
      });
    }

    const compactionCfg = getCompactionConfig(config, model);
    const enabledTools = config?.enabledTools as string[] | null;
    const toolContext: ToolContext = {
      orgId,
      userId,
      conversationId: conversation.id,
      userRole,
      knowledgeBase: this.knowledgeBase,
    };

    return {
      config,
      model,
      maxIterations,
      conversation,
      sanitizedMessage,
      compactionCfg,
      enabledTools,
      toolContext,
      customPrompt,
    };
  }

  // ===== POST-RUN CLEANUP =====

  /**
   * Shared post-loop work: update title, audit completion.
   */
  private async completeRun(
    ctx: RunContext,
    result: LoopResult,
    runStartTime: number,
    orgId: string,
    userId: string | undefined,
    mode?: string
  ): Promise<void> {
    // Auto-title
    if (!ctx.conversation.title || ctx.conversation.title === ctx.sanitizedMessage.slice(0, 100)) {
      const title =
        ctx.sanitizedMessage.length > 60
          ? `${ctx.sanitizedMessage.slice(0, 57)}...`
          : ctx.sanitizedMessage;
      await this.repo.conversations.update(ctx.conversation.id, { title });
    }

    await this.auditRunLifecycle("run_complete", ctx.conversation.id, orgId, userId, {
      model: ctx.model,
      totalTokens: result.totalTokens,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      toolCallCount: result.toolCallCount,
      durationMs: Date.now() - runStartTime,
      ...(mode ? { mode } : {}),
      toolsUsed: result.toolCallTraces.map((t) => t.toolName),
    });
  }

  // ===== ATTACHMENT PROCESSING =====

  private async processAttachments(
    conversationId: string,
    orgId: string,
    userId: string | undefined,
    sanitizedMessage: string,
    attachments: FileAttachment[]
  ): Promise<{
    contentParts: LLMContentPart[];
    displayContent: string;
    kbIngested: Array<{ filename: string; chunkCount: number }>;
  }> {
    return processAttachmentsHelper(
      conversationId,
      orgId,
      userId,
      sanitizedMessage,
      attachments,
      this.knowledgeBase
    );
  }

  // ===== HELPER: persist user message =====

  private async persistUserMessage(conversationId: string, content: string): Promise<void> {
    await this.repo.messages.create({ conversationId, role: "user", content });
    await this.repo.conversations.incrementMessageCount(conversationId, 0);
  }

  // ===== AUDIT =====

  private async auditRunLifecycle(
    action: "run_start" | "run_complete" | "run_error",
    conversationId: string,
    orgId: string,
    userId: string | undefined,
    details: Record<string, unknown>
  ) {
    try {
      await auditAction(
        "agent_run",
        conversationId,
        action === "run_start" ? "create" : "update",
        {
          lifecycle: action,
          ...details,
        },
        { orgId, userId }
      );
    } catch {
      // Non-critical
    }
  }

}
