import OpenAI from "openai";
import fs from "fs";
import { createOpenAIClient } from "../../../openai/client";
import type { AgentRepositoryPort, KnowledgeBasePort } from "../domain/ports";
import type { AgentRunResult, FileAttachment, ToolCallTrace } from "../domain/types";
import { getTool, getToolOpenAIDefinitions } from "../tools";
import { SafetyService } from "./safety-service";
import { auditAction } from "../../../utils/audit-helpers";
import { registerFile, listConversationFiles } from "../infrastructure/file-registry";
import { buildSystemPrompt } from "../domain/system-prompt";
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

    const history = await this.repo.messages.list(conversation.id, 50);
    const openaiMessages = this.buildOpenAIMessages(history, customPrompt);

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
    const toolDefs = getToolOpenAIDefinitions(enabledTools);
    const toolContext: ToolContext = { orgId, userId, conversationId: conversation.id, userRole, knowledgeBase: this.knowledgeBase };

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let toolCallCount = 0;
    let finalResponse = "";
    const toolCallTraces: ToolCallTrace[] = [];
    const maxTokenBudget = options?.maxTokenBudget;

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

            const toolMsgContent = JSON.stringify(toolResult);
            await this.repo.messages.create({
              conversationId: conversation.id,
              role: "tool",
              content: toolMsgContent,
              toolCalls: { toolCallId: tc.id },
            });
            await this.repo.conversations.incrementMessageCount(conversation.id, 0);

            openaiMessages.push({
              role: "tool", tool_call_id: tc.id, content: toolMsgContent,
            });
          }
          continue;
        }

        finalResponse = choice.message.content || "";
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

    const kbIngestedFiles: Array<{ name: string; chunks: number }> = [];
    if (this.knowledgeBase) {
      const docMimeTypes = ["application/pdf", "text/csv", "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
      const mimeToType: Record<string, string> = {
        "application/pdf": "pdf",
        "text/csv": "txt",
        "text/plain": "txt",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      };
      for (const att of attachments) {
        const isDoc = docMimeTypes.includes(att.mimetype) ||
          /\.(pdf|docx|xlsx|txt|md|csv)$/i.test(att.filename);
        if (!isDoc) continue;
        try {
          const fileBuffer = fs.readFileSync(att.path);
          const ext = att.filename.split(".").pop()?.toLowerCase() || "";
          const fileType = mimeToType[att.mimetype] || ext || "txt";
          const result = await this.knowledgeBase.ingestDocument(orgId, att.filename, fileBuffer, fileType, userId);
          kbIngestedFiles.push({ name: att.filename, chunks: result.chunkCount });
          fileDescriptions.push(`[KB: "${att.filename}" ingested — ${result.chunkCount} chunks indexed]`);
        } catch (err) {
          console.warn(`[Agent] KB ingestion failed for ${att.filename}:`, err instanceof Error ? err.message : "unknown");
        }
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

    if (kbIngestedFiles.length > 0) {
      const ingestionSummary = kbIngestedFiles
        .map(f => `• "${f.name}" — ${f.chunks} chunks indexed`)
        .join("\n");
      const systemContent = `[Knowledge Base] ${kbIngestedFiles.length} document(s) automatically ingested into the Knowledge Base:\n${ingestionSummary}\nThese documents are now searchable via the searchKnowledgeBase tool.`;
      await this.repo.messages.create({
        conversationId: conversation.id, role: "system", content: systemContent,
      });
    }

    const history = await this.repo.messages.list(conversation.id, 50);
    const openaiMessages = this.buildOpenAIMessages(history, customPrompt);

    const lastIdx = openaiMessages.length - 1;
    const lastMsg = openaiMessages[lastIdx];
    if (lastMsg && lastMsg.role === "user") {
      openaiMessages[lastIdx] = { role: "user", content: contentParts };
    }

    const enabledToolsMA = config?.enabledTools as string[] | null;
    const toolDefs = getToolOpenAIDefinitions(enabledToolsMA);
    const toolContext: ToolContext = { orgId, userId, conversationId: conversation.id, userRole, knowledgeBase: this.knowledgeBase };

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let toolCallCount = 0;
    let finalResponse = "";
    const toolCallTraces: ToolCallTrace[] = [];

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

            const toolMsgContent = JSON.stringify(toolResult);
            await this.repo.messages.create({
              conversationId: conversation.id,
              role: "tool",
              content: toolMsgContent,
              toolCalls: { toolCallId: tc.id },
            });
            await this.repo.conversations.incrementMessageCount(conversation.id, 0);

            openaiMessages.push({
              role: "tool", tool_call_id: tc.id, content: toolMsgContent,
            });
          }
          continue;
        }

        finalResponse = choice.message.content || "";
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

    const history = await this.repo.messages.list(conversation.id, 50);
    const openaiMessages = this.buildOpenAIMessages(history, customPrompt);
    const enabledToolsStream = config?.enabledTools as string[] | null;
    const toolDefs = getToolOpenAIDefinitions(enabledToolsStream);
    const toolContext: ToolContext = { orgId, userId, conversationId: conversation.id, userRole, knowledgeBase: this.knowledgeBase };

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let toolCallCount = 0;
    let finalResponse = "";
    let finalResponseTokens = 0;
    const toolCallTraces: ToolCallTrace[] = [];

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

            onChunk(JSON.stringify({ type: "tool_result", toolName: tc.function.name, result: toolResult }) + "\n");

            const toolMsgContent = JSON.stringify(toolResult);
            await this.repo.messages.create({
              conversationId: conversation.id,
              role: "tool",
              content: toolMsgContent,
              toolCalls: { toolCallId: tc.id },
            });
            await this.repo.conversations.incrementMessageCount(conversation.id, 0);

            openaiMessages.push({ role: "tool", tool_call_id: tc.id, content: toolMsgContent });
          }
          continue;
        }

        finalResponse = choice.message.content || "";
        finalResponseTokens = iterationTokens;
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

    if (runtimeAllowedTools && !runtimeAllowedTools.includes(toolName)) {
      return { toolResult: { error: `Tool ${toolName} is not in the schedule allowlist` }, toolStatus: "error", toolError: "Schedule allowlist denied", durationMs: 0 };
    }

    const enabledTools = config?.enabledTools as string[] | null | undefined;
    if (enabledTools && !this.safety.validateToolAccess(toolName, enabledTools)) {
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
        const resultData = toolResult as Record<string, unknown>;
        const data = resultData.data as Record<string, unknown>;
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
