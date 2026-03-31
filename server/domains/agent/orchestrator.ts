import OpenAI from "openai";
import { createOpenAIClient } from "../../openai/client";
import { agentRepository } from "./repository";
import { getTool, getToolOpenAIDefinitions, type ToolContext } from "./tools";
import type { AgentConversation, AgentMessage } from "@shared/schema";

const SYSTEM_PROMPT = `You are ARUS Copilot, an AI assistant for marine fleet operations and predictive maintenance.

Your responsibilities:
- Answer questions about vessels, equipment, maintenance history, and fleet operations
- Explain predictive maintenance alerts and failure predictions
- Help draft work orders when maintenance is needed
- Provide risk assessments and prioritized recommendations
- Summarize crew schedules and inventory status

Important guidelines:
1. Always use the provided tools to look up real data — never guess or make up equipment IDs, dates, or statistics
2. When presenting predictions or risk scores, always mention the confidence level
3. If a prediction has low confidence (below 0.6), explicitly warn the user
4. When drafting work orders, always confirm the details with the user before proceeding
5. Be concise and action-oriented — fleet operators are busy
6. Use maritime terminology when appropriate
7. If you cannot find information through the tools, say so clearly rather than guessing

You have access to tools for looking up equipment, vessels, maintenance history, alerts, failure predictions, crew info, inventory, and drafting work orders.`;

export interface AgentRunResult {
  conversation: AgentConversation;
  messages: AgentMessage[];
  finalResponse: string;
  toolCallCount: number;
  totalTokens: number;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onToolCall?: (toolName: string, input: any) => void;
  onToolResult?: (toolName: string, result: any) => void;
  onComplete?: (result: AgentRunResult) => void;
  onError?: (error: Error) => void;
}

