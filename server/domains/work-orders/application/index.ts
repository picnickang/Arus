/**
 * Work Orders Application Layer - Dependency Injection Composition Root
 * Wires up the application service with infrastructure adapters
 */

import { WorkOrderApplicationService } from "./work-order-service";
import { workOrderRepoAdapter } from "../infrastructure/work-order-repository-adapter";
import { workOrderEventPublisher } from "../infrastructure/event-publisher-adapter";

export const workOrderAppService = new WorkOrderApplicationService({
  workOrderRepository: workOrderRepoAdapter,
  eventPublisher: workOrderEventPublisher,
});

export { WorkOrderApplicationService } from "./work-order-service";
export { WorkOrderWorkflowService } from "./wo-workflow-service";
