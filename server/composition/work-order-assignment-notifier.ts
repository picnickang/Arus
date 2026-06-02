/**
 * Composition root for supervisor notifications on work-order assignment
 * responses.
 *
 * Lives outside `server/domains/` on purpose: it bridges the work-orders
 * bounded context (which emits `work_order.status_changed` /
 * `work_order.updated` when an assigned crew member accepts or declines) to
 * the alerts bounded context (`dbAlertStorage`), without either domain
 * reaching into the other's infrastructure.
 *
 * It reuses the events that `respondToAssignment` already emits — it does NOT
 * add a new write path or event type. When the emitted event carries
 * `assignmentResponse` metadata, an alert notification is created so the
 * assigning supervisor / chief engineer sees it in the alerts list and in the
 * attention inbox's unacknowledged-alerts count (including the decline reason).
 */

import { dbAlertStorage } from "../db/alerts/index.js";
import { domainEventBus } from "../lib/domain-event-bus/index.js";
import type { WorkOrderAssignmentResponsePayload } from "../lib/domain-event-bus/types.js";
import { createLogger } from "../lib/structured-logger.js";

const logger = createLogger("WorkOrderAssignmentNotifier");

function describe(woNumber?: string | null): string {
  return woNumber ? `work order ${woNumber}` : "their assigned work order";
}

function buildMessage(meta: WorkOrderAssignmentResponsePayload): string {
  const who = meta.crewName?.trim() || "An assigned crew member";
  const what = describe(meta.woNumber);
  if (meta.response === "declined") {
    const reason = meta.reason?.trim();
    return reason
      ? `${who} declined ${what}. Reason: ${reason}`
      : `${who} declined ${what}. No reason provided.`;
  }
  return `${who} accepted ${what}.`;
}

async function notify(orgId: string, meta: WorkOrderAssignmentResponsePayload): Promise<void> {
  try {
    await dbAlertStorage.createAlertNotification({
      orgId,
      equipmentId: meta.equipmentId,
      sensorType: "assignment",
      alertType:
        meta.response === "declined" ? "work_order_declined" : "work_order_accepted",
      message: buildMessage(meta),
      value: 0,
      threshold: 0,
    });
  } catch (error) {
    // A notification failure must never break the crew member's
    // accept/decline response, which has already been committed.
    logger.error("Failed to create assignment-response alert", {
      orgId,
      response: meta.response,
      crewId: meta.crewId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function initWorkOrderAssignmentNotifier(): void {
  domainEventBus.on("work_order.status_changed", (event) => {
    const meta = event.payload.assignmentResponse;
    if (meta) {
      void notify(event.orgId, meta);
    }
  });

  domainEventBus.on("work_order.updated", (event) => {
    const meta = event.payload.assignmentResponse;
    if (meta) {
      void notify(event.orgId, meta);
    }
  });

  logger.info("Work-order assignment-response notifier initialized");
}
