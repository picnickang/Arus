import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  MaintenanceSchedule,
  MaintenanceRecord,
  MaintenanceTemplate,
  MaintenanceTemplateItem,
  MaintenanceCost,
} from "../types";

export const maintenanceKeys = {
  all: ["/api/maintenance"] as const,
  schedules: () => [...maintenanceKeys.all, "schedules"] as const,
  upcoming: (days: number) => [...maintenanceKeys.schedules(), "upcoming", days] as const,
  records: (equipmentId?: string) => [...maintenanceKeys.all, "records", equipmentId] as const,
  templates: () => ["/api/maintenance-templates"] as const,
  templateItems: (templateId: string) =>
    [...maintenanceKeys.templates(), templateId, "items"] as const,
  costs: (workOrderId?: string) => [...maintenanceKeys.all, "costs", workOrderId] as const,
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

export function useMaintenanceRecords(equipmentId?: string) {
  return useQuery<MaintenanceRecord[]>({
    queryKey: maintenanceKeys.records(equipmentId ?? ""),
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/maintenance-records${equipmentId ? `?equipmentId=${equipmentId}` : ""}`
      ),
    enabled: !!equipmentId,
  });
}

export function useMaintenanceTemplates() {
  return useQuery<MaintenanceTemplate[]>({
    queryKey: maintenanceKeys.templates(),
    queryFn: () => apiRequest<MaintenanceTemplate[]>("GET", "/api/maintenance-templates"),
  });
}

export function useMaintenanceTemplateItems(templateId: string | undefined) {
  return useQuery<MaintenanceTemplateItem[]>({
    queryKey: maintenanceKeys.templateItems(templateId || ""),
    queryFn: () =>
      apiRequest<MaintenanceTemplateItem[]>(
        "GET",
        `/api/maintenance-templates/${templateId}/items`
      ),
    enabled: !!templateId,
  });
}

export function useMaintenanceCosts(workOrderId?: string) {
  return useQuery<MaintenanceCost[]>({
    queryKey: maintenanceKeys.costs(workOrderId ?? "all"),
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/maintenance-costs${workOrderId ? `?workOrderId=${workOrderId}` : ""}`
      ),
  });
}

export function useCreateMaintenanceSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<MaintenanceSchedule, "id" | "createdAt" | "updatedAt">) => {
      return apiRequest("POST", "/api/maintenance-schedules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.schedules() });
    },
  });
}

export function useUpdateMaintenanceSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<MaintenanceSchedule> & { id: string }) => {
      return apiRequest("PATCH", `/api/maintenance-schedules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.schedules() });
    },
  });
}

export function useCompleteMaintenanceSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scheduleId,
      completedBy,
      notes,
    }: {
      scheduleId: string;
      completedBy: string;
      notes?: string;
    }) => {
      return apiRequest("POST", `/api/maintenance-schedules/${scheduleId}/complete`, {
        completedBy,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
    },
  });
}

export function useCreateMaintenanceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<MaintenanceTemplate, "id" | "createdAt" | "updatedAt">) => {
      return apiRequest("POST", "/api/maintenance-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.templates() });
    },
  });
}

export function useCloneMaintenanceTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("POST", `/api/maintenance-templates/${templateId}/clone`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.templates() });
    },
  });
}

export function useAddMaintenanceTemplateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, ...data }: Omit<MaintenanceTemplateItem, "id">) => {
      return apiRequest("POST", `/api/maintenance-templates/${templateId}/items`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.templateItems(variables.templateId),
      });
    },
  });
}
