export type SRStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface ServiceRequest {
  id: string;
  orgId: string;
  vesselId?: string;
  equipmentId?: string;
  title: string;
  description?: string;
  status: SRStatus;
  priority: "low" | "medium" | "high" | "critical";
  workOrderType: "service_request";
  probableCause?: string;
  actionTaken?: string;
  recurringDefect?: boolean;
  diagnosticDescription?: string;
  assistanceRequired?: string[];
  mocRequired?: boolean;
  mocApproved?: boolean;
  mocApprovedBy?: string;
  mocApprovedAt?: string;
  equipmentStatus?: string;
  certificateItems?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SRFilters {
  status?: SRStatus;
  priority?: string;
  vesselId?: string;
  equipmentId?: string;
  search?: string;
}

export const SR_STATUS_LABELS: Record<SRStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const SR_STATUS_COLORS: Record<SRStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export const SR_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const SR_PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};
