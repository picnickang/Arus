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
  analyzeErrorType,
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

// Narrow shapes of the OpenAI chat.completions wire response we extract from.
// Kept local (and structural) because the `openai` SDK's request/response types
// have shifted between major versions; using `unknown` + these guards is more
// stable than importing the SDK's internal types.
interface OpenAIChatMessageShape {
  content?: unknown;
  tool_calls?: unknown;
}
interface OpenAIChatChoiceShape {
  message?: OpenAIChatMessageShape;
  delta?: OpenAIStreamDeltaShape;
  finish_reason?: string | null;
}
interface OpenAIChatRawShape {
  choices?: OpenAIChatChoiceShape[];
  model?: string;
  usage?: OpenAIUsageShape;
}
interface OpenAIUsageShape {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}
interface OpenAIToolCallShape {
  id?: unknown;
  type?: unknown;
  function?: { name?: unknown; arguments?: unknown };
  index?: unknown;
}
interface OpenAIStreamDeltaShape {
  content?: unknown;
  tool_calls?: OpenAIToolCallShape[];
}
interface OpenAIStreamChunkShape {
  choices?: OpenAIChatChoiceShape[];
  usage?: OpenAIUsageShape;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asChatRaw(value: unknown): OpenAIChatRawShape {
  return isRecord(value) ? (value as OpenAIChatRawShape) : {};
}
function asStreamChunk(value: unknown): OpenAIStreamChunkShape {
  return isRecord(value) ? (value as OpenAIStreamChunkShape) : {};
}

function toOpenAIMessages(params: LLMChatParams): unknown[] {
  return params.messages.map((m) => {
    // OpenAI's chat.completions API accepts both `string` and
    // `ContentPart[]` for `content`; our LLMContentPart shape is the
    // OpenAI wire shape, so we can pass arrays straight through.
    const base: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.name) {
      base['name'] = m.name;
    }
    if (m.toolCallId) {
      base['tool_call_id'] = m.toolCallId;
    }
    if (m.toolCalls && m.toolCalls.length > 0) {
      base['tool_calls'] = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
    }
    return base;
  });
}

function toOpenAIToolChoice(choice: LLMChatParams["toolChoice"]): unknown {
  if (!choice) {
    return undefined;
  }
  if (choice === "auto" || choice === "none") {
    return choice;
  }
  return { type: "function", function: { name: choice.function.name } };
}

function buildOpenAIParams(params: LLMChatParams): Record<string, unknown> {
  const out: Record<string, unknown> = {
    model: params.model,
    messages: toOpenAIMessages(params),
  };
  if (params.maxCompletionTokens !== undefined) {
    out['max_completion_tokens'] = params.maxCompletionTokens;
  }
  if (params.temperature !== undefined) {
    out['temperature'] = params.temperature;
  }
  if (params.jsonMode) {
    out['response_format'] = { type: "json_object" };
  }
  if (params.tools && params.tools.length > 0) {
    out['tools'] = params.tools;
  }
  const tc = toOpenAIToolChoice(params.toolChoice);
  if (tc !== undefined) {
    out['tool_choice'] = tc;
  }
  return out;
}

function extractToolCalls(message: OpenAIChatMessageShape | undefined): LLMToolCall[] {
  const tc = message?.tool_calls;
  if (!Array.isArray(tc)) {
    return [];
  }
  return (tc as OpenAIToolCallShape[])
    .filter((t) => t?.type === "function" && isRecord(t.function) && typeof t.function.name === "string")
    .map((t) => ({
      id: String(t.id),
      type: "function" as const,
      function: {
        name: String(t.function?.name ?? ""),
        arguments: typeof t.function?.arguments === "string" ? t.function.arguments : "",
      },
    }));
}

function extractUsage(raw: unknown): LLMUsage {
  const u = asChatRaw(raw).usage;
  if (!u) {
    return ZERO_USAGE;
  }
  return {
    promptTokens: Number(u.prompt_tokens ?? 0),
    completionTokens: Number(u.completion_tokens ?? 0),
    totalTokens: Number(u.total_tokens ?? 0),
  };
}

// The `openai` SDK's typed `create()` overloads are extremely strict about
// param shape; our `buildOpenAIParams` produces a Record<string, unknown>
// that the production-tested `callWithModelFallback` accepts unchanged.
// One narrow boundary cast — documented — bridges the two.
type OpenAICreateClient = OpenAI & {
  chat: { completions: { create: (params: Record<string, unknown>) => Promise<unknown> } };
};
type OpenAIFallbackParams = Parameters<typeof callWithModelFallback>[1];

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
    const raw = await callWithModelFallback(client, oaiParams as OpenAIFallbackParams);
    const latencyMs = Date.now() - started;

    const choice0 = asChatRaw(raw).choices?.[0];
    const message = choice0?.message;
    const contentRaw = message?.content;
    const content = typeof contentRaw === "string" ? contentRaw : "";

    return {
      content,
      toolCalls: extractToolCalls(message),
      finishReason: choice0?.finish_reason ?? null,
      model: String(asChatRaw(raw).model ?? params.model),
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
    const oaiParams: Record<string, unknown> = {
      ...buildOpenAIParams(params),
      stream: true,
      stream_options: { include_usage: true },
    };

    // Wrap the initial stream-creation call in retry, but iteration itself
    // cannot be retried mid-stream. Mirror callWithModelFallback so that
    // model_overloaded / rate-limit errors fall back to gpt-4o-mini before
    // the first SSE chunk is emitted.
    const createClient = client as OpenAICreateClient;
    let stream: unknown;
    try {
      stream = await retryWithBackoff(() =>
        createClient.chat.completions.create(oaiParams)
      );
    } catch (error: unknown) {
      const analysis = analyzeErrorType(error);
      if (analysis.fallbackModel && oaiParams['model'] !== analysis.fallbackModel) {
        logger.warn(
          `Streaming: falling back from ${oaiParams['model']} to ${analysis.fallbackModel} due to: ${analysis.recommendation}`
        );
        stream = await retryWithBackoff(() =>
          createClient.chat.completions.create({
            ...oaiParams,
            model: analysis.fallbackModel,
          })
        );
      } else {
        throw error;
      }
    }

    for await (const chunkRaw of stream as AsyncIterable<unknown>) {
      const chunk = asStreamChunk(chunkRaw);
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;
      const toolDeltas: OpenAIToolCallShape[] | undefined = delta?.tool_calls;
      const out: LLMStreamChunk = {
        contentDelta: typeof delta?.content === "string" ? delta.content : "",
        finishReason: choice?.finish_reason ?? null,
        raw: chunkRaw,
      };
      if (Array.isArray(toolDeltas)) {
        out.toolCallDeltas = toolDeltas.map((t) => ({
          index: Number(t.index ?? 0),
          id: typeof t.id === "string" ? t.id : undefined,
          name: typeof t.function?.name === "string" ? t.function.name : undefined,
          argumentsDelta: typeof t.function?.arguments === "string" ? t.function.arguments : undefined,
        }));
      }
      if (chunk.usage) {
        out.usage = extractUsage(chunkRaw);
      }
      yield out;
    }
  }
}
