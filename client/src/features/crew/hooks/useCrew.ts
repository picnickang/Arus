import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CrewMemberRecord as CrewMember, ShiftTemplate } from "../types";

const crewKeys = {
  all: ["/api/crew"] as const,
  list: () => [...crewKeys.all] as const,
  shifts: () => ["/api/shifts"] as const,
};

export function useCrewList(vesselId?: string) {
  const filterKey = vesselId || "all";
  return useQuery<CrewMember[]>({
    queryKey: [...crewKeys.list(), filterKey],
    queryFn: () =>
      apiRequest<CrewMember[]>("GET", vesselId ? `/api/crew?vessel_id=${vesselId}` : "/api/crew"),
  });
}

export function useShiftTemplates() {
  return useQuery<ShiftTemplate[]>({
    queryKey: crewKeys.shifts(),
    queryFn: () => apiRequest<ShiftTemplate[]>("GET", "/api/shifts"),
  });
}
