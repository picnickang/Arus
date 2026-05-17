/**
 * OpenAI provider adapter for the LLM Gateway.
 *
 * Wraps the existing `createOpenAIClient` + `callWithModelFallback` helpers
 * in `server/openai/client.ts` so we keep the production-tested retry /
 * model-fallback behaviour while exposing the narrow `LLMProviderPort`.
 */

import type OpenAI from "openai";
import { createLogger } from "../structured-logger";
import {
  callWithModelFallback,
  createOpenAIClient,
  retryWithBackoff,
} from "../../openai/client";
import type {
  LLMChatParams,
  LLMChatResponse,
  LLMProviderPort,
  LLMStreamChunk,
  LLMToolCall,
  LLMUsage,
} from "./types";

const logger = createLogger("Lib:LlmGateway:OpenaiProvider");

type ClientFactory = () => Promise<OpenAI | null>;

export interface OpenAIProviderOptions {
  /** Override the client factory (used by tests). */
  clientFactory?: ClientFactory;
}

const ZERO_USAGE: LLMUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

function toOpenAIMessages(params: LLMChatParams): unknown[] {
  return params.messages.map((m) => {
    const base: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.name) base.name = m.name;
    if (m.toolCallId) base.tool_call_id = m.toolCallId;
    if (m.toolCalls && m.toolCalls.length > 0) {
      base.tool_calls = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
    }
    return base;
  });
}

function toOpenAIToolChoice(choice: LLMChatParams["toolChoice"]): unknown {
  if (!choice) return undefined;
  if (choice === "auto" || choice === "none") return choice;
  return { type: "function", function: { name: choice.function.name } };
}

function buildOpenAIParams(params: LLMChatParams): Record<string, unknown> {
  const out: Record<string, unknown> = {
    model: params.model,
    messages: toOpenAIMessages(params),
  };
  if (params.maxCompletionTokens !== undefined) {
    out.max_completion_tokens = params.maxCompletionTokens;
  }
  if (params.temperature !== undefined) {
    out.temperature = params.temperature;
  }
  if (params.jsonMode) {
    out.response_format = { type: "json_object" };
  }
  if (params.tools && params.tools.length > 0) {
    out.tools = params.tools;
  }
  const tc = toOpenAIToolChoice(params.toolChoice);
  if (tc !== undefined) {
    out.tool_choice = tc;
  }
  return out;
}

function extractToolCalls(message: unknown): LLMToolCall[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tc = (message as any)?.tool_calls;
  if (!Array.isArray(tc)) return [];
  return tc
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((t: any) => t?.type === "function" && t?.function?.name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((t: any) => ({
      id: String(t.id),
      type: "function" as const,
      function: {
        name: String(t.function.name),
        arguments: typeof t.function.arguments === "string" ? t.function.arguments : "",
      },
    }));
}

function extractUsage(raw: unknown): LLMUsage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = (raw as any)?.usage;
  if (!u) return ZERO_USAGE;
  return {
    promptTokens: Number(u.prompt_tokens ?? 0),
    completionTokens: Number(u.completion_tokens ?? 0),
    totalTokens: Number(u.total_tokens ?? 0),
  };
}

export class OpenAIProvider implements LLMProviderPort {
  readonly name = "openai";
  private readonly clientFactory: ClientFactory;

  constructor(opts: OpenAIProviderOptions = {}) {
    this.clientFactory = opts.clientFactory ?? createOpenAIClient;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const client = await this.clientFactory();
      return client !== null;
    } catch (err) {
      logger.warn("OpenAI availability check failed", { err: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    const client = await this.clientFactory();
    if (!client) {
      throw new Error("OpenAI client not available - API key not configured");
    }

    const oaiParams = buildOpenAIParams(params);
    const started = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await callWithModelFallback(client, oaiParams as any);
    const latencyMs = Date.now() - started;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const choice0 = (raw as any)?.choices?.[0];
    const message = choice0?.message;
    const contentRaw = message?.content;
    const content = typeof contentRaw === "string" ? contentRaw : "";

    return {
      content,
      toolCalls: extractToolCalls(message),
      finishReason: choice0?.finish_reason ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: String((raw as any)?.model ?? params.model),
      usage: extractUsage(raw),
      provider: this.name,
      latencyMs,
      raw,
    };
  }

  async *chatStream(params: LLMChatParams): AsyncIterable<LLMStreamChunk> {
    const client = await this.clientFactory();
    if (!client) {
      throw new Error("OpenAI client not available - API key not configured");
    }
    const oaiParams = { ...buildOpenAIParams(params), stream: true, stream_options: { include_usage: true } };

    // Wrap the initial stream-creation call in retry, but iteration itself
    // cannot be retried mid-stream.
    const stream = await retryWithBackoff(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).chat.completions.create(oaiParams)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const chunk of stream as AsyncIterable<any>) {
      const choice = chunk?.choices?.[0];
      const delta = choice?.delta;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolDeltas: any[] | undefined = delta?.tool_calls;
      const out: LLMStreamChunk = {
        contentDelta: typeof delta?.content === "string" ? delta.content : "",
        finishReason: choice?.finish_reason ?? null,
        raw: chunk,
      };
      if (Array.isArray(toolDeltas)) {
        out.toolCallDeltas = toolDeltas.map((t) => ({
          index: Number(t.index ?? 0),
          id: t.id,
          name: t.function?.name,
          argumentsDelta: t.function?.arguments,
        }));
      }
      if (chunk?.usage) {
        out.usage = extractUsage(chunk);
      }
      yield out;
    }
  }
}
