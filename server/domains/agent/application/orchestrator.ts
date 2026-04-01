import OpenAI from "openai";
import fs from "fs";
import { createOpenAIClient } from "../../../openai/client";
import type { AgentRepositoryPort, KnowledgeBasePort } from "../domain/ports";
import type { AgentRunResult, AgentSignal, FileAttachment, ToolCallTrace } from "../domain/types";
import { DEFAULT_CONFIG } from "../domain/types";
import { getTool, getToolOpenAIDefinitions } from "../tools";
import type { ToolLoadingMode } from "../tools/registry";
import { SafetyService } from "./safety-service";
import { executeDraftAction } from "./draft-executor";
import { auditAction } from "../../../utils/audit-helpers";
import { registerFile, listConversationFiles } from "../infrastructure/file-registry";
import { ingestFilesToKB, buildIngestionSystemMessage } from "../infrastructure/kb-ingestion-helper";
import { buildSystemPrompt } from "../domain/system-prompt";
import {
  buildCompactedMessages,
  compactToolOutput,
  generateProgressiveSummary,
  shouldSummarize,
  type CompactionConfig,
} from "./context-compaction";
import type { AgentConversation, AgentMessage, AgentConfigType } from "@shared/schema";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ToolContext {
  orgId: string;
  userId: string | undefined;
  conversationId: string;
  userRole?: string;
  knowledgeBase?: KnowledgeBasePort;
}

/** Shared state produced by the common initialisation step. */
interface RunContext {
  client: OpenAI;
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
  contentParts?: OpenAI.Chat.Completions.ChatCompletionContentPart[];
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

  constructor(private repo: AgentRepositoryPort, knowledgeBase?: KnowledgeBasePort) {
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
    options?: { toolAllowlist?: string[] | null; maxTokenBudget?: number },
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
    const result = await this.run(
      signal.orgId,
      undefined,
      undefined,
      prompt,
      "admin",
      { maxTokenBudget: 4000 },
    );

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
      await auditAction("agent_signal", result.conversationId, "create", {
        lifecycle: "signal_triggered",
        triggerType: "prediction_signal",
        triggerId: String(signal.predictionId),
        signalType: signal.type,
        equipmentId: signal.equipmentId,
        failureProbability: signal.failureProbability,
        riskLevel: signal.riskLevel,
        modelId: signal.modelId ?? null,
        autoTriggered: true,
      }, { orgId: signal.orgId });
    } catch {
      // Non-critical
    }

    console.log(
      `[AgentOrchestrator] Signal processed: ${signal.type} for equipment ${signal.equipmentId} ` +
      `(prediction #${signal.predictionId}, probability: ${signal.failureProbability}) → conversation ${result.conversationId}`,
    );

