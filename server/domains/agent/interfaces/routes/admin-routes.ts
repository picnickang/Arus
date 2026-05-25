import { createLogger } from "../../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Interfaces:Routes:AdminRoutes");
import type { Express, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { agentRepo } from "../../infrastructure/repository";
import { buildSystemPrompt } from "../../domain/system-prompt";
import { auditAction } from "../../../../utils/audit-helpers";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface AdminRouteDeps {
  rateLimit: RateLimitMiddleware;
  requireAdminRole: RoleMiddleware;
}

export function registerAdminRoutes(app: Express, deps: AdminRouteDeps) {
  const { rateLimit, requireAdminRole } = deps;

  app.get(
    "/api/agent/admin/conversations",
    rateLimit.generalApiRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const limit = parseInt(req.query['limit'] as string) || 100;
        const conversations = await agentRepo.conversations.list(orgId, undefined, limit);
        res.json(conversations);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/admin/export-jsonl",
    rateLimit.generalApiRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const config = await agentRepo.config.get(orgId);
        const systemContent = buildSystemPrompt(config?.customSystemPrompt);

        const allConversations = await agentRepo.conversations.list(orgId, undefined, 10000);

        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="agent-conversations-${new Date().toISOString().slice(0, 10)}.jsonl"`
        );
        res.setHeader("X-Total-Conversations", String(allConversations.length));

        const CONV_LIMIT = 10000;
        const MSG_LIMIT = 500;
        if (allConversations.length >= CONV_LIMIT) {
          res.setHeader("X-Truncated", "true");
        }
        let truncatedConversations = 0;
        for (const conv of allConversations) {
          const messages = await agentRepo.messages.list(conv.id, MSG_LIMIT);
          if (messages.length === 0) {
            continue;
          }
          if (messages.length >= MSG_LIMIT) {
            truncatedConversations++;
          }

          const openaiMessages: Record<string, unknown>[] = [];
          openaiMessages.push({ role: "system", content: systemContent });

          for (const msg of messages) {
            if (msg.role === "user") {
              openaiMessages.push({ role: "user", content: msg.content || "" });
            } else if (msg.role === "assistant" && msg.toolCalls) {
              const calls = msg.toolCalls as {
                id: string;
                type: string;
                function: { name: string; arguments: string };
              }[];
              openaiMessages.push({
                role: "assistant",
                content: msg.content || null,
                tool_calls: calls,
              });
            } else if (msg.role === "assistant") {
              openaiMessages.push({ role: "assistant", content: msg.content || "" });
            } else if (msg.role === "tool") {
              const ref = msg.toolCalls as { toolCallId?: string } | null;
              openaiMessages.push({
                role: "tool",
                content:
                  typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
                tool_call_id: ref?.toolCallId || "unknown",
              });
            }
          }

          if (openaiMessages.length > 1) {
            res.write(`${JSON.stringify({ messages: openaiMessages })}\n`);
          }
        }

        if (truncatedConversations > 0) {
          logger.info(`[Agent Export] ${truncatedConversations} conversation(s) had messages truncated at ${MSG_LIMIT}`);
        }
        res.end();
      } catch (error: unknown) {
        if (!res.headersSent) {
          res.status(500).json({ error: error instanceof Error ? error.message : "Export failed" });
        } else {
          res.end();
        }
      }
    }
  );

  app.delete(
    "/api/agent/admin/conversations",
    rateLimit.writeOperationRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const conversations = await agentRepo.conversations.list(orgId, undefined, 1000);
        let purged = 0;
        for (const conv of conversations) {
          await agentRepo.conversations.delete(conv.id);
          purged++;
        }

        await auditAction(
          "agent_conversations",
          orgId,
          "delete",
          {
            action: "bulk_purge",
            count: purged,
          },
          { orgId, userId: (req as AuthenticatedRequest).user?.id }
        );

        res.json({ purged });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
