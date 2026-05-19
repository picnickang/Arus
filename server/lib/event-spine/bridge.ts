import { domainEventBus } from "../domain-event-bus/bus.js";
import type { DomainEventMap, DomainEventName } from "../domain-event-bus/types.js";
import { createLogger } from "../structured-logger.js";
import { enqueueOutbox } from "./outbox-repository.js";
import { envelopeToOutboxInput } from "./types.js";

const logger = createLogger("EventSpine:Bridge");

/**
 * The full set of `DomainEventName` values the bridge captures into the
 * outbox. Kept as a runtime list because TS interfaces have no runtime
 * representation, but the `_exhaustive` check below makes it impossible
 * to add a new `DomainEventName` without also adding it here — the build
 * (`npx tsc --noEmit`) fails otherwise.
 */
export const TRACKED_EVENTS = [
  "scheduler.run.started",
  "scheduler.run.completed",
  "scheduler.run.failed",
  "simulation.preview.created",
  "simulation.committed",
  "simulation.discarded",
  "work_order.created",
  "work_order.updated",
  "work_order.status_changed",
  "work_order.completed",
  "work_order.assigned",
  "work_order.part_added",
  "work_order.task_completed",
  "inventory.part_created",
  "inventory.part_updated",
  "inventory.part_deleted",
  "inventory.item_created",
  "inventory.item_updated",
  "inventory.item_deleted",
  "inventory.stock_movement",
  "inventory.low_stock",
  "inventory.stock_replenished",
  "crew.member_created",
  "crew.member_updated",
  "crew.member_deleted",
  "crew.assigned",
  "crew.unassigned",
  "crew.leave_requested",
  "crew.leave_approved",
  "crew.certification_expiring",
  "maintenance.scheduled",
  "maintenance.updated",
  "maintenance.deleted",
  "maintenance.completed",
  "maintenance.overdue",
  "maintenance.auto_scheduled",
  "maintenance.template_created",
  "maintenance.template_updated",
  "maintenance.template_deleted",
  "prediction.threshold_exceeded",
  "agent.signal_dispatched",
  "alert.triggered",
  "compliance.violation_detected",
  "telemetry.anomaly_detected",
  "telemetry.batch_ingested",
  "bunkering.started",
  "bunkering.completed",
  "rms.alert_triggered",
  "pdm.rul.updated",
  "pdm.anomaly.created",
  "pdm.maintenance.window",
  "service_request.created",
  "service_request.approved",
  "service_request.rejected",
  "service_request.converted",
] as const satisfies readonly DomainEventName[];

// Compile-time exhaustiveness guard: if a new `DomainEventName` is added
// to `DomainEventMap` but not to `TRACKED_EVENTS`, `_Missing` becomes a
// non-`never` union and this assignment fails to type-check.
type _Missing = Exclude<DomainEventName, (typeof TRACKED_EVENTS)[number]>;
const _exhaustive: _Missing extends never ? true : never = true;
void _exhaustive;

/**
 * TRANSITIONAL bridge — subscribes to the in-process domain event bus
 * and writes every emitted envelope to `event_outbox`. This is *not* a
 * transactional outbox: it cannot guarantee the envelope lands on the
 * spine if the bridge subscriber crashes between the commit and the
 * enqueue. It exists only so that legacy emit sites (the ones that have
 * not yet been migrated to inline `enqueueOutboxFromEnvelope(env, tx)`)
 * still get spine coverage during the migration.
 *
 * The canonical pattern — and the only one that satisfies the
 * outbox-then-publish constraint stated in the task description — is
 * `db.transaction(async tx => { repo.write(tx); publisher.publish(ev, tx); })`,
 * which the work-orders application service uses as the reference
 * implementation. New emit sites MUST follow that pattern. Once every
 * legacy emit site is migrated, this bridge can be removed entirely
 * (the `eventId` unique index makes the duplicate enqueue safe in the
 * meantime).
 */
export function initEventSpineOutboxBridge(): void {
  for (const eventType of TRACKED_EVENTS) {
    domainEventBus.on(eventType, async (event) => {
      try {
        await enqueueOutbox(envelopeToOutboxInput(event));
      } catch (err) {
        logger.warn("Failed to enqueue domain event to spine outbox", {
          eventType,
          eventId: (event as DomainEventMap[DomainEventName])?.eventId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }
  logger.info("Event-spine outbox bridge initialized", { tracked: TRACKED_EVENTS.length });
}
