import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Application:Orchestrator");
import type {
  LLMChatResponse,
  LLMContentPart,
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
} from "../../../lib/llm-gateway/types";
import type { AgentRepositoryPort, KnowledgeBasePort } from "../domain/ports";
import type { AgentRunResult, AgentSignal, FileAttachment, ToolCallTrace } from "../domain/types";
import { getToolOpenAIDefinitions } from "../tools";
import type { ToolLoadingMode } from "../tools/registry";
import { SafetyService } from "./safety-service";
import { auditAction } from "../../../utils/audit-helpers";
import { listConversationFiles } from "../infrastructure/file-registry";
import { buildIngestionSystemMessage } from "../infrastructure/kb-ingestion-helper";
import {
  buildCompactedMessages,
  compactToolOutput,
  generateProgressiveSummary,
  shouldSummarize,
  type CompactionConfig,
} from "./context-compaction";
import type { AgentConversation, AgentConfigType } from "@shared/schema";

import { callLLMWithRetry, parseToolArgs } from "./orchestrator-helpers/openai-client";
import { processAttachments as processAttachmentsHelper } from "./orchestrator-helpers/attachment-processor";
import {
  executeTool as executeToolHelper,
  type ToolContext,
} from "./orchestrator-helpers/tool-execution";
import {
  buildSignalPrompt,
  expandActivatedToolsFromDiscovery,
  getActivatedToolsFromMetadata,
  getCompactionConfig,
  isDeferredToolLoadingEnabled,
  looksLikeFallbackNeeded,
} from "./orchestrator-helpers/loop-helpers";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Shared state produced by the common initialisation step. */
interface RunContext {
  config: AgentConfigType | null | undefined;
  model: string;
  maxIterations: number;
  conversation: AgentConversation;
  sanitizedMessage: string;
  compactionCfg: CompactionConfig;
  enabledTools: string[] | null;
  toolContext: ToolContext;
  customPrompt: string | null | undefined;
}

/** Options that customise the shared iteration loop. */
interface LoopOptions {
  /** 'sync' = buffer response; 'stream' = push chunks via onChunk. */
  mode: "sync" | "stream";
  onChunk?: (chunk: string) => void;
  maxTokenBudget?: number;
  /** Runtime tool allowlist (schedules). Null = no extra restriction. */
  runtimeAllowlist?: string[] | null;
  /**
   * For multimodal: if set, the last user message in `openaiMessages` is
   * replaced with these content parts before the first API call.
   */
  contentParts?: LLMContentPart[];
}

