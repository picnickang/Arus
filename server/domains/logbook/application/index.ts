/**
 * Logbook Application Layer - Dependency Injection Composition Root
 */

import { LogbookCorrectionService } from "./correction-service";
import { logbookCorrectionRepository } from "../infrastructure/correction-repository-adapter";

export const logbookCorrectionService = new LogbookCorrectionService(logbookCorrectionRepository);

export { LogbookCorrectionService, OriginalEntryNotFoundError } from "./correction-service";
