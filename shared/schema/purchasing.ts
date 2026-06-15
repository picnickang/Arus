/**
 * Schema Purchasing - Purchasing, Procurement, and Service Orders
 *
 * Manages purchase requests, purchase orders, service orders,
 * parts reservations, and item-supplier relationships.
 */

import { createInsertSchema, z } from "./base";
import {
  purchaseOrderEvents,
  purchaseOrderItems,
  purchaseOrders,
  purchaseRequestEvents,
  purchaseRequestItems,
  purchaseRequests,
  reservations,
} from "./purchasing/procurement";
import {
  itemSuppliers,
  serviceOrderEvents,
  serviceOrders,
  serviceRequests,
} from "./purchasing/services";

export * from "./purchasing/procurement";
export * from "./purchasing/services";

// INSERT SCHEMAS
// ============================================================================

export const insertReservationSchema = createInsertSchema(reservations).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseOrderEventSchema = createInsertSchema(purchaseOrderEvents).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseRequestItemSchema = createInsertSchema(purchaseRequestItems).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseRequestEventSchema = createInsertSchema(purchaseRequestEvents).omit({
  id: true,
  createdAt: true,
});

export const insertItemSupplierSchema = createInsertSchema(itemSuppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceOrderSchema = createInsertSchema(serviceOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceOrderEventSchema = createInsertSchema(serviceOrderEvents).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = z.infer<typeof insertReservationSchema>;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;

export type PurchaseOrderEvent = typeof purchaseOrderEvents.$inferSelect;
export type InsertPurchaseOrderEvent = z.infer<typeof insertPurchaseOrderEventSchema>;

export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = z.infer<typeof insertPurchaseRequestSchema>;

export type PurchaseRequestItem = typeof purchaseRequestItems.$inferSelect;
export type InsertPurchaseRequestItem = z.infer<typeof insertPurchaseRequestItemSchema>;

export type PurchaseRequestEvent = typeof purchaseRequestEvents.$inferSelect;
export type InsertPurchaseRequestEvent = z.infer<typeof insertPurchaseRequestEventSchema>;

export type ItemSupplier = typeof itemSuppliers.$inferSelect;
export type InsertItemSupplier = z.infer<typeof insertItemSupplierSchema>;

export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = z.infer<typeof insertServiceOrderSchema>;

export type ServiceOrderEvent = typeof serviceOrderEvents.$inferSelect;
export type InsertServiceOrderEvent = z.infer<typeof insertServiceOrderEventSchema>;