export async function runAgent(
  orgId: string,
  userId: string | undefined,
  conversationId: string | undefined,
  userMessage: string,
  callbacks?: StreamCallbacks,
): Promise<AgentRunResult> {
  const client = await createOpenAIClient();
  if (!client) {
    throw new Error("OpenAI is not configured. Please set up your API key.");
  }

  const config = await agentRepository.getConfig(orgId);
  const model = config?.defaultModel || "gpt-4o-mini";
  const maxIterations = config?.maxIterationsPerRun || 10;
  const customPrompt = config?.customSystemPrompt;

  let conversation: AgentConversation;
  if (conversationId) {
    const existing = await agentRepository.getConversation(conversationId, orgId);
    if (!existing) throw new Error("Conversation not found");
    conversation = existing;
  } else {
    conversation = await agentRepository.createConversation({
      orgId,
      userId,
      title: userMessage.slice(0, 100),
      status: "active",
      metadata: {},
    });
  }

  const userMsg = await agentRepository.createMessage({
    conversationId: conversation.id,
    role: "user",
    content: userMessage,
  });
  await agentRepository.incrementMessageCount(conversation.id, 0);

  const history = await agentRepository.getMessages(conversation.id, 50);

  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: customPrompt
        ? `${SYSTEM_PROMPT}\n\nAdditional instructions from your organization:\n${customPrompt}`
        : SYSTEM_PROMPT,
    },
    ...history.map(m => {
      if (m.role === "tool") {
        return {
          role: "tool" as const,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          tool_call_id: (m.toolCalls as any)?.toolCallId || "unknown",
        };
      }
      if (m.role === "assistant" && m.toolCalls) {
        const tc = m.toolCalls as any[];
        return {
          role: "assistant" as const,
          content: m.content || null,
          tool_calls: tc,
        };
      }
      return {
        role: m.role as "user" | "assistant",
        content: m.content || "",
      };
    }),
  ];

  const toolDefs = getToolOpenAIDefinitions();
  const toolContext: ToolContext = { orgId, userId, conversationId: conversation.id };

  let totalTokens = 0;
  let toolCallCount = 0;
  let finalResponse = "";
  const allMessages: AgentMessage[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const response = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      temperature: 0.3,
      max_tokens: 4096,
    });

    const choice = response.choices[0];
    totalTokens += response.usage?.total_tokens || 0;

    if (choice.finish_reason === "tool_calls" || (choice.message.tool_calls && choice.message.tool_calls.length > 0)) {
      const assistantToolMsg = await agentRepository.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: choice.message.content,
        toolCalls: choice.message.tool_calls,
        tokenCount: response.usage?.total_tokens,
        model,
      });
      allMessages.push(assistantToolMsg);
      await agentRepository.incrementMessageCount(conversation.id, response.usage?.total_tokens || 0);

      openaiMessages.push({
        role: "assistant",
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
      });

      for (const tc of choice.message.tool_calls!) {
        const toolName = tc.function.name;
        let toolInput: any;
        try {
          toolInput = JSON.parse(tc.function.arguments);
        } catch {
          toolInput = {};
        }

        callbacks?.onToolCall?.(toolName, toolInput);
        const tool = getTool(toolName);
        let toolResult: any;
        let toolStatus = "success";
        let toolError: string | undefined;
        const startTime = Date.now();

        if (!tool) {
          toolResult = { error: `Unknown tool: ${toolName}` };
          toolStatus = "error";
          toolError = `Unknown tool: ${toolName}`;
        } else {
          try {
            toolResult = await tool.execute(toolInput, toolContext);
            if (tool.requiresApproval && toolResult.requiresApproval) {
              const draft = await agentRepository.createDraft({
                orgId,
                conversationId: conversation.id,
                draftType: toolResult.draftType,
                title: toolResult.data.title || toolName,
                data: toolResult.data,
                status: "pending",
                createdById: userId,
              });
              toolResult = { ...toolResult, draftId: draft.id };
            }
          } catch (err: any) {
            toolResult = { error: err.message || "Tool execution failed" };
            toolStatus = "error";
            toolError = err.message;
          }
        }

        const durationMs = Date.now() - startTime;
        toolCallCount++;

        await agentRepository.createToolCall({
          conversationId: conversation.id,
          messageId: assistantToolMsg.id,
          toolName,
          input: toolInput,
          output: toolResult,
          status: toolStatus,
          durationMs,
          error: toolError,
        });

        callbacks?.onToolResult?.(toolName, toolResult);

        const toolMsgContent = JSON.stringify(toolResult);
        await agentRepository.createMessage({
          conversationId: conversation.id,
          role: "tool",
          content: toolMsgContent,
          toolCalls: { toolCallId: tc.id },
        });
        await agentRepository.incrementMessageCount(conversation.id, 0);

        openaiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolMsgContent,
        });
      }
      continue;
    }

    finalResponse = choice.message.content || "";

    if (callbacks?.onToken) {
      callbacks.onToken(finalResponse);
    }

    const assistantMsg = await agentRepository.createMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: finalResponse,
      tokenCount: response.usage?.total_tokens,
      model,
    });
    allMessages.push(assistantMsg);
    await agentRepository.incrementMessageCount(conversation.id, response.usage?.total_tokens || 0);
    break;
  }

  if (!conversation.title || conversation.title === userMessage.slice(0, 100)) {
    const title = userMessage.length > 60 ? userMessage.slice(0, 57) + "..." : userMessage;
    await agentRepository.updateConversation(conversation.id, { title });
    conversation = { ...conversation, title };
  }

  const result: AgentRunResult = {
    conversation,
    messages: allMessages,
    finalResponse,
    toolCallCount,
    totalTokens,
  };

  callbacks?.onComplete?.(result);
  return result;
}

