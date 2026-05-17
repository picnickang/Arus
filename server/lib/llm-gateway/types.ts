/**
 * LLM Gateway — port interface and shared types.
 *
 * The gateway abstracts the underlying LLM provider (OpenAI, Anthropic,
 * local model, etc.) behind a narrow, swappable interface so application
 * code can remain provider-agnostic. Concrete providers live alongside in
 * this directory (`openai-provider.ts`) and are wired up in
 * `server/composition/llm-gateway.ts`.
 *
 * Design constraints:
 *   - Keep the surface area small. We deliberately do not mirror every
 *     OpenAI parameter — only what the codebase actually uses today.
 *   - The provider return shape is the source of truth for `usage` and
 *     `raw`. Higher layers should prefer the normalised `content` /
 *     `toolCalls` fields and only reach into `raw` for provider-specific
 *     fallbacks during migration.
 */

export type LLMRole = "system" | "user" | "assistant" | "tool";

/**
 * Multi-modal content part. Today only text and image (URL or base64
 * data URL) are modelled; extend with audio/file parts when needed.
 * Providers that do not support a given part should error explicitly
 * rather than silently dropping it.
 */
export type LLMContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: {
        url: string;
        /** OpenAI-compatible detail hint. */
        detail?: "auto" | "low" | "high";
      };
    };

export interface LLMMessage {
  role: LLMRole;
  /**
   * Message content. `string` for plain-text turns (the common case),
   * `null` for assistant turns that only emit tool calls, and
   * `LLMContentPart[]` for multi-modal user turns (e.g. text + image).
   */
  content: string | null | LLMContentPart[];
  /** Tool call id this message is responding to (role === "tool"). */
  toolCallId?: string;
  /** Tool calls emitted by an assistant message. */
  toolCalls?: LLMToolCall[];
  /** Free-form name (used by some providers for tool messages). */
  name?: string;
}

export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    /** Raw JSON string as emitted by the model. */
    arguments: string;
  };
}

export interface LLMToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMChatParams {
  model: string;
  messages: LLMMessage[];
  /** Optional JSON-mode request (provider translates appropriately). */
  jsonMode?: boolean;
  maxCompletionTokens?: number;
  temperature?: number;
  /** Tool/function-calling definitions. */
  tools?: LLMToolDefinition[];
  /** "auto" | "none" | { type: "function", function: { name } }. */
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  /** Free-form metadata propagated to the cost meter (e.g. caller name). */
  meta?: LLMCallMeta;
}

/**
 * Call-site metadata. Cost meters use this for attribution and reporting.
 */
export interface LLMCallMeta {
  /** Logical caller, e.g. "equipment-analysis", "agent-orchestrator". */
  caller?: string;
  /** Organisation id for multi-tenant cost attribution. */
  orgId?: string;
  /** Optional correlation id, request id, or conversation id. */
  correlationId?: string;
  /** Anything else useful for downstream telemetry. */
  [k: string]: unknown;
}

export interface LLMChatResponse {
  /** First-choice assistant text content (may be empty when toolCalls is set). */
  content: string;
  /** Tool calls emitted by the assistant, if any. */
  toolCalls: LLMToolCall[];
  /** Finish reason from the provider, normalised lower-case. */
  finishReason: string | null;
  /** Effective model used (provider may have swapped via fallback). */
  model: string;
  usage: LLMUsage;
  /** Provider name (e.g. "openai", "anthropic"). */
  provider: string;
  /** Latency for the call in ms. */
  latencyMs: number;
  /** Raw provider response for migration escape hatches. Avoid in new code. */
  raw: unknown;
}

export interface LLMStreamChunk {
  /** Incremental content delta (may be empty string). */
  contentDelta: string;
  /** Tool call deltas, if the model is invoking tools. */
  toolCallDeltas?: Array<{
    index: number;
    id?: string;
    name?: string;
    argumentsDelta?: string;
  }>;
  finishReason?: string | null;
  /** Final usage snapshot, only emitted on the terminal chunk. */
  usage?: LLMUsage;
  raw: unknown;
}

/**
 * Port: anything that can speak to an LLM.
 *
 * Application code should depend on this interface, never on
 * `OpenAI` / `Anthropic` SDK types directly.
 */
export interface LLMProviderPort {
  /** Human-readable provider name, e.g. "openai". */
  readonly name: string;

  /** Single-shot chat completion. */
  chat(params: LLMChatParams): Promise<LLMChatResponse>;

  /**
   * Streaming chat completion. Implementations should yield zero or more
   * chunks and terminate when the provider signals end-of-stream.
   */
  chatStream(params: LLMChatParams): AsyncIterable<LLMStreamChunk>;

  /**
   * Returns true if the provider currently has the credentials it needs.
   * Used by composition / health checks; callers should not branch on this
   * to silently fall back.
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Pluggable cost / usage telemetry sink. The gateway invokes `record` after
 * every successful chat call. Failures inside the meter must not bubble.
 */
export interface CostMeter {
  record(event: CostMeterEvent): void | Promise<void>;
}

export interface CostMeterEvent {
  provider: string;
  model: string;
  usage: LLMUsage;
  latencyMs: number;
  streamed: boolean;
  meta?: LLMCallMeta;
}

/**
 * The gateway exposed to application code. It is intentionally identical
 * in shape to `LLMProviderPort` so that callers do not need to know
 * whether they're talking to a single provider or a multi-provider
 * router — but the gateway adds telemetry and (in future) routing.
 */
export interface LLMGateway extends LLMProviderPort {}
