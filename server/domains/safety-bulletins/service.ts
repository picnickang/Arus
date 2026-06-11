/**
 * Safety Bulletin Domain - Composed Service Instance
 * Wires the infrastructure adapter into the application service.
 */

import { SafetyBulletinApplicationService } from "./application/safety-bulletin-service";
import { safetyBulletinRepository } from "./infrastructure/safety-bulletin-repository-adapter";

export const safetyBulletinService = new SafetyBulletinApplicationService(safetyBulletinRepository);
