// @ts-nocheck
/**
 * Composition root for the Crew Application Service.
 *
 * Lives outside `server/domains/` on purpose: the crew domain expresses
 * its dependencies as ports (see
 * `server/domains/crew/application/crew-service.ts`), and this file is
 * the only place that wires those ports to the concrete `dbCrewStorage`
 * and `dbCrewExtensionsStorage` adapters from the repositories barrel.
 *
 * Infrastructure adapters internal to the crew domain
 * (`crewMemberRepository`, `crewEventPublisher`) remain wired here so the
 * full dependency set is visible in one place.
 */

import { dbCrewStorage, dbCrewExtensionsStorage } from "../repositories.js";
import { CrewApplicationService } from "../domains/crew/application/crew-service.js";
import { crewMemberRepository } from "../domains/crew/infrastructure/crew-repository-adapter.js";
import { crewEventPublisher } from "../domains/crew/infrastructure/event-publisher-adapter.js";

export const crewAppService = new CrewApplicationService({
  crewMemberRepository,
  eventPublisher: crewEventPublisher,
  crewStorage: dbCrewStorage,
  crewExtensionsStorage: dbCrewExtensionsStorage,
});
