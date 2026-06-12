import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MaintenanceSchedule } from "../types";

const maintenanceKeys = {
  schedules: () => [...maintenanceKeys.all, "schedules"] as const,
  upcoming: (days: number) => [...maintenanceKeys.schedules(), "upcoming", days] as const,
  all: ["/api/maintenance"] as const,
};

export function useMaintenanceSchedules(equipmentId?: string) {
  return useQuery<MaintenanceSchedule[]>({
    queryKey: [...maintenanceKeys.schedules(), equipmentId ?? "all"],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/maintenance-schedules${equipmentId ? `?equipmentId=${equipmentId}` : ""}`
      ),
  });
}

export function useUpcomingMaintenance(days: number = 7) {
  return useQuery<MaintenanceSchedule[]>({
    queryKey: maintenanceKeys.upcoming(days),
    queryFn: () =>
      apiRequest<MaintenanceSchedule[]>("GET", `/api/maintenance-schedules/upcoming?days=${days}`),
  });
}
