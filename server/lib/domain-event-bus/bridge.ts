import { domainEventBus } from "./bus.js";
import { createDomainEvent } from "./types.js";
import type { DomainEventMap, DomainEventName, DomainEventEnvelope } from "./types.js";
import { syncEventBus, type EventType, recordJournalEntry, publishEvent } from "../../sync-events.js";
import { schedulerEventBus } from "../../events/scheduler-bus.js";
import { mqttReliableSync } from "../../mqtt-reliable-sync/index.js";

const BRIDGE_SOURCE_MARKER = Symbol("bridgeSource");

const SYNC_EVENT_ENTITY_MAP: Record<string, string> = {
  "work_order.created": "work_order",
  "work_order.updated": "work_order",
  "work_order.completed": "work_order",
  "work_order.status_changed": "work_order",
  "work_order.assigned": "work_order",
  "work_order.part_added": "work_order",
  "work_order.task_completed": "work_order",
  "inventory.part_created": "part",
  "inventory.part_updated": "part",
  "inventory.part_deleted": "part",
  "inventory.item_created": "parts_inventory",
  "inventory.item_updated": "parts_inventory",
  "inventory.item_deleted": "parts_inventory",
  "inventory.stock_movement": "inventory_movement",
  "inventory.low_stock": "stock",
  "inventory.stock_replenished": "stock",
  "crew.member_created": "crew",
  "crew.member_updated": "crew",
  "crew.member_deleted": "crew",
  "crew.assigned": "crew_assignment",
  "crew.unassigned": "crew_assignment",
  "crew.leave_requested": "crew",
  "crew.leave_approved": "crew",
  "crew.certification_expiring": "crew",
  "maintenance.scheduled": "maintenance_schedule",
  "maintenance.updated": "maintenance_schedule",
  "maintenance.deleted": "maintenance_schedule",
  "maintenance.completed": "maintenance_schedule",
  "maintenance.overdue": "maintenance_schedule",
  "maintenance.auto_scheduled": "maintenance_schedule",
  "maintenance.template_created": "maintenance_template",
  "maintenance.template_updated": "maintenance_template",
  "maintenance.template_deleted": "maintenance_template",
};

function mapDomainEventToSyncEvent(eventType: string): EventType | null {
  const mapping: Record<string, EventType> = {
    "work_order.created": "work_order.created",
    "work_order.updated": "work_order.updated",
    "work_order.completed": "work_order.updated",
    "work_order.status_changed": "work_order.updated",
    "work_order.assigned": "work_order.updated",
    "work_order.part_added": "work_order.updated",
    "work_order.task_completed": "work_order.updated",
    "inventory.part_created": "part.created",
    "inventory.part_updated": "part.updated",
    "inventory.part_deleted": "part.deleted",
    "inventory.item_created": "parts_inventory.created",
    "inventory.item_updated": "parts_inventory.updated",
    "inventory.item_deleted": "parts_inventory.deleted",
    "inventory.stock_movement": "inventory_movement.created",
    "inventory.low_stock": "parts_inventory.updated",
    "inventory.stock_replenished": "parts_inventory.updated",
    "crew.member_created": "crew.created",
    "crew.member_updated": "crew.updated",
    "crew.member_deleted": "crew.deleted",
    "crew.assigned": "crew_assignment.created",
    "crew.unassigned": "crew_assignment.deleted",
    "crew.leave_requested": "crew.updated",
    "crew.leave_approved": "crew.updated",
    "crew.certification_expiring": "crew.updated",
  };
  return mapping[eventType] ?? null;
}

function mapOperationFromEventType(eventType: string): "create" | "update" | "delete" {
  if (eventType.includes("deleted") || eventType.includes("unassigned")) return "delete";
  if (eventType.includes("created") || eventType.includes("assigned") || eventType.includes("requested")) return "create";
  return "update";
}

