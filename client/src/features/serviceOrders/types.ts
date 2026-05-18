export type SOStatus = "draft" | "sent" | "confirmed" | "in_progress" | "completed" | "cancelled";
export type SOType = "service" | "replacement_quote";
export type SOUrgency = "routine" | "urgent" | "critical";

export interface ServiceOrder {
  id: string;
  orgId: string;
  workOrderId: string;
  serviceProviderId: string;
  soNumber: string;
  status: SOStatus;
  serviceType: SOType;
  scheduledStartDate?: Date | string | null;
  scheduledEndDate?: Date | string | null;
  actualStartDate?: Date | string | null;
  actualEndDate?: Date | string | null;
  estimatedDurationHours?: number | null;
  actualDurationHours?: number | null;
  scope?: string | null;
  serviceDetails?: string | null;
  specialRequirements?: string | null;
  quotedAmount?: number | null;
  actualAmount?: number | null;
  currency?: string | null;
  cancelledAt?: Date | string | null;
  cancellationReason?: string | null;
  sentAt?: Date | string | null;
  confirmedAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  workOrderNumber?: string;
  workOrderDescription?: string;
  serviceProviderName?: string;
  serviceProviderEmail?: string;
  vesselName?: string;
  equipmentName?: string;
  urgency?: SOUrgency | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  downtimeWindowStart?: Date | string | null;
  downtimeWindowEnd?: Date | string | null;
  justification?: string | null;
  responseDeadline?: Date | string | null;
  originatingRequestId?: string | null;
  originatingRequestNumber?: string | null;
  originatingRequestStatus?: string | null;
}

export interface SOEvent {
  id: string;
  orgId: string;
  soId: string;
  eventType: string;
  userId?: string;
  details?: Record<string, unknown>;
  createdAt: Date | string;
}

export interface SOFilters {
  status?: SOStatus;
  serviceProviderId?: string;
  workOrderId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const SO_STATUS_LABELS: Record<SOStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const SO_STATUS_COLORS: Record<SOStatus, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  confirmed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const SO_STATUS_TRANSITIONS: Record<SOStatus, SOStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const SO_TYPE_LABELS: Record<SOType, string> = {
  service: "Service Request",
  replacement_quote: "Replacement Quote",
};

export const SO_TYPE_COLORS: Record<SOType, string> = {
  service: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  replacement_quote: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export const SO_URGENCY_LABELS: Record<SOUrgency, string> = {
  routine: "Routine",
  urgent: "Urgent",
  critical: "Critical",
};

export const SO_URGENCY_COLORS: Record<SOUrgency, string> = {
  routine: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  urgent: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
