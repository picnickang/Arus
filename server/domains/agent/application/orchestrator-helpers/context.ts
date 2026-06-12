import type { LLMMessage } from "../../../../lib/llm-gateway/types";
import type { AgentConversation } from "@shared/schema";
import type { AgentRepositoryPort } from "../../domain/ports";
import { listConversationFiles } from "../../infrastructure/file-registry";
import {
  buildCompactedMessages,
  generateProgressiveSummary,
  shouldSummarize,
  type CompactionConfig,
} from "../context-compaction";
import type { RunContext } from "../orchestrator-types";

export async function buildAgentMessages(
  repo: AgentRepositoryPort,
  ctx: RunContext
): Promise<LLMMessage[]> {
  const contextSummary = await maybeSummarizeConversation(
    repo,
    ctx.conversation,
    ctx.compactionCfg
  );

  const history = ctx.compactionCfg.enabled
    ? await repo.messages.listRecent(
        ctx.conversation.id,
        contextSummary
          ? Math.max(
              20,
              (ctx.conversation.messageCount || 50) - (ctx.conversation.summarizedUpTo || 0)
            )
          : 100
      )
    : await repo.messages.list(ctx.conversation.id, 50);

  return buildCompactedMessages(history, ctx.customPrompt, contextSummary, ctx.compactionCfg);
}

export async function appendAgentFileContext(
  conversationId: string,
  orgId: string,
  messages: LLMMessage[]
): Promise<void> {
  const convFiles = await listConversationFiles(conversationId, orgId);
  if (convFiles.length === 0) {
    return;
  }

  const fileRefContext = convFiles
    .map((f) => `- fileId: "${f.id}" | ${f.filename} (${f.mimetype}, ${f.size} bytes)`)
    .join("\n");

  messages.push({
    role: "system" as const,
    content: `Available files for this conversation:\n${fileRefContext}\nUse analyzeImage or analyzeSpreadsheet tools with these fileIds when relevant.`,
  });
}

async function maybeSummarizeConversation(
  repo: AgentRepositoryPort,
  conversation: AgentConversation,
  compactionCfg: CompactionConfig
): Promise<string | null | undefined> {
  if (!compactionCfg.enabled) {
    return conversation.contextSummary;
  }

  const summarizedUpTo = conversation.summarizedUpTo || 0;
  if (!shouldSummarize(conversation.messageCount, summarizedUpTo, compactionCfg.threshold)) {
    return conversation.contextSummary;
  }

  const allMessages = await repo.messages.list(conversation.id, 10000);
  const keepRecent = 10;
  const messagesToSummarize = allMessages.slice(
    summarizedUpTo,
    Math.max(summarizedUpTo, allMessages.length - keepRecent)
  );

  if (messagesToSummarize.length < 5) {
    return conversation.contextSummary;
  }

  const summary = await generateProgressiveSummary(
    messagesToSummarize,
    conversation.contextSummary
  );
  if (!summary) {
    return conversation.contextSummary;
  }

  const newSummarizedUpTo = Math.max(0, allMessages.length - keepRecent);
  await repo.conversations.update(conversation.id, {
    contextSummary: summary,
    summarizedUpTo: newSummarizedUpTo,
  } as Partial<AgentConversation>);

  conversation.summarizedUpTo = newSummarizedUpTo;
  return summary;
}
