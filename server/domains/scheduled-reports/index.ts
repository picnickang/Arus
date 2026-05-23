/**
 * Scheduled Reports Domain - Main Entry Point
 * Provides factory function to create and wire all domain components
 */

import { ReportSchedulerService } from "./application/report-scheduler-service.js";
import { ReportGenerationService } from "./application/report-generation-service.js";
import {
  ReportScheduleRepositoryAdapter,
  GeneratedReportRepositoryAdapter,
} from "./infrastructure/report-repository-adapter.js";
import { PdfGeneratorAdapter } from "./infrastructure/pdf-generator-adapter.js";
import { EmailDeliveryAdapter } from "./infrastructure/email-delivery-adapter.js";
import { ReportStorageAdapter } from "./infrastructure/storage-adapter.js";
import { ReportEventPublisherAdapter } from "./infrastructure/event-publisher-adapter.js";
import { DefaultReportGeneratorRegistry } from "./generators/index.js";
import { createScheduledReportsRouter } from "./interfaces/routes.js";
import { isCloudMode, canUseCloudFeature } from "../../config/runtimeEnv.js";
import { logger } from "../../utils/logger.js";

const LOG_CTX = "ScheduledReportsDomain";

export interface ScheduledReportsDomain {
  schedulerService: ReportSchedulerService;
  generationService: ReportGenerationService;
  router: ReturnType<typeof createScheduledReportsRouter>;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

let domainInstance: ScheduledReportsDomain | null = null;

export function createScheduledReportsDomain(): ScheduledReportsDomain {
  if (domainInstance) {
    return domainInstance;
  }

  const scheduleRepository = new ReportScheduleRepositoryAdapter();
  const reportRepository = new GeneratedReportRepositoryAdapter();
  const pdfGenerator = new PdfGeneratorAdapter();
  const storageAdapter = new ReportStorageAdapter();
  const deliveryAdapter = new EmailDeliveryAdapter();
  const eventPublisher = new ReportEventPublisherAdapter();
  const generatorRegistry = new DefaultReportGeneratorRegistry();

  const generationService = new ReportGenerationService(
    reportRepository,
    generatorRegistry,
    pdfGenerator,
    storageAdapter,
    deliveryAdapter,
    eventPublisher
  );

  const schedulerService = new ReportSchedulerService(
    scheduleRepository,
    reportRepository,
    generationService,
    eventPublisher
  );

  const router = createScheduledReportsRouter(schedulerService, generationService);

  domainInstance = {
    schedulerService,
    generationService,
    router,
    async initialize() {
      if (!isCloudMode || !canUseCloudFeature("scheduledReports")) {
        logger.info(LOG_CTX, "Scheduled reports domain disabled (vessel mode)");
        return;
      }
      await schedulerService.initialize();
      logger.info(LOG_CTX, "Scheduled reports domain initialized");
    },
    async shutdown() {
      await schedulerService.shutdown();
      logger.info(LOG_CTX, "Scheduled reports domain shut down");
    },
  };

  return domainInstance;
}

export function registerScheduledReportsRoutes(
  app: import("express").Express,
  deps: {
    requireOrgId: import("express").RequestHandler;
    generalApiRateLimit: import("express").RequestHandler;
  }
) {
  const domain = createScheduledReportsDomain();
  app.use("/api/scheduled-reports", deps.requireOrgId, deps.generalApiRateLimit, domain.router);
  domain
    .initialize()
    .catch((err) => logger.error(LOG_CTX, "Init failed", err));
}

export { ReportSchedulerService, ReportGenerationService };
export * from "./domain/types.js";
export * from "./domain/events.js";
