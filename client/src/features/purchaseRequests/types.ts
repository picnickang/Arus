export type PRStatus = "draft" | "sent" | "closed" | "cancelled";

export interface PurchaseRequest {
  id: string;
  orgId: string;
  prNumber: string;
  status: PRStatus;
  requestedBy: string;
  vesselId?: string | null;
  requiredByDate?: Date | string | null;
  deliveryLocation?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PRItem {
  id: string;
  purchaseRequestId: string;
  partId: string;
  supplierId?: string | null;
  quantity: number;
  uom?: string | null;
  remarks?: string | null;
  partName?: string;
  partNumber?: string;
  supplierName?: string;
}

export interface PRWithItems extends PurchaseRequest {
  items: PRItem[];
  events?: Array<{ eventType: string; createdAt: string | Date; details?: Record<string, unknown> }>;
  linkedPO?: { id: string; orderNumber: string; status: string; totalAmount?: number; expectedDate?: string | Date | null } | null;
  sentAt?: string | Date | null;
  closedAt?: string | Date | null;
}

export interface PRSendResult {
  prId: string;
  purchaseOrders: { poId: string; supplierId: string; supplierName: string }[];
  emailsQueued: number;
}

export interface PRFormData {
  requestedBy: string;
  vesselId?: string;
  requiredByDate?: Date;
  deliveryLocation?: string;
  notes?: string;
}

export interface PRItemFormData {
  partId: string;
  supplierId?: string;
  quantity: number;
  uom?: string;
  remarks?: string;
}

export interface PRFilters {
  status?: PRStatus;
  vesselId?: string;
  requestedBy?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export const PR_STATUS_LABELS: Record<PRStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const PR_STATUS_COLORS: Record<PRStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  closed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};
