import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { AgentOrchestrator } from "../application/orchestrator";
import { SafetyService } from "../application/safety-service";
import { SuggestionEngine } from "../application/suggestion-engine";
import { SchedulerService } from "../application/scheduler-service";
import { agentRepo } from "../infrastructure/repository";
import { MAINTENANCE_ROLES } from "../domain/types";
import { db } from "../../../db";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Interfaces:Routes");

import { getOrgUploadDir } from "../infrastructure/file-registry";
import { knowledgeBaseAdapter } from "../infrastructure/kb-adapter";
import { createFindingsAdapter } from "../infrastructure/findings-adapter";
import { FindingsAggregatorService } from "../application/findings-service";
import { OutcomeTrackingService } from "../application/outcome-service";
import { PredictionFeedbackAdapter } from "../infrastructure/prediction-feedback-adapter";
import { BriefingRepositoryAdapter } from "../infrastructure/briefing-repository-adapter";
import { BriefingDataAdapter } from "../infrastructure/briefing-data-adapter";
import { BriefingGeneratorService } from "../application/briefing-generator-service";
import { ActivityRepositoryAdapter } from "../infrastructure/activity-repository-adapter";
import { AgentActivityService } from "../application/activity-service";
import { AgentTaskRepositoryAdapter } from "../infrastructure/task-repository-adapter";
import { AgentFindingRepositoryAdapter } from "../infrastructure/finding-repository-adapter";
import { AgentTaskService } from "../application/task-service";
import { AgentFindingService } from "../application/finding-service";

import type { RateLimitMiddleware, RoleMiddleware } from "./routes/_shared";
import { registerChatRoutes } from "./routes/chat-routes";
import { registerConversationsRoutes } from "./routes/conversations-routes";
import { registerDraftsRoutes } from "./routes/drafts-routes";
import { registerConfigRoutes } from "./routes/config-routes";
import { registerUsageRoutes } from "./routes/usage-routes";
import { registerSuggestionsRoutes } from "./routes/suggestions-routes";
import { registerSchedulesRoutes } from "./routes/schedules-routes";
import { registerToolsRoutes } from "./routes/tools-routes";
import { registerAdminRoutes } from "./routes/admin-routes";
import { registerReportsRoutes } from "./routes/reports-routes";
import { registerFindingsRoutes } from "./routes/findings-routes";
import { registerBriefingsRoutes } from "./routes/briefings-routes";
import { registerActivityRoutes } from "./routes/activity-routes";
import { registerTasksRoutes } from "./routes/tasks-routes";
import { registerFindingRecordsRoutes } from "./routes/finding-records-routes";

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const orgId = (req as AuthenticatedRequest).orgId || "default-org-id";
      cb(null, getOrgUploadDir(orgId));
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "image/png",
      "image/jpeg",
      "application/pdf",
      "text/csv",
      "text/plain",
      "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExtensions = /\.(pdf|csv|txt|md|docx|xlsx|png|jpe?g)$/i;
    const mimeOk =
      allowedMimes.includes(file.mimetype) || file.mimetype === "application/octet-stream";
    const extOk = allowedExtensions.test(file.originalname);
    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      logger.warn(`[Agent] Rejected upload: "${file.originalname}" (MIME: ${file.mimetype}, ext match: ${extOk}, mime match: ${mimeOk})`);
      cb(
        new Error(
          `Unsupported file type: ${file.mimetype}. Allowed: PNG, JPEG, PDF, CSV, TXT, MD, DOCX, XLSX.`
        )
      );
    }
  },
});

export type { RateLimitMiddleware } from "./routes/_shared";