export function initSyncJournalSubscriber(): void {
  const trackedEvents: DomainEventName[] = [
    "work_order.created", "work_order.updated", "work_order.completed",
    "work_order.status_changed", "work_order.assigned",
    "work_order.part_added", "work_order.task_completed",
    "inventory.part_created", "inventory.part_updated", "inventory.part_deleted",
    "inventory.item_created", "inventory.item_updated", "inventory.item_deleted",
    "inventory.stock_movement", "inventory.low_stock", "inventory.stock_replenished",
    "crew.member_created", "crew.member_updated", "crew.member_deleted",
    "crew.assigned", "crew.unassigned", "crew.leave_requested", "crew.leave_approved",
    "crew.certification_expiring",
    "maintenance.scheduled", "maintenance.updated", "maintenance.deleted",
    "maintenance.completed", "maintenance.overdue", "maintenance.auto_scheduled",
    "maintenance.template_created", "maintenance.template_updated", "maintenance.template_deleted",
  ];

  for (const eventType of trackedEvents) {
    domainEventBus.on(eventType, async (event) => {
      try {
        if ((event as Record<string | symbol, unknown>)[BRIDGE_SOURCE_MARKER]) return;
        const entityType = SYNC_EVENT_ENTITY_MAP[eventType];
        if (!entityType) return;
        const operation = mapOperationFromEventType(eventType);
        const aggregateId = event.aggregateId || "unknown";
        await recordJournalEntry(entityType, aggregateId, operation, event.payload, event.userId);
        const syncEvent = mapDomainEventToSyncEvent(eventType);
        if (syncEvent) {
          await publishEvent(syncEvent, { id: aggregateId, data: event.payload, operation }, false);
        }
      } catch {
        // sync journal write must not break event flow
      }
    });
  }

  console.log(`[DomainEventBridge] Sync journal subscriber initialized (${trackedEvents.length} events)`);
}

export function initMqttSubscriber(): void {
  const workOrderEvents: DomainEventName[] = [
    "work_order.created", "work_order.updated", "work_order.completed",
    "work_order.status_changed", "work_order.assigned",
    "work_order.part_added", "work_order.task_completed",
  ];
  for (const eventType of workOrderEvents) {
    domainEventBus.on(eventType, (event) => {
      if ((event as Record<string | symbol, unknown>)[BRIDGE_SOURCE_MARKER]) return;
      const op = mapOperationFromEventType(eventType);
      mqttReliableSync.publishWorkOrderChange(op, { id: event.aggregateId, eventType, ...event.payload }).catch(() => {});
    });
  }

  const crewEvents: DomainEventName[] = [
    "crew.member_created", "crew.member_updated", "crew.member_deleted",
    "crew.assigned", "crew.unassigned",
    "crew.leave_requested", "crew.leave_approved",
    "crew.certification_expiring",
  ];
  for (const eventType of crewEvents) {
    domainEventBus.on(eventType, (event) => {
      if ((event as Record<string | symbol, unknown>)[BRIDGE_SOURCE_MARKER]) return;
      const op = mapOperationFromEventType(eventType);
      mqttReliableSync.publishCrewChange(op, event.payload).catch(() => {});
    });
  }

  const maintenanceEvents: DomainEventName[] = [
    "maintenance.scheduled", "maintenance.updated", "maintenance.deleted",
    "maintenance.completed", "maintenance.overdue", "maintenance.auto_scheduled",
    "maintenance.template_created", "maintenance.template_updated", "maintenance.template_deleted",
  ];
  for (const eventType of maintenanceEvents) {
    domainEventBus.on(eventType, (event) => {
      if ((event as Record<string | symbol, unknown>)[BRIDGE_SOURCE_MARKER]) return;
      const op = mapOperationFromEventType(eventType);
      mqttReliableSync.publishMaintenanceChange(op, { id: event.aggregateId, eventType, ...event.payload }).catch(() => {});
    });
  }

  console.log("[DomainEventBridge] MQTT subscriber initialized");
}

export function initSchedulerBusBridge(): void {
  domainEventBus.on("pdm.rul.updated", (event) => {
    schedulerEventBus.emitRulUpdate({ orgId: event.orgId, ...event.payload });
  });
  domainEventBus.on("pdm.anomaly.created", (event) => {
    schedulerEventBus.emitAnomalyCreated({ orgId: event.orgId, ...event.payload });
  });
  domainEventBus.on("pdm.maintenance.window", (event) => {
    schedulerEventBus.emitMaintenanceWindow({ orgId: event.orgId, ...event.payload });
  });
  domainEventBus.on("scheduler.run.started", (event) => {
    schedulerEventBus.emitSchedulerRunStarted({ orgId: event.orgId, ...event.payload });
  });
  domainEventBus.on("scheduler.run.completed", (event) => {
    schedulerEventBus.emitSchedulerRunCompleted({ orgId: event.orgId, ...event.payload });
  });
  domainEventBus.on("scheduler.run.failed", (event) => {
    schedulerEventBus.emitSchedulerRunFailed({ orgId: event.orgId, ...event.payload });
  });
  domainEventBus.on("simulation.preview.created", (event) => {
    schedulerEventBus.emitSimulationPreviewCreated({ orgId: event.orgId, ...event.payload });
  });
  domainEventBus.on("simulation.committed", (event) => {
    schedulerEventBus.emitSimulationCommitted({ orgId: event.orgId, ...event.payload });
  });
  domainEventBus.on("simulation.discarded", (event) => {
    schedulerEventBus.emitSimulationDiscarded({ orgId: event.orgId, ...event.payload });
  });

  console.log("[DomainEventBridge] Scheduler bus bridge initialized");
}

