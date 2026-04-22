/**
 * Maintenance Application Layer - Dependency Injection Composition Root
 * Wires up the application service with infrastructure adapters
 */

import { MaintenanceApplicationService } from "./maintenance-service";
import { maintenanceScheduleRepository } from "../infrastructure/schedule-repository-adapter";
import { maintenanceTemplateRepository } from "../infrastructure/template-repository-adapter";
import { eventPublisher } from "../infrastructure/event-publisher-adapter";

/**
 * Create and export the fully wired application service
 * This is where dependency injection happens
 */
export const maintenanceAppService = new MaintenanceApplicationService(
  maintenanceScheduleRepository,
  maintenanceTemplateRepository,
  eventPublisher
);

export { MaintenanceApplicationService } from "./maintenance-service";
