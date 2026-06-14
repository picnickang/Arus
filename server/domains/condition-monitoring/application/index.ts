/**
 * Condition Monitoring Application Layer - Dependency Injection Composition Root
 */

import { ConditionMonitoringService } from "./condition-monitoring-service";
import { conditionMonitoringRepository } from "../infrastructure/condition-monitoring-repository-adapter";

export const conditionMonitoringService = new ConditionMonitoringService(
  conditionMonitoringRepository
);

export {
  ConditionMonitoringService,
  ConditionResourceNotFoundError,
} from "./condition-monitoring-service";
