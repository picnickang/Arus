/**
 * Composition root for the Agent draft executor.
 *
 * Lives outside `server/domains/` on purpose: the agent domain expresses
 * its dependency on a work-order creator via the `WorkOrderCreatorPort`
 * interface (see `server/domains/agent/application/draft-executor.ts`),
 * and this file is the only place that wires that port to the concrete
 * `workOrderService` adapter owned by the work-orders bounded context.
 */

import { workOrderService } from "../repositories.js";
import {
  createDraftExecutor,
  type WorkOrderCreatorPort,
} from "../domains/agent/application/draft-executor.js";

const workOrderCreator: WorkOrderCreatorPort = {
  createWorkOrder: (input) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workOrderService.createWorkOrder(input as any),
};

export const executeDraftAction = createDraftExecutor({ workOrderCreator });
