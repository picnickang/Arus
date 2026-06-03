/**
 * Crew Task Domain - Composed Service Instance
 * Wires the infrastructure adapters into the application service.
 */

import { CrewTaskApplicationService } from "./application/crew-task-service";
import { crewTaskRepository } from "./infrastructure/crew-task-repository-adapter";
import { crewTaskEffects } from "./infrastructure/crew-task-effects-adapter";
import { crewTaskEventRepository } from "./infrastructure/crew-task-event-repository-adapter";

export const crewTaskService = new CrewTaskApplicationService(
  crewTaskRepository,
  crewTaskEffects,
  crewTaskEventRepository,
);
