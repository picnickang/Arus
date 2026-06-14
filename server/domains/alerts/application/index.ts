/**
 * Alerts Application Layer - Dependency Injection Composition Root
 * Wires the application service with infrastructure adapters.
 */

import { AlertsApplicationService } from "./alerts-service";
import { alertRepository } from "../infrastructure/alert-repository-adapter";
import {
  alertEventPublisher,
  alertRealtimeNotifier,
} from "../infrastructure/event-publisher-adapter";
import { workOrderEscalator } from "../infrastructure/work-order-escalation-adapter";

export const alertsAppService = new AlertsApplicationService(
  alertRepository,
  alertEventPublisher,
  alertRealtimeNotifier,
  workOrderEscalator
);

export { AlertsApplicationService } from "./alerts-service";
