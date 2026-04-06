export type SRStatus = "pending_review" | "under_review" | "approved" | "converted" | "rejected";

export interface ServiceRequest {
  id: string;
  orgId?: string;
  workOrderId: string;
  serviceOrderId?: string | null;
  requestNumber: string;
  title: string;
  description?: string | null;
  urgency: "low" | "medium" | "high" | "critical";
  estimatedCost?: number | null;
  requestedBy: string;
  status: SRStatus;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  convertedAt?: string | null;
  workOrderNumber?: string | null;
  workOrderDescription?: string | null;
  equipmentName?: string | null;
  vesselName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SRFilters {
  status?: SRStatus;
  workOrderId?: string;
}

export const SR_STATUS_LABELS: Record<SRStatus, string> = {
  pending_review: "Pending Review",
  under_review: "Under Review",
  approved: "Approved",
  converted: "Converted to SO",
  rejected: "Rejected",
};

export const SR_STATUS_COLORS: Record<SRStatus, string> = {
  pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  under_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  converted: "bg-primary/20 text-primary",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export const SR_URGENCY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const SR_URGENCY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};
