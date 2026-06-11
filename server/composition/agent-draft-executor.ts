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

// The agent domain port intentionally accepts a wider, transport-shaped
// input (`Record<string, unknown> & { status, orgId }`) because the draft
// payload is assembled from LLM tool-call arguments. The work-order
// service performs its own validation against `InsertWorkOrder` before
// touching storage, so the adapter binds the two shapes via the
// service's own parameter type — keeping the cast tied to the service
// signature instead of `any`.
type CreateWorkOrderInput = Parameters<typeof workOrderService.createWorkOrder>[0];

const workOrderCreator: WorkOrderCreatorPort = {
  createWorkOrder: (input) => workOrderService.createWorkOrder(input as CreateWorkOrderInput),
};

export const executeDraftAction = createDraftExecutor({ workOrderCreator });