/** Counters & traces returned by the iteration loop. */
interface LoopResult {
  finalResponse: string;
  toolCallTraces: ToolCallTrace[];
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  toolCallCount: number;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class AgentOrchestrator {
  private safety: SafetyService;
  private knowledgeBase?: KnowledgeBasePort;

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
    const openaiMessages = await this.buildContext(ctx);

    // Append file-reference context for previously uploaded files
    await this.appendFileContext(ctx.conversation.id, orgId, openaiMessages);

    try {
      const result = await this.executeLoop(ctx, openaiMessages, {
        mode: "sync",
        maxTokenBudget: options?.maxTokenBudget,
        runtimeAllowlist: options?.toolAllowlist,
      });

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
    const prompt = this.buildSignalPrompt(signal);
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

    logger.info(`[AgentOrchestrator] Signal processed: ${signal.type} for equipment ${signal.equipmentId} ` +
        `(prediction #${signal.predictionId}, probability: ${signal.failureProbability}) → conversation ${result.conversationId}`);

    return result;
  }

  private buildSignalPrompt(signal: AgentSignal): string {
    return buildSignalPrompt(signal);
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
    const openaiMessages = await this.buildContext(ctx);

    // Append file-reference context
    await this.appendFileContext(ctx.conversation.id, orgId, openaiMessages);

    try {
      const result = await this.executeLoop(ctx, openaiMessages, {
        mode: "sync",
        contentParts,
      });

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
    const openaiMessages = await this.buildContext(ctx);

    try {
      const result = await this.executeLoop(ctx, openaiMessages, {
        mode: "stream",
        onChunk,
      });

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

    const compactionCfg = this.getCompactionConfig(config, model);
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

  // ===== CONTEXT BUILDING =====

  /**
   * Load history, apply compaction, and produce the OpenAI message array.
   */
  private async buildContext(ctx: RunContext): Promise<LLMMessage[]> {
    const contextSummary = await this.maybeSummarize(
      ctx.conversation,
      ctx.compactionCfg,
      ctx.model
    );

    const history = ctx.compactionCfg.enabled
      ? await this.repo.messages.listRecent(
          ctx.conversation.id,
          contextSummary
            ? Math.max(
                20,
                (ctx.conversation.messageCount || 50) - (ctx.conversation.summarizedUpTo || 0)
              )
            : 100
        )
      : await this.repo.messages.list(ctx.conversation.id, 50);

    return buildCompactedMessages(history, ctx.customPrompt, contextSummary, ctx.compactionCfg);
  }

  /**
   * Append a system message listing files already attached to this conversation.
   */
  private async appendFileContext(
    conversationId: string,
    orgId: string,
    messages: LLMMessage[]
  ): Promise<void> {
    const convFiles = await listConversationFiles(conversationId, orgId);
    if (convFiles.length === 0) {
      return;
    }

    const fileRefContext = convFiles
      .map((f) => `- fileId: "${f.id}" | ${f.filename} (${f.mimetype}, ${f.size} bytes)`)
      .join("\n");

    messages.push({
      role: "system" as const,
      content: `Available files for this conversation:\n${fileRefContext}\nUse analyzeImage or analyzeSpreadsheet tools with these fileIds when relevant.`,
    });
  }

  // ===== UNIFIED ITERATION LOOP =====

  /**
   * Single iteration loop used by all three public methods.
   *
   * Differences between modes:
   * - `sync`:   persists the final assistant message inside the loop and breaks.
   * - `stream`: emits chunks via `onChunk`, does NOT persist the final message
   *             (caller is responsible for persisting after the loop).
   */
  private async executeLoop(
    ctx: RunContext,
    openaiMessages: LLMMessage[],
    opts: LoopOptions
  ): Promise<LoopResult> {
    const { mode, onChunk, maxTokenBudget, runtimeAllowlist, contentParts } = opts;

    // --- Deferred tool loading state ---
    const deferredEnabled = this.isDeferredToolLoadingEnabled(ctx.config);
    const previouslyActivated = this.getActivatedToolsFromMetadata(ctx.conversation);
    const activatedTools = new Set<string>(previouslyActivated);
    let toolLoadingMode: ToolLoadingMode = deferredEnabled ? "light" : "full";
    let didFallback = false;

    let toolDefs = getToolOpenAIDefinitions(ctx.enabledTools, {
      mode: toolLoadingMode,
      activatedTools: [...activatedTools],
    });

    // --- Replace last user message with multipart content if provided ---
    if (contentParts) {
      for (let i = openaiMessages.length - 1; i >= 0; i--) {
        if (openaiMessages[i].role === "user") {
          openaiMessages[i] = { role: "user", content: contentParts };
          break;
        }
      }
    }

    // --- Counters ---
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let toolCallCount = 0;
    let finalResponse = "";
    const toolCallTraces: ToolCallTrace[] = [];

    for (let iteration = 0; iteration < ctx.maxIterations; iteration++) {
      // Token budget gate
      if (maxTokenBudget && totalTokens >= maxTokenBudget) {
        finalResponse = `[Token budget exceeded: ${totalTokens}/${maxTokenBudget} tokens used. Stopping early.]`;
        break;
      }

      // In stream mode the last iteration drops tools to guarantee a text reply
      const isLastChance = mode === "stream" && iteration === ctx.maxIterations - 1;
      const iterToolDefs = isLastChance ? undefined : toolDefs;

      const response = await this.callLLM(ctx.model, openaiMessages, iterToolDefs, {
        conversationId: ctx.conversation.id,
        orgId: ctx.toolContext.orgId,
      });
      const iterTokens = response.usage.totalTokens;
      totalTokens += iterTokens;
      promptTokens += response.usage.promptTokens;
      completionTokens += response.usage.completionTokens;

      // --- Tool-call branch ---
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolCalls = response.toolCalls;
        for (const tc of toolCalls) {
          activatedTools.add(tc.function.name);
        }

        const assistantMsg = await this.repo.messages.create({
          conversationId: ctx.conversation.id,
          role: "assistant",
          content: response.content,
          // Persisted in OpenAI wire shape ({id,type,function:{name,arguments}})
          // — same as LLMToolCall. activity-repository-adapter and
          // context-compaction reader both expect this shape.
          toolCalls,
          tokenCount: iterTokens,
          model: ctx.model,
        });
        await this.repo.conversations.incrementMessageCount(ctx.conversation.id, iterTokens);

        openaiMessages.push({
          role: "assistant",
          content: response.content,
          toolCalls,
        });

        for (const tc of toolCalls) {
          const parsedInput = this.parseJson(tc.function.arguments);

          if (mode === "stream" && onChunk) {
            onChunk(
              `${JSON.stringify({ type: "tool_call", toolName: tc.function.name, input: parsedInput })}\n`
            );
          }

          const { toolResult, toolStatus, toolError, durationMs } = await this.executeTool(
            tc,
            ctx.toolContext,
            ctx.toolContext.orgId,
            ctx.toolContext.userId,
            ctx.conversation.id,
            ctx.config,
            runtimeAllowlist ?? ctx.enabledTools
          );
          toolCallCount++;

          toolCallTraces.push({
            toolName: tc.function.name,
            input: parsedInput,
            output: toolResult,
            status: toolStatus,
            durationMs,
            error: toolError,
          });

          await this.repo.toolCalls.create({
            conversationId: ctx.conversation.id,
            messageId: assistantMsg.id,
            toolName: tc.function.name,
            input: parsedInput,
            output: toolResult,
            status: toolStatus,
            durationMs,
            error: toolError,
          });

          // Expand activated tools from discovery
          if (toolLoadingMode === "light" && tc.function.name === "listAvailableTools") {
            this.expandActivatedToolsFromDiscovery(
              toolResult,
              activatedTools,
              parsedInput,
              ctx.enabledTools
            );
          }

          if (mode === "stream" && onChunk) {
            onChunk(
              `${JSON.stringify({ type: "tool_result", toolName: tc.function.name, result: toolResult })}\n`
            );
          }

          const toolMsgContent = JSON.stringify(toolResult);
          await this.repo.messages.create({
            conversationId: ctx.conversation.id,
            role: "tool",
            content: toolMsgContent,
            toolCalls: { toolCallId: tc.id },
          });
          await this.repo.conversations.incrementMessageCount(ctx.conversation.id, 0);

          const compactedContent = ctx.compactionCfg.enabled
            ? compactToolOutput(toolMsgContent, ctx.compactionCfg.toolOutputCharLimit)
            : toolMsgContent;

          openaiMessages.push({ role: "tool", toolCallId: tc.id, content: compactedContent });
        }

        // Refresh tool definitions after activating new tools
        toolDefs = getToolOpenAIDefinitions(ctx.enabledTools, {
          mode: toolLoadingMode,
          activatedTools: [...activatedTools],
        });
        continue;
      }

      // --- Text response branch ---
      finalResponse = response.content || "";

      // Deferred-loading fallback: if the model refused on its first try with
      // a lightweight tool set, retry with the full set.
      if (
        toolLoadingMode === "light" &&
        !didFallback &&
        iteration === 0 &&
        this.looksLikeFallbackNeeded(finalResponse)
      ) {
        toolLoadingMode = "full";
        toolDefs = getToolOpenAIDefinitions(ctx.enabledTools, { mode: "full" });
        didFallback = true;
        continue;
      }

      if (mode === "stream") {
        // Stream mode: emit the text and break; caller persists
        if (onChunk) {
          onChunk(`${JSON.stringify({ type: "text", content: finalResponse })}\n`);
        }
      } else {
        // Sync mode: persist inside the loop
        await this.repo.messages.create({
          conversationId: ctx.conversation.id,
          role: "assistant",
          content: finalResponse,
          tokenCount: iterTokens,
          model: ctx.model,
        });
        await this.repo.conversations.incrementMessageCount(ctx.conversation.id, iterTokens);
      }
      break;
    }

    // Persist activated tools
    if (activatedTools.size > 0) {
      await this.persistActivatedTools(ctx.conversation, [...activatedTools]);
    }

    return {
      finalResponse,
      toolCallTraces,
      totalTokens,
      promptTokens,
      completionTokens,
      toolCallCount,
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

  // ===== CONFIG HELPERS (delegated to ./orchestrator-helpers/loop-helpers.ts) =====

  private getCompactionConfig(
    config: AgentConfigType | null | undefined,
    model: string
  ): CompactionConfig {
    return getCompactionConfig(config, model);
  }

  private isDeferredToolLoadingEnabled(config: AgentConfigType | null | undefined): boolean {
    return isDeferredToolLoadingEnabled(config);
  }

  private getActivatedToolsFromMetadata(conversation: AgentConversation): string[] {
    return getActivatedToolsFromMetadata(conversation);
  }

  private async persistActivatedTools(
    conversation: AgentConversation,
    activatedTools: string[]
  ): Promise<void> {
    try {
      const meta = (conversation.metadata as Record<string, unknown>) || {};
      const existing = Array.isArray(meta.activatedTools) ? (meta.activatedTools as string[]) : [];
      const merged = [...new Set([...existing, ...activatedTools])];
      await this.repo.conversations.update(conversation.id, {
        metadata: { ...meta, activatedTools: merged },
      } as Partial<AgentConversation>);
    } catch {
      // Non-critical — swallow
    }
  }

  private expandActivatedToolsFromDiscovery(
    toolResult: Record<string, unknown>,
    activatedTools: Set<string>,
    input: Record<string, unknown>,
    enabledTools?: string[] | null
  ): void {
    expandActivatedToolsFromDiscovery(toolResult, activatedTools, input, enabledTools);
  }

  private looksLikeFallbackNeeded(response: string): boolean {
    return looksLikeFallbackNeeded(response);
  }

  // ===== CONTEXT COMPACTION =====

  private async maybeSummarize(
    conversation: AgentConversation,
    compactionCfg: CompactionConfig,
    _model: string
  ): Promise<string | null | undefined> {
    if (!compactionCfg.enabled) {
      return conversation.contextSummary;
    }

    const summarizedUpTo = conversation.summarizedUpTo || 0;
    if (!shouldSummarize(conversation.messageCount, summarizedUpTo, compactionCfg.threshold)) {
      return conversation.contextSummary;
    }

    const allMessages = await this.repo.messages.list(conversation.id, 10000);
    const keepRecent = 10;
    const messagesToSummarize = allMessages.slice(
      summarizedUpTo,
      Math.max(summarizedUpTo, allMessages.length - keepRecent)
    );

    if (messagesToSummarize.length < 5) {
      return conversation.contextSummary;
    }

    const summary = await generateProgressiveSummary(
      messagesToSummarize,
      conversation.contextSummary
    );
    if (!summary) {
      return conversation.contextSummary;
    }

    const newSummarizedUpTo = Math.max(0, allMessages.length - keepRecent);
    await this.repo.conversations.update(conversation.id, {
      contextSummary: summary,
      summarizedUpTo: newSummarizedUpTo,
    } as Partial<AgentConversation>);

    conversation.summarizedUpTo = newSummarizedUpTo;
    return summary;
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

  // ===== TOOL EXECUTION (delegated to ./orchestrator-helpers/tool-execution.ts) =====

  private async executeTool(
    tc: LLMToolCall,
    toolContext: ToolContext,
    orgId: string,
    userId: string | undefined,
    conversationId: string,
    config: AgentConfigType | null | undefined,
    runtimeAllowedTools?: string[] | null
  ) {
    return executeToolHelper(
      { repo: this.repo, safety: this.safety },
      tc,
      toolContext,
      orgId,
      userId,
      conversationId,
      config,
      runtimeAllowedTools
    );
  }

  // ===== LLM CALL (delegated to ./orchestrator-helpers/openai-client.ts) =====

  private async callLLM(
    model: string,
    messages: LLMMessage[],
    toolDefs?: LLMToolDefinition[],
    meta?: Record<string, unknown>
  ): Promise<LLMChatResponse> {
    return callLLMWithRetry(model, messages, toolDefs, meta);
  }

  // ===== UTILITIES =====

  private parseJson(str: string): Record<string, unknown> {
    return parseToolArgs(str);
  }
}