export function initSyncEventBusBridge(): void {
  const bridgedEvents: DomainEventName[] = [
    "work_order.created", "work_order.updated", "work_order.completed",
    "work_order.status_changed", "work_order.assigned",
    "work_order.part_added", "work_order.task_completed",
    "inventory.part_created", "inventory.part_updated", "inventory.part_deleted",
    "inventory.item_created", "inventory.item_updated", "inventory.item_deleted",
    "inventory.stock_movement", "inventory.low_stock", "inventory.stock_replenished",
    "crew.member_created", "crew.member_updated", "crew.member_deleted",
    "crew.assigned", "crew.unassigned",
    "crew.leave_requested", "crew.leave_approved", "crew.certification_expiring",
  ];

  for (const eventType of bridgedEvents) {
    domainEventBus.on(eventType, (event) => {
      if ((event as Record<string | symbol, unknown>)[BRIDGE_SOURCE_MARKER]) return;
      const syncEvent = mapDomainEventToSyncEvent(eventType);
      if (syncEvent) {
        const markedPayload = { id: event.aggregateId, data: event.payload, operation: mapOperationFromEventType(eventType), [BRIDGE_SOURCE_MARKER]: true };
        syncEventBus.emit(syncEvent, markedPayload);
      }
    });
  }

  console.log(`[DomainEventBridge] SyncEventBus bridge initialized (${bridgedEvents.length} events forwarded, new→old)`);
}

function mapSyncEventToDomainEvent(syncEvent: string): DomainEventName | null {
  const reverseMapping: Record<string, DomainEventName> = {
    "work_order.created": "work_order.created",
    "work_order.updated": "work_order.updated",
    "part.created": "inventory.part_created",
    "part.updated": "inventory.part_updated",
    "part.deleted": "inventory.part_deleted",
    "parts_inventory.created": "inventory.item_created",
    "parts_inventory.updated": "inventory.item_updated",
    "parts_inventory.deleted": "inventory.item_deleted",
    "inventory_movement.created": "inventory.stock_movement",
    "crew.created": "crew.member_created",
    "crew.updated": "crew.member_updated",
    "crew.deleted": "crew.member_deleted",
    "crew_assignment.created": "crew.assigned",
    "crew_assignment.deleted": "crew.unassigned",
  };
  return reverseMapping[syncEvent] ?? null;
}

export function initReverseSyncEventBusBridge(): void {
  const syncEventsToForward: EventType[] = [
    "work_order.created", "work_order.updated",
    "part.created", "part.updated", "part.deleted",
    "parts_inventory.created", "parts_inventory.updated", "parts_inventory.deleted",
    "inventory_movement.created",
    "crew.created", "crew.updated", "crew.deleted",
    "crew_assignment.created", "crew_assignment.deleted",
  ];

  for (const syncEvent of syncEventsToForward) {
    syncEventBus.on(syncEvent, (data: Record<string | symbol, unknown>) => {
      if (data[BRIDGE_SOURCE_MARKER]) return;
      const domainEventType = mapSyncEventToDomainEvent(syncEvent);
      if (!domainEventType) return;
      const nested = data.data as Record<string, unknown> | undefined;
      const orgId = (data.orgId as string) || (nested?.orgId as string);
      if (!orgId) return;
      const aggregateId = (data.id as string) || "unknown";
      const envelope = createDomainEvent(domainEventType, orgId, nested ?? data, {
        aggregateId,
        aggregateType: domainEventType.split(".")[0],
      });
      (envelope as Record<string | symbol, unknown>)[BRIDGE_SOURCE_MARKER] = true;
      domainEventBus.emitUnchecked(domainEventType, envelope as DomainEventMap[DomainEventName]);
    });
  }

  console.log(`[DomainEventBridge] Reverse SyncEventBus bridge initialized (${syncEventsToForward.length} events forwarded, old→new)`);
}

function initLoggingMiddleware(): void {
  domainEventBus.use((eventType) => {
    if (process.env.NODE_ENV === "development" && process.env.DEBUG_EVENTS === "true") {
      console.log(`[DomainEventBus] ${eventType}`);
    }
  });
}

export function initAllBridges(): void {
  initLoggingMiddleware();
  initSyncJournalSubscriber();
  initMqttSubscriber();
  initSchedulerBusBridge();
  initSyncEventBusBridge();
  initReverseSyncEventBusBridge();
  console.log("[DomainEventBridge] All bridges initialized");
}
