import { isSameDay, isPast } from "date-fns";

export interface ScheduleFilters {
  search: string;
  equipmentType: string;
  status: string;
  priority: string;
}

export function createDefaultScheduleFilters(): ScheduleFilters {
  return {
    search: "",
    equipmentType: "all",
    status: "all",
    priority: "all",
  };
}

export function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1:
      return "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30";
    case 2:
      return "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case 3:
      return "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30";
    default:
      return "bg-gray-500/10 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30";
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
    case 4:
      return "Low";
    default:
      return "Unknown";
  }
}

export function getStatusBadgeVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "overdue":
      return "destructive";
    case "due":
      return "default";
    case "upcoming":
      return "secondary";
    default:
      return "outline";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "overdue":
      return "Overdue";
    case "due":
      return "Due";
    case "upcoming":
      return "Upcoming";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}

export function calculateScheduleStatus(scheduledDate: Date): "overdue" | "due" | "upcoming" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const schedDate = new Date(scheduledDate);
  schedDate.setHours(0, 0, 0, 0);

  if (isPast(schedDate) && !isSameDay(schedDate, today)) {
    return "overdue";
  }

  if (isSameDay(schedDate, today)) {
    return "due";
  }
  return "upcoming";
}

export function filterSchedules<T extends { 
  equipmentId: string; 
  status?: string; 
  priority?: number;
  title?: string;
  description?: string;
}>(
  schedules: T[],
  filters: ScheduleFilters,
  getEquipmentName: (id: string) => string
): T[] {
  return schedules.filter((schedule) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const equipmentName = getEquipmentName(schedule.equipmentId).toLowerCase();
      const title = (schedule.title || "").toLowerCase();
      const description = (schedule.description || "").toLowerCase();
      if (
        !equipmentName.includes(searchLower) &&
        !title.includes(searchLower) &&
        !description.includes(searchLower)
      ) {
        return false;
      }
    }

    if (filters.status !== "all" && schedule.status !== filters.status) {
      return false;
    }

    if (filters.priority !== "all" && String(schedule.priority) !== filters.priority) {
      return false;
    }

    return true;
  });
}

export function countActiveFilters(filters: ScheduleFilters): number {
  let count = 0;
  if (filters.search) {
    count++;
  }

  if (filters.equipmentType !== "all") {
    count++;
  }

  if (filters.status !== "all") {
    count++;
  }

  if (filters.priority !== "all") {
    count++;
  }
  return count;
}

export const PRIORITY_OPTIONS = [
  { value: "1", label: "Critical" },
  { value: "2", label: "High" },
  { value: "3", label: "Medium" },
  { value: "4", label: "Low" },
] as const;

export const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;
