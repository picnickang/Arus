/**
 * Crew Extensions Application Layer
 * Composition root for dependency injection
 */

import { CrewExtensionsApplicationService } from "./crew-extensions-service.js";
import { ScheduleSimulationService } from "./schedule-simulation-service.js";
import { schedulerRunRepository } from "../infrastructure/scheduler-run-repository-adapter.js";
import { scheduleAssignmentRepository } from "../infrastructure/schedule-assignment-repository-adapter.js";
import { crewExtensionsEventPublisher } from "../infrastructure/event-publisher-adapter.js";
import { schedulePlannerReadModel } from "../infrastructure/schedule-planner-read-model.js";
import { simulationPreviewStore } from "../infrastructure/simulation-preview-store.js";
import { BalancedScheduleGenerator } from "../infrastructure/schedule-generator-strategy.js";
import { crewDataAdapter } from "../infrastructure/crew-data-adapter.js";
import { vesselDataAdapter } from "../infrastructure/vessel-data-adapter.js";

export const crewExtensionsAppService = new CrewExtensionsApplicationService({
  schedulerRunRepository,
  assignmentRepository: scheduleAssignmentRepository,
  eventPublisher: crewExtensionsEventPublisher,
  schedulePlannerReadModel,
});

const balancedScheduleGenerator = new BalancedScheduleGenerator(crewDataAdapter, vesselDataAdapter);

export const scheduleSimulationService = new ScheduleSimulationService({
  previewStore: simulationPreviewStore,
  generator: balancedScheduleGenerator,
  assignmentRepository: scheduleAssignmentRepository,
  runRepository: schedulerRunRepository,
  eventPublisher: crewExtensionsEventPublisher,
});

export { CrewExtensionsApplicationService } from "./crew-extensions-service.js";
export { ScheduleSimulationService } from "./schedule-simulation-service.js";
