import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  CrewMemberRecord as CrewMember,
  CrewCertification,
  CrewLeave,
  CrewAssignment,
  ShiftTemplate,
  CrewRestDay,
} from "../types";

export const crewKeys = {
  all: ["/api/crew"] as const,
  list: () => [...crewKeys.all] as const,
  detail: (id: string) => [...crewKeys.all, id] as const,
  certifications: (crewId: string) => [...crewKeys.all, crewId, "certifications"] as const,
  leave: (crewId: string) => [...crewKeys.all, crewId, "leave"] as const,
  assignments: () => ["/api/crew/assignments"] as const,
  shifts: () => ["/api/shifts"] as const,
  restDays: (sheetId: string) => ["/api/stcw/rest/days", sheetId] as const,
};

export function useCrewList(vesselId?: string) {
  const filterKey = vesselId || "all";
  return useQuery<CrewMember[]>({
    queryKey: [...crewKeys.list(), filterKey],
    queryFn: () =>
      apiRequest<CrewMember[]>("GET", vesselId ? `/api/crew?vessel_id=${vesselId}` : "/api/crew"),
  });
}

export function useCrewMember(id: string | undefined) {
  return useQuery<CrewMember>({
    queryKey: crewKeys.detail(id || ""),
    queryFn: () => apiRequest<CrewMember>("GET", `/api/crew/${id}`),
    enabled: !!id,
  });
}

export function useCrewCertifications(crewId: string | undefined) {
  return useQuery<CrewCertification[]>({
    queryKey: crewKeys.certifications(crewId || ""),
    queryFn: () => apiRequest<CrewCertification[]>("GET", `/api/crew/${crewId}/certifications`),
    enabled: !!crewId,
  });
}

export function useCrewLeave(crewId: string | undefined) {
  return useQuery<CrewLeave[]>({
    queryKey: crewKeys.leave(crewId || ""),
    queryFn: () => apiRequest<CrewLeave[]>("GET", `/api/crew/${crewId}/leave`),
    enabled: !!crewId,
  });
}

export function useShiftTemplates() {
  return useQuery<ShiftTemplate[]>({
    queryKey: crewKeys.shifts(),
    queryFn: () => apiRequest<ShiftTemplate[]>("GET", "/api/shifts"),
  });
}

export function useCrewAssignments(date?: string) {
  return useQuery<CrewAssignment[]>({
    queryKey: [...crewKeys.assignments(), date],
    queryFn: () =>
      apiRequest<CrewAssignment[]>("GET", `/api/crew/assignments${date ? `?date=${date}` : ""}`),
  });
}

export function useRestDays(sheetId: string | undefined) {
  return useQuery<CrewRestDay[]>({
    queryKey: crewKeys.restDays(sheetId || ""),
    queryFn: () => apiRequest<CrewRestDay[]>("GET", `/api/stcw/rest/days?sheetId=${sheetId}`),
    enabled: !!sheetId,
  });
}

export function useCreateCrew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CrewMember, "id" | "createdAt" | "updatedAt">) => {
      return apiRequest("POST", "/api/crew", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crewKeys.all });
    },
  });
}

export function useUpdateCrew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CrewMember> & { id: string }) => {
      return apiRequest("PATCH", `/api/crew/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: crewKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: crewKeys.list() });
    },
  });
}

export function useCreateLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CrewLeave, "id">) => {
      return apiRequest("POST", "/api/crew/leave", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: crewKeys.leave(variables.crewId) });
    },
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CrewAssignment, "id">) => {
      return apiRequest("POST", "/api/crew/assignments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crewKeys.assignments() });
    },
  });
}

export function useSaveRestDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CrewRestDay) => {
      return apiRequest("PUT", `/api/stcw/rest/days/${data.id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: crewKeys.restDays(variables.sheetId) });
    },
  });
}
