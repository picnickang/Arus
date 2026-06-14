/**
 * Compliance Application Layer - Dependency Injection Composition Root
 */

import { ComplianceService } from "./compliance-service";
import { complianceRepository } from "../infrastructure/compliance-repository-adapter";

export const complianceService = new ComplianceService(complianceRepository);

export { ComplianceService } from "./compliance-service";
