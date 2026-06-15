import type { WorkOrder } from "@shared/schema";

export function getWorkOrderDuration(order: WorkOrder & { actualDuration?: number }): string {
  if (order.status === "completed") {
    if (typeof order.actualDuration === "number") {
      const m = order.actualDuration;
      const h = Math.floor(m / 60);
      const minutes = m % 60;
      return `${h}h ${minutes}m`;
    }
    const actualEndDate = (order as { actualEndDate?: Date | string | null }).actualEndDate;
    if (order.actualStartDate && actualEndDate) {
      const start = new Date(order.actualStartDate).getTime();
      const end = new Date(actualEndDate).getTime();
      const m = Math.max(0, Math.round((end - start) / (1000 * 60)));
      const h = Math.floor(m / 60);
      const minutes = m % 60;
      return `${h}h ${minutes}m`;
    }
  }
  if (order.actualStartDate && order.status !== "completed") {
    const start = new Date(order.actualStartDate).getTime();
    const now = Date.now();
    const m = Math.max(0, Math.round((now - start) / (1000 * 60)));
    const h = Math.floor(m / 60);
    const minutes = m % 60;
    return `${h}h ${minutes}m (in progress)`;
  }
  return "Not started";
}

export function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1:
      return "bg-destructive/20 text-destructive";
    case 2:
      return "bg-chart-2/20 text-chart-2";
    default:
      return "bg-chart-3/20 text-chart-3";
  }
}

export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1:
      return "Critical";
    case 2:
      return "High";
    case 3:
      return "Medium";
    default:
      return "Low";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-chart-3/20 text-chart-3";
    case "in_progress":
      return "bg-chart-2/20 text-chart-2";
    default:
      return "bg-muted/20 text-muted-foreground";
  }
}
