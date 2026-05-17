/**
 * Purchasing Module Types
 * Type definitions for PR → PO workflow
 */

import type {
  PurchaseRequest,
  PurchaseRequestItem,
  ItemSupplier,
  PurchaseRequestEvent,
  PurchaseOrderEvent,
  InsertPurchaseRequest,
  InsertPurchaseRequestItem,
  InsertItemSupplier,
  EmailQueue,
  InsertEmailQueue,
} from "@shared/schema";

export type PRStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "ordered"
  | "received"
  | "closed"
  | "cancelled";

export type PREventType =
  | "created"
  | "sent"
  | "closed"
  | "cancelled"
  | "item_added"
  | "item_removed"
  | "draft_saved"
  | "submitted"
  | "approved"
  | "ordered"
  | "received"
  | "item_fulfilled";

export type FulfillmentStatus = "pending" | "partial" | "fulfilled";

export type POEventType =
  | "created"
  | "confirmed"
  | "shipped"
  | "received"
  | "completed"
  | "cancelled"
  | "qty_updated"
  | "expected_date_changed";

export interface PRWithItems extends PurchaseRequest {
  items: PRItemWithDetails[];
}

export interface PRItemWithDetails extends PurchaseRequestItem {
  partName?: string;
  partNumber?: string;
  supplierName?: string;
}

export interface PRSendResult {
  prId: string;
  purchaseOrders: { poId: string; supplierId: string; supplierName: string }[];
  emailsQueued: number;
}

export interface PRListFilters {
  orgId: string;
  status?: PRStatus;
  vesselId?: string;
  requestedBy?: string;
  workOrderId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ItemSupplierWithDetails extends ItemSupplier {
  partName?: string;
  partNumber?: string;
  supplierName?: string;
}

export interface FulfillItemRequest {
  prId: string;
  itemId: string;
  orgId: string;
  quantityToFulfill: number;
  fulfilledBy: string;
}

export interface FulfillmentResult {
  itemId: string;
  partId: string;
  quantityFulfilled: number;
  fulfillmentStatus: FulfillmentStatus;
  inventoryUpdated: boolean;
  newStockLevel?: number;
}

export {
  PurchaseRequest,
  PurchaseRequestItem,
  ItemSupplier,
  PurchaseRequestEvent,
  PurchaseOrderEvent,
  EmailQueue as EmailQueueItem,
  InsertPurchaseRequest,
  InsertPurchaseRequestItem,
  InsertItemSupplier,
  InsertEmailQueue as InsertEmailQueueItem,
};
