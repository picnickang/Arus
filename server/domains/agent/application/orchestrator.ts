import OpenAI from "openai";
import fs from "fs";
import { createOpenAIClient } from "../../../openai/client";
import type { AgentRepositoryPort, KnowledgeBasePort } from "../domain/ports";
import type { AgentRunResult, FileAttachment, ToolCallTrace } from "../domain/types";
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

interface StoredToolCallRef {
  toolCallId: string;
}

interface ToolContext {
  orgId: string;
  userId: string | undefined;
  conversationId: string;
  userRole?: string;
  knowledgeBase?: KnowledgeBasePort;
}

export class AgentOrchestrator {
  private safety: SafetyService;
  private knowledgeBase?: KnowledgeBasePort;

  constructor(private repo: AgentRepositoryPort, knowledgeBase?: KnowledgeBasePort) {
    this.safety = new SafetyService(repo);
    this.knowledgeBase = knowledgeBase;
  }

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
    const lowerResp = response.toLowerCase();
    const refusalPhrases = [
      "i can't", "i cannot", "i don't have", "i'm unable", "i am unable",
      "i'm not able", "i am not able", "i don't have access", "no tools",
      "outside my capabilities", "beyond my capabilities",
      "don't have the ability", "not equipped", "no way to",
    ];
    if (refusalPhrases.some(p => lowerResp.includes(p))) return true;
    if (response.length < 40 && /\?/.test(response)) return true;
    return false;
  }

  private async maybeSummarize(
    client: OpenAI,
    conversation: AgentConversation,
    compactionCfg: CompactionConfig,
    model: string,
  ): Promise<string | null | undefined> {
    if (!compactionCfg.enabled) return conversation.contextSummary;

    const summarizedUpTo = conversation.summarizedUpTo || 0;
    if (!shouldSummarize(conversation.messageCount, summarizedUpTo, compactionCfg.threshold)) {
      return conversation.contextSummary;
    }

    const allMessages = await this.repo.messages.list(conversation.id, 10000);
    const keepRecent = 10;
    const messagesToSummarize = allMessages.slice(summarizedUpTo, Math.max(summarizedUpTo, allMessages.length - keepRecent));

    if (messagesToSummarize.length < 5) return conversation.contextSummary;

    const summary = await generateProgressiveSummary(
      client, messagesToSummarize, conversation.contextSummary,
    );
    if (!summary) return conversation.contextSummary;

    const newSummarizedUpTo = Math.max(0, allMessages.length - keepRecent);
    await this.repo.conversations.update(conversation.id, {
      contextSummary: summary,
      summarizedUpTo: newSummarizedUpTo,
    } as Partial<AgentConversation>);

    conversation.summarizedUpTo = newSummarizedUpTo;

    return summary;
  }

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
    }
  }

  async run(
    orgId: string,
    userId: string | undefined,
    conversationId: string | undefined,
    userMessage: string,
    userRole?: string,
    options?: { toolAllowlist?: string[] | null; maxTokenBudget?: number },
  ): Promise<AgentRunResult> {
    const client = await createOpenAIClient();
    if (!client) throw new Error("OpenAI is not configured. Please set up your API key.");

    const config = await this.repo.config.get(orgId);
    const model = config?.defaultModel || "gpt-4o-mini";
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
        orgId, userId, title: sanitizedMessage.slice(0, 100), status: "active", metadata: {},
      });
    }

    const runStartTime = Date.now();
    await this.auditRunLifecycle("run_start", conversation.id, orgId, userId, { model, maxIterations });

    await this.repo.messages.create({
      conversationId: conversation.id, role: "user", content: sanitizedMessage,
    });
    await this.repo.conversations.incrementMessageCount(conversation.id, 0);

    const compactionCfg = this.getCompactionConfig(config, model);
    const contextSummary = await this.maybeSummarize(client, conversation, compactionCfg, model);

    const history = compactionCfg.enabled
      ? await this.repo.messages.listRecent(
          conversation.id,
          contextSummary ? Math.max(20, (conversation.messageCount || 50) - (conversation.summarizedUpTo || 0)) : 100,
        )
      : await this.repo.messages.list(conversation.id, 50);
    const openaiMessages = buildCompactedMessages(history, customPrompt, contextSummary, compactionCfg);

    const convFiles = await listConversationFiles(conversation.id, orgId);
    if (convFiles.length > 0) {
      const fileRefContext = convFiles.map(f =>
        `- fileId: "${f.id}" | ${f.filename} (${f.mimetype}, ${f.size} bytes)`
      ).join("\n");
      openaiMessages.push({
        role: "system" as const,
        content: `Available files for this conversation:\n${fileRefContext}\nUse analyzeImage or analyzeSpreadsheet tools with these fileIds when relevant.`,
      });
    }

    const enabledTools = options?.toolAllowlist !== undefined ? options.toolAllowlist : (config?.enabledTools as string[] | null);
    const deferredEnabled = this.isDeferredToolLoadingEnabled(config);
    const previouslyActivated = this.getActivatedToolsFromMetadata(conversation);
    const activatedTools = new Set<string>(previouslyActivated);
    let toolLoadingMode: ToolLoadingMode = deferredEnabled ? "light" : "full";

    let toolDefs = getToolOpenAIDefinitions(enabledTools, { mode: toolLoadingMode, activatedTools: [...activatedTools] });
    const toolContext: ToolContext = { orgId, userId, conversationId: conversation.id, userRole, knowledgeBase: this.knowledgeBase };

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let toolCallCount = 0;
    let finalResponse = "";
    const toolCallTraces: ToolCallTrace[] = [];
    const maxTokenBudget = options?.maxTokenBudget;
    let didFallbackToFull = false;

    try {
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        if (maxTokenBudget && totalTokens >= maxTokenBudget) {
          finalResponse = `[Token budget exceeded: ${totalTokens}/${maxTokenBudget} tokens used. Stopping early.]`;
          break;
        }

        const response = await this.callOpenAI(client, model, openaiMessages, toolDefs);

        const choice = response.choices[0];
        totalTokens += response.usage?.total_tokens || 0;
        promptTokens += response.usage?.prompt_tokens || 0;
        completionTokens += response.usage?.completion_tokens || 0;

        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          for (const tc of choice.message.tool_calls) {
            activatedTools.add(tc.function.name);
          }

          const assistantMsg = await this.repo.messages.create({
            conversationId: conversation.id,
            role: "assistant",
            content: choice.message.content,
            toolCalls: choice.message.tool_calls,
            tokenCount: response.usage?.total_tokens,
            model,
          });
          await this.repo.conversations.incrementMessageCount(conversation.id, response.usage?.total_tokens || 0);

          openaiMessages.push({
            role: "assistant",
            content: choice.message.content,
            tool_calls: choice.message.tool_calls,
          });

          for (const tc of choice.message.tool_calls) {
            const parsedInput = this.parseJson(tc.function.arguments);
            const { toolResult, toolStatus, toolError, durationMs } = await this.executeTool(
              tc, toolContext, orgId, userId, conversation.id, config, enabledTools,
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
              conversationId: conversation.id,
              messageId: assistantMsg.id,
              toolName: tc.function.name,
              input: parsedInput,
              output: toolResult,
              status: toolStatus,
              durationMs,
              error: toolError,
            });

            if (toolLoadingMode === "light" && tc.function.name === "listAvailableTools") {
              this.expandActivatedToolsFromDiscovery(toolResult, activatedTools, parsedInput, enabledTools);
            }

            const toolMsgContent = JSON.stringify(toolResult);
            await this.repo.messages.create({
              conversationId: conversation.id,
              role: "tool",
              content: toolMsgContent,
              toolCalls: { toolCallId: tc.id },
            });
            await this.repo.conversations.incrementMessageCount(conversation.id, 0);

            const compactedContent = compactionCfg.enabled ? compactToolOutput(toolMsgContent, compactionCfg.toolOutputCharLimit) : toolMsgContent;
            openaiMessages.push({
              role: "tool", tool_call_id: tc.id, content: compactedContent,
            });
          }

          toolDefs = getToolOpenAIDefinitions(enabledTools, { mode: toolLoadingMode, activatedTools: [...activatedTools] });
          continue;
        }

        finalResponse = choice.message.content || "";

        if (toolLoadingMode === "light" && !didFallbackToFull && iteration === 0 && this.looksLikeFallbackNeeded(finalResponse)) {
          toolLoadingMode = "full";
          toolDefs = getToolOpenAIDefinitions(enabledTools, { mode: "full" });
          didFallbackToFull = true;
          continue;
        }

        await this.repo.messages.create({
          conversationId: conversation.id,
          role: "assistant",
          content: finalResponse,
          tokenCount: response.usage?.total_tokens,
          model,
        });
        await this.repo.conversations.incrementMessageCount(conversation.id, response.usage?.total_tokens || 0);
        break;
      }
    } catch (err) {
      await this.auditRunLifecycle("run_error", conversation.id, orgId, userId, {
        model, totalTokens, promptTokens, completionTokens, toolCallCount, durationMs: Date.now() - runStartTime,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }

    if (activatedTools.size > 0) {
      await this.persistActivatedTools(conversation, [...activatedTools]);
    }

    if (!conversation.title || conversation.title === sanitizedMessage.slice(0, 100)) {
      const title = sanitizedMessage.length > 60 ? sanitizedMessage.slice(0, 57) + "..." : sanitizedMessage;
      await this.repo.conversations.update(conversation.id, { title });
    }

    await this.auditRunLifecycle("run_complete", conversation.id, orgId, userId, {
      model, totalTokens, promptTokens, completionTokens, toolCallCount, durationMs: Date.now() - runStartTime,
      toolsUsed: toolCallTraces.map(t => t.toolName),
    });

    return { conversationId: conversation.id, toolCalls: toolCallTraces, finalResponse, toolCallCount, totalTokens };
  }

  async runWithAttachments(
    orgId: string,
    userId: string | undefined,
    conversationId: string | undefined,
    userMessage: string,
    attachments: FileAttachment[],
    userRole?: string,
  ): Promise<AgentRunResult> {
    const client = await createOpenAIClient();
    if (!client) throw new Error("OpenAI is not configured. Please set up your API key.");

    const config = await this.repo.config.get(orgId);
    const model = config?.defaultModel || "gpt-4o";
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
        orgId, userId, title: sanitizedMessage.slice(0, 100), status: "active", metadata: {},
      });
    }

    const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: sanitizedMessage },
    ];

    const fileDescriptions: string[] = [];

    for (const att of attachments) {
      if (att.mimetype.startsWith("image/")) {
        const base64 = fs.readFileSync(att.path, "base64");
        const dataUrl = `data:${att.mimetype};base64,${base64}`;
        contentParts.push({
          type: "image_url",
          image_url: { url: dataUrl, detail: "auto" },
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

    for (const att of attachments) {
      await registerFile(orgId, conversation.id, {
        originalname: att.filename,
        mimetype: att.mimetype,
        size: att.size,
        path: att.path,
      });
    }

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

    const convFiles = await listConversationFiles(conversation.id, orgId);
    if (convFiles.length > 0) {
      const fileRefContext = convFiles.map(f =>
        `- fileId: "${f.id}" | ${f.filename} (${f.mimetype}, ${f.size} bytes)`
      ).join("\n");
      contentParts.push({
        type: "text",
        text: `\n\n--- Available files for this conversation ---\n${fileRefContext}\nYou can use analyzeImage or analyzeSpreadsheet tools with these fileIds.\n--- End of file list ---`,
      });
    }

    const displayContent = `${sanitizedMessage}${fileDescriptions.length > 0 ? "\n" + fileDescriptions.join(" ") : ""}`;
    await this.repo.messages.create({
      conversationId: conversation.id, role: "user", content: displayContent,
    });
    await this.repo.conversations.incrementMessageCount(conversation.id, 0);

    if (kbIngested.length > 0) {
      const systemContent = buildIngestionSystemMessage(kbIngested);
      await this.repo.messages.create({
        conversationId: conversation.id, role: "system", content: systemContent,
      });
    }

    const compactionCfg = this.getCompactionConfig(config, model);
    const contextSummary = await this.maybeSummarize(client, conversation, compactionCfg, model);

    const history = compactionCfg.enabled
      ? await this.repo.messages.listRecent(
          conversation.id,
          contextSummary ? Math.max(20, (conversation.messageCount || 50) - (conversation.summarizedUpTo || 0)) : 100,
        )
      : await this.repo.messages.list(conversation.id, 50);
    const openaiMessages = buildCompactedMessages(history, customPrompt, contextSummary, compactionCfg);

    for (let i = openaiMessages.length - 1; i >= 0; i--) {
      if (openaiMessages[i].role === "user") {
        openaiMessages[i] = { role: "user", content: contentParts };
        break;
      }
    }

    const enabledToolsMA = config?.enabledTools as string[] | null;
    const deferredEnabledMA = this.isDeferredToolLoadingEnabled(config);
    const previouslyActivatedMA = this.getActivatedToolsFromMetadata(conversation);
    const activatedToolsMA = new Set<string>(previouslyActivatedMA);
    let maToolMode: ToolLoadingMode = deferredEnabledMA ? "light" : "full";

    let toolDefs = getToolOpenAIDefinitions(enabledToolsMA, { mode: maToolMode, activatedTools: [...activatedToolsMA] });
    const toolContext: ToolContext = { orgId, userId, conversationId: conversation.id, userRole, knowledgeBase: this.knowledgeBase };

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let toolCallCount = 0;
    let finalResponse = "";
    const toolCallTraces: ToolCallTrace[] = [];
    let didMAFallback = false;

    const runStartTime = Date.now();
    await this.auditRunLifecycle("run_start", conversation.id, orgId, userId, { model, maxIterations, mode: "attachments" });

    try {
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const response = await this.callOpenAI(client, model, openaiMessages, toolDefs);

        const choice = response.choices[0];
        totalTokens += response.usage?.total_tokens || 0;
        promptTokens += response.usage?.prompt_tokens || 0;
        completionTokens += response.usage?.completion_tokens || 0;

        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          for (const tc of choice.message.tool_calls) {
            activatedToolsMA.add(tc.function.name);
          }

          if (maToolMode === "light") {
            toolDefs = getToolOpenAIDefinitions(enabledToolsMA, { mode: "light", activatedTools: [...activatedToolsMA] });
          }

          const assistantMsg = await this.repo.messages.create({
            conversationId: conversation.id,
            role: "assistant",
            content: choice.message.content,
            toolCalls: choice.message.tool_calls,
            tokenCount: response.usage?.total_tokens,
            model,
          });
          await this.repo.conversations.incrementMessageCount(conversation.id, response.usage?.total_tokens || 0);

          openaiMessages.push({
            role: "assistant",
            content: choice.message.content,
            tool_calls: choice.message.tool_calls,
          });

          for (const tc of choice.message.tool_calls) {
            const parsedInput = this.parseJson(tc.function.arguments);
            const { toolResult, toolStatus, toolError, durationMs } = await this.executeTool(
              tc, toolContext, orgId, userId, conversation.id, config,
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
              conversationId: conversation.id,
              messageId: assistantMsg.id,
              toolName: tc.function.name,
              input: parsedInput,
              output: toolResult,
              status: toolStatus,
              durationMs,
              error: toolError,
            });

            if (maToolMode === "light" && tc.function.name === "listAvailableTools") {
              this.expandActivatedToolsFromDiscovery(toolResult, activatedToolsMA, parsedInput, enabledToolsMA);
            }

            const toolMsgContent = JSON.stringify(toolResult);
            await this.repo.messages.create({
              conversationId: conversation.id,
              role: "tool",
              content: toolMsgContent,
              toolCalls: { toolCallId: tc.id },
            });
            await this.repo.conversations.incrementMessageCount(conversation.id, 0);

            const compactedContent = compactionCfg.enabled ? compactToolOutput(toolMsgContent, compactionCfg.toolOutputCharLimit) : toolMsgContent;
            openaiMessages.push({
              role: "tool", tool_call_id: tc.id, content: compactedContent,
            });
          }

          toolDefs = getToolOpenAIDefinitions(enabledToolsMA, { mode: maToolMode, activatedTools: [...activatedToolsMA] });
          continue;
        }

        finalResponse = choice.message.content || "";

        if (maToolMode === "light" && !didMAFallback && iteration === 0 && this.looksLikeFallbackNeeded(finalResponse)) {
          maToolMode = "full";
          toolDefs = getToolOpenAIDefinitions(enabledToolsMA, { mode: "full" });
          didMAFallback = true;
          continue;
        }

        await this.repo.messages.create({
          conversationId: conversation.id,
          role: "assistant",
          content: finalResponse,
          tokenCount: response.usage?.total_tokens,
          model,
        });
        await this.repo.conversations.incrementMessageCount(conversation.id, response.usage?.total_tokens || 0);
        break;
      }
    } catch (err) {
      await this.auditRunLifecycle("run_error", conversation.id, orgId, userId, {
        model, totalTokens, promptTokens, completionTokens, toolCallCount, durationMs: Date.now() - runStartTime, mode: "attachments",
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }

    if (activatedToolsMA.size > 0) {
      await this.persistActivatedTools(conversation, [...activatedToolsMA]);
    }

    if (!conversation.title || conversation.title === sanitizedMessage.slice(0, 100)) {
      const title = sanitizedMessage.length > 60 ? sanitizedMessage.slice(0, 57) + "..." : sanitizedMessage;
      await this.repo.conversations.update(conversation.id, { title });
    }

    await this.auditRunLifecycle("run_complete", conversation.id, orgId, userId, {
      model, totalTokens, promptTokens, completionTokens, toolCallCount, durationMs: Date.now() - runStartTime, mode: "attachments",
      toolsUsed: toolCallTraces.map(t => t.toolName),
    });

    return { conversationId: conversation.id, toolCalls: toolCallTraces, finalResponse, toolCallCount, totalTokens };
  }

  async runStream(
    orgId: string,
    userId: string | undefined,
    conversationId: string | undefined,
    userMessage: string,
    onChunk: (chunk: string) => void,
    userRole?: string,
  ): Promise<AgentRunResult> {
    const client = await createOpenAIClient();
    if (!client) throw new Error("OpenAI is not configured. Please set up your API key.");

    const config = await this.repo.config.get(orgId);
    const model = config?.defaultModel || "gpt-4o-mini";
    const maxIterations = config?.maxIterationsPerRun || 10;
    const customPrompt = config?.customSystemPrompt;

    const sanitizedMessage = this.safety.sanitizeInput(userMessage);

    let conversation: AgentConversation;
    if (conversationId) {
      const existing = await this.repo.conversations.get(conversationId, orgId);
      if (!existing) throw new Error("Conversation not found");
      conversation = existing;

      const budgetCheck = await this.safety.checkTokenBudget(orgId, conversationId, config || {});
      if (!budgetCheck.allowed) {
        onChunk(JSON.stringify({ type: "error", error: budgetCheck.reason }) + "\n");
        throw new Error(budgetCheck.reason);
      }
    } else {
      conversation = await this.repo.conversations.create({
        orgId, userId, title: sanitizedMessage.slice(0, 100), status: "active", metadata: {},
      });
    }

    await this.repo.messages.create({
      conversationId: conversation.id, role: "user", content: sanitizedMessage,
    });
    await this.repo.conversations.incrementMessageCount(conversation.id, 0);

    const compactionCfg = this.getCompactionConfig(config, model);
    const contextSummary = await this.maybeSummarize(client, conversation, compactionCfg, model);

    const history = compactionCfg.enabled
      ? await this.repo.messages.listRecent(
          conversation.id,
          contextSummary ? Math.max(20, (conversation.messageCount || 50) - (conversation.summarizedUpTo || 0)) : 100,
        )
      : await this.repo.messages.list(conversation.id, 50);
    const openaiMessages = buildCompactedMessages(history, customPrompt, contextSummary, compactionCfg);
    const enabledToolsStream = config?.enabledTools as string[] | null;
    const deferredEnabledStream = this.isDeferredToolLoadingEnabled(config);
    const previouslyActivatedStream = this.getActivatedToolsFromMetadata(conversation);
    const activatedToolsStream = new Set<string>(previouslyActivatedStream);
    let streamToolMode: ToolLoadingMode = deferredEnabledStream ? "light" : "full";

    let toolDefs = getToolOpenAIDefinitions(enabledToolsStream, { mode: streamToolMode, activatedTools: [...activatedToolsStream] });
    const toolContext: ToolContext = { orgId, userId, conversationId: conversation.id, userRole, knowledgeBase: this.knowledgeBase };

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let toolCallCount = 0;
    let finalResponse = "";
    let finalResponseTokens = 0;
    const toolCallTraces: ToolCallTrace[] = [];
    let didStreamFallback = false;

    const runStartTime = Date.now();
    await this.auditRunLifecycle("run_start", conversation.id, orgId, userId, { model, maxIterations, mode: "stream" });

    try {
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const isLastChance = iteration === maxIterations - 1;

        if (isLastChance) {
          const response = await this.callOpenAI(client, model, openaiMessages);
          finalResponse = response.choices[0].message.content || "";
          finalResponseTokens = response.usage?.total_tokens || 0;
          totalTokens += finalResponseTokens;
          promptTokens += response.usage?.prompt_tokens || 0;
          completionTokens += response.usage?.completion_tokens || 0;
          onChunk(JSON.stringify({ type: "text", content: finalResponse }) + "\n");
          break;
        }

        const response = await this.callOpenAI(client, model, openaiMessages, toolDefs);

        const choice = response.choices[0];
        const iterationTokens = response.usage?.total_tokens || 0;
        totalTokens += iterationTokens;
        promptTokens += response.usage?.prompt_tokens || 0;
        completionTokens += response.usage?.completion_tokens || 0;

        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          for (const tc of choice.message.tool_calls) {
            activatedToolsStream.add(tc.function.name);
          }

          const assistantMsg = await this.repo.messages.create({
            conversationId: conversation.id,
            role: "assistant",
            content: choice.message.content,
            toolCalls: choice.message.tool_calls,
            tokenCount: iterationTokens,
            model,
          });
          await this.repo.conversations.incrementMessageCount(conversation.id, iterationTokens);

          openaiMessages.push({
            role: "assistant",
            content: choice.message.content,
            tool_calls: choice.message.tool_calls,
          });

          for (const tc of choice.message.tool_calls) {
            const parsedInput = this.parseJson(tc.function.arguments);
            onChunk(JSON.stringify({ type: "tool_call", toolName: tc.function.name, input: parsedInput }) + "\n");

            const { toolResult, toolStatus, toolError, durationMs } = await this.executeTool(
              tc, toolContext, orgId, userId, conversation.id, config,
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
              conversationId: conversation.id,
              messageId: assistantMsg.id,
              toolName: tc.function.name,
              input: parsedInput,
              output: toolResult,
              status: toolStatus,
              durationMs,
              error: toolError,
            });

            if (streamToolMode === "light" && tc.function.name === "listAvailableTools") {
              this.expandActivatedToolsFromDiscovery(toolResult, activatedToolsStream, parsedInput, enabledToolsStream);
            }

            onChunk(JSON.stringify({ type: "tool_result", toolName: tc.function.name, result: toolResult }) + "\n");

            const toolMsgContent = JSON.stringify(toolResult);
            await this.repo.messages.create({
              conversationId: conversation.id,
              role: "tool",
              content: toolMsgContent,
              toolCalls: { toolCallId: tc.id },
            });
            await this.repo.conversations.incrementMessageCount(conversation.id, 0);

            const compactedContent = compactionCfg.enabled ? compactToolOutput(toolMsgContent, compactionCfg.toolOutputCharLimit) : toolMsgContent;
            openaiMessages.push({ role: "tool", tool_call_id: tc.id, content: compactedContent });
          }

          toolDefs = getToolOpenAIDefinitions(enabledToolsStream, { mode: streamToolMode, activatedTools: [...activatedToolsStream] });
          continue;
        }

        finalResponse = choice.message.content || "";
        finalResponseTokens = iterationTokens;

        if (streamToolMode === "light" && !didStreamFallback && iteration === 0 && this.looksLikeFallbackNeeded(finalResponse)) {
          streamToolMode = "full";
          toolDefs = getToolOpenAIDefinitions(enabledToolsStream, { mode: "full" });
          didStreamFallback = true;
          continue;
        }

        onChunk(JSON.stringify({ type: "text", content: finalResponse }) + "\n");
        break;
      }
    } catch (err) {
      await this.auditRunLifecycle("run_error", conversation.id, orgId, userId, {
        model, totalTokens, promptTokens, completionTokens, toolCallCount, durationMs: Date.now() - runStartTime, mode: "stream",
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }

    await this.repo.messages.create({
      conversationId: conversation.id,
      role: "assistant",
      content: finalResponse,
      tokenCount: finalResponseTokens,
      model,
    });
    await this.repo.conversations.incrementMessageCount(conversation.id, finalResponseTokens);

    if (activatedToolsStream.size > 0) {
      await this.persistActivatedTools(conversation, [...activatedToolsStream]);
    }

    if (!conversation.title || conversation.title === sanitizedMessage.slice(0, 100)) {
      const title = sanitizedMessage.length > 60 ? sanitizedMessage.slice(0, 57) + "..." : sanitizedMessage;
      await this.repo.conversations.update(conversation.id, { title });
    }

    onChunk(JSON.stringify({ type: "done", conversationId: conversation.id }) + "\n");

    await this.auditRunLifecycle("run_complete", conversation.id, orgId, userId, {
      model, totalTokens, promptTokens, completionTokens, toolCallCount, durationMs: Date.now() - runStartTime, mode: "stream",
      toolsUsed: toolCallTraces.map(t => t.toolName),
    });

    return { conversationId: conversation.id, toolCalls: toolCallTraces, finalResponse, toolCallCount, totalTokens };
  }

  private buildOpenAIMessages(
    history: AgentMessage[],
    customPrompt?: string | null,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return [
      {
        role: "system",
        content: buildSystemPrompt(customPrompt),
      },
      ...history.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
        if (m.role === "tool") {
          const ref = m.toolCalls as unknown as StoredToolCallRef | null;
          return {
            role: "tool" as const,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
            tool_call_id: ref?.toolCallId || "unknown",
          };
        }
        if (m.role === "assistant" && m.toolCalls) {
          const calls = m.toolCalls as unknown as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
          return {
            role: "assistant" as const,
            content: m.content || null,
            tool_calls: calls,
          };
        }
        return { role: m.role as "user" | "assistant", content: m.content || "" };
      }),
    ];
  }

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
      return { toolResult: { error: `Tool ${toolName} is not in the schedule allowlist` }, toolStatus: "error", toolError: "Schedule allowlist denied", durationMs: 0 };
    }

    const enabledTools = config?.enabledTools as string[] | null | undefined;
    if (enabledTools && toolName !== "listAvailableTools" && !this.safety.validateToolAccess(toolName, enabledTools)) {
      return { toolResult: { error: `Tool ${toolName} is disabled` }, toolStatus: "error", toolError: "Tool disabled", durationMs: 0 };
    }

    const userRole = (toolContext as { orgId: string; userId?: string; userRole?: string }).userRole;
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
      return { toolResult: { error: `Unknown tool: ${toolName}` }, toolStatus: "error", toolError: `Unknown tool: ${toolName}`, durationMs: 0 };
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
        const permissionTier = ((config?.permissionTier as string) || "strict") as import("../domain/types").PermissionTier;
        const autoApprove = this.safety.shouldAutoApprove(tool.riskLevel, permissionTier, userRole);

        const resultData = toolResult as Record<string, unknown>;
        const data = resultData.data as Record<string, unknown>;

        if (autoApprove) {
          const draftType = resultData.draftType as string;
          const execResult = await executeDraftAction(draftType, data, orgId);

          if (execResult.error) {
            const fallbackDraft = await this.repo.drafts.create({
              orgId, conversationId,
              draftType,
              title: (data?.title as string) || toolName,
              data,
              status: "pending",
              createdById: userId,
            });
            toolResult = {
              ...toolResult,
              draftId: fallbackDraft.id,
              autoApproveError: execResult.error,
              autoApproveFailed: true,
              message: `Auto-approval failed: ${execResult.error}. A pending draft has been created for manual review.`,
            };
            toolStatus = "error";
          } else {
            const draft = await this.repo.drafts.create({
              orgId, conversationId,
              draftType,
              title: (data?.title as string) || toolName,
              data,
              status: "approved",
              createdById: userId,
            });
            if (execResult.resultId) {
              await this.repo.drafts.update(draft.id, { resultId: execResult.resultId });
            }
            await this.repo.approvals.create({
              orgId, draftId: draft.id, conversationId,
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
            toolResult = { ...toolResult, draftId: draft.id, resultId: execResult.resultId, autoApproved: true, approvalMode: "auto" };
          }
        } else {
          const draft = await this.repo.drafts.create({
            orgId, conversationId,
            draftType: resultData.draftType as string,
            title: (data?.title as string) || toolName,
            data,
            status: "pending",
            createdById: userId,
          });
          toolResult = { ...toolResult, draftId: draft.id };
        }
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
        const isRetryable = statusCode === 429 || statusCode === 500 || statusCode === 503 || statusCode === 502 ||
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

  private parseJson(str: string): Record<string, unknown> {
    try { return JSON.parse(str) as Record<string, unknown>; } catch { return {}; }
  }
}
