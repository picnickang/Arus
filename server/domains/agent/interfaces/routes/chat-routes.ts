import type { Express, Request, Response } from "express";
import type { Multer } from "multer";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import type { AgentOrchestrator } from "../../application/orchestrator";
import { agentRepo } from "../../infrastructure/repository";
import { registerFile, listConversationFiles } from "../../infrastructure/file-registry";
import { knowledgeBaseAdapter } from "../../infrastructure/kb-adapter";
import { createLogger } from "../../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Interfaces:Routes:ChatRoutes");
import {
  ingestFilesToKB,
  buildIngestionSystemMessage,
} from "../../infrastructure/kb-ingestion-helper";
import { auditAction } from "../../../../utils/audit-helpers";
import type { RateLimitMiddleware } from "./_shared";

export interface ChatRouteDeps {
  orchestrator: AgentOrchestrator;
  upload: Multer;
  rateLimit: RateLimitMiddleware;
}

export function registerChatRoutes(app: Express, deps: ChatRouteDeps) {
  const { orchestrator, upload, rateLimit } = deps;

  app.post(
    "/api/agent/chat",
    rateLimit.writeOperationRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id;
        const userRole = (req as AuthenticatedRequest).user?.role;
        const { message, conversationId } = req.body;

        if (!message || typeof message !== "string") {
          return res.status(400).json({ error: "Message is required" });
        }

        const result = await orchestrator.run(orgId, userId, conversationId, message, userRole);

        await auditAction(
          "agent_conversation",
          result.conversationId,
          "update",
          {
            action: "chat",
            toolCallCount: result.toolCallCount,
            totalTokens: result.totalTokens,
          },
          { orgId, userId }
        );

        res.json({
          conversationId: result.conversationId,
          response: result.finalResponse,
          toolCalls: result.toolCalls,
          toolCallCount: result.toolCallCount,
          totalTokens: result.totalTokens,
        });
      } catch (error: unknown) {
        logger.error("[Agent] Chat error:", undefined, error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Agent error" });
      }
    }
  );

  app.post(
    "/api/agent/chat-multimodal",
    rateLimit.writeOperationRateLimit,
    upload.array("files", 5),
    async (req: Request, res: Response) => {
      const files = (req.files as Express.Multer.File[]) || [];
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id;
        const userRole = (req as AuthenticatedRequest).user?.role;
        const { message, conversationId } = req.body;

        if (!message || typeof message !== "string") {
          return res.status(400).json({ error: "Message is required" });
        }

        const attachments = files.map((f) => ({
          filename: f.originalname,
          mimetype: f.mimetype,
          path: f.path,
          size: f.size,
        }));

        const result = await orchestrator.runWithAttachments(
          orgId,
          userId,
          conversationId,
          message,
          attachments,
          userRole
        );

        const convFiles = await listConversationFiles(result.conversationId, orgId);
        const fileRefs = convFiles.map((f) => ({
          fileId: f.id,
          filename: f.filename,
          mimetype: f.mimetype,
          size: f.size,
        }));

        res.json({
          conversationId: result.conversationId,
          response: result.finalResponse,
          toolCalls: result.toolCalls,
          toolCallCount: result.toolCallCount,
          totalTokens: result.totalTokens,
          files: fileRefs,
        });
      } catch (error: unknown) {
        logger.error("[Agent] Multimodal chat error:", undefined, error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Agent error" });
      }
    }
  );

  app.post(
    "/api/agent/conversations/:id/files",
    rateLimit.writeOperationRateLimit,
    upload.array("files", 5),
    async (req: Request, res: Response) => {
      const files = (req.files as Express.Multer.File[]) || [];
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id;
        const conversationId = req.params.id;

        const existing = await agentRepo.conversations.get(conversationId, orgId);
        if (!existing) {
          return res.status(404).json({ error: "Conversation not found" });
        }

        const fileRefs = await Promise.all(
          files.map(async (f) => {
            const record = await registerFile(orgId, conversationId, f);
            return {
              fileId: record.id,
              filename: record.filename,
              mimetype: record.mimetype,
              size: record.size,
              originalname: f.originalname,
              path: f.path,
            };
          })
        );

        const kbFiles = fileRefs.map((f) => ({
          path: f.path,
          filename: f.originalname,
          mimetype: f.mimetype,
        }));
        const kbResults = await ingestFilesToKB(knowledgeBaseAdapter, orgId, kbFiles, userId);

        const kbIngestedSet = new Set(kbResults.map((r) => r.filename));

        if (kbResults.length > 0) {
          try {
            const systemContent = buildIngestionSystemMessage(kbResults);
            await agentRepo.messages.create({
              conversationId,
              role: "system",
              content: systemContent,
            });
          } catch (err) {
            logger.warn("[Agent] Failed to create KB ingestion system message:", { details: err instanceof Error ? err.message : "unknown" });
          }
        }

        res.json({
          files: fileRefs.map((f) => ({
            fileId: f.fileId,
            filename: f.filename,
            mimetype: f.mimetype,
            size: f.size,
            kbIngested: kbIngestedSet.has(f.originalname),
          })),
        });
      } catch (error: unknown) {
        logger.error("[Agent] File upload error:", undefined, error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Upload failed" });
      }
    }
  );

  app.get(
    "/api/agent/conversations/:id/files",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const conversationId = req.params.id;
        const files = await listConversationFiles(conversationId, orgId);
        res.json({
          files: files.map((f) => ({
            fileId: f.id,
            filename: f.filename,
            mimetype: f.mimetype,
            size: f.size,
          })),
        });
      } catch (error: unknown) {
        res
          .status(500)
          .json({ error: error instanceof Error ? error.message : "Failed to list files" });
      }
    }
  );

  app.get(
    "/api/agent/chat-stream",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id;
        const userRole = (req as AuthenticatedRequest).user?.role;
        const message = req.query.message as string;
        const conversationId = req.query.conversationId as string | undefined;

        if (!message) {
          return res.status(400).json({ error: "Message query parameter is required" });
        }

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });

        await orchestrator.runStream(
          orgId,
          userId,
          conversationId,
          message,
          (chunk) => {
            res.write(`data: ${chunk}\n\n`);
          },
          userRole
        );

        res.end();
      } catch (error: unknown) {
        logger.error("[Agent] Stream error:", undefined, error);
        if (!res.headersSent) {
          res
            .status(500)
            .json({ error: error instanceof Error ? error.message : "Agent stream error" });
        } else {
          res.write(
            `data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Unknown error" })}\n\n`
          );
          res.end();
        }
      }
    }
  );
}
