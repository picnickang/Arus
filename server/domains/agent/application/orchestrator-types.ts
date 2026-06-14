import type { LLMContentPart } from "../../../lib/llm-gateway/types";
import type { AgentConversation, AgentConfigType } from "@shared/schema";
import type { ToolCallTrace } from "../domain/types";
import type { CompactionConfig } from "./context-compaction";
import type { ToolContext } from "./orchestrator-helpers/tool-execution";

export interface RunContext {
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

export interface LoopOptions {
  mode: "sync" | "stream";
  onChunk?: ((chunk: string) => void) | undefined;
  maxTokenBudget?: number | undefined;
  runtimeAllowlist?: string[] | null | undefined;
  contentParts?: LLMContentPart[];
}

export interface LoopResult {
  finalResponse: string;
  toolCallTraces: ToolCallTrace[];
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  toolCallCount: number;
}