export async function runAgentStream(
  orgId: string,
  userId: string | undefined,
  conversationId: string | undefined,
  userMessage: string,
  onChunk: (chunk: string) => void,
): Promise<AgentRunResult> {
  const client = await createOpenAIClient();
  if (!client) {
    throw new Error("OpenAI is not configured. Please set up your API key.");
  }

  const config = await agentRepository.getConfig(orgId);
  const model = config?.defaultModel || "gpt-4o-mini";
  const maxIterations = config?.maxIterationsPerRun || 10;
  const customPrompt = config?.customSystemPrompt;

  let conversation: AgentConversation;
  if (conversationId) {
    const existing = await agentRepository.getConversation(conversationId, orgId);
    if (!existing) throw new Error("Conversation not found");
    conversation = existing;
  } else {
    conversation = await agentRepository.createConversation({
      orgId,
      userId,
      title: userMessage.slice(0, 100),
      status: "active",
      metadata: {},
    });
  }

  await agentRepository.createMessage({
    conversationId: conversation.id,
    role: "user",
    content: userMessage,
  });
  await agentRepository.incrementMessageCount(conversation.id, 0);

  const history = await agentRepository.getMessages(conversation.id, 50);
  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: customPrompt
        ? `${SYSTEM_PROMPT}\n\nAdditional instructions:\n${customPrompt}`
        : SYSTEM_PROMPT,
    },
    ...history.map(m => {
      if (m.role === "tool") {
        return {
          role: "tool" as const,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          tool_call_id: (m.toolCalls as any)?.toolCallId || "unknown",
        };
      }
      if (m.role === "assistant" && m.toolCalls) {
        return {
          role: "assistant" as const,
          content: m.content || null,
          tool_calls: m.toolCalls as any[],
        };
      }
      return { role: m.role as "user" | "assistant", content: m.content || "" };
    }),
  ];

  const toolDefs = getToolOpenAIDefinitions();
  const toolContext: ToolContext = { orgId, userId, conversationId: conversation.id };
  let totalTokens = 0;
  let toolCallCount = 0;
  let finalResponse = "";
  const allMessages: AgentMessage[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const isLastChance = iteration === maxIterations - 1;

    if (isLastChance) {
      const response = await client.chat.completions.create({
        model,
        messages: openaiMessages,
        temperature: 0.3,
        max_tokens: 4096,
      });
      finalResponse = response.choices[0].message.content || "";
      totalTokens += response.usage?.total_tokens || 0;
      onChunk(JSON.stringify({ type: "text", content: finalResponse }) + "\n");
      break;
    }

    const nonStreamResponse = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      temperature: 0.3,
      max_tokens: 4096,
    });

    const choice = nonStreamResponse.choices[0];
    totalTokens += nonStreamResponse.usage?.total_tokens || 0;

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const assistantToolMsg = await agentRepository.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: choice.message.content,
        toolCalls: choice.message.tool_calls,
        tokenCount: nonStreamResponse.usage?.total_tokens,
        model,
      });
      allMessages.push(assistantToolMsg);
      await agentRepository.incrementMessageCount(conversation.id, nonStreamResponse.usage?.total_tokens || 0);

      openaiMessages.push({
        role: "assistant",
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
      });

      for (const tc of choice.message.tool_calls) {
        const toolName = tc.function.name;
        let toolInput: any;
        try { toolInput = JSON.parse(tc.function.arguments); } catch { toolInput = {}; }

        onChunk(JSON.stringify({ type: "tool_call", toolName, input: toolInput }) + "\n");

        const tool = getTool(toolName);
        let toolResult: any;
        let toolStatus = "success";
        let toolError: string | undefined;
        const startTime = Date.now();

        if (!tool) {
          toolResult = { error: `Unknown tool: ${toolName}` };
          toolStatus = "error";
          toolError = `Unknown tool: ${toolName}`;
        } else {
          try {
            toolResult = await tool.execute(toolInput, toolContext);
            if (tool.requiresApproval && toolResult.requiresApproval) {
              const draft = await agentRepository.createDraft({
                orgId,
                conversationId: conversation.id,
                draftType: toolResult.draftType,
                title: toolResult.data.title || toolName,
                data: toolResult.data,
                status: "pending",
                createdById: userId,
              });
              toolResult = { ...toolResult, draftId: draft.id };
            }
          } catch (err: any) {
            toolResult = { error: err.message };
            toolStatus = "error";
            toolError = err.message;
          }
        }

        const durationMs = Date.now() - startTime;
        toolCallCount++;

        await agentRepository.createToolCall({
          conversationId: conversation.id,
          messageId: assistantToolMsg.id,
          toolName,
          input: toolInput,
          output: toolResult,
          status: toolStatus,
          durationMs,
          error: toolError,
        });

        onChunk(JSON.stringify({ type: "tool_result", toolName, result: toolResult }) + "\n");

        const toolMsgContent = JSON.stringify(toolResult);
        await agentRepository.createMessage({
          conversationId: conversation.id,
          role: "tool",
          content: toolMsgContent,
          toolCalls: { toolCallId: tc.id },
        });
        await agentRepository.incrementMessageCount(conversation.id, 0);

        openaiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolMsgContent,
        });
      }
      continue;
    }

    finalResponse = choice.message.content || "";
    onChunk(JSON.stringify({ type: "text", content: finalResponse }) + "\n");
    break;
  }

  const assistantMsg = await agentRepository.createMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: finalResponse,
    tokenCount: totalTokens,
    model,
  });
  allMessages.push(assistantMsg);
  await agentRepository.incrementMessageCount(conversation.id, totalTokens);

  if (!conversation.title || conversation.title === userMessage.slice(0, 100)) {
    const title = userMessage.length > 60 ? userMessage.slice(0, 57) + "..." : userMessage;
    await agentRepository.updateConversation(conversation.id, { title });
  }

  onChunk(JSON.stringify({ type: "done", conversationId: conversation.id }) + "\n");

  return {
    conversation,
    messages: allMessages,
    finalResponse,
    toolCallCount,
    totalTokens,
  };
}
