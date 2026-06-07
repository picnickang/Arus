import type { Express, Request, Response } from "express";
import { z } from "zod";
import { authenticatedRequest } from "../../../../middleware/auth";
import { agentRepo } from "../../infrastructure/repository";
import { getRegisteredToolNames } from "../../tools";
import { auditAction } from "../../../../utils/audit-helpers";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface ConfigRouteDeps {
  rateLimit: RateLimitMiddleware;
  requireAdminRole: RoleMiddleware;
}

const configUpdateSchema = z.object({
  defaultModel: z.enum(["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"]).optional(),
  maxIterationsPerRun: z.number().int().min(1).max(50).optional(),
  maxTokensPerConversation: z.number().int().min(1000).max(500000).optional(),
  dailyTokenLimit: z.number().int().min(10000).max(50000000).optional(),
  monthlyTokenLimit: z.number().int().min(100000).max(500000000).optional(),
  customSystemPrompt: z.string().max(5000).optional().nullable(),
  enabledTools: z.array(z.string()).optional().nullable(),
  contextCompaction: z.boolean().optional(),
  compactionThreshold: z.number().int().min(5).max(100).optional(),
  toolOutputCharLimit: z.number().int().min(500).max(50000).optional(),
  deferredToolLoading: z.boolean().optional(),
  permissionTier: z.enum(["strict", "balanced", "autonomous"]).optional(),
  autoTriggerEnabled: z.boolean().optional(),
  autoTriggerThreshold: z.number().min(0.8).max(1.0).optional(),
});

export function registerConfigRoutes(app: Express, deps: ConfigRouteDeps) {
  const { rateLimit, requireAdminRole } = deps;

  app.get(
    "/api/agent/config",
    rateLimit.generalApiRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = authenticatedRequest(req).orgId;
        const config = await agentRepo.config.get(orgId);
        return res.json(
          config || {
            defaultModel: "gpt-4o-mini",
            maxIterationsPerRun: 10,
            maxTokensPerConversation: 50000,
            dailyTokenLimit: 500000,
            monthlyTokenLimit: 5000000,
            contextCompaction: true,
            compactionThreshold: 30,
            toolOutputCharLimit: 4000,
            deferredToolLoading: true,
            permissionTier: "strict",
            autoTriggerEnabled: false,
            autoTriggerThreshold: 0.85,
          }
        );
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.put(
    "/api/agent/config",
    rateLimit.writeOperationRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = authenticatedRequest(req).orgId;
        const parsed = configUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid configuration", details: parsed.error.flatten().fieldErrors });
        }

        if (
          parsed.data.enabledTools &&
          Array.isArray(parsed.data.enabledTools) &&
          parsed.data.enabledTools.length > 0
        ) {
          const registeredNames = getRegisteredToolNames();
          const invalid = parsed.data.enabledTools.filter((t) => !registeredNames.includes(t));
          if (invalid.length > 0) {
            return res
              .status(400)
              .json({
                error: "Invalid tool names in enabledTools",
                invalidTools: invalid,
                validTools: registeredNames,
              });
          }
        }

        const config = await agentRepo.config.upsert({ ...parsed.data, orgId });

        await auditAction(
          "agent_config",
          config.id,
          "update",
          {
            action: "config_updated",
            fields: Object.keys(parsed.data),
          },
          { orgId, userId: authenticatedRequest(req).user?.id }
        );

        return res.json(config);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.delete(
    "/api/agent/config",
    rateLimit.writeOperationRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = authenticatedRequest(req).orgId;
        const defaults = {
          orgId,
          defaultModel: "gpt-4o-mini",
          maxIterationsPerRun: 10,
          maxTokensPerConversation: 50000,
          dailyTokenLimit: 500000,
          monthlyTokenLimit: 5000000,
          customSystemPrompt: null,
          enabledTools: null,
          contextCompaction: true,
          compactionThreshold: 30,
          toolOutputCharLimit: 4000,
          deferredToolLoading: true,
          permissionTier: "strict",
          autoTriggerEnabled: false,
          autoTriggerThreshold: 0.85,
        };
        const config = await agentRepo.config.upsert(defaults);
        return res.json(config);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