export function registerAgentRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const orchestrator = new AgentOrchestrator(agentRepo, knowledgeBaseAdapter);
  const safety = new SafetyService(agentRepo);
  const suggestionEngine = new SuggestionEngine(agentRepo);

  suggestionEngine.setSignalHandler(async (signal) => {
    await orchestrator.processSignal(signal);
  });

  (async () => {
    try {
      const { organizations } = await import("@shared/schema/core");
      const orgs = await db.select({ id: organizations.id }).from(organizations);
      for (const org of orgs) {
        suggestionEngine.startBackgroundEvaluation(org.id);
      }
      if (orgs.length === 0) {
        suggestionEngine.startBackgroundEvaluation("default-org-id");
      }
    } catch {
      suggestionEngine.startBackgroundEvaluation("default-org-id");
    }
  })();

  const requireAdminRole: RoleMiddleware = (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    const role = user?.role?.toLowerCase();
    if (!role || role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
    return undefined;
  };

  const requireMaintenanceRole: RoleMiddleware = (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    const role = user?.role?.toLowerCase();
    if (!role || !MAINTENANCE_ROLES.includes(role as (typeof MAINTENANCE_ROLES)[number])) {
      return res.status(403).json({ error: "Maintenance role required" });
    }
    next();
    return undefined;
  };

  registerChatRoutes(app, { orchestrator, upload, rateLimit });
  registerConversationsRoutes(app, { rateLimit });
  registerDraftsRoutes(app, { rateLimit, requireMaintenanceRole });
  registerConfigRoutes(app, { rateLimit, requireAdminRole });
  registerUsageRoutes(app, { safety, rateLimit, requireAdminRole });

  const predictionFeedbackAdapter = new PredictionFeedbackAdapter();
  const outcomeService = new OutcomeTrackingService(agentRepo, predictionFeedbackAdapter);

  registerSuggestionsRoutes(app, {
    suggestionEngine,
    outcomeService,
    rateLimit,
    requireAdminRole,
    requireMaintenanceRole,
  });

  const globalScheduler = new SchedulerService(agentRepo, (org, user, conv, msg, role, opts) =>
    orchestrator.run(org, user, conv, msg, role, opts)
  );

  registerSchedulesRoutes(app, { globalScheduler, rateLimit, requireAdminRole });
  registerToolsRoutes(app, { rateLimit, requireAdminRole });
  registerAdminRoutes(app, { rateLimit, requireAdminRole });
  registerReportsRoutes(app);

  const findingsService = new FindingsAggregatorService(createFindingsAdapter());
  registerFindingsRoutes(app, { findingsService, rateLimit, requireMaintenanceRole });

  const briefingRepo = new BriefingRepositoryAdapter();
  let _briefingService: BriefingGeneratorService | null = null;
  function getBriefingService() {
    if (!_briefingService) {
      _briefingService = new BriefingGeneratorService(
        briefingRepo,
        agentRepo,
        new BriefingDataAdapter()
      );
    }
    return _briefingService;
  }

  registerBriefingsRoutes(app, { getBriefingService, rateLimit, requireMaintenanceRole });

  async function seedBriefingSchedule(orgId: string): Promise<void> {
    try {
      const schedules = await agentRepo.schedules.list(orgId);
      const hasBriefing = schedules.some((s) => s.name === "Daily Operations Briefing");
      if (!hasBriefing) {
        await agentRepo.schedules.create({
          orgId,
          name: "Daily Operations Briefing",
          prompt: "__briefing__",
          cronExpression: process.env['BRIEFING_CRON'] || "0 6 * * *",
          allowedTools: [],
          outputDestination: "notification",
          allowWriteTools: false,
          maxTokenBudget: 4000,
          enabled: true,
          consecutiveFailures: 0,
        });
        logger.info(`[BriefingSeed] Created Daily Operations Briefing schedule for org ${orgId}`);
      }
    } catch (err) {
      logger.warn(`[BriefingSeed] Failed to seed briefing schedule: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  globalScheduler.registerBriefingHandler(async (orgId: string, scheduleRunId: string) => {
    const result = await (await getBriefingService()).generate(orgId, scheduleRunId);
    return { briefingId: result.id };
  });

  (async () => {
    try {
      const { organizations } = await import("@shared/schema/core");
      const orgs = await db.select({ id: organizations.id }).from(organizations);
      for (const org of orgs) {
        await seedBriefingSchedule(org.id);
        await globalScheduler.initialize(org.id);
      }
      if (orgs.length === 0) {
        await seedBriefingSchedule("default-org-id");
        await globalScheduler.initialize("default-org-id");
      }
    } catch {
      await seedBriefingSchedule("default-org-id");
      await globalScheduler.initialize("default-org-id");
    }
  })();

  const activityAdapter = new ActivityRepositoryAdapter();
  const activityService = new AgentActivityService(activityAdapter);
  registerActivityRoutes(app, { activityService, rateLimit, requireMaintenanceRole });

  const taskAdapter = new AgentTaskRepositoryAdapter();
  const taskService = new AgentTaskService(taskAdapter);
  const findingAdapter = new AgentFindingRepositoryAdapter();
  const findingService = new AgentFindingService(findingAdapter);

  registerTasksRoutes(app, { taskService, rateLimit, requireMaintenanceRole });
  registerFindingRecordsRoutes(app, { findingService, rateLimit, requireMaintenanceRole });

  logger.info("[Agent Domain] Routes registered (chat, conversations, drafts, config, usage, suggestions, schedules, tools, reports, admin, findings, briefings, activity, tasks, agent-findings)");
}

// Re-export Request/Response so any external consumers of this module
// retain access; though external callers should use express directly.
export type { Request, Response };
