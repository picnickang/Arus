import { getToolOpenAIDefinitions } from "../../tools";
import type { ToolLoadingMode } from "../../tools/registry";
import type { AgentConversation } from "@shared/schema";
import type { LLMMessage } from "../../../../lib/llm-gateway/types";
import type { AgentRepositoryPort } from "../../domain/ports";
import type { SafetyService } from "../safety-service";
import { compactToolOutput } from "../context-compaction";
import type { LoopOptions, LoopResult, RunContext } from "../orchestrator-types";
import { callLLMWithRetry, parseToolArgs } from "./openai-client";
import { executeTool as executeToolHelper } from "./tool-execution";
import {
  expandActivatedToolsFromDiscovery,
  getActivatedToolsFromMetadata,
  isDeferredToolLoadingEnabled,
  looksLikeFallbackNeeded,
} from "./loop-helpers";

interface LoopDeps {
  repo: AgentRepositoryPort;
  safety: SafetyService;
}

export async function executeAgentLoop(
  deps: LoopDeps,
  ctx: RunContext,
  openaiMessages: LLMMessage[],
  opts: LoopOptions
): Promise<LoopResult> {
  const { repo, safety } = deps;
  const { mode, onChunk, maxTokenBudget, runtimeAllowlist, contentParts } = opts;

  const deferredEnabled = isDeferredToolLoadingEnabled(ctx.config);
  const previouslyActivated = getActivatedToolsFromMetadata(ctx.conversation);
  const activatedTools = new Set<string>(previouslyActivated);
  let toolLoadingMode: ToolLoadingMode = deferredEnabled ? "light" : "full";
  let didFallback = false;

  let toolDefs = getToolOpenAIDefinitions(ctx.enabledTools, {
    mode: toolLoadingMode,
    activatedTools: [...activatedTools],
  });

  if (contentParts) {
    for (let i = openaiMessages.length - 1; i >= 0; i--) {
      if (openaiMessages[i]?.role === "user") {
        openaiMessages[i] = { role: "user", content: contentParts };
        break;
      }
    }
  }

  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let toolCallCount = 0;
  let finalResponse = "";
  const toolCallTraces: LoopResult["toolCallTraces"] = [];

  for (let iteration = 0; iteration < ctx.maxIterations; iteration++) {
    if (maxTokenBudget && totalTokens >= maxTokenBudget) {
      finalResponse = `[Token budget exceeded: ${totalTokens}/${maxTokenBudget} tokens used. Stopping early.]`;
      break;
    }

    const isLastChance = mode === "stream" && iteration === ctx.maxIterations - 1;
    const iterToolDefs = isLastChance ? undefined : toolDefs;

    const response = await callLLMWithRetry(ctx.model, openaiMessages, iterToolDefs, {
      conversationId: ctx.conversation.id,
      orgId: ctx.toolContext.orgId,
    });
    const iterTokens = response.usage.totalTokens;
    totalTokens += iterTokens;
    promptTokens += response.usage.promptTokens;
    completionTokens += response.usage.completionTokens;

    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolCalls = response.toolCalls;
      for (const tc of toolCalls) {
        activatedTools.add(tc.function.name);
      }

      const assistantMsg = await repo.messages.create({
        conversationId: ctx.conversation.id,
        role: "assistant",
        content: response.content,
        toolCalls,
        tokenCount: iterTokens,
        model: ctx.model,
      });
      await repo.conversations.incrementMessageCount(ctx.conversation.id, iterTokens);

      openaiMessages.push({
        role: "assistant",
        content: response.content,
        toolCalls,
      });

      for (const tc of toolCalls) {
        const parsedInput = parseToolArgs(tc.function.arguments);

        if (mode === "stream" && onChunk) {
          onChunk(
            `${JSON.stringify({ type: "tool_call", toolName: tc.function.name, input: parsedInput })}\n`
          );
        }

        const { toolResult, toolStatus, toolError, durationMs } = await executeToolHelper(
          { repo, safety },
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
          ...(toolError !== undefined && { error: toolError }),
        });

        await repo.toolCalls.create({
          conversationId: ctx.conversation.id,
          messageId: assistantMsg.id,
          toolName: tc.function.name,
          input: parsedInput,
          output: toolResult,
          status: toolStatus,
          durationMs,
          ...(toolError !== undefined && { error: toolError }),
        });

        if (toolLoadingMode === "light" && tc.function.name === "listAvailableTools") {
          expandActivatedToolsFromDiscovery(
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
        await repo.messages.create({
          conversationId: ctx.conversation.id,
          role: "tool",
          content: toolMsgContent,
          toolCalls: { toolCallId: tc.id },
        });
        await repo.conversations.incrementMessageCount(ctx.conversation.id, 0);

        const compactedContent = ctx.compactionCfg.enabled
          ? compactToolOutput(toolMsgContent, ctx.compactionCfg.toolOutputCharLimit)
          : toolMsgContent;

        openaiMessages.push({ role: "tool", toolCallId: tc.id, content: compactedContent });
      }

      toolDefs = getToolOpenAIDefinitions(ctx.enabledTools, {
        mode: toolLoadingMode,
        activatedTools: [...activatedTools],
      });
      continue;
    }

    finalResponse = response.content || "";

    if (
      toolLoadingMode === "light" &&
      !didFallback &&
      iteration === 0 &&
      looksLikeFallbackNeeded(finalResponse)
    ) {
      toolLoadingMode = "full";
      toolDefs = getToolOpenAIDefinitions(ctx.enabledTools, { mode: "full" });
      didFallback = true;
      continue;
    }

    if (mode === "stream") {
      if (onChunk) {
        onChunk(`${JSON.stringify({ type: "text", content: finalResponse })}\n`);
      }
    } else {
      await repo.messages.create({
        conversationId: ctx.conversation.id,
        role: "assistant",
        content: finalResponse,
        tokenCount: iterTokens,
        model: ctx.model,
      });
      await repo.conversations.incrementMessageCount(ctx.conversation.id, iterTokens);
    }
    break;
  }

  if (activatedTools.size > 0) {
    await persistActivatedTools(repo, ctx.conversation, [...activatedTools]);
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

async function persistActivatedTools(
  repo: AgentRepositoryPort,
  conversation: AgentConversation,
  activatedTools: string[]
): Promise<void> {
  try {
    const meta = (conversation.metadata as Record<string, unknown>) || {};
    const existing = Array.isArray(meta["activatedTools"])
      ? (meta["activatedTools"] as string[])
      : [];
    const merged = [...new Set([...existing, ...activatedTools])];
    await repo.conversations.update(conversation.id, {
      metadata: { ...meta, activatedTools: merged },
    } as Partial<AgentConversation>);
  } catch {
    // Non-critical.
  }
}
