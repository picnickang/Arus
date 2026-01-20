/**
 * Inventory Domain Events
 * Typed discriminated unions for event-driven architecture
 */

import { v4 as uuidv4 } from 'uuid';

export type InventoryEventType =
  | 'PartCreated'
  | 'PartUpdated'
  | 'PartDeleted'
  | 'InventoryItemCreated'
  | 'InventoryItemUpdated'
  | 'InventoryItemDeleted'
  | 'StockMovementRecorded'
  | 'LowStockDetected'
  | 'StockReplenished';

interface BaseInventoryEvent {
  eventId: string;
  aggregateId: string;
  aggregateType: 'Part' | 'PartsInventory' | 'StockMovement';
  occurredAt: Date;
  userId?: string;
  orgId: string;
  version: number;
}

export interface PartCreatedEvent extends BaseInventoryEvent {
  eventType: 'PartCreated';
  payload: {
    partNo: string;
    description: string;
    category: string | null;
    manufacturer: string | null;
  };
}

export interface PartUpdatedEvent extends BaseInventoryEvent {
  eventType: 'PartUpdated';
  payload: {
    changedFields: string[];
    previousState: Record<string, unknown>;
    newState: Record<string, unknown>;
  };
}

export interface PartDeletedEvent extends BaseInventoryEvent {
  eventType: 'PartDeleted';
  payload: {
    partNo: string;
    description: string;
  };
}

export interface InventoryItemCreatedEvent extends BaseInventoryEvent {
  eventType: 'InventoryItemCreated';
  payload: {
    partNo: string;
    name: string;
    quantity: number;
    minQuantity: number;
    location: string | null;
  };
}

export interface InventoryItemUpdatedEvent extends BaseInventoryEvent {
  eventType: 'InventoryItemUpdated';
  payload: {
    changedFields: string[];
    previousState: Record<string, unknown>;
    newState: Record<string, unknown>;
  };
}

export interface InventoryItemDeletedEvent extends BaseInventoryEvent {
  eventType: 'InventoryItemDeleted';
  payload: {
    partNo: string;
    name: string;
  };
}

export interface StockMovementRecordedEvent extends BaseInventoryEvent {
  eventType: 'StockMovementRecorded';
  payload: {
    inventoryId: string;
    movementType: 'in' | 'out' | 'adjustment' | 'transfer';
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    reason: string | null;
  };
}

export interface LowStockDetectedEvent extends BaseInventoryEvent {
  eventType: 'LowStockDetected';
  payload: {
    partNo: string;
    currentQuantity: number;
    minQuantity: number;
    threshold: number;
  };
}

export interface StockReplenishedEvent extends BaseInventoryEvent {
  eventType: 'StockReplenished';
  payload: {
    partNo: string;
    previousQuantity: number;
    newQuantity: number;
    minQuantity: number;
  };
}

export type InventoryDomainEvent =
  | PartCreatedEvent
  | PartUpdatedEvent
  | PartDeletedEvent
  | InventoryItemCreatedEvent
  | InventoryItemUpdatedEvent
  | InventoryItemDeletedEvent
  | StockMovementRecordedEvent
  | LowStockDetectedEvent
  | StockReplenishedEvent;

export function createEventId(): string {
  return uuidv4();
}