    return result;
  }

  private buildSignalPrompt(signal: AgentSignal): string {
    const pct = (signal.failureProbability * 100).toFixed(0);
    const dateStr = signal.predictedFailureDate
      ? ` Predicted failure date: ${signal.predictedFailureDate}.`
      : "";
    return (
      `AUTOMATED SIGNAL: A high-risk failure prediction has been detected. ` +
      `Equipment ${signal.equipmentId} has a ${pct}% probability of ${signal.failureMode} failure ` +
      `(risk level: ${signal.riskLevel}).${dateStr} ` +
      `Please investigate this equipment, check its recent maintenance history, review any related alerts, ` +
      `and recommend immediate actions to prevent the predicted failure. ` +
      `If appropriate, draft a preventive maintenance work order.`
    );
  }

  async runWithAttachments(
    orgId: string,
    userId: string | undefined,
    conversationId: string | undefined,
    userMessage: string,
    attachments: FileAttachment[],
    userRole?: string,
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
      ctx.conversation.id, orgId, userId, ctx.sanitizedMessage, attachments,
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
    userRole?: string,
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

      onChunk(JSON.stringify({ type: "done", conversationId: ctx.conversation.id }) + "\n");

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
    modelOverride?: string,
  ): Promise<RunContext> {
    const client = await createOpenAIClient();
    if (!client) throw new Error("OpenAI is not configured. Please set up your API key.");

    const config = await this.repo.config.get(orgId);
    const model = modelOverride || config?.defaultModel || "gpt-4o-mini";
    const maxIterations = config?.maxIterationsPerRun || 10;
    const customPrompt = config?.customSystemPrompt;
    const sanitizedMessage = this.safety.sanitizeInput(userMessage);

    let conversation: AgentConversation;
    if (conversationId) {
      const existing = await this.repo.conversations.get(conversationId, orgId);
      if (!existing) throw new Error("Conversation not found");
      conversation = existing;
      const budgetCheck = await this.safety.checkTokenBudget(orgId, conversationId, config || {});
      if (!budgetCheck.allowed) throw new Error(budgetCheck.reason);
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
      client,
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
  private async buildContext(
    ctx: RunContext,
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const contextSummary = await this.maybeSummarize(
      ctx.client, ctx.conversation, ctx.compactionCfg, ctx.model,
    );

    const history = ctx.compactionCfg.enabled
      ? await this.repo.messages.listRecent(
          ctx.conversation.id,
          contextSummary
            ? Math.max(20, (ctx.conversation.messageCount || 50) - (ctx.conversation.summarizedUpTo || 0))
            : 100,
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
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): Promise<void> {
    const convFiles = await listConversationFiles(conversationId, orgId);
    if (convFiles.length === 0) return;

    const fileRefContext = convFiles
      .map(f => `- fileId: "${f.id}" | ${f.filename} (${f.mimetype}, ${f.size} bytes)`)
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
    openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    opts: LoopOptions,
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

      const response = await this.callOpenAI(ctx.client, ctx.model, openaiMessages, iterToolDefs);
      const choice = response.choices[0];
      const iterTokens = response.usage?.total_tokens || 0;
      totalTokens += iterTokens;
      promptTokens += response.usage?.prompt_tokens || 0;
      completionTokens += response.usage?.completion_tokens || 0;

      // --- Tool-call branch ---
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        for (const tc of choice.message.tool_calls) {
          activatedTools.add(tc.function.name);
        }

        const assistantMsg = await this.repo.messages.create({
          conversationId: ctx.conversation.id,
          role: "assistant",
          content: choice.message.content,
          toolCalls: choice.message.tool_calls,
          tokenCount: iterTokens,
          model: ctx.model,
        });
        await this.repo.conversations.incrementMessageCount(ctx.conversation.id, iterTokens);

        openaiMessages.push({
          role: "assistant",
          content: choice.message.content,
          tool_calls: choice.message.tool_calls,
        });

        for (const tc of choice.message.tool_calls) {
          const parsedInput = this.parseJson(tc.function.arguments);

          if (mode === "stream" && onChunk) {
            onChunk(JSON.stringify({ type: "tool_call", toolName: tc.function.name, input: parsedInput }) + "\n");
          }

          const { toolResult, toolStatus, toolError, durationMs } = await this.executeTool(
            tc, ctx.toolContext, ctx.toolContext.orgId, ctx.toolContext.userId,
            ctx.conversation.id, ctx.config, runtimeAllowlist ?? ctx.enabledTools,
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
            this.expandActivatedToolsFromDiscovery(toolResult, activatedTools, parsedInput, ctx.enabledTools);
          }

          if (mode === "stream" && onChunk) {
            onChunk(JSON.stringify({ type: "tool_result", toolName: tc.function.name, result: toolResult }) + "\n");
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

          openaiMessages.push({ role: "tool", tool_call_id: tc.id, content: compactedContent });
        }

        // Refresh tool definitions after activating new tools
        toolDefs = getToolOpenAIDefinitions(ctx.enabledTools, {
          mode: toolLoadingMode,
          activatedTools: [...activatedTools],
        });
        continue;
      }

      // --- Text response branch ---
      finalResponse = choice.message.content || "";

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
          onChunk(JSON.stringify({ type: "text", content: finalResponse }) + "\n");
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

    return { finalResponse, toolCallTraces, totalTokens, promptTokens, completionTokens, toolCallCount };
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
    mode?: string,
  ): Promise<void> {
    // Auto-title
    if (!ctx.conversation.title || ctx.conversation.title === ctx.sanitizedMessage.slice(0, 100)) {
      const title = ctx.sanitizedMessage.length > 60
        ? ctx.sanitizedMessage.slice(0, 57) + "..."
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
      toolsUsed: result.toolCallTraces.map(t => t.toolName),
    });
  }

  // ===== ATTACHMENT PROCESSING =====

  private async processAttachments(
    conversationId: string,
    orgId: string,
    userId: string | undefined,
    sanitizedMessage: string,
    attachments: FileAttachment[],
  ): Promise<{
    contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[];
    displayContent: string;
    kbIngested: Array<{ filename: string; chunkCount: number }>;
  }> {
    const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: sanitizedMessage },
    ];
    const fileDescriptions: string[] = [];

    for (const att of attachments) {
      if (att.mimetype.startsWith("image/")) {
        const base64 = fs.readFileSync(att.path, "base64");
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:${att.mimetype};base64,${base64}`, detail: "auto" },
        });
        fileDescriptions.push(`[Image: ${att.filename}]`);
      } else if (att.mimetype === "application/pdf") {
        try {
          const pdfBuffer = fs.readFileSync(att.path);
          const pdfParse = (await import("pdf-parse")).default;
          const pdfData = await pdfParse(pdfBuffer);
          const text = pdfData.text.slice(0, 12000);
          contentParts.push({
            type: "text",
            text: `\n\n--- PDF: ${att.filename} (${pdfData.numpages} pages) ---\n${text}\n--- End of PDF ---`,
          });
          fileDescriptions.push(`[PDF: ${att.filename}, ${pdfData.numpages} pages]`);
        } catch (err) {
          console.warn(`[Agent] Failed to parse PDF ${att.filename}:`, err instanceof Error ? err.message : "unknown");
          fileDescriptions.push(`[PDF: ${att.filename} (could not extract text)]`);
        }
      } else if (att.mimetype === "text/csv" || att.filename.endsWith(".csv")) {
        try {
          const csvText = fs.readFileSync(att.path, "utf-8");
          const Papa = (await import("papaparse")).default;
          const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
          const rows = parsed.data as Record<string, unknown>[];
          const headers = parsed.meta.fields || [];
          const rowCount = rows.length;

          const numericCols = headers.filter(h => rows.some(r => typeof r[h] === "number"));
          const stats: string[] = [`Rows: ${rowCount}`, `Columns: ${headers.join(", ")}`];
          for (const col of numericCols.slice(0, 10)) {
            const vals = rows.map(r => r[col]).filter((v): v is number => typeof v === "number");
            if (vals.length > 0) {
              const min = Math.min(...vals);
              const max = Math.max(...vals);
              const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
              stats.push(`  ${col}: min=${min}, max=${max}, avg=${avg.toFixed(2)}, count=${vals.length}`);
            }
          }

          const preview = csvText.split("\n").slice(0, 21).join("\n");
          contentParts.push({
            type: "text",
            text: `\n\n--- CSV: ${att.filename} ---\nSummary:\n${stats.join("\n")}\n\nFirst 20 rows:\n${preview}\n--- End of CSV ---`,
          });
          fileDescriptions.push(`[CSV: ${att.filename}, ${rowCount} rows]`);
        } catch (err) {
          console.warn(`[Agent] Failed to parse CSV ${att.filename}:`, err instanceof Error ? err.message : "unknown");
          const fallback = fs.readFileSync(att.path, "utf-8").slice(0, 10000);
          contentParts.push({
            type: "text",
            text: `\n\n--- Attached file: ${att.filename} ---\n${fallback}\n--- End of file ---`,
          });
          fileDescriptions.push(`[File: ${att.filename}]`);
        }
      } else {
        try {
          const textContent = fs.readFileSync(att.path, "utf-8").slice(0, 10000);
          contentParts.push({
            type: "text",
            text: `\n\n--- Attached file: ${att.filename} ---\n${textContent}\n--- End of file ---`,
          });
          fileDescriptions.push(`[File: ${att.filename}]`);
        } catch (err) {
          console.warn(`[Agent] Failed to read attachment ${att.filename}:`, err instanceof Error ? err.message : "unknown");
          fileDescriptions.push(`[File: ${att.filename} (could not read)]`);
        }
      }
    }

    // Register files in DB
    for (const att of attachments) {
      await registerFile(orgId, conversationId, {
        originalname: att.filename,
        mimetype: att.mimetype,
        size: att.size,
        path: att.path,
      });
    }

    // Ingest document-type files into KB
    const kbIngested: Array<{ filename: string; chunkCount: number }> = [];
    if (this.knowledgeBase) {
      const results = await ingestFilesToKB(
        this.knowledgeBase,
        orgId,
        attachments.map(att => ({ path: att.path, filename: att.filename, mimetype: att.mimetype })),
        userId,
      );
      for (const r of results) {
        kbIngested.push(r);
        fileDescriptions.push(`[KB: "${r.filename}" ingested — ${r.chunkCount} chunks indexed]`);
      }
    }

    // Append available-files context from DB to content parts
    const convFiles = await listConversationFiles(conversationId, orgId);
    if (convFiles.length > 0) {
      const fileRefContext = convFiles
        .map(f => `- fileId: "${f.id}" | ${f.filename} (${f.mimetype}, ${f.size} bytes)`)
        .join("\n");
      contentParts.push({
        type: "text",
        text: `\n\n--- Available files for this conversation ---\n${fileRefContext}\nYou can use analyzeImage or analyzeSpreadsheet tools with these fileIds.\n--- End of file list ---`,
      });
    }

    const displayContent = `${sanitizedMessage}${fileDescriptions.length > 0 ? "\n" + fileDescriptions.join(" ") : ""}`;

    return { contentParts, displayContent, kbIngested };
  }

  // ===== HELPER: persist user message =====

  private async persistUserMessage(conversationId: string, content: string): Promise<void> {
    await this.repo.messages.create({ conversationId, role: "user", content });
    await this.repo.conversations.incrementMessageCount(conversationId, 0);
  }

  // ===== CONFIG HELPERS =====

  private getCompactionConfig(config: AgentConfigType | null | undefined, model: string): CompactionConfig {
    return {
      enabled: config?.contextCompaction ?? DEFAULT_CONFIG.contextCompaction,
      threshold: config?.compactionThreshold ?? DEFAULT_CONFIG.compactionThreshold,
      model,
      toolOutputCharLimit: config?.toolOutputCharLimit ?? DEFAULT_CONFIG.toolOutputCharLimit,
    };
  }

  private isDeferredToolLoadingEnabled(config: AgentConfigType | null | undefined): boolean {
    return config?.deferredToolLoading ?? true;
  }

  private getActivatedToolsFromMetadata(conversation: AgentConversation): string[] {
    const meta = conversation.metadata as Record<string, unknown> | null;
    if (meta && Array.isArray(meta.activatedTools)) {
      return meta.activatedTools as string[];
    }
    return [];
  }

  private async persistActivatedTools(conversation: AgentConversation, activatedTools: string[]): Promise<void> {
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
    enabledTools?: string[] | null,
  ): void {
    const categories = toolResult.categories as Record<string, { name: string }[]> | undefined;
    if (!categories) return;

    const enabledSet = Array.isArray(enabledTools) && enabledTools.length > 0 ? new Set(enabledTools) : null;
    const requestedCategory = input.category as string | undefined;
    for (const [cat, tools] of Object.entries(categories)) {
      if (requestedCategory && cat !== requestedCategory) continue;
      for (const t of tools) {
        if (!t.name) continue;
        if (enabledSet && !enabledSet.has(t.name)) continue;
        activatedTools.add(t.name);
      }
    }

    if (enabledSet) {
      const filtered: Record<string, { name: string }[]> = {};
      for (const [cat, tools] of Object.entries(categories)) {
        const allowed = tools.filter(t => enabledSet.has(t.name));
        if (allowed.length > 0) filtered[cat] = allowed;
      }
      toolResult.categories = filtered;
      toolResult.totalTools = Object.values(filtered).reduce((sum, arr) => sum + arr.length, 0);
    }
  }

  private looksLikeFallbackNeeded(response: string): boolean {
    if (!response) return true;
    const lower = response.toLowerCase();
    const refusalPhrases = [
      "i can't", "i cannot", "i don't have", "i'm unable", "i am unable",
      "i'm not able", "i am not able", "i don't have access", "no tools",
      "outside my capabilities", "beyond my capabilities",
      "don't have the ability", "not equipped", "no way to",
    ];
    if (refusalPhrases.some(p => lower.includes(p))) return true;
    if (response.length < 40 && /\?/.test(response)) return true;
    return false;
  }

  // ===== CONTEXT COMPACTION =====

  private async maybeSummarize(
    client: OpenAI,
    conversation: AgentConversation,
    compactionCfg: CompactionConfig,
    _model: string,
  ): Promise<string | null | undefined> {
    if (!compactionCfg.enabled) return conversation.contextSummary;

    const summarizedUpTo = conversation.summarizedUpTo || 0;
    if (!shouldSummarize(conversation.messageCount, summarizedUpTo, compactionCfg.threshold)) {
      return conversation.contextSummary;
    }

    const allMessages = await this.repo.messages.list(conversation.id, 10000);
    const keepRecent = 10;
    const messagesToSummarize = allMessages.slice(
      summarizedUpTo,
      Math.max(summarizedUpTo, allMessages.length - keepRecent),
    );

    if (messagesToSummarize.length < 5) return conversation.contextSummary;

    const summary = await generateProgressiveSummary(client, messagesToSummarize, conversation.contextSummary);
    if (!summary) return conversation.contextSummary;

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
    details: Record<string, unknown>,
  ) {
    try {
      await auditAction("agent_run", conversationId, action === "run_start" ? "create" : "update", {
        lifecycle: action,
        ...details,
      }, { orgId, userId });
    } catch {
      // Non-critical
    }
  }

  // ===== TOOL EXECUTION =====

  private async executeTool(
    tc: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
    toolContext: ToolContext,
    orgId: string,
    userId: string | undefined,
    conversationId: string,
    config: AgentConfigType | null | undefined,
    runtimeAllowedTools?: string[] | null,
  ) {
    const toolName = tc.function.name;
    const toolInput = this.parseJson(tc.function.arguments);
    const startTime = Date.now();
    let toolResult: Record<string, unknown> = {};
    let toolStatus = "success";
    let toolError: string | undefined;

    if (runtimeAllowedTools && toolName !== "listAvailableTools" && !runtimeAllowedTools.includes(toolName)) {
      return {
        toolResult: { error: `Tool ${toolName} is not in the schedule allowlist` },
        toolStatus: "error",
        toolError: "Schedule allowlist denied",
        durationMs: 0,
      };
    }

    const enabledTools = config?.enabledTools as string[] | null | undefined;
    if (enabledTools && toolName !== "listAvailableTools" && !this.safety.validateToolAccess(toolName, enabledTools)) {
      return {
        toolResult: { error: `Tool ${toolName} is disabled` },
        toolStatus: "error",
        toolError: "Tool disabled",
        durationMs: 0,
      };
    }

    const userRole = toolContext.userRole;
    if (!this.safety.checkWriteToolAccess(toolName, userRole)) {
      return {
        toolResult: { error: `Insufficient permissions: ${toolName} requires a maintenance role (chief engineer, captain, or admin)` },
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
        const errMsg = `Invalid input for ${toolName}: ${validation.error.issues.map(i => i.message).join(", ")}`;
        return { toolResult: { error: errMsg }, toolStatus: "error", toolError: errMsg, durationMs: 0 };
      }
    }

    try {
      toolResult = await tool.execute(toolInput, toolContext);

      if (tool.requiresApproval && (toolResult as Record<string, unknown>).requiresApproval) {
        toolResult = await this.handleDraftApproval(
          tool, toolResult, config, userRole, orgId, userId, conversationId,
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Tool execution failed";
      toolResult = { error: errMsg };
      toolStatus = "error";
      toolError = errMsg;
    }

    const durationMs = Date.now() - startTime;

    auditAction("agent_tool_call", conversationId, "create", {
      toolName,
      status: toolStatus,
      durationMs,
      error: toolError,
    }, { orgId, userId }).catch((err) => {
      console.warn("[Agent] Audit logging failed for tool call:", err instanceof Error ? err.message : "unknown");
    });

    return { toolResult, toolStatus, toolError, durationMs };
  }

  /**
   * Extracted draft-approval logic formerly inlined in executeTool.
   */
  private async handleDraftApproval(
    tool: import("../domain/types").ToolDefinition,
    toolResult: Record<string, unknown>,
    config: AgentConfigType | null | undefined,
    userRole: string | undefined,
    orgId: string,
    userId: string | undefined,
    conversationId: string,
  ): Promise<Record<string, unknown>> {
    const permissionTier = ((config?.permissionTier as string) || "strict") as import("../domain/types").PermissionTier;
    const autoApprove = this.safety.shouldAutoApprove(tool.riskLevel, permissionTier, userRole);

    const resultData = toolResult;
    const data = resultData.data as Record<string, unknown>;
    const draftType = resultData.draftType as string;

    if (autoApprove) {
      const execResult = await executeDraftAction(draftType, data, orgId);

      if (execResult.error) {
        const fallbackDraft = await this.repo.drafts.create({
          orgId,
          conversationId,
          draftType,
          title: (data?.title as string) || tool.name,
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

      const draft = await this.repo.drafts.create({
        orgId,
        conversationId,
        draftType,
        title: (data?.title as string) || tool.name,
        data,
        status: "approved",
        createdById: userId,
      });
      await this.repo.drafts.update(draft.id, {
        reviewedById: userId,
        reviewNote: `Auto-approved (tier: ${permissionTier}, risk: ${tool.riskLevel})`,
        ...(execResult.resultId ? { resultId: execResult.resultId } : {}),
      });
      await this.repo.approvals.create({
        orgId,
        draftId: draft.id,
        conversationId,
        action: "approved",
        reviewedById: userId,
        reviewNote: `Auto-approved (tier: ${permissionTier}, risk: ${tool.riskLevel})`,
        resultId: execResult.resultId,
      });
      auditAction("agent_draft", draft.id, "update", {
        action: "auto_approved",
        draftType,
        permissionTier,
        riskLevel: tool.riskLevel,
        approvalMode: "auto",
        resultId: execResult.resultId,
      }, { orgId, userId });
      return {
        ...toolResult,
        draftId: draft.id,
        resultId: execResult.resultId,
        autoApproved: true,
        approvalMode: "auto",
      };
    }

    // Manual approval path
    const draft = await this.repo.drafts.create({
      orgId,
      conversationId,
      draftType,
      title: (data?.title as string) || tool.name,
      data,
      status: "pending",
      createdById: userId,
    });
    return { ...toolResult, draftId: draft.id };
  }

  // ===== OPENAI CALL WITH RETRY =====

  private async callOpenAI(
    client: OpenAI,
    model: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    toolDefs?: ReturnType<typeof getToolOpenAIDefinitions>,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await client.chat.completions.create({
          model,
          messages,
          tools: toolDefs && toolDefs.length > 0 ? toolDefs : undefined,
          temperature: 0.3,
          max_tokens: 4096,
        });
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error("OpenAI call failed");
        const statusCode = (err as { status?: number })?.status || 0;
        const errorCode = (err as { code?: string })?.code || "";
        const isRetryable =
          statusCode === 429 || statusCode === 500 || statusCode === 503 || statusCode === 502 ||
          errorCode === "ECONNRESET" || errorCode === "ETIMEDOUT" || errorCode === "ENOTFOUND" ||
          lastError.message.includes("timeout") || lastError.message.includes("network");

        if (!isRetryable || attempt === maxRetries) break;

        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        console.warn(`[Agent] OpenAI attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    throw new Error(
      `AI service is temporarily unavailable. Please try again in a moment. (${lastError?.message || "unknown error"})`,
    );
  }

  // ===== UTILITIES =====

  private parseJson(str: string): Record<string, unknown> {
    try {
      return JSON.parse(str) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
