import OpenAI from "openai";
import type { AgentMessage } from "@shared/schema";
import { buildSystemPrompt } from "../domain/system-prompt";

const TOOL_OUTPUT_CHAR_LIMIT = 4000;

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "gpt-4o-mini": 128000,
  "gpt-4o": 128000,
  "gpt-4-turbo": 128000,
};

const CONTEXT_USAGE_RATIO = 0.8;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function compactToolOutput(content: string): string {
  if (content.length <= TOOL_OUTPUT_CHAR_LIMIT) return content;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const truncated = content.slice(0, TOOL_OUTPUT_CHAR_LIMIT);
    return `[Compacted: original ${content.length} chars, showing first ${TOOL_OUTPUT_CHAR_LIMIT}]\n${truncated}\n[... truncated]`;
  }

  if (Array.isArray(parsed)) {
    const totalCount = parsed.length;
    const preview = parsed.slice(0, 5);
    const previewStr = JSON.stringify(preview, null, 0);

    if (previewStr.length <= TOOL_OUTPUT_CHAR_LIMIT) {
      return JSON.stringify({
        _compacted: true,
        _totalRecords: totalCount,
        _showing: Math.min(5, totalCount),
        _note: `Showing first ${Math.min(5, totalCount)} of ${totalCount} records`,
        data: preview,
      });
    }
    return JSON.stringify({
      _compacted: true,
      _totalRecords: totalCount,
      _note: `Result contained ${totalCount} records (too large to display inline)`,
      data: parsed.slice(0, 2),
    });
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 5) {
        const arr = obj[key] as unknown[];
        obj[key] = arr.slice(0, 5);
        (obj as Record<string, unknown>)[`_${key}_total`] = arr.length;
        (obj as Record<string, unknown>)[`_${key}_note`] = `Showing first 5 of ${arr.length}`;
      }
    }

    const compacted = JSON.stringify(obj);
    if (compacted.length <= TOOL_OUTPUT_CHAR_LIMIT) return compacted;

    const truncated = compacted.slice(0, TOOL_OUTPUT_CHAR_LIMIT);
    return `[Compacted: original ${content.length} chars]\n${truncated}\n[... truncated]`;
  }

  const truncated = content.slice(0, TOOL_OUTPUT_CHAR_LIMIT);
  return `[Compacted: original ${content.length} chars]\n${truncated}\n[... truncated]`;
}

export async function generateConversationSummary(
  client: OpenAI,
  messages: AgentMessage[],
  model: string,
): Promise<string> {
  const condensed = messages.map(m => {
    const role = m.role;
    let text = m.content || "";
    if (text.length > 500) text = text.slice(0, 500) + "...";
    return `[${role}]: ${text}`;
  }).join("\n");

  const summaryPrompt = `Summarize the following conversation history into a concise paragraph. Focus on:
- Key topics discussed
- Important data points, equipment, or entities mentioned
- Decisions made or actions taken
- Any pending questions or issues

Keep the summary under 300 words. Be factual and specific.

Conversation:
${condensed}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a conversation summarizer. Produce concise, factual summaries." },
        { role: "user", content: summaryPrompt },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });
    return response.choices[0]?.message?.content || "No summary generated.";
  } catch (err) {
    console.warn("[ContextCompaction] Summary generation failed:", err instanceof Error ? err.message : "unknown");
    return "";
  }
}

interface StoredToolCallRef {
  toolCallId: string;
}

export interface CompactionConfig {
  enabled: boolean;
  threshold: number;
  model: string;
}

export function buildCompactedMessages(
  history: AgentMessage[],
  customPrompt: string | null | undefined,
  contextSummary: string | null | undefined,
  compactionConfig: CompactionConfig,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(customPrompt) },
  ];

  if (contextSummary && compactionConfig.enabled) {
    result.push({
      role: "system",
      content: `[Previous conversation summary]\n${contextSummary}\n[End of summary — recent messages follow]`,
    });
  }

  const modelWindow = MODEL_CONTEXT_WINDOWS[compactionConfig.model] || 128000;
  const maxContextTokens = Math.floor(modelWindow * CONTEXT_USAGE_RATIO);

  const systemTokens = result.reduce((sum, m) => {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return sum + estimateTokens(content || "");
  }, 0);

  let budgetRemaining = maxContextTokens - systemTokens - 4096;

  const mappedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  for (const m of history) {
    if (m.role === "tool") {
      const ref = m.toolCalls as unknown as StoredToolCallRef | null;
      let content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);

      if (compactionConfig.enabled) {
        content = compactToolOutput(content);
      }

      mappedMessages.push({
        role: "tool" as const,
        content,
        tool_call_id: ref?.toolCallId || "unknown",
      });
    } else if (m.role === "assistant" && m.toolCalls) {
      const calls = m.toolCalls as unknown as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
      mappedMessages.push({
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: calls,
      });
    } else {
      mappedMessages.push({
        role: m.role as "user" | "assistant",
        content: m.content || "",
      });
    }
  }

  if (!compactionConfig.enabled) {
    result.push(...mappedMessages);
    return result;
  }

  const messagesWithTokens = mappedMessages.map(m => {
    let text: string;
    if (m.role === "assistant" && "tool_calls" in m && m.tool_calls) {
      text = (m.content || "") + JSON.stringify(m.tool_calls);
    } else {
      text = typeof m.content === "string" ? m.content : JSON.stringify(m.content || "");
    }
    return { msg: m, tokens: estimateTokens(text) };
  });

  const selected: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  for (let i = messagesWithTokens.length - 1; i >= 0; i--) {
    const { msg, tokens } = messagesWithTokens[i];
    if (tokens > budgetRemaining) {
      break;
    }
    budgetRemaining -= tokens;
    selected.unshift(msg);
  }

  result.push(...selected);
  return result;
}

export function shouldSummarize(
  messageCount: number,
  summarizedUpTo: number,
  threshold: number,
): boolean {
  const unsummarizedCount = messageCount - summarizedUpTo;
  return unsummarizedCount >= threshold;
}
