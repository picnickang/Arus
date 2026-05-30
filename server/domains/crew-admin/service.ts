/**
 * Crew Admin Domain - Composed Service Instance
 */

import { CrewAdminApplicationService } from "./application/crew-admin-service";
import { crewAdminRepository } from "./infrastructure/crew-admin-repository-adapter";

export const crewAdminService = new CrewAdminApplicationService(crewAdminRepository);

export { CrewAdminError } from "./application/crew-admin-service";
