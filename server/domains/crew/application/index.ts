/**
 * Crew Application Layer - Dependency Injection Composition Root
 * Wires up the application service with infrastructure adapters
 */

import { CrewApplicationService } from "./crew-service";
import { crewMemberRepository } from "../infrastructure/crew-repository-adapter";
import { crewEventPublisher } from "../infrastructure/event-publisher-adapter";

export const crewAppService = new CrewApplicationService({
  crewMemberRepository,
  eventPublisher: crewEventPublisher,
});

export { CrewApplicationService } from "./crew-service";
