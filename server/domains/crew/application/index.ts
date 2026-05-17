/**
 * Crew Application Layer - public exports
 *
 * The concrete `crewAppService` instance is wired in
 * `server/composition/crew-application-service.ts` (composition root).
 * This module re-exports it so existing import paths
 * (`server/domains/crew/application` and `server/domains/crew` index)
 * continue to work unchanged.
 */

export { CrewApplicationService } from "./crew-service";
export { crewAppService } from "../../../composition/crew-application-service.js";
