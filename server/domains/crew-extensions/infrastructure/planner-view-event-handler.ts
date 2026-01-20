/**
 * Planner View Event Handler
 * Subscribes to crew assignment and schedule events to trigger read model refresh
 */

import { syncEventBus, type EventType } from "../../../sync-events.js";
import { schedulePlannerReadModel } from "./schedule-planner-read-model.js";
import { createLogger } from "../../../lib/structured-logger.js";

const logger = createLogger("PlannerViewEventHandler");

const RELEVANT_EVENTS: EventType[] = [
  "crew_assignment.created",
  "crew_assignment.updated",
  "crew_assignment.deleted",
  "schedule.created",
  "schedule.updated",
  "schedule.deleted",
  "crew.created",
  "crew.updated",
  "crew.deleted",
];

let isInitialized = false;

interface EventPayload {
  id?: string;
  data?: {
    orgId?: string;
  };
  operation?: string;
}

export function initPlannerViewEventHandler(): void {
  if (isInitialized) {
    logger.warn("Planner view event handler already initialized");
    return;
  }

  for (const eventType of RELEVANT_EVENTS) {
    syncEventBus.on(eventType, async (payload: EventPayload) => {
      try {
        const orgId = payload?.data?.orgId;
        if (!orgId) {
          logger.debug("Event missing orgId, skipping refresh", { eventType });
          return;
        }

        logger.info("Triggering read model refresh from event", {
          eventType,
          entityId: payload?.id,
          orgId,
        });

        await schedulePlannerReadModel.refresh(orgId, `event:${eventType}`);
      } catch (error) {
        logger.error("Failed to refresh read model from event", {
          eventType,
          error,
        });
      }
    });
  }

  isInitialized = true;
  logger.info("Planner view event handler initialized", {
    subscribedEvents: RELEVANT_EVENTS,
  });
}

export function shutdownPlannerViewEventHandler(): void {
  if (!isInitialized) {
    return;
  }

  for (const eventType of RELEVANT_EVENTS) {
    syncEventBus.removeAllListeners(eventType);
  }

  isInitialized = false;
  logger.info("Planner view event handler shutdown");
}
